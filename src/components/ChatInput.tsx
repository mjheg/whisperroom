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
