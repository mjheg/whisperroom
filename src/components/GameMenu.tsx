"use client";

import { useState } from "react";
import type { User } from "@/types";

interface GameMenuProps {
  users: User[];
  mySocketId: string;
  onChallenge: (opponentId: string) => void;
  onArena: () => void;
}

export default function GameMenu({ users, mySocketId, onChallenge, onArena }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const [showTTT, setShowTTT] = useState(false);
  const others = users.filter((u) => u.socketId !== mySocketId);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setShowTTT(false); }}
        className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-600 rounded-lg
                   transition-colors text-sm font-semibold"
      >
        Game
      </button>

      {open && !showTTT && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onArena(); }}
            className="w-full px-3 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700"
          >
            <div className="font-semibold text-sm">⚔️ Battle Arena</div>
            <div className="text-xs text-gray-400">Jujutsu Kaisen style 2D battle</div>
          </button>
          <button
            onClick={() => setShowTTT(true)}
            className="w-full px-3 py-3 text-left hover:bg-gray-700 transition-colors"
          >
            <div className="font-semibold text-sm">❌ Tic-Tac-Toe</div>
            <div className="text-xs text-gray-400">1v1 classic game</div>
          </button>
        </div>
      )}

      {open && showTTT && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
            <button onClick={() => setShowTTT(false)} className="text-gray-400 hover:text-white text-sm">←</button>
            <p className="text-xs text-gray-400 font-semibold">Tic-Tac-Toe — pick opponent</p>
          </div>
          {others.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">No other players</p>
          ) : (
            others.map((u) => (
              <button
                key={u.socketId}
                onClick={() => { onChallenge(u.socketId); setOpen(false); setShowTTT(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
              >
                {u.nickname}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
