import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { userQueries, messageQueries, blockQueries, friendQueries, inviteQueries, matchQueries, } from "./db.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --------------------------------------------------------------
// 🔧 Utility for broadcasting events only to specific users
// --------------------------------------------------------------
function broadcastToUsers(io, connected, userIds, event, payload) {
    for (const [socketId, user] of connected.entries()) {
        if (userIds.includes(user.userId)) {
            io.to(socketId).emit(event, payload);
        }
    }
}
async function startServer() {
    const fastify = Fastify();
    // CORS
    await fastify.register(fastifyCors, {
        origin: "*",
        methods: ["GET", "POST", "DELETE"],
    });
    // Static (React build)
    // В Docker: __dirname = /app/dist, поэтому путь к public: /app/dist/../public = /app/public
    const staticRoot = path.join(__dirname, "..", "public");
    await fastify.register(fastifyStatic, {
        root: staticRoot,
        prefix: "/",
    });
    // Active socket connections
    const connectedUsers = new Map();
    let io;
    // --------------------------------------------------------------
    // 🧩 REST API
    // --------------------------------------------------------------
    // USERS
    fastify.get("/api/users", async () => ({ users: userQueries.getAll.all() }));
    fastify.post("/api/users", async (req, reply) => {
        const { username, avatar = "👤" } = req.body;
        if (!username)
            return reply.code(400).send({ error: "Missing username" });
        const existing = userQueries.getByUsername.get(username);
        if (existing) {
            return {
                id: existing.id,
                username: existing.username,
                avatar: existing.avatar ?? "👤",
            };
        }
        const id = `user-${Date.now()}`;
        userQueries.create.run(id, username, avatar);
        return { id, username, avatar };
    });
    // MESSAGES
    fastify.get("/api/messages/:userId/:peerId", async (req) => {
        const { userId, peerId } = req.params;
        const blocked = blockQueries.check.get(userId, peerId) ||
            blockQueries.check.get(peerId, userId);
        if (blocked)
            return { messages: [] };
        const messages = messageQueries.getConversation.all(userId, peerId, peerId, userId);
        return { messages };
    });
    fastify.post("/api/messages", async (req, reply) => {
        const { senderId, receiverId, content } = req.body;
        if (!senderId || !receiverId || !content)
            return reply.code(400).send({ error: "Missing fields" });
        const blocked = blockQueries.check.get(senderId, receiverId) ||
            blockQueries.check.get(receiverId, senderId);
        if (blocked)
            return reply.code(403).send({ error: "User blocked" });
        const timestamp = new Date().toISOString();
        try {
            messageQueries.insert.run(senderId, receiverId, content);
            const msg = { senderId, receiverId, content, timestamp };
            if (io) {
                broadcastToUsers(io, connectedUsers, [senderId, receiverId], "private_message", msg);
            }
            return { success: true, message: msg };
        }
        catch {
            return reply.code(500).send({ error: "DB insert failed" });
        }
    });
    // BLOCKS
    fastify.post("/api/block", async (req) => {
        const { blockerId, blockedId } = req.body;
        blockQueries.add.run(blockerId, blockedId);
        if (io) {
            broadcastToUsers(io, connectedUsers, [blockerId, blockedId], "user_blocked", { fromUserId: blockerId });
        }
        return { success: true };
    });
    fastify.delete("/api/block", async (req) => {
        const { blockerId, blockedId } = req.body;
        blockQueries.remove.run(blockerId, blockedId);
        if (io) {
            broadcastToUsers(io, connectedUsers, [blockerId, blockedId], "user_unblocked", { fromUserId: blockerId });
        }
        return { success: true };
    });
    fastify.get("/api/blocks/:userId", async (req) => {
        const { userId } = req.params;
        return {
            blocked: blockQueries.listByUser.all(userId),
            blockedBy: blockQueries.listBlockedBy.all(userId),
        };
    });
    // FRIENDS
    fastify.get("/api/friends/:userId", async (req) => {
        const { userId } = req.params;
        return {
            accepted: friendQueries.getFriends.all(userId),
            incoming: friendQueries.getIncoming.all(userId),
            outgoing: friendQueries.getOutgoing.all(userId),
        };
    });
    fastify.post("/api/friends/request", async (req) => {
        const { userId, friendId } = req.body;
        friendQueries.createRequest.run(userId, friendId);
        if (io) {
            broadcastToUsers(io, connectedUsers, [friendId], "friend_request", {
                fromUserId: userId,
            });
            broadcastToUsers(io, connectedUsers, [userId], "friend_request_created", {
                userId,
                friendId,
            });
        }
        return { success: true };
    });
    fastify.post("/api/friends/accept", async (req) => {
        const { userId, friendId } = req.body;
        friendQueries.upsertAccepted.run(userId, friendId);
        friendQueries.upsertAccepted.run(friendId, userId);
        if (io) {
            broadcastToUsers(io, connectedUsers, [friendId], "friend_accepted", {
                fromUserId: userId,
            });
        }
        return { success: true };
    });
    fastify.delete("/api/friends", async (req) => {
        const { userId, friendId } = req.body;
        friendQueries.deleteRelation.run(userId, friendId);
        friendQueries.deleteRelation.run(friendId, userId);
        if (io) {
            broadcastToUsers(io, connectedUsers, [friendId], "friend_removed", {
                fromUserId: userId,
            });
        }
        return { success: true };
    });
    // GAME INVITES (REST)
    fastify.post("/api/invite", async (req) => {
        const { inviterId, inviteeId } = req.body;
        const exists = inviteQueries.outgoing
            .all(inviterId)
            .some((inv) => inv.userId === inviteeId);
        if (!exists)
            inviteQueries.create.run(inviterId, inviteeId);
        return { success: true };
    });
    fastify.post("/api/invite/response", async (req) => {
        const { inviterId, inviteeId, accepted } = req.body;
        if (accepted)
            inviteQueries.accept.run(inviterId, inviteeId);
        else
            inviteQueries.decline.run(inviterId, inviteeId);
        return { success: true };
    });
    fastify.get("/api/invite/incoming/:userId", async (req) => {
        const { userId } = req.params;
        return { incoming: inviteQueries.incoming.all(userId) };
    });
    fastify.get("/api/invite/outgoing/:userId", async (req) => {
        const { userId } = req.params;
        return { outgoing: inviteQueries.outgoing.all(userId) };
    });
    // MATCH HISTORY
    fastify.post("/api/matches", async (req) => {
        const { player1Id, player2Id, winnerId, score, matchType = "regular", gameType = "default", duration, } = req.body;
        if (!player1Id || !player2Id)
            return { error: "Missing player IDs" };
        matchQueries.create.run(player1Id, player2Id, winnerId || null, score || null, matchType, gameType, duration || null);
        return { success: true };
    });
    fastify.get("/api/matches/:userId", async (req) => {
        const { userId } = req.params;
        return { matches: matchQueries.getByUser.all(userId, userId) };
    });
    fastify.get("/api/matches/:userId/regular", async (req) => {
        const { userId } = req.params;
        return { matches: matchQueries.getRegular.all(userId, userId) };
    });
    fastify.get("/api/matches/:userId/tournament", async (req) => {
        const { userId } = req.params;
        return { matches: matchQueries.getTournament.all(userId, userId) };
    });
    fastify.get("/api/matches/:userId/stats", async (req) => {
        const { userId } = req.params;
        const stats = matchQueries.getStats.get(userId, userId, userId, userId, userId, userId, userId, userId);
        return {
            stats: stats || { totalMatches: 0, wins: 0, draws: 0, losses: 0 },
        };
    });
    // 🔔 Tournament notifications
    fastify.post("/api/tournament/notify", async (req) => {
        const { message, status } = req.body;
        if (io)
            io.emit("tournament_update", { message, status });
        return { success: true };
    });
    // FALLBACK
    // Для всех не-API запросов возвращаем index.html (для React Router)
    fastify.setNotFoundHandler((req, reply) => {
        if (!req.url.startsWith("/api")) {
            return reply.sendFile("index.html", staticRoot);
        }
        return reply.code(404).send({ error: "Not Found" });
    });
    // --------------------------------------------------------------
    // ⚡ SOCKET.IO
    // --------------------------------------------------------------
    const sslKeyPath = process.env.SSL_KEY_PATH ??
        path.join(__dirname, "..", "ssl", "key.pem");
    const sslCertPath = process.env.SSL_CERT_PATH ??
        path.join(__dirname, "..", "ssl", "cert.pem");
    const server = createServer({
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
    }, (req, res) => fastify.server.emit("request", req, res));
    await fastify.ready();
    io = new SocketIOServer(server, {
        cors: { origin: "*", methods: ["GET", "POST"] },
    });
    io.on("connection", (socket) => {
        socket.emit("online_users", Array.from(connectedUsers.values()));
        socket.on("user_join", ({ userId, username, avatar }) => {
            connectedUsers.set(socket.id, { userId, username, avatar });
            userQueries.updateOnline.run(1, userId);
            io.emit("online_users", Array.from(connectedUsers.values()));
        });
        socket.on("user_leave", ({ userId }) => {
            for (const [id, u] of connectedUsers) {
                if (u.userId === userId) {
                    connectedUsers.delete(id);
                    userQueries.updateOnline.run(0, userId);
                }
            }
            io.emit("online_users", Array.from(connectedUsers.values()));
            io.emit("user_offline", { userId });
        });
        socket.on("disconnect", () => {
            const user = connectedUsers.get(socket.id);
            if (user) {
                userQueries.updateOnline.run(0, user.userId);
                connectedUsers.delete(socket.id);
                io.emit("online_users", Array.from(connectedUsers.values()));
                io.emit("user_offline", { userId: user.userId });
            }
        });
        // GAME INVITES
        socket.on("game_invite", ({ inviterId, inviteeId }) => {
            inviteQueries.create.run(inviterId, inviteeId);
            broadcastToUsers(io, connectedUsers, [inviterId, inviteeId], "game_invite", {
                inviterId,
                inviteeId,
            });
        });
        socket.on("game_invite_cancel", ({ inviterId, inviteeId }) => {
            inviteQueries.cancel.run(inviterId, inviteeId);
            broadcastToUsers(io, connectedUsers, [inviterId, inviteeId], "game_invite_cancel", { inviterId, inviteeId });
        });
        socket.on("game_invite_response", ({ inviterId, inviteeId, accepted }) => {
            if (accepted)
                inviteQueries.accept.run(inviterId, inviteeId);
            else
                inviteQueries.decline.run(inviterId, inviteeId);
            broadcastToUsers(io, connectedUsers, [inviterId, inviteeId], "game_invite_response", { inviterId, inviteeId, accepted });
        });
    });
    // --------------------------------------------------------------
    // 🚀 START SERVER
    // --------------------------------------------------------------
    const PORT = parseInt(process.env.PORT || "8443", 10);
    server.listen(PORT, "0.0.0.0");
}
startServer().catch(console.error);
