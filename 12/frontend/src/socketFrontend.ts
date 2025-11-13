//frontend/src/socketFrontend.ts
import { io, Socket } from "socket.io-client";

export interface User {
  userId: string;
  username: string;
  avatar: string;
  online?: boolean;
}

export const SOCKET_URL =
  (import.meta as any).env?.VITE_SOCKET_URL ?? "https://localhost:8443";

// Один единственный сокет на всё приложение
let socket: Socket | null = null;

export function makeSocket() {
  if (socket) {
    console.log("⚠️ makeSocket() called again — reusing existing socket");
    return socket;
  }

  console.log("🔥 Initializing NEW socket connection...");

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    upgrade: true,
    secure: true,
    rejectUnauthorized: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    const transport = (socket!.io.engine as any)?.transport?.name || "unknown";
    console.log(`✅ Connected: ${socket!.id}`);
    console.log(`   Transport: ${transport}`);

    socket!.io.engine.on("upgrade", () => {
      const newTransport =
        (socket!.io.engine as any)?.transport?.name || "unknown";
      console.log(`⬆️ Upgraded to: ${newTransport}`);
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ connect_error:", error.message);
  });

  return socket;
}

export function joinAs(sock: Socket, user: User) {
  sock.emit("user_join", user);
}
