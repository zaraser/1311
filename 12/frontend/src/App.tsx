// frontend/src/App.tsx
import React, { useEffect, useState, useRef } from "react";
import Front, { GamePage } from "./front";
import { socket } from "./socket";
import { useAppFunctions } from "./functionFront";
import type {
  User,
  Message,
  Friend,
  Invite,
  Match,
  MatchStats,
} from "./types";

const API_BASE = "https://localhost:8443";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const blockedUsersRef = useRef<string[]>([]);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [messagesByUser, setMessagesByUser] = useState<
    Record<string, Message[]>
  >({});
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const handleSetSelectedUser = (user: User | null) => setSelectedUser(user);

  const [messageInput, setMessageInput] = useState("");
  const [unreadMessages, setUnreadMessages] = useState<Set<string>>(
    new Set()
  );
  const [systemMessage, setSystemMessage] = useState<string>("");

  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [blockedByUsers, setBlockedByUsers] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Friend[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Friend[]>([]);

  const [incomingInvites, setIncomingInvites] = useState<Invite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<Invite[]>([]);
  const [isInviteCooldown, setIsInviteCooldown] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [isFriendsModalOpen, setFriendsModalOpen] = useState(false);

  const [showLogin, setShowLogin] = useState(true);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showTournamentMatches, setShowTournamentMatches] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [regularMatches, setRegularMatches] = useState<Match[]>([]);
  const [tournamentMatches, setTournamentMatches] = useState<Match[]>([]);

  const [tournamentStatus, setTournamentStatus] = useState<string | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    blockedUsersRef.current = blockedUsers;
  }, [blockedUsers]);

  const {
    loadFriendsData,
    addFriend,
    acceptFriend,
    removeFriend,
    declineFriendRequest,
    cancelFriendRequest,
    sendGameInvite,
    cancelGameInvite,
    handleLogin,
    sendMessage,
    blockUser,
    unblockUser,
    handleLogout,
    clearUnreadMessages,
  } = useAppFunctions({
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
  });

  // === Загрузка пользователей для экрана логина ===
  useEffect(() => {
    fetch(`${API_BASE}/api/users`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.users) {
          const users: User[] = data.users.map((u: any) => ({
            userId: u.id || u.userId,
            username: u.username,
            avatar: u.avatar || "👤",
            online: u.online === 1 || u.online === true,
          }));
          setAllUsers(users);
        } else {
          setAllUsers([]);
        }
      })
      .catch(() => setAllUsers([]));
  }, []);

  // === После логина грузим друзей, блоки, инвайты ===
  useEffect(() => {
    if (!currentUser) return;

    loadFriendsData();
    refreshBlocks(currentUser.userId);
    refreshInvites(currentUser.userId);
  }, [currentUser]);

  const refreshBlocks = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/blocks/${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      const blocked = (data.blocked || []).map(
        (b: { blockedId?: string; blocked_id?: string }) =>
          b.blockedId ?? b.blocked_id
      );
      const blockedBy = (data.blockedBy || []).map(
        (b: { blockerId?: string; blocker_id?: string }) =>
          b.blockerId ?? b.blocker_id
      );
      setBlockedUsers(blocked);
      setBlockedByUsers(blockedBy);
    } catch {
      // ignore
    }
  };

  const refreshInvites = async (userId: string) => {
    try {
      const [incomingRes, outgoingRes] = await Promise.all([
        fetch(`${API_BASE}/api/invite/incoming/${userId}`),
        fetch(`${API_BASE}/api/invite/outgoing/${userId}`),
      ]);

      if (incomingRes.ok) {
        const data = await incomingRes.json();
        const unique = (data.incoming || []).filter(
          (invite: any, index: number, self: any[]) =>
            index === self.findIndex((i: any) => i.userId === invite.userId)
        );
        setIncomingInvites(unique);
      }

      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        const unique = (data.outgoing || []).filter(
          (invite: any, index: number, self: any[]) =>
            index === self.findIndex((i: any) => i.userId === invite.userId)
        );
        setOutgoingInvites(unique);
      }
    } catch {
      // ignore
    }
  };

  // === Socket listeners (один раз) ===
  useEffect(() => {
    const handleConnect = () => {
      console.log("✅ SOCKET CONNECTED", socket.id);
    };

    socket.on("connect", handleConnect);

    socket.on("disconnect", () => {
      setOnlineUsers([]);
    });

    socket.on("online_users", (users: User[]) => {
      setOnlineUsers(users);
    });

    socket.on(
      "user_online",
      ({
        userId,
        username,
        avatar,
      }: {
        userId: string;
        username: string;
        avatar?: string;
      }) => {
        setOnlineUsers((prev) => {
          if (prev.some((u) => u.userId === userId)) return prev;
          return [
            ...prev,
            { userId, username, avatar: avatar || "👤", online: true },
          ];
        });
      }
    );

    socket.on("user_offline", ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    const handlePrivateMessage = (message: Message) => {
      const currentUserId = currentUserRef.current?.userId;
      if (!currentUserId) return;

      const otherId =
        message.senderId === currentUserId
          ? message.receiverId
          : message.senderId;

      if (
        message.senderId !== currentUserId &&
        blockedUsersRef.current.includes(otherId)
      ) {
        return;
      }

      setMessagesByUser((prev) => {
        const existing = prev[otherId] || [];
        const isDuplicate = existing.some(
          (m) =>
            m.timestamp === message.timestamp &&
            m.content === message.content &&
            m.senderId === message.senderId &&
            m.receiverId === message.receiverId
        );
        if (isDuplicate) return prev;

        return {
          ...prev,
          [otherId]: [...existing, message],
        };
      });

      if (message.senderId !== currentUserId) {
        setSelectedUser((currentSelected) => {
          if (currentSelected?.userId !== otherId) {
            setUnreadMessages((prev) => new Set(prev).add(otherId));
          }
          return currentSelected;
        });
      }
    };

    socket.on("private_message", handlePrivateMessage);

    const handleFriendsUpdate = () => {
      if (currentUserRef.current) {
        loadFriendsData();
      }
    };

    socket.on("friend_request", handleFriendsUpdate);
    socket.on("friend_accepted", handleFriendsUpdate);
    socket.on("friend_removed", handleFriendsUpdate);
    socket.on("friend_declined", handleFriendsUpdate);
    socket.on("friend_request_created", handleFriendsUpdate);

    socket.on("user_blocked", () => {
      if (currentUserRef.current) {
        refreshBlocks(currentUserRef.current.userId);
      }
    });

    socket.on("user_unblocked", () => {
      if (currentUserRef.current) {
        refreshBlocks(currentUserRef.current.userId);
      }
    });

    socket.on("game_invite", () => {
      if (currentUserRef.current) {
        refreshInvites(currentUserRef.current.userId);
      }
    });

    socket.on("game_invite_cancel", () => {
      if (currentUserRef.current) {
        refreshInvites(currentUserRef.current.userId);
      }
    });

    socket.on("game_invite_response", (eventData: {
      inviterId?: string;
      inviteeId?: string;
      accepted?: boolean;
    }) => {
      const u = currentUserRef.current;
      if (!u) return;

      refreshInvites(u.userId);

      if (eventData && eventData.accepted) {
        const isInviter = eventData.inviterId === u.userId;
        const isInvitee = eventData.inviteeId === u.userId;
        if (isInviter || isInvitee) {
          const opponentId = isInviter
            ? eventData.inviteeId
            : eventData.inviterId;
          if (opponentId) {
            window.location.href = `/game?with=${opponentId}`;
          }
        }
      }
    });

    socket.on(
      "tournament_update",
      (payload: { message?: string; status?: string }) => {
        const msg = payload.message || payload.status || "";
        if (msg) {
          setTournamentStatus(msg);
        }
      }
    );

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect");
      socket.off("online_users");
      socket.off("user_online");
      socket.off("user_offline");
      socket.off("private_message", handlePrivateMessage);
      socket.off("friend_request", handleFriendsUpdate);
      socket.off("friend_accepted", handleFriendsUpdate);
      socket.off("friend_removed", handleFriendsUpdate);
      socket.off("friend_declined", handleFriendsUpdate);
      socket.off("friend_request_created", handleFriendsUpdate);
      socket.off("user_blocked");
      socket.off("user_unblocked");
      socket.off("game_invite");
      socket.off("game_invite_cancel");
      socket.off("game_invite_response");
      socket.off("tournament_update");
    };
  }, []);

  // join/leave при логине
  useEffect(() => {
    if (!currentUser) return;

    socket.emit("user_join", {
      userId: currentUser.userId,
      username: currentUser.username,
      avatar: currentUser.avatar,
    });

    return () => {
      socket.emit("user_leave", { userId: currentUser.userId });
    };
  }, [currentUser]);

  // === История сообщений при выборе собеседника ===
  useEffect(() => {
    if (!currentUser || !selectedUser) return;
    fetch(
      `${API_BASE}/api/messages/${currentUser.userId}/${selectedUser.userId}`
    )
      .then((res) => res.json())
      .then((data) => {
        setMessagesByUser((prev) => ({
          ...prev,
          [selectedUser.userId]: data.messages || [],
        }));
        clearUnreadMessages(selectedUser.userId);

        setTimeout(() => {
          const messagesArea = document.querySelector(".messages-area");
          if (messagesArea) {
            (messagesArea as HTMLElement).scrollTop =
              messagesArea.scrollHeight;
          }
        }, 100);
      })
      .catch(() => {});
  }, [currentUser, selectedUser]);

  // автоскролл
  useEffect(() => {
    if (!selectedUser) return;
    const messagesArea = document.querySelector(
      ".messages-area"
    ) as HTMLElement | null;
    if (messagesArea) {
      const isNearBottom =
        messagesArea.scrollHeight -
          messagesArea.scrollTop -
          messagesArea.clientHeight <
        100;
      if (isNearBottom) {
        setTimeout(() => {
          messagesArea.scrollTop = messagesArea.scrollHeight;
        }, 50);
      }
    }
  }, [messagesByUser, selectedUser]);

  // Статистика
  useEffect(() => {
    if (!currentUser || !showProfile) return;
    const loadStats = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/matches/${currentUser.userId}/stats`
        );
        if (res.ok) {
          const data = await res.json();
          setMatchStats(data.stats);
        }
      } catch {}
    };
    loadStats();
  }, [currentUser, showProfile]);

  useEffect(() => {
    if (!currentUser || !showMatchHistory) return;
    const loadMatches = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/matches/${currentUser.userId}/regular`
        );
        if (res.ok) {
          const data = await res.json();
          setRegularMatches(data.matches || []);
        }
      } catch {}
    };
    loadMatches();
  }, [currentUser, showMatchHistory]);

  useEffect(() => {
    if (!currentUser || !showTournamentMatches) return;
    const loadMatches = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/matches/${currentUser.userId}/tournament`
        );
        if (res.ok) {
          const data = await res.json();
          setTournamentMatches(data.matches || []);
        }
      } catch {}
    };
    loadMatches();
  }, [currentUser, showTournamentMatches]);

  // user_leave при закрытии вкладки
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser) {
        socket.emit("user_leave", { userId: currentUser.userId });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentUser]);

  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/game"
  ) {
    return <GamePage />;
  }

  return (
    <Front
      showLogin={showLogin}
      handleLogin={handleLogin}
      currentUser={currentUser}
      allUsers={allUsers}
      onlineUsers={onlineUsers}
      messagesByUser={messagesByUser}
      selectedUser={selectedUser}
      setSelectedUser={handleSetSelectedUser}
      messageInput={messageInput}
      setMessageInput={setMessageInput}
      unreadMessages={unreadMessages}
      systemMessage={systemMessage}
      friends={friends}
      incomingRequests={incomingRequests}
      outgoingRequests={outgoingRequests}
      blockedUsers={blockedUsers}
      blockedByUsers={blockedByUsers}
      isInviteCooldown={isInviteCooldown}
      isInviteModalOpen={isInviteModalOpen}
      setInviteModalOpen={setInviteModalOpen}
      isFriendsModalOpen={isFriendsModalOpen}
      setFriendsModalOpen={setFriendsModalOpen}
      incomingInvites={incomingInvites}
      setIncomingInvites={setIncomingInvites}
      outgoingInvites={outgoingInvites}
      sendMessage={sendMessage}
      addFriend={addFriend}
      acceptFriend={acceptFriend}
      removeFriend={removeFriend}
      declineFriendRequest={declineFriendRequest}
      cancelFriendRequest={cancelFriendRequest}
      blockUser={blockUser}
      unblockUser={unblockUser}
      sendGameInvite={sendGameInvite}
      cancelGameInvite={cancelGameInvite}
      handleLogout={handleLogout}
      socket={socket}
      showBlacklist={showBlacklist}
      setShowBlacklist={setShowBlacklist}
      showMatchHistory={showMatchHistory}
      setShowMatchHistory={setShowMatchHistory}
      showTournamentMatches={showTournamentMatches}
      setShowTournamentMatches={setShowTournamentMatches}
      showProfile={showProfile}
      setShowProfile={setShowProfile}
      matchStats={matchStats}
      regularMatches={regularMatches}
      tournamentMatches={tournamentMatches}
    />
  );
};

export default App;

