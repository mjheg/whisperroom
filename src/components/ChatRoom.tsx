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
  const [nickname, setNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [needsNickname, setNeedsNickname] = useState(false);

  // Check for existing nickname on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("whisper-nickname");
    if (saved) {
      setNickname(saved);
    } else {
      setNeedsNickname(true);
    }
  }, []);

  // Connect to room once we have a nickname
  useEffect(() => {
    if (!nickname) return;

    const socket = getSocket();

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

    function joinRoom() {
      socket.emit("room:join", { code, nickname: nickname! });
    }

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on("connect", joinRoom);
      socket.connect();
    }

    return () => {
      socket.off("connect");
      socket.off("room:joined");
      socket.off("room:user-left");
      socket.off("chat:message");
      socket.off("room:not-found");
      socket.off("room:full");
    };
  }, [code, nickname, router]);

  const handleSend = useCallback((text: string) => {
    const socket = getSocket();
    socket.emit("chat:send", text);
  }, []);

  const handleGif = useCallback((gifUrl: string) => {
    const socket = getSocket();
    socket.emit("chat:gif", gifUrl);
  }, []);

  function handleLeave() {
    disconnectSocket();
    router.push("/");
  }

  function handleNicknameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nicknameInput.trim()) return;
    const name = nicknameInput.trim();
    sessionStorage.setItem("whisper-nickname", name);
    setNickname(name);
    setNeedsNickname(false);
  }

  // Show nickname input for direct link visitors
  if (needsNickname) {
    return (
      <div className="flex items-center justify-center h-dvh p-4">
        <form onSubmit={handleNicknameSubmit} className="flex flex-col items-center gap-4 w-full max-w-sm">
          <h1 className="text-3xl font-bold">WhisperRoom</h1>
          <p className="text-gray-400 text-center">
            Joining room <span className="text-blue-400 font-mono font-semibold">{code}</span>
          </p>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg
                       focus:outline-none focus:border-blue-500 text-lg"
          />
          <button
            type="submit"
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold
                       transition-colors"
          >
            Join
          </button>
        </form>
      </div>
    );
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
          <ChatInput onSend={handleSend} onGif={handleGif} />
        </div>
        <div className={`${showVoice ? "flex flex-col flex-1 md:flex-none" : "hidden"} md:flex`}>
          <VoicePanel users={users} />
        </div>
      </div>
    </div>
  );
}
