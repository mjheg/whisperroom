"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/socket";

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
    // Connect temporarily just to create the room, then disconnect
    const socket = getSocket();
    socket.connect();
    socket.emit("room:create", nickname.trim(), (code) => {
      disconnectSocket();
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
    // Just save nickname and navigate — ChatRoom handles the socket connection
    sessionStorage.setItem("whisper-nickname", nickname.trim());
    router.push(`/room/${roomCode.trim()}`);
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
