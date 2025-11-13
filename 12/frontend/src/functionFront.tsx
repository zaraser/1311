// src/functionFront.tsx
import type { Socket } from "socket.io-client";
import type { User, Message, Friend } from "./types";
import React from "react";

interface UseAppFunctionsProps {
  currentUser: User | null;
  socket: Socket; // Socket всегда существует (singleton)
  selectedUser: User | null;
  messageInput: string;
  blockedUsers: string[];

  setCurrentUser: (u: User | null) => void;
  setShowLogin: (v: boolean) => void;
  setFriends: (f: Friend[]) => void;
  setIncomingRequests: (f: Friend[]) => void;
  setOutgoingRequests: React.Dispatch<React.SetStateAction<Friend[]>>;
  setMessagesByUser: React.Dispatch<
    React.SetStateAction<Record<string, Message[]>>
  >;
  setUnreadMessages: React.Dispatch<React.SetStateAction<Set<string>>>;
  setMessageInput: (v: string) => void;
  setSystemMessage: (msg: string) => void;
  setBlockedUsers: React.Dispatch<React.SetStateAction<string[]>>;
  setBlockedByUsers: (ids: string[]) => void;
  setIncomingInvites: (v: any) => void;
  setIsInviteCooldown: (v: boolean) => void;
}

const API_BASE = "https://localhost:8443";

/**
 * Безопасный fetch с попыткой перейти на http при SSL-проблемах
 */
export async function safeFetch(
  url: string,
  options?: RequestInit
): Promise<Response | null> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return response;
  } catch (error: any) {
    if (
      url.includes("https://") &&
      (error?.message?.includes("certificate") ||
        error?.message?.includes("SSL") ||
        error?.message?.includes("Failed to fetch"))
    ) {
      const httpUrl = url.replace("https://", "http://");
      try {
        const response = await fetch(httpUrl, options);
        if (!response.ok) return null;
        return response;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export function useAppFunctions({
  currentUser,
  socket,
  selectedUser,
  messageInput,
  blockedUsers,

  setCurrentUser,
  setShowLogin,
  setFriends,
  setIncomingRequests,
  setOutgoingRequests,
  setMessagesByUser,
  setUnreadMessages,
  setMessageInput,
  setSystemMessage,
  setBlockedUsers,
  setBlockedByUsers,
  setIncomingInvites,
  setIsInviteCooldown,
}: UseAppFunctionsProps) {
  // === 🔐 ЛОГИН ===
  const handleLogin = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        alert("Ошибка при входе: сервер вернул ошибку");
        return;
      }

      const userData = await res.json();

      const user: User = {
        userId: userData.id || userData.userId || "",
        username: userData.username || "",
        avatar: userData.avatar || "👤",
        online: userData.online === 1 || userData.online === true,
      };

      if (!user.userId) {
        alert("Ошибка: не удалось получить ID пользователя");
        return;
      }

      setCurrentUser(user);
      setShowLogin(false);

      if (socket) {
        const sendJoin = () =>
          socket.emit("user_join", {
            userId: user.userId,
            username: user.username,
            avatar: user.avatar,
          });

        if (socket.connected) sendJoin();
        else socket.once("connect", sendJoin);
      }
    } catch {
      alert("Не удалось подключиться к серверу.");
    }
  };

  // === 🚪 ЛОГАУТ ===
  const handleLogout = () => {
    // Отправляем user_leave, но НЕ отключаем сокет (он singleton)
    if (currentUser) {
      socket.emit("user_leave", { userId: currentUser.userId });
    }
    setCurrentUser(null);
    setShowLogin(true);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setMessagesByUser({});
    setUnreadMessages(new Set());
  };

  // === 💬 ОТПРАВКА СООБЩЕНИЯ ===
  const sendMessage = async () => {
    if (!currentUser || !selectedUser) return;

    const content = messageInput.trim();
    if (!content) return;

    // Локальная проверка блокировки
    if (blockedUsers.includes(selectedUser.userId)) {
      setMessageInput("");
      setSystemMessage("Пользователь недоступен для сообщений 🚫");
      setTimeout(() => setSystemMessage(""), 3000);
      return;
    }

    const senderId = currentUser.userId;
    const receiverId = selectedUser.userId;
    if (!senderId || !receiverId) return;

    const requestBody = { senderId, receiverId, content };
    const originalInput = messageInput;
    setMessageInput("");

    try {
      const response = await safeFetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response) {
        setMessageInput(originalInput);
        setSystemMessage("Ошибка: сервер не ответил");
        setTimeout(() => setSystemMessage(""), 3000);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: "Unknown error",
        }));
        setMessageInput(originalInput);

        if (response.status === 403) {
          setSystemMessage("Пользователь недоступен для сообщений 🚫");
        } else {
          setSystemMessage(
            `Ошибка: ${errorData.error || response.statusText}`
          );
        }
        setTimeout(() => setSystemMessage(""), 3000);
        return;
      }

      // Само сообщение придет через socket "private_message"
    } catch {
      setMessageInput(originalInput);
      setSystemMessage("Ошибка при отправке сообщения");
      setTimeout(() => setSystemMessage(""), 3000);
    }
  };

  // === 👥 ДРУЗЬЯ ===
  const loadFriendsData = async () => {
    if (!currentUser) return;
    try {
      const res = await apiFetch(
        `${API_BASE}/api/friends/${currentUser.userId}`
      );
      const data = await res.json();
      
      // Маппинг данных из API формата {id, username, avatar} в Friend формат
      const mapToFriend = (users: any[]): Friend[] => {
        return (users || []).map((u: any) => ({
          friend_id: u.id || u.userId || u.friend_id,
          friend_name: u.username || u.friend_name || "",
          avatar: u.avatar || "👤",
          status: u.status || "accepted",
        }));
      };

      setFriends(mapToFriend(data.accepted || []));
      setIncomingRequests(mapToFriend(data.incoming || []).map(f => ({ ...f, status: "pending" })));
      setOutgoingRequests(mapToFriend(data.outgoing || []).map(f => ({ ...f, status: "pending" })));
    } catch (error) {
      console.error("Ошибка загрузки друзей:", error);
      // Можно добавить systemMessage при желании
    }
  };

  const addFriend = async (
    friendId: string,
    friendUsername?: string,
    friendAvatar?: string
  ) => {
    if (!currentUser) return;

    // Оптимистично добавляем в исходящие, если ещё нет
    setOutgoingRequests((prev) => {
      if (prev.some((r) => r.friend_id === friendId)) return prev;
      return [
        ...prev,
        {
          friend_id: friendId,
          friend_name: friendUsername || "",
          avatar: friendAvatar || "👤",
          status: "pending",
        },
      ];
    });

    try {
      const response = await apiFetch(`${API_BASE}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.userId, friendId }),
      });

      if (!response) {
        // Откатываем оптимистичное обновление при ошибке
        setOutgoingRequests((prev) =>
          prev.filter((r) => r.friend_id !== friendId)
        );
      } else {
        // Обновляем данные после успешного запроса
        // Это гарантирует синхронизацию с сервером
        setTimeout(() => {
          loadFriendsData();
        }, 200); // Небольшая задержка для обработки на сервере
      }
      // Также обновится через сокет события
    } catch (error) {
      console.error("Ошибка добавления в друзья:", error);
      // Откатываем оптимистичное обновление при ошибке
      setOutgoingRequests((prev) =>
        prev.filter((r) => r.friend_id !== friendId)
      );
    }
  };

  const acceptFriend = async (friendId: string) => {
    if (!currentUser) return;
    await apiFetch(`${API_BASE}/api/friends/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.userId, friendId }),
    });
    loadFriendsData();
  };

  const deleteFriendRelation = async (friendId: string) => {
    if (!currentUser) return;
    await apiFetch(`${API_BASE}/api/friends`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.userId, friendId }),
    });
    loadFriendsData();
  };

  const removeFriend = deleteFriendRelation;
  const declineFriendRequest = deleteFriendRelation;
  const cancelFriendRequest = deleteFriendRelation;

  // === 🚫 БЛОКИРОВКА ===
  const blockUser = async (userId: string) => {
    if (!currentUser) return;
    await apiFetch(`${API_BASE}/api/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerId: currentUser.userId, blockedId: userId }),
    });

    const res = await safeFetch(`${API_BASE}/api/blocks/${currentUser.userId}`);
    if (res) {
      const data = await res.json();
      const list = (data.blocked || []).map(
        (b: { blockedId?: string; blocked_id?: string }) =>
          b.blockedId ?? b.blocked_id
      );
      setBlockedUsers(list);
      const blockedByList = (data.blockedBy || []).map(
        (b: { blockerId?: string; blocker_id?: string }) =>
          b.blockerId ?? b.blocker_id
      );
      setBlockedByUsers(blockedByList);
    } else {
      setBlockedUsers([...blockedUsers, userId]);
    }
  };

  const unblockUser = async (userId: string) => {
    if (!currentUser) return;

    // оптимистично
    setBlockedUsers((prev) => prev.filter((id) => id !== userId));

    try {
      await apiFetch(`${API_BASE}/api/block`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockerId: currentUser.userId,
          blockedId: userId,
        }),
      });

      const res = await safeFetch(
        `${API_BASE}/api/blocks/${currentUser.userId}`
      );
      if (res) {
        const data = await res.json();
        const list = (data.blocked || []).map(
          (b: { blockedId?: string; blocked_id?: string }) =>
            b.blockedId ?? b.blocked_id
        );
        setBlockedUsers(list);
        const blockedByList = (data.blockedBy || []).map(
          (b: { blockerId?: string; blocker_id?: string }) =>
            b.blockerId ?? b.blocker_id
        );
        setBlockedByUsers(blockedByList);
      }
    } catch {
      setBlockedUsers((prev) => [...prev, userId]);
    }
  };

  // === 🎮 ПРИГЛАШЕНИЯ В ИГРУ ===
  // ВАЖНО: состояние инвайтов теперь полностью обновляется через App.tsx
  const sendGameInvite = (user: User) => {
    if (!currentUser || !socket) return;

    socket.emit("game_invite", {
      inviterId: currentUser.userId,
      inviteeId: user.userId,
    });

    fetch(`${API_BASE}/api/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviterId: currentUser.userId,
        inviteeId: user.userId,
      }),
    }).catch(() => {});

    setIsInviteCooldown(true);
    setTimeout(() => setIsInviteCooldown(false), 5000);
  };

  const cancelGameInvite = (userId: string) => {
    if (!currentUser || !socket) return;

    socket.emit("game_invite_cancel", {
      inviterId: currentUser.userId,
      inviteeId: userId,
    });

    fetch(`${API_BASE}/api/invite/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviterId: currentUser.userId,
        inviteeId: userId,
        accepted: false,
      }),
    }).catch(() => {});
  };

  // === ✉️ НЕПРОЧИТАННЫЕ ===
  const clearUnreadMessages = (userId: string) => {
    setUnreadMessages((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  return {
    handleLogin,
    handleLogout,
    sendMessage,
    loadFriendsData,
    addFriend,
    acceptFriend,
    removeFriend,
    declineFriendRequest,
    cancelFriendRequest,
    blockUser,
    unblockUser,
    sendGameInvite,
    cancelGameInvite,
    clearUnreadMessages,
  };
}
