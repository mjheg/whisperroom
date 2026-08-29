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

    // Always set up listeners first, then connect and join
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

    // Join room only after socket is fully connected
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
