"use client";

import { useState } from "react";
import type { User } from "@/types";

interface GameMenuProps {
  users: User[];
  mySocketId: string;
  onChallenge: (opponentId: string) => void;
}

export default function GameMenu({ users, mySocketId, onChallenge }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const others = users.filter((u) => u.socketId !== mySocketId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-600 rounded-lg
                   transition-colors text-sm font-semibold"
      >
        Game
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700">
            <p className="text-xs text-gray-400 font-semibold">Tic-Tac-Toe — pick opponent</p>
          </div>
          {others.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">No other players</p>
          ) : (
            others.map((u) => (
              <button
                key={u.socketId}
                onClick={() => { onChallenge(u.socketId); setOpen(false); }}
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
