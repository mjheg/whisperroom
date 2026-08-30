"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface ChatInputProps {
  onSend: (text: string) => void;
  onGif: (gifUrl: string) => void;
}

interface TenorGif {
  id: string;
  media_formats: {
    tinygif: { url: string };
    gif: { url: string };
  };
}

const TENOR_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Public Tenor API key

export default function ChatInput({ onSend, onGif }: ChatInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const gifRef = useRef<HTMLDivElement>(null);

  // Close popups on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
      if (gifRef.current && !gifRef.current.contains(e.target as Node)) {
        setShowGif(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  async function searchGifs(query: string) {
    if (!query.trim()) {
      // Load trending
      setGifLoading(true);
      const res = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=20&media_filter=tinygif,gif`
      );
      const data = await res.json();
      setGifs(data.results || []);
      setGifLoading(false);
      return;
    }
    setGifLoading(true);
    const res = await fetch(
      `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=20&media_filter=tinygif,gif`
    );
    const data = await res.json();
    setGifs(data.results || []);
    setGifLoading(false);
  }

  function handleGifOpen() {
    setShowGif(!showGif);
    setShowEmoji(false);
    if (!showGif) searchGifs("");
  }

  function handleGifSelect(gif: TenorGif) {
    onGif(gif.media_formats.gif.url);
    setShowGif(false);
    setGifSearch("");
  }

  return (
    <div className="relative bg-gray-900 border-t border-gray-800">
      {/* Emoji Picker */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full left-0 mb-2 ml-2 z-50">
          <EmojiPicker
            onEmojiClick={(emoji) => {
              setText((prev) => prev + emoji.emoji);
              setShowEmoji(false);
            }}
            theme={"dark" as never}
            width={300}
            height={350}
          />
        </div>
      )}

      {/* GIF Picker */}
      {showGif && (
        <div ref={gifRef} className="absolute bottom-full left-0 mb-2 ml-2 z-50 w-80 max-h-96 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search GIFs..."
              value={gifSearch}
              onChange={(e) => {
                setGifSearch(e.target.value);
                searchGifs(e.target.value);
              }}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm
                         focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">
            {gifLoading && <p className="text-gray-400 text-sm col-span-2 text-center py-4">Loading...</p>}
            {!gifLoading && gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleGifSelect(gif)}
                className="rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <img
                  src={gif.media_formats.tinygif.url}
                  alt="GIF"
                  className="w-full h-24 object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-xl shrink-0"
          title="Emoji"
        >
          😀
        </button>
        <button
          type="button"
          onClick={handleGifOpen}
          className="px-2 py-1 hover:bg-gray-800 rounded-lg transition-colors text-xs font-bold text-gray-400 shrink-0"
          title="GIF"
        >
          GIF
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg
                     focus:outline-none focus:border-blue-500"
          autoFocus
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold
                     transition-colors shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
