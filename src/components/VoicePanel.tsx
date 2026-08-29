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
    <aside className="w-full md:w-64 bg-gray-900 md:border-l border-gray-800 p-4 flex flex-col gap-3">
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
