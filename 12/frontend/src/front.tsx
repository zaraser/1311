// src/front.tsx
import React, { Dispatch, SetStateAction, useMemo } from "react";
import type { Socket } from "socket.io-client";
import type { Friend, Invite, Message, User, Match, MatchStats } from "./types";

interface FrontProps {
  showLogin: boolean;
  handleLogin: (username: string) => Promise<void>;

  currentUser: User | null;
  setCurrentUser?: (user: User | null) => void;
  allUsers: User[];
  onlineUsers: User[];

  messagesByUser: Record<string, Message[]>;
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;

  messageInput: string;
  setMessageInput: (value: string) => void;
  unreadMessages: Set<string>;
  systemMessage: string;

  friends: Friend[];
  incomingRequests: Friend[];
  outgoingRequests: Friend[];
  blockedUsers: string[];
  blockedByUsers: string[];

  isInviteCooldown: boolean;
  isInviteModalOpen: boolean;
  setInviteModalOpen: (open: boolean) => void;
  isFriendsModalOpen: boolean;
  setFriendsModalOpen: Dispatch<SetStateAction<boolean>>;
  incomingInvites: Invite[];
  setIncomingInvites: Dispatch<SetStateAction<Invite[]>>;
  outgoingInvites: Invite[];

  sendMessage: () => void;
  addFriend: (userId: string, username?: string, avatar?: string) => void;
  acceptFriend: (userId: string) => void;
  removeFriend: (userId: string) => void;
  declineFriendRequest: (userId: string) => void;
  cancelFriendRequest: (userId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  sendGameInvite: (user: User) => void;
  cancelGameInvite: (userId: string) => void;
  handleLogout: () => void;
  socket: Socket | null;

  showProfile?: boolean;
  showBlacklist?: boolean;
  showMatchHistory?: boolean;
  showTournamentMatches?: boolean;
  setShowProfile?: Dispatch<SetStateAction<boolean>>;
  setShowBlacklist?: Dispatch<SetStateAction<boolean>>;
  setShowMatchHistory?: Dispatch<SetStateAction<boolean>>;
  setShowTournamentMatches?: Dispatch<SetStateAction<boolean>>;
  matchStats?: MatchStats | null;
  regularMatches?: Match[];
  tournamentMatches?: Match[];
}

// ================================
// 🎮 Страница игры
// ================================
export const GamePage: React.FC = () => {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const opponentId = params.get("with") || "opponent";

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-900 text-slate-100">
      <h2 className="text-2xl font-semibold">
        🎮 Матч с <span className="font-bold text-emerald-400">{opponentId}</span>
      </h2>
      <button
        onClick={() => (window.location.href = "/")}
        className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow hover:bg-slate-200"
      >
        ⬅ Вернуться в чат
      </button>
    </div>
  );
};

// ================================
// 💬 Основной интерфейс чата
// ================================
const Front: React.FC<FrontProps> = ({
  showLogin,
  handleLogin,
  currentUser,
  allUsers,
  onlineUsers,
  messagesByUser,
  selectedUser,
  setSelectedUser,
  messageInput,
  setMessageInput,
  unreadMessages,
  systemMessage,
  friends,
  incomingRequests,
  outgoingRequests,
  blockedUsers,
  blockedByUsers,
  isInviteCooldown,
  isInviteModalOpen,
  setInviteModalOpen,
  isFriendsModalOpen,
  setFriendsModalOpen,
  incomingInvites,
  outgoingInvites,
  sendMessage,
  addFriend,
  acceptFriend,
  removeFriend,
  declineFriendRequest,
  cancelFriendRequest,
  blockUser,
  unblockUser,
  sendGameInvite,
  cancelGameInvite,
  handleLogout,
  socket,
  showProfile = false,
  showBlacklist = false,
  showMatchHistory = false,
  showTournamentMatches = false,
  setShowProfile,
  setShowBlacklist,
  setShowMatchHistory,
  setShowTournamentMatches,
  matchStats = null,
  regularMatches = [],
  tournamentMatches = [],
}) => {
  // === Экран логина ===
  if (showLogin) {
    const availableUsers = allUsers.length > 0 ? allUsers : [];

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white/10 p-6 shadow-xl backdrop-blur-lg">
          <h2 className="mb-4 text-center text-xl font-semibold text-white">
            Выберите пользователя
          </h2>

          {availableUsers.length === 0 ? (
            <p className="text-center text-sm text-slate-100/80">
              Загрузка пользователей…
            </p>
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {availableUsers.map((user) => {
                const isOnline = onlineUsers.some(
                  (u) => u.userId === user.userId
                );
                return (
                  <button
                    key={user.userId}
                    className="flex w-full items-center gap-3 rounded-xl bg-white/90 px-3 py-2 text-left text-sm shadow hover:bg-white"
                    onClick={async () => {
                      await handleLogin(user.username);
                    }}
                  >
                    <span className="text-2xl">{user.avatar || "👤"}</span>
                    <span className="flex-1 font-medium text-slate-800">
                      {user.username}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isOnline ? "bg-emerald-400" : "bg-slate-400"
                      }`}
                      title={isOnline ? "Онлайн" : "Офлайн"}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === Навигационные кнопки / модалки ===
  const hasPendingFriendRequests = incomingRequests.length > 0;
  const hasPendingGameInvites = incomingInvites.length > 0;

  const handleFriendsClick = () => setFriendsModalOpen(true);
  const handleBlacklistClick = () => setShowBlacklist && setShowBlacklist(true);
  const handleHistoryClick = () =>
    setShowMatchHistory && setShowMatchHistory(true);
  const handleTournamentClick = () =>
    setShowTournamentMatches && setShowTournamentMatches(true);
  const handleProfileClick = () => setShowProfile && setShowProfile(true);

  const topButtons = [
    {
      label: "👥 Друзья",
      onClick: handleFriendsClick,
      showBadge: hasPendingFriendRequests,
    },
    {
      label: "🚫 Чёрный список",
      onClick: handleBlacklistClick,
    },
    {
      label: "🎮 Игровые приглашения",
      onClick: () => setInviteModalOpen(true),
      showBadge: hasPendingGameInvites,
    },
    { label: "📜 История матчей", onClick: handleHistoryClick },
    { label: "🥇 Турнирные матчи", onClick: handleTournamentClick },
    { label: "👤 Профиль", onClick: handleProfileClick },
  ];

  // === Пользователи + статусы ===
  const usersWithStatus = useMemo(
    () =>
      allUsers.map((user) => ({
        ...user,
        online: onlineUsers.some((u) => u.userId === user.userId),
      })),
    [allUsers, onlineUsers]
  );

  const activeMessages = selectedUser
    ? messagesByUser[selectedUser.userId] || []
    : [];

  const acceptedFriends = friends.filter((f) => f.status === "accepted");
  const pendingIncoming = incomingRequests.filter(
    (f) => f.status === "pending"
  );
  const pendingOutgoing = outgoingRequests.filter(
    (f) => f.status === "pending"
  );

  // =============================
  // Рендер основного чата
  // =============================
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex h-screen w-full max-w-6xl flex-col px-2 py-3 sm:px-4">
        <div className="flex h-full gap-3 rounded-2xl bg-white/80 p-3 shadow-lg backdrop-blur">
          {/* === Левая навигация === */}
          <aside className="flex w-48 flex-col gap-2 border-r border-slate-200 pr-2">
            <div className="flex flex-col gap-2">
              {topButtons.map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.onClick}
                  className="relative flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <span className="flex-1 text-center">{btn.label}</span>
                  {btn.showBadge && (
                    <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-pink-500" />
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setInviteModalOpen(false);
                setFriendsModalOpen(false);
                handleLogout();
              }}
              className="mt-auto rounded-xl border border-red-100 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
            >
              Выйти
            </button>
          </aside>

          {/* === Список пользователей === */}
          <aside className="flex w-[17rem] flex-col gap-2 border-r border-slate-200 pr-2">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Пользователи</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                {usersWithStatus.length - (currentUser ? 1 : 0)}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {usersWithStatus
                .filter((user) => user.userId !== currentUser?.userId)
                .map((user) => {
                  const isFriend = friends.some(
                    (f) => f.friend_id === user.userId && f.status === "accepted"
                  );
                  const hasRequest = incomingRequests.some(
                    (r) =>
                      r.friend_id === user.userId && r.status === "pending"
                  );
                  const outgoingPending = outgoingRequests.some(
                    (r) =>
                      r.friend_id === user.userId && r.status === "pending"
                  );
                  const isBlocked = blockedUsers.includes(user.userId);
                  const hasOutgoingGameInvite = outgoingInvites.some(
                    (inv) => inv.userId === user.userId
                  );
                  const hasIncomingGameInvite = incomingInvites.some(
                    (inv) => inv.userId === user.userId
                  );

                  const friendButton = (() => {
                    if (hasRequest) return null;
                    if (isFriend) {
                      return {
                        label: "✖",
                        title: "Удалить из друзей",
                        className:
                          "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[15px] text-rose-600 hover:bg-rose-100",
                        handler: (e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          removeFriend(user.userId);
                        },
                      };
                    }
                    if (outgoingPending) {
                      return {
                        label: "⏳",
                        title: "Отменить заявку",
                        className:
                          "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-[15px] text-amber-700 hover:bg-amber-100",
                        handler: (e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          cancelFriendRequest(user.userId);
                        },
                      };
                    }
                    return {
                      label: "👥",
                      title: "Добавить в друзья",
                      className:
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[15px] text-indigo-600 hover:bg-indigo-100",
                      handler: (e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        addFriend(user.userId, user.username, user.avatar);
                      },
                    };
                  })();

                  return (
                    <div
                      key={user.userId}
                      onClick={() => setSelectedUser(user)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-2 py-1.5 text-xs transition ${
                        selectedUser?.userId === user.userId
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl">{user.avatar}</span>
                        <div className="flex flex-col">
                          <span className="max-w-[120px] truncate font-medium text-slate-800">
                            {user.username}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                user.online
                                  ? "bg-emerald-400"
                                  : "bg-slate-400"
                              }`}
                            />
                            {unreadMessages.has(user.userId) && (
                              <span className="ml-1 text-[10px] font-semibold text-amber-500">
                                • новое
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {friendButton && (
                          <button
                            type="button"
                            title={friendButton.title}
                            onClick={friendButton.handler}
                            className={friendButton.className}
                          >
                            {friendButton.label}
                          </button>
                        )}

                        {hasRequest && (
                          <>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[15px] text-emerald-700 hover:bg-emerald-100"
                              title="Принять заявку"
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptFriend(user.userId);
                              }}
                            >
                              ✅
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[15px] text-rose-600 hover:bg-rose-100"
                              title="Отклонить заявку"
                              onClick={(e) => {
                                e.stopPropagation();
                                declineFriendRequest(user.userId);
                              }}
                            >
                              ✖
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[15px] ${
                            isBlocked
                              ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                              : "bg-rose-50 text-rose-500 hover:bg-rose-100"
                          }`}
                          title={isBlocked ? "Разблокировать" : "Заблокировать"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isBlocked) unblockUser(user.userId);
                            else blockUser(user.userId);
                          }}
                        >
                          {isBlocked ? "🔓" : "🚫"}
                        </button>

                        {/* Игровые приглашения */}
                        {(() => {
                          if (hasOutgoingGameInvite) {
                            return (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-[15px] text-amber-700 hover:bg-amber-100"
                                title="Отменить приглашение"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelGameInvite(user.userId);
                                }}
                              >
                                ⏳
                              </button>
                            );
                          }
                          if (hasIncomingGameInvite) {
                            return (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[15px] text-emerald-700 hover:bg-emerald-100"
                                title="Принять приглашение"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (socket && currentUser) {
                                    socket.emit("game_invite_response", {
                                      inviterId: user.userId,
                                      inviteeId: currentUser.userId,
                                      accepted: true,
                                    });
                                  }
                                }}
                              >
                                🎮
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              disabled={isInviteCooldown}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[15px] ${
                                isInviteCooldown
                                  ? "cursor-not-allowed bg-slate-100 text-slate-300"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                              title="Игровое приглашение"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isInviteCooldown) {
                                  sendGameInvite(user);
                                }
                              }}
                            >
                              🎮
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
            </div>
          </aside>

          {/* === Основной чат === */}
          <section className="flex flex-1 flex-col rounded-xl bg-slate-50">
            {/* Header */}
            <div className="flex items-center justify-between rounded-t-xl bg-indigo-600 px-4 py-2 text-sm text-indigo-50">
              <div className="flex min-w-0 items-center gap-2">
                {selectedUser ? (
                  <>
                    <span className="text-2xl">{selectedUser.avatar}</span>
                    <span className="max-w-[200px] truncate font-semibold">
                      {selectedUser.username}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-indigo-100/80">
                    Выберите пользователя, чтобы начать чат
                  </span>
                )}
              </div>

              {selectedUser && currentUser && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-100/90">
                    Вы: {currentUser.username}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-indigo-300/60 bg-indigo-500/40 px-2 py-1 text-xs font-medium text-indigo-50 hover:bg-indigo-500/60"
                    title="Выйти"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Сообщения */}
            <div className="messages-area flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-2 text-sm">
              {activeMessages.map((message, i) => {
                const isOwn = message.senderId === currentUser?.userId;
                return (
                  <div
                    key={`${message.timestamp}-${i}`}
                    className={`flex w-full ${
                      isOwn ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
                        isOwn
                          ? "rounded-br-sm bg-emerald-100 text-slate-900"
                          : "rounded-bl-sm bg-white text-slate-900"
                      }`}
                    >
                      <div className="break-words">
                        {message.content}
                      </div>
                      <div className="mt-1 text-right text-[10px] text-slate-400">
                        {new Date(message.timestamp).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {systemMessage && (
                <div className="mt-2 flex justify-center">
                  <div className="w-full max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
                    {systemMessage}
                  </div>
                </div>
              )}
            </div>

            {/* Ввод сообщения */}
            {selectedUser && (
              <div className="border-t border-slate-200 bg-white p-2">
                {(() => {
                  const isBlockedByMe = blockedUsers.includes(
                    selectedUser.userId
                  );
                  const isBlockedByThem = blockedByUsers.includes(
                    selectedUser.userId
                  );

                  if (isBlockedByMe) {
                    return (
                      <div className="flex items-center gap-2">
                        <input
                          disabled
                          value=""
                          placeholder="Вы заблокировали пользователя"
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400"
                        />
                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                        >
                          Отправить
                        </button>
                      </div>
                    );
                  }

                  if (isBlockedByThem) {
                    return (
                      <div className="flex items-center gap-2">
                        <input
                          disabled
                          value=""
                          placeholder="Вы заблокированы"
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400"
                        />
                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                        >
                          Отправить
                        </button>
                      </div>
                    );
                  }

                  return (
                    <form
                      className="flex items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage();
                      }}
                    >
                      <textarea
                        value={messageInput}
                        onChange={(e) => {
                          setMessageInput(e.target.value);
                          // Автоматическое изменение высоты
                          const textarea = e.target;
                          textarea.style.height = "auto";
                          const newHeight = Math.min(textarea.scrollHeight, 128); // max-h-32 = 128px
                          textarea.style.height = `${newHeight}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Введите сообщение…"
                        rows={1}
                        className="max-h-32 min-h-[2.5rem] w-full flex-1 resize-none overflow-y-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring"
                        style={{
                          wordWrap: "break-word",
                          overflowWrap: "break-word",
                          whiteSpace: "pre-wrap",
                          height: "2.5rem",
                        }}
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                      >
                        Отправить
                      </button>
                    </form>
                  );
                })()}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* === Модалки === */}

      {/* Друзья */}
      {isFriendsModalOpen && (
        <Modal onClose={() => setFriendsModalOpen(false)} title="👥 Список друзей">
          <section className="space-y-4 text-sm">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">
                Мои друзья
              </h4>
              {acceptedFriends.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Пока нет добавленных друзей.
                </p>
              ) : (
                <ul className="space-y-2">
                  {acceptedFriends.map((friend) => (
                    <li
                      key={friend.friend_id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-lg">
                          {friend.avatar || "👤"}
                        </span>
                        <strong>{friend.friend_name}</strong>
                      </span>
                      <button
                        onClick={() => removeFriend(friend.friend_id)}
                        className="rounded-lg bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100"
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">
                Входящие заявки
              </h4>
              {pendingIncoming.length === 0 ? (
                <p className="text-xs text-slate-500">Новых заявок нет.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingIncoming.map((request) => (
                    <li
                      key={`incoming-${request.friend_id}`}
                      className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-lg">
                          {request.avatar || "👤"}
                        </span>
                        <strong>{request.friend_name}</strong>
                      </span>
                      <span className="flex gap-2">
                        <button
                          onClick={() => acceptFriend(request.friend_id)}
                          className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                        >
                          Принять
                        </button>
                        <button
                          onClick={() => declineFriendRequest(request.friend_id)}
                          className="rounded-lg bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-200"
                        >
                          Отклонить
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">
                Исходящие заявки
              </h4>
              {pendingOutgoing.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Вы не отправляли заявки.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pendingOutgoing.map((request) => (
                    <li
                      key={`outgoing-${request.friend_id}`}
                      className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-lg">
                          {request.avatar || "👤"}
                        </span>
                        <strong>{request.friend_name}</strong>
                      </span>
                      <button
                        onClick={() => cancelFriendRequest(request.friend_id)}
                        className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-indigo-600 shadow hover:bg-slate-50"
                      >
                        Отменить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </Modal>
      )}

      {/* Приглашения в игру */}
      {isInviteModalOpen && (
        <Modal
          onClose={() => setInviteModalOpen(false)}
          title="🎮 Игровые приглашения"
        >
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">
                Входящие
              </h4>
              {incomingInvites.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Новых приглашений нет.
                </p>
              ) : (
                <ul className="space-y-2">
                  {incomingInvites.map((invite) => (
                    <li
                      key={invite.userId}
                      className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2"
                    >
                      <span>
                        {invite.username || invite.userId}
                      </span>
                      <span className="flex gap-2">
                        <button
                          onClick={() => {
                            if (socket && currentUser) {
                              socket.emit("game_invite_response", {
                                inviterId: invite.userId,
                                inviteeId: currentUser.userId,
                                accepted: true,
                              });
                            }
                          }}
                          className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                        >
                          ✅
                        </button>
                        <button
                          onClick={() => {
                            if (socket && currentUser) {
                              socket.emit("game_invite_response", {
                                inviterId: invite.userId,
                                inviteeId: currentUser.userId,
                                accepted: false,
                              });
                            }
                          }}
                          className="rounded-lg bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-200"
                        >
                          ❌
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">
                Исходящие
              </h4>
              {outgoingInvites.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Вы не отправляли приглашения.
                </p>
              ) : (
                <ul className="space-y-2">
                  {outgoingInvites.map((invite, index) => (
                    <li
                      key={`outgoing-${invite.userId}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span>{invite.username || invite.userId}</span>
                      <button
                        onClick={() => cancelGameInvite(invite.userId)}
                        className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow hover:bg-slate-50"
                      >
                        Отменить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Профиль */}
      {showProfile && (
        <Modal
          onClose={() => setShowProfile && setShowProfile(false)}
          title="👤 Профиль пользователя"
        >
          {currentUser ? (
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <p>
                  <span className="font-semibold">Имя:</span>{" "}
                  {currentUser.username}
                </p>
                <p>
                  <span className="font-semibold">ID:</span>{" "}
                  {currentUser.userId}
                </p>
                <p>
                  <span className="font-semibold">Аватар:</span>{" "}
                  {currentUser.avatar || "👤"}
                </p>
              </div>

              {matchStats && (
                <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h4 className="text-xs font-semibold uppercase text-slate-500">
                    📊 Статистика матчей
                  </h4>
                  <p>Всего матчей: {matchStats.totalMatches}</p>
                  <p>Побед: {matchStats.wins}</p>
                  <p>Поражений: {matchStats.losses}</p>
                  <p>Ничьих: {matchStats.draws}</p>
                  {matchStats.totalMatches > 0 && (
                    <p>
                      Винрейт:{" "}
                      {Math.round(
                        (matchStats.wins / matchStats.totalMatches) * 100
                      )}
                      %
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Нет данных о пользователе</p>
          )}
        </Modal>
      )}

      {/* Чёрный список */}
      {showBlacklist && (
        <Modal
          onClose={() => setShowBlacklist && setShowBlacklist(false)}
          title="🚫 Чёрный список"
        >
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-slate-500">
              Пока нет заблокированных пользователей.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {blockedUsers.map((blockedId) => {
                const blockedUser = allUsers.find(
                  (u) => u.userId === blockedId
                );
                return (
                  <li
                    key={blockedId}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">
                        {blockedUser?.avatar || "👤"}
                      </span>
                      <strong>
                        {blockedUser?.username || blockedId}
                      </strong>
                    </span>
                    <button
                      onClick={() => unblockUser(blockedId)}
                      className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      Разблокировать
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}

      {/* История матчей */}
      {showMatchHistory && (
        <Modal
          onClose={() => setShowMatchHistory && setShowMatchHistory(false)}
          title="🏆 История матчей"
        >
          {regularMatches.length === 0 ? (
            <p className="text-sm text-slate-500">
              Пока нет сыгранных матчей.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {regularMatches.map((match) => (
                <li
                  key={match.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{match.player1Avatar}</span>
                    <strong>{match.player1Name}</strong>
                    <span className="text-xs text-slate-500">vs</span>
                    <span>{match.player2Avatar}</span>
                    <strong>{match.player2Name}</strong>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {match.winnerId ? (
                      <span>
                        Победитель:{" "}
                        <strong>{match.winnerName}</strong>
                        {match.score && ` (${match.score})`}
                      </span>
                    ) : (
                      <span>
                        Ничья
                        {match.score && ` (${match.score})`}
                      </span>
                    )}
                    {match.duration && (
                      <span className="ml-2">
                        Длительность:{" "}
                        {Math.floor(match.duration / 60)}:
                        {(match.duration % 60)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {new Date(match.createdAt).toLocaleString("ru-RU")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Турнирные матчи */}
      {showTournamentMatches && (
        <Modal
          onClose={() =>
            setShowTournamentMatches && setShowTournamentMatches(false)
          }
          title="🥇 Турнирные матчи"
        >
          {tournamentMatches.length === 0 ? (
            <p className="text-sm text-slate-500">
              Пока нет турнирных матчей.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tournamentMatches.map((match) => (
                <li
                  key={match.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{match.player1Avatar}</span>
                    <strong>{match.player1Name}</strong>
                    <span className="text-xs text-slate-500">vs</span>
                    <span>{match.player2Avatar}</span>
                    <strong>{match.player2Name}</strong>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {match.winnerId ? (
                      <span>
                        Победитель:{" "}
                        <strong>{match.winnerName}</strong>
                        {match.score && ` (${match.score})`}
                      </span>
                    ) : (
                      <span>
                        Ничья
                        {match.score && ` (${match.score})`}
                      </span>
                    )}
                    {match.duration && (
                      <span className="ml-2">
                        Длительность:{" "}
                        {Math.floor(match.duration / 60)}:
                        {(match.duration % 60)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {new Date(match.createdAt).toLocaleString("ru-RU")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Front;

// ================================
// 🔲 Общий компонент модалки
// ================================
interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {children}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
