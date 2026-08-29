# WhisperRoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-login, room-code-based web app for real-time text chat and peer-to-peer voice chat.

**Architecture:** Next.js frontend with a custom Node.js server that embeds Socket.io for real-time messaging and WebRTC signaling. Single deployable unit — one `npm start` runs both the web app and the WebSocket server. Room state lives in-memory only; rooms auto-delete when empty.

**Tech Stack:** Next.js 15 (App Router), Socket.io 4, WebRTC (native browser API), TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-08-29-whisperroom-design.md`

## Global Constraints

- Node.js >= 20
- No database — all room state is in-memory on the server
- No authentication — no login, no cookies for auth
- Max 8 users per room
- Room code format: `{word}-{digit}{digit}{letter}{letter}` (e.g., `cat-3K`, `moon-7R`)
- Must work on Chrome, Firefox, Safari, Edge — desktop, tablet, mobile
- WebRTC uses Google public STUN (`stun:stun.l.google.com:19302`)
- TypeScript strict mode

---

## File Structure

```
webchat/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── server.ts                    # Custom Node server (Next.js + Socket.io)
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with metadata
│   │   ├── page.tsx             # Landing page (nickname + room code entry)
│   │   └── room/
│   │       └── [code]/
│   │           └── page.tsx     # Chat room page (client component shell)
│   ├── components/
│   │   ├── LandingForm.tsx      # Nickname + room code form
│   │   ├── ChatRoom.tsx         # Main chat room container
│   │   ├── ChatMessages.tsx     # Message list display
│   │   ├── ChatInput.tsx        # Message input bar
│   │   ├── VoicePanel.tsx       # Voice chat panel (join/leave/mute)
│   │   └── RoomHeader.tsx       # Room code display, user count, leave
│   ├── lib/
│   │   ├── socket.ts            # Socket.io client singleton
│   │   ├── webrtc.ts            # WebRTC peer connection manager
│   │   └── roomCode.ts          # Room code generation (shared)
│   └── types.ts                 # Shared TypeScript types
└── __tests__/
    ├── roomCode.test.ts         # Room code generation tests
    └── server-rooms.test.ts     # Server room logic tests
```

---

### Task 1: Project Scaffolding & Server Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `server.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/types.ts`, `src/lib/roomCode.ts`
- Test: `__tests__/roomCode.test.ts`

**Interfaces:**
- Produces:
  - `generateRoomCode(existingCodes: Set<string>): string` — returns unique room code
  - `WORD_POOL: string[]` — array of ~100 English words
  - Types: `Room`, `User`, `ChatMessage` in `src/types.ts`
  - Working Next.js dev server with Socket.io on port 3000

- [ ] **Step 1: Initialize the project**

```bash
cd /Users/myeongjeonghyeonmyeongjeonghyeon/earn_money/webchat
npm init -y
npm install next@latest react@latest react-dom@latest socket.io@4 socket.io-client@4
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss tsx vitest
```

- [ ] **Step 2: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Configure Next.js and Tailwind**

Create `next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

Create `src/app/globals.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Create shared types**

Create `src/types.ts`:
```ts
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
```

- [ ] **Step 5: Create room code generator**

Create `src/lib/roomCode.ts`:
```ts
const WORD_POOL = [
  "ant", "bat", "bee", "bug", "cat", "cow", "dog", "elk", "emu", "fox",
  "hen", "jay", "koi", "owl", "pig", "ram", "rat", "yak", "ape", "cod",
  "cup", "dot", "ear", "egg", "fan", "gem", "hat", "ice", "jam", "key",
  "lip", "map", "net", "oak", "pan", "red", "sky", "sun", "tea", "urn",
  "van", "web", "zip", "ace", "bay", "den", "fin", "fog", "gum", "hop",
  "ink", "jet", "kit", "log", "mud", "nap", "oat", "pea", "rig", "sap",
  "tag", "vet", "wax", "axe", "bow", "cap", "dew", "elm", "fig", "gap",
  "hub", "ivy", "jug", "lab", "mix", "nub", "orb", "pod", "rag", "sob",
  "tin", "vow", "wig", "yew", "ark", "bin", "cob", "dip", "fir", "gym",
  "hum", "ion", "jar", "lap", "mop", "nil", "ore", "pit", "rye", "spa",
];

const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I, L, O (avoid confusion with 1, l, 0)

export function generateRoomCode(existingCodes: Set<string>): string {
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
    const digit = Math.floor(Math.random() * 10);
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const code = `${word}-${digit}${letter}`;
    if (!existingCodes.has(code)) return code;
  }
  throw new Error("Failed to generate unique room code");
}

export { WORD_POOL };
```

- [ ] **Step 6: Write tests for room code generator**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Create `__tests__/roomCode.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateRoomCode, WORD_POOL } from "@/lib/roomCode";

describe("generateRoomCode", () => {
  it("returns a code matching the pattern word-digitLetter", () => {
    const code = generateRoomCode(new Set());
    expect(code).toMatch(/^[a-z]+-\d[A-Z]$/);
  });

  it("uses a word from the pool", () => {
    const code = generateRoomCode(new Set());
    const word = code.split("-")[0];
    expect(WORD_POOL).toContain(word);
  });

  it("does not return an existing code", () => {
    const existing = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode(existing);
      expect(existing.has(code)).toBe(false);
      existing.add(code);
    }
  });

  it("throws if it cannot generate a unique code", () => {
    const allCodes = new Set<string>();
    // Fill with enough codes to make collisions very likely
    for (const w of WORD_POOL) {
      for (let d = 0; d < 10; d++) {
        for (const l of "ABCDEFGHJKMNPQRSTUVWXYZ") {
          allCodes.add(`${w}-${d}${l}`);
        }
      }
    }
    expect(() => generateRoomCode(allCodes)).toThrow("Failed to generate unique room code");
  });
});
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run
```

Expected: all 4 tests pass.

- [ ] **Step 8: Create root layout**

Create `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhisperRoom",
  description: "Private chat rooms — no login required",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Create placeholder landing page**

Create `src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">WhisperRoom</h1>
    </main>
  );
}
```

- [ ] **Step 10: Create custom server with Socket.io**

Create `server.ts`:
```ts
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { generateRoomCode } from "./src/lib/roomCode";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  User,
} from "./src/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface RoomState {
  users: Map<string, User>;
  createdAt: Date;
}

const rooms = new Map<string, RoomState>();

function getActiveCodes(): Set<string> {
  return new Set(rooms.keys());
}

function broadcastUserList(io: Server, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const users = Array.from(room.users.values());
  io.to(roomCode).emit("room:joined", { code: roomCode, users });
}

app.prepare().then(() => {
  const httpServer = createServer(handle);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
    path: "/api/socketio",
  });

  io.on("connection", (socket) => {
    let currentRoom: string | null = null;

    socket.on("room:create", (nickname, callback) => {
      const code = generateRoomCode(getActiveCodes());
      const user: User = { socketId: socket.id!, nickname, inVoice: false };
      const room: RoomState = { users: new Map([[socket.id!, user]]), createdAt: new Date() };
      rooms.set(code, room);
      socket.join(code);
      currentRoom = code;
      callback(code);
      broadcastUserList(io, code);
    });

    socket.on("room:join", ({ code, nickname }) => {
      const room = rooms.get(code);
      if (!room) {
        socket.emit("room:not-found");
        return;
      }
      if (room.users.size >= 8) {
        socket.emit("room:full");
        return;
      }
      const user: User = { socketId: socket.id!, nickname, inVoice: false };
      room.users.set(socket.id!, user);
      socket.join(code);
      currentRoom = code;
      socket.to(code).emit("room:user-joined", user);
      broadcastUserList(io, code);
    });

    socket.on("chat:send", (text) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (!user) return;
      const message = {
        id: `${socket.id}-${Date.now()}`,
        nickname: user.nickname,
        text,
        timestamp: Date.now(),
      };
      io.to(currentRoom).emit("chat:message", message);
    });

    socket.on("voice:join", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (!user) return;
      user.inVoice = true;
      io.to(currentRoom).emit("voice:user-joined", socket.id!);
      broadcastUserList(io, currentRoom);
    });

    socket.on("voice:leave", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (!user) return;
      user.inVoice = false;
      io.to(currentRoom).emit("voice:user-left", socket.id!);
      broadcastUserList(io, currentRoom);
    });

    socket.on("voice:signal", ({ to, signal }) => {
      socket.to(to).emit("voice:signal", { from: socket.id!, signal });
    });

    socket.on("disconnect", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (user?.inVoice) {
        io.to(currentRoom).emit("voice:user-left", socket.id!);
      }
      room.users.delete(socket.id!);
      socket.to(currentRoom).emit("room:user-left", socket.id!);
      if (room.users.size === 0) {
        rooms.delete(currentRoom);
      } else {
        broadcastUserList(io, currentRoom);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> WhisperRoom running on http://localhost:${port}`);
  });
});
```

- [ ] **Step 11: Add scripts to package.json**

Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts",
    "test": "vitest run"
  }
}
```

- [ ] **Step 12: Verify the dev server starts**

```bash
npm run dev
```

Visit `http://localhost:3000` — should see "WhisperRoom" heading. Kill the server (`Ctrl+C`).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Next.js, Socket.io server, and room code generator"
```

---

### Task 2: Socket.io Client & Landing Page

**Files:**
- Create: `src/lib/socket.ts`
- Create: `src/components/LandingForm.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `ServerToClientEvents`, `ClientToServerEvents` from `src/types.ts`
- Produces:
  - `getSocket(): Socket` — returns singleton Socket.io client
  - `LandingForm` component — handles create/join room, navigates to `/room/[code]`

- [ ] **Step 1: Create Socket.io client singleton**

Create `src/lib/socket.ts`:
```ts
"use client";

import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io({
      path: "/api/socketio",
      autoConnect: false,
    }) as TypedSocket;
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

- [ ] **Step 2: Build the landing form component**

Create `src/components/LandingForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function LandingForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    if (!nickname.trim()) {
      setError("Enter a nickname");
      return;
    }
    setLoading(true);
    setError("");
    const socket = getSocket();
    socket.connect();
    socket.emit("room:create", nickname.trim(), (code) => {
      sessionStorage.setItem("whisper-nickname", nickname.trim());
      router.push(`/room/${code}`);
    });
  }

  function handleJoin() {
    if (!nickname.trim()) {
      setError("Enter a nickname");
      return;
    }
    if (!roomCode.trim()) {
      setError("Enter a room code");
      return;
    }
    setLoading(true);
    setError("");
    const socket = getSocket();
    socket.connect();

    socket.on("room:not-found", () => {
      setLoading(false);
      setError("Room not found");
      socket.off("room:not-found");
      socket.off("room:full");
    });

    socket.on("room:full", () => {
      setLoading(false);
      setError("Room is full (max 8)");
      socket.off("room:not-found");
      socket.off("room:full");
    });

    socket.on("room:joined", () => {
      sessionStorage.setItem("whisper-nickname", nickname.trim());
      router.push(`/room/${roomCode.trim()}`);
      socket.off("room:not-found");
      socket.off("room:full");
      socket.off("room:joined");
    });

    socket.emit("room:join", { code: roomCode.trim(), nickname: nickname.trim() });
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <h1 className="text-5xl font-bold tracking-tight">WhisperRoom</h1>
      <p className="text-gray-400 text-center">
        Private chat rooms — no login required
      </p>

      <input
        type="text"
        placeholder="Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg
                   focus:outline-none focus:border-blue-500 text-lg"
      />

      <div className="flex w-full gap-2">
        <input
          type="text"
          placeholder="Room code (e.g. cat-3K)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg
                     focus:outline-none focus:border-blue-500 text-lg"
        />
        <button
          onClick={handleJoin}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold
                     disabled:opacity-50 transition-colors"
        >
          Join
        </button>
      </div>

      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-gray-500 text-sm">or</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600
                   rounded-lg font-semibold disabled:opacity-50 transition-colors"
      >
        Create New Room
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Update landing page to use the form**

Replace `src/app/page.tsx`:
```tsx
import LandingForm from "@/components/LandingForm";

export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      <LandingForm />
    </main>
  );
}
```

- [ ] **Step 4: Verify landing page works**

```bash
npm run dev
```

Open `http://localhost:3000`. Should see the form with nickname input, room code input, Join button, and Create Room button. Click "Create New Room" with a nickname — should navigate to `/room/[code]` (will 404 for now, that's expected).

- [ ] **Step 5: Commit**

```bash
git add src/lib/socket.ts src/components/LandingForm.tsx src/app/page.tsx
git commit -m "feat: landing page with create/join room form"
```

---

### Task 3: Chat Room — Text Chat

**Files:**
- Create: `src/app/room/[code]/page.tsx`
- Create: `src/components/ChatRoom.tsx`
- Create: `src/components/RoomHeader.tsx`
- Create: `src/components/ChatMessages.tsx`
- Create: `src/components/ChatInput.tsx`

**Interfaces:**
- Consumes: `getSocket()` from `src/lib/socket.ts`, types from `src/types.ts`
- Produces:
  - `ChatRoom` — full chat room container with header, messages, input
  - `RoomHeader` — displays room code (copyable), user count, leave button
  - `ChatMessages` — scrollable message list
  - `ChatInput` — message text input with send

- [ ] **Step 1: Create the chat room page (client shell)**

Create `src/app/room/[code]/page.tsx`:
```tsx
import ChatRoom from "@/components/ChatRoom";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ChatRoom code={code} />;
}
```

- [ ] **Step 2: Create RoomHeader component**

Create `src/components/RoomHeader.tsx`:
```tsx
"use client";

import { useState } from "react";

interface RoomHeaderProps {
  code: string;
  userCount: number;
  onLeave: () => void;
}

export default function RoomHeader({ code, userCount, onLeave }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
      <button
        onClick={copyCode}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700
                   rounded-lg transition-colors text-sm font-mono"
        title="Click to copy"
      >
        <span className="text-blue-400 font-semibold">{code}</span>
        <span className="text-gray-500">{copied ? "Copied!" : "Copy"}</span>
      </button>

      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm">{userCount} online</span>
        <button
          onClick={onLeave}
          className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-300
                     rounded-lg transition-colors text-sm"
        >
          Leave
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create ChatMessages component**

Create `src/components/ChatMessages.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && (
        <p className="text-gray-500 text-center mt-8">No messages yet. Say something!</p>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-2">
          <span className="font-semibold text-blue-400 shrink-0">{msg.nickname}</span>
          <span className="text-gray-200 break-words min-w-0">{msg.text}</span>
          <span className="text-gray-600 text-xs shrink-0 self-end ml-auto">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4: Create ChatInput component**

Create `src/components/ChatInput.tsx`:
```tsx
"use client";

import { useState, type FormEvent } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-gray-900 border-t border-gray-800">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        maxLength={500}
        className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg
                   focus:outline-none focus:border-blue-500"
        autoFocus
      />
      <button
        type="submit"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold
                   transition-colors"
      >
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Create ChatRoom container (text chat only for now)**

Create `src/components/ChatRoom.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/socket";
import RoomHeader from "./RoomHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import VoicePanel from "./VoicePanel";
import type { ChatMessage, User } from "@/types";

interface ChatRoomProps {
  code: string;
}

export default function ChatRoom({ code }: ChatRoomProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const nickname = sessionStorage.getItem("whisper-nickname");

    if (!nickname) {
      router.push("/");
      return;
    }

    if (!socket.connected) {
      socket.connect();
      socket.emit("room:join", { code, nickname });
    }

    socket.on("room:joined", ({ users: roomUsers }) => {
      setUsers(roomUsers);
      setConnected(true);
    });

    socket.on("room:user-joined", () => {
      // User list is updated via room:joined broadcast
    });

    socket.on("room:user-left", (leftSocketId) => {
      setUsers((prev) => prev.filter((u) => u.socketId !== leftSocketId));
    });

    socket.on("chat:message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("room:not-found", () => {
      alert("Room not found");
      router.push("/");
    });

    socket.on("room:full", () => {
      alert("Room is full");
      router.push("/");
    });

    return () => {
      socket.off("room:joined");
      socket.off("room:user-joined");
      socket.off("room:user-left");
      socket.off("chat:message");
      socket.off("room:not-found");
      socket.off("room:full");
    };
  }, [code, router]);

  const handleSend = useCallback((text: string) => {
    const socket = getSocket();
    socket.emit("chat:send", text);
  }, []);

  function handleLeave() {
    disconnectSocket();
    router.push("/");
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Connecting...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <RoomHeader code={code} userCount={users.length} onLeave={handleLeave} />
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1">
          <ChatMessages messages={messages} />
          <ChatInput onSend={handleSend} />
        </div>
        <VoicePanel users={users} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create placeholder VoicePanel (built out in Task 4)**

Create `src/components/VoicePanel.tsx`:
```tsx
"use client";

import type { User } from "@/types";

interface VoicePanelProps {
  users: User[];
}

export default function VoicePanel({ users: _users }: VoicePanelProps) {
  return (
    <aside className="w-64 bg-gray-900 border-l border-gray-800 p-4 hidden md:block">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Voice Chat</h2>
      <button className="w-full px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg
                         font-semibold transition-colors text-sm">
        Join Voice
      </button>
    </aside>
  );
}
```

- [ ] **Step 7: Test the full chat flow**

```bash
npm run dev
```

1. Open `http://localhost:3000` in two browser tabs
2. Tab 1: Enter nickname "Alice", click "Create New Room"
3. Copy the room code
4. Tab 2: Enter nickname "Bob", paste room code, click "Join"
5. Both should see each other's messages in real time

- [ ] **Step 8: Commit**

```bash
git add src/app/room src/components src/lib
git commit -m "feat: chat room with real-time text messaging"
```

---

### Task 4: Voice Chat (WebRTC)

**Files:**
- Create: `src/lib/webrtc.ts`
- Modify: `src/components/VoicePanel.tsx`
- Modify: `src/components/ChatRoom.tsx`

**Interfaces:**
- Consumes: `getSocket()` from `src/lib/socket.ts`, `User` from `src/types.ts`
- Produces:
  - `WebRTCManager` class — manages peer connections, audio streams, mute toggle
  - Updated `VoicePanel` — join/leave voice, mute/unmute, participant list with speaking indicators

- [ ] **Step 1: Create WebRTC peer connection manager**

Create `src/lib/webrtc.ts`:
```ts
"use client";

import { getSocket } from "./socket";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class WebRTCManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private remoteAudios: Map<string, HTMLAudioElement> = new Map();
  private _isMuted = false;
  private onPeersChanged: () => void;

  constructor(onPeersChanged: () => void) {
    this.onPeersChanged = onPeersChanged;
  }

  get isMuted() {
    return this._isMuted;
  }

  get activePeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  async joinVoice() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const socket = getSocket();

    socket.on("voice:signal", async ({ from, signal }) => {
      const signalData = signal as { type: string; sdp?: string; candidate?: RTCIceCandidateInit };

      if (signalData.type === "offer") {
        const pc = this.createPeer(from);
        await pc.setRemoteDescription(new RTCSessionDescription(signalData as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice:signal", { to: from, signal: answer });
      } else if (signalData.type === "answer") {
        const pc = this.peers.get(from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData as RTCSessionDescriptionInit));
        }
      } else if (signalData.candidate) {
        const pc = this.peers.get(from);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      }
    });

    socket.on("voice:user-joined", async (peerId) => {
      if (peerId === socket.id) return;
      const pc = this.createPeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("voice:signal", { to: peerId, signal: offer });
    });

    socket.on("voice:user-left", (peerId) => {
      this.removePeer(peerId);
    });

    socket.emit("voice:join");
  }

  private createPeer(peerId: string): RTCPeerConnection {
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit("voice:signal", {
          to: peerId,
          signal: { candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      this.remoteAudios.set(peerId, audio);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.removePeer(peerId);
      }
    };

    this.peers.set(peerId, pc);
    this.onPeersChanged();
    return pc;
  }

  private removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    const audio = this.remoteAudios.get(peerId);
    if (audio) {
      audio.srcObject = null;
      this.remoteAudios.delete(peerId);
    }
    this.onPeersChanged();
  }

  toggleMute(): boolean {
    this._isMuted = !this._isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this._isMuted;
      });
    }
    return this._isMuted;
  }

  leaveVoice() {
    const socket = getSocket();
    socket.emit("voice:leave");
    socket.off("voice:signal");
    socket.off("voice:user-joined");
    socket.off("voice:user-left");

    this.peers.forEach((pc) => pc.close());
    this.peers.clear();

    this.remoteAudios.forEach((audio) => {
      audio.srcObject = null;
    });
    this.remoteAudios.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this._isMuted = false;
    this.onPeersChanged();
  }

  destroy() {
    this.leaveVoice();
  }
}
```

- [ ] **Step 2: Build full VoicePanel component**

Replace `src/components/VoicePanel.tsx`:
```tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { WebRTCManager } from "@/lib/webrtc";
import type { User } from "@/types";

interface VoicePanelProps {
  users: User[];
}

export default function VoicePanel({ users }: VoicePanelProps) {
  const [inVoice, setInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [, setUpdateTick] = useState(0);
  const managerRef = useRef<WebRTCManager | null>(null);

  const triggerUpdate = useCallback(() => {
    setUpdateTick((t) => t + 1);
  }, []);

  useEffect(() => {
    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  async function handleJoinVoice() {
    const manager = new WebRTCManager(triggerUpdate);
    managerRef.current = manager;
    await manager.joinVoice();
    setInVoice(true);
  }

  function handleLeaveVoice() {
    managerRef.current?.leaveVoice();
    managerRef.current = null;
    setInVoice(false);
    setIsMuted(false);
  }

  function handleToggleMute() {
    if (managerRef.current) {
      const muted = managerRef.current.toggleMute();
      setIsMuted(muted);
    }
  }

  const voiceUsers = users.filter((u) => u.inVoice);

  return (
    <aside className="w-64 bg-gray-900 border-l border-gray-800 p-4 hidden md:flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Voice Chat
      </h2>

      {!inVoice ? (
        <button
          onClick={handleJoinVoice}
          className="w-full px-4 py-2.5 bg-green-700 hover:bg-green-600 rounded-lg
                     font-semibold transition-colors text-sm"
        >
          Join Voice
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleToggleMute}
            className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${
              isMuted
                ? "bg-red-700 hover:bg-red-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={handleLeaveVoice}
            className="px-3 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-300
                       rounded-lg transition-colors text-sm"
          >
            Leave
          </button>
        </div>
      )}

      {voiceUsers.length > 0 && (
        <div className="space-y-2 mt-2">
          <p className="text-xs text-gray-500">{voiceUsers.length} in voice</p>
          {voiceUsers.map((u) => (
            <div key={u.socketId} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-300 truncate">{u.nickname}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Test voice chat**

```bash
npm run dev
```

1. Open two browser tabs, join the same room
2. In both tabs, click "Join Voice"
3. Allow microphone access
4. Speak in one tab — audio should play in the other
5. Click "Mute" — other tab should stop hearing you
6. Click "Leave" — cleanly disconnects

- [ ] **Step 4: Commit**

```bash
git add src/lib/webrtc.ts src/components/VoicePanel.tsx
git commit -m "feat: WebRTC voice chat with join/leave/mute"
```

---

### Task 5: Mobile Responsive Design & Polish

**Files:**
- Modify: `src/components/ChatRoom.tsx`
- Modify: `src/components/VoicePanel.tsx`
- Modify: `src/components/LandingForm.tsx`
- Modify: `src/components/RoomHeader.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: all existing components
- Produces: fully responsive layout that works on mobile/tablet/desktop

- [ ] **Step 1: Add mobile viewport and PWA meta tags to layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhisperRoom",
  description: "Private chat rooms — no login required",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-dvh">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Make ChatRoom responsive — toggle voice panel on mobile**

Replace `src/components/ChatRoom.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/socket";
import RoomHeader from "./RoomHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import VoicePanel from "./VoicePanel";
import type { ChatMessage, User } from "@/types";

interface ChatRoomProps {
  code: string;
}

export default function ChatRoom({ code }: ChatRoomProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [connected, setConnected] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const nickname = sessionStorage.getItem("whisper-nickname");

    if (!nickname) {
      router.push("/");
      return;
    }

    if (!socket.connected) {
      socket.connect();
      socket.emit("room:join", { code, nickname });
    }

    socket.on("room:joined", ({ users: roomUsers }) => {
      setUsers(roomUsers);
      setConnected(true);
    });

    socket.on("room:user-left", (leftSocketId) => {
      setUsers((prev) => prev.filter((u) => u.socketId !== leftSocketId));
    });

    socket.on("chat:message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("room:not-found", () => {
      alert("Room not found");
      router.push("/");
    });

    socket.on("room:full", () => {
      alert("Room is full");
      router.push("/");
    });

    return () => {
      socket.off("room:joined");
      socket.off("room:user-left");
      socket.off("chat:message");
      socket.off("room:not-found");
      socket.off("room:full");
    };
  }, [code, router]);

  const handleSend = useCallback((text: string) => {
    const socket = getSocket();
    socket.emit("chat:send", text);
  }, []);

  function handleLeave() {
    disconnectSocket();
    router.push("/");
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <p className="text-gray-400">Connecting...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh">
      <RoomHeader
        code={code}
        userCount={users.length}
        onLeave={handleLeave}
        onToggleVoice={() => setShowVoice((v) => !v)}
        showVoiceToggle
      />
      <div className="flex flex-1 min-h-0">
        <div className={`flex flex-col flex-1 ${showVoice ? "hidden md:flex" : "flex"}`}>
          <ChatMessages messages={messages} />
          <ChatInput onSend={handleSend} />
        </div>
        <div className={`${showVoice ? "flex flex-col flex-1 md:flex-none" : "hidden"} md:flex`}>
          <VoicePanel users={users} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update RoomHeader with voice toggle button for mobile**

Replace `src/components/RoomHeader.tsx`:
```tsx
"use client";

import { useState } from "react";

interface RoomHeaderProps {
  code: string;
  userCount: number;
  onLeave: () => void;
  onToggleVoice?: () => void;
  showVoiceToggle?: boolean;
}

export default function RoomHeader({
  code,
  userCount,
  onLeave,
  onToggleVoice,
  showVoiceToggle,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="flex items-center justify-between px-3 py-2.5 bg-gray-900 border-b border-gray-800 gap-2">
      <button
        onClick={copyCode}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700
                   rounded-lg transition-colors text-sm font-mono shrink-0"
        title="Click to copy"
      >
        <span className="text-blue-400 font-semibold">{code}</span>
        <span className="text-gray-500 text-xs">{copied ? "Copied!" : "Copy"}</span>
      </button>

      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs sm:text-sm">{userCount} online</span>
        {showVoiceToggle && (
          <button
            onClick={onToggleVoice}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg
                       transition-colors text-sm md:hidden"
          >
            Voice
          </button>
        )}
        <button
          onClick={onLeave}
          className="px-2.5 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-300
                     rounded-lg transition-colors text-sm"
        >
          Leave
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Make VoicePanel responsive**

Replace the aside tag in `src/components/VoicePanel.tsx` — change the outer element:

Replace the first line of the return:
```tsx
// Change from:
<aside className="w-64 bg-gray-900 border-l border-gray-800 p-4 hidden md:flex flex-col gap-3">
// To:
<aside className="w-full md:w-64 bg-gray-900 md:border-l border-gray-800 p-4 flex flex-col gap-3">
```

Everything else in VoicePanel stays the same.

- [ ] **Step 5: Test on mobile viewport**

```bash
npm run dev
```

Open Chrome DevTools → Toggle device toolbar → Test on iPhone SE and iPad:
- Landing page: form is centered, inputs are full width
- Chat room: messages fill the screen, input bar sticks to bottom
- "Voice" button in header toggles between chat and voice panel on mobile
- On desktop (>768px), voice panel is always visible as a sidebar

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: responsive mobile/tablet design with voice panel toggle"
```

---

### Task 6: Final Integration Test & Cleanup

**Files:**
- Modify: `server.ts` (edge case: handle duplicate socket connections)
- Modify: `src/components/LandingForm.tsx` (handle Enter key on room code input)

**Interfaces:**
- Consumes: all existing code
- Produces: polished, production-ready MVP

- [ ] **Step 1: Add Enter key handler on room code input**

In `src/components/LandingForm.tsx`, wrap the room code input + join button in a `<form>` so pressing Enter triggers join. The Create button stays outside the form.

Update the room code section in `LandingForm.tsx`:
```tsx
// Replace the <div className="flex w-full gap-2"> section with:
<form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="flex w-full gap-2">
  <input
    type="text"
    placeholder="Room code (e.g. cat-3K)"
    value={roomCode}
    onChange={(e) => setRoomCode(e.target.value)}
    className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg
               focus:outline-none focus:border-blue-500 text-lg"
  />
  <button
    type="submit"
    disabled={loading}
    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold
               disabled:opacity-50 transition-colors"
  >
    Join
  </button>
</form>
```

- [ ] **Step 2: Handle duplicate join prevention on server**

In `server.ts`, add a guard at the top of `room:join` handler to prevent the same socket from joining multiple rooms:

```ts
// Add at the start of the "room:join" handler, before const room = rooms.get(code):
if (currentRoom) {
  // Already in a room — leave it first
  const prevRoom = rooms.get(currentRoom);
  if (prevRoom) {
    prevRoom.users.delete(socket.id!);
    socket.leave(currentRoom);
    socket.to(currentRoom).emit("room:user-left", socket.id!);
    if (prevRoom.users.size === 0) {
      rooms.delete(currentRoom);
    } else {
      broadcastUserList(io, currentRoom);
    }
  }
  currentRoom = null;
}
```

- [ ] **Step 3: Full end-to-end test**

```bash
npm run dev
```

Test checklist:
1. Create room → code appears, copied to clipboard
2. Join room from another tab → both see each other
3. Send messages both ways → appear in real time
4. Join voice → microphone prompt → audio works
5. Mute → other side can't hear → unmute → works again
6. Leave voice → cleanly disconnects
7. Leave room → redirected to home, room deletes when empty
8. Try joining nonexistent code → "Room not found" error
9. Open on mobile viewport → responsive layout works
10. Test on actual phone (same WiFi) → `http://<your-ip>:3000`

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: polish — enter key join, duplicate join guard, integration tested"
```

---

## Summary

| Task | What it builds | Estimated steps |
|------|---------------|-----------------|
| 1 | Project setup, server, room codes | 13 |
| 2 | Landing page, Socket.io client | 5 |
| 3 | Chat room, text messaging | 8 |
| 4 | WebRTC voice chat | 4 |
| 5 | Mobile responsive design | 6 |
| 6 | Polish & integration test | 5 |
| **Total** | **Full MVP** | **41** |
