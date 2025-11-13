export interface User {
    userId: string;
    username: string;
    avatar: string;
    online?: boolean;
  }
  
  export interface Message {
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: string;
  }
  
  export interface Friend {
    friend_id: string;
    friend_name: string;
    avatar: string;
    status: string;
  }
  
  export interface Invite {
    userId: string;
    username?: string;
    avatar?: string;
    timestamp?: number;
  }
  
  export interface Match {
    id: number;
    player1Id: string;
    player2Id: string;
    winnerId: string | null;
    score: string | null;
    matchType: string;
    gameType: string;
    duration: number | null;
    createdAt: string;
    player1Name: string;
    player1Avatar: string;
    player2Name: string;
    player2Avatar: string;
    winnerName: string | null;
  }
  
  export interface MatchStats {
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
  }
  