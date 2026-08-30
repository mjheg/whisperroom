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
          <div className="flex-1 min-w-0">
            {msg.type === "gif" && msg.gifUrl ? (
              <img
                src={msg.gifUrl}
                alt="GIF"
                className="max-w-xs rounded-lg"
                loading="lazy"
              />
            ) : (
              <span className="text-gray-200 break-words">{msg.text}</span>
            )}
          </div>
          <span className="text-gray-600 text-xs shrink-0 self-end ml-auto">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
