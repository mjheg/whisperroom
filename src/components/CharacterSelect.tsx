"use client";

import { useState } from "react";
import { CHARACTERS } from "@/game/arena";

interface CharacterSelectProps {
  onSelect: (characterId: string) => void;
  onCancel: () => void;
}

export default function CharacterSelect({ onSelect, onCancel }: CharacterSelectProps) {
  const [selected, setSelected] = useState("gojo");

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-2">Choose Your Character</h2>
        <p className="text-gray-400 text-center text-sm mb-6">Jujutsu Battle Arena</p>

        <div className="space-y-3">
          {CHARACTERS.map((char) => (
            <button
              key={char.id}
              onClick={() => setSelected(char.id)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                selected === char.id
                  ? "border-white bg-gray-700"
                  : "border-gray-600 bg-gray-700/50 hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: char.color }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{char.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-600 rounded">{char.abilityName}</span>
                  </div>
                  <p className="text-gray-400 text-sm">{char.abilityDescription}</p>
                  <p className="text-gray-500 text-xs mt-1">Cooldown: {char.abilityCooldown}s</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(selected)}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
          >
            Fight!
          </button>
        </div>

        <div className="mt-4 text-center text-gray-500 text-xs">
          WASD to move · Click to shoot · Q for ability
        </div>
      </div>
    </div>
  );
}
