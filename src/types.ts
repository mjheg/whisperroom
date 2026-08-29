export interface User {
  socketId: string;
  nickname: string;
  inVoice: boolean;
}

export interface ChatMessage {
  id: string;
  nickname: string;
  text: string;
  timestamp: number;
}

export interface Room {
  code: string;
  users: Map<string, User>;
  createdAt: Date;
}

// Socket.io event types
export interface ServerToClientEvents {
  "room:joined": (data: { code: string; users: User[] }) => void;
  "room:user-joined": (user: User) => void;
  "room:user-left": (socketId: string) => void;
  "room:full": () => void;
  "room:not-found": () => void;
  "chat:message": (message: ChatMessage) => void;
  "voice:user-joined": (socketId: string) => void;
  "voice:user-left": (socketId: string) => void;
  "voice:signal": (data: { from: string; signal: unknown }) => void;
}

export interface ClientToServerEvents {
  "room:create": (nickname: string, callback: (code: string) => void) => void;
  "room:join": (data: { code: string; nickname: string }) => void;
  "chat:send": (text: string) => void;
  "voice:join": () => void;
  "voice:leave": () => void;
  "voice:signal": (data: { to: string; signal: unknown }) => void;
}
