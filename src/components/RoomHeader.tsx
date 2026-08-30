"use client";

import { useState } from "react";

interface RoomHeaderProps {
  code: string;
  userCount: number;
  onLeave: () => void;
  onToggleVoice?: () => void;
  showVoiceToggle?: boolean;
  children?: React.ReactNode;
}

export default function RoomHeader({
  code,
  userCount,
  onLeave,
  onToggleVoice,
  showVoiceToggle,
  children,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="flex items-center justify-between px-3 py-2.5 bg-gray-900 border-b border-gray-800 gap-2">
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700
                   rounded-lg transition-colors text-sm font-mono shrink-0"
        title="Click to copy invite link"
      >
        <span className="text-blue-400 font-semibold">{code}</span>
        <span className="text-gray-500 text-xs">{copied ? "Link copied!" : "Invite"}</span>
      </button>

      <div className="flex items-center gap-2">
        {children}
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
