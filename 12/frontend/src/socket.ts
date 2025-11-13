// frontend/src/socket.ts
// Singleton socket — создаётся один раз на всё приложение

import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  (import.meta as any).env?.VITE_SOCKET_URL ?? "https://localhost:8443";

// --- создаём единственный экземпляр ---
export const socket: Socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  upgrade: true,
  secure: true,
  rejectUnauthorized: false,   // самоподписанные сертификаты
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

// --- логирование подключения ---
socket.on("connect", () => {
  const transport = (socket.io.engine as any)?.transport?.name || "unknown";
  console.log(`✅ Socket connected: ${socket.id}`);
  console.log(`   Transport: ${transport}`);
});

// --- логирование отключений ---
socket.on("disconnect", (reason) => {
  console.log("❌ Socket disconnected:", reason);
});

// --- ошибки подключения ---
socket.on("connect_error", (error) => {
  console.error("❌ Socket connection error:", error.message);
});

// --- ловим upgrade (Chrome/Firefox/Safari) ---
socket.io.on("upgrade", () => {
  const transport = (socket.io.engine as any)?.transport?.name || "unknown";
  console.log(`⬆️ Socket upgraded to: ${transport}`);
});

// Дублируем для edge-cases Chrome
socket.io.engine?.on("upgrade", () => {
  const transport = (socket.io.engine as any)?.transport?.name || "unknown";
  console.log(`⬆️ Socket upgraded to: ${transport}`);
});

// --- helper: отправка user_join ---
export function joinAs(user: { userId: string; username: string; avatar: string }) {
  socket.emit("user_join", user);
}
