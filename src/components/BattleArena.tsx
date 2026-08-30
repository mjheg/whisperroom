"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import {
  ARENA_W, ARENA_H, PLAYER_RADIUS, OBSTACLES, CHARACTERS,
  type ArenaState,
} from "@/game/arena";

interface BattleArenaProps {
  onClose: () => void;
}

export default function BattleArena({ onClose }: BattleArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<ArenaState | null>(null);
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const mouseRef = useRef({ x: 0, y: 0, shooting: false });
  const abilityRef = useRef(false);
  const animRef = useRef<number>(0);

  const socket = getSocket();
  const myId = socket.id;

  // Auto-focus container on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Listen for game state
  useEffect(() => {
    socket.on("arena:state", (state: ArenaState) => {
      setGameState(state);
    });
    return () => { socket.off("arena:state"); };
  }, [socket]);

  // Send inputs at 20fps
  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit("arena:input", {
        keys: { ...keysRef.current },
        mouseX: mouseRef.current.x,
        mouseY: mouseRef.current.y,
        shooting: mouseRef.current.shooting,
        ability: abilityRef.current,
      });
      abilityRef.current = false;
    }, 50);
    return () => clearInterval(interval);
  }, [socket]);

  // Keyboard handlers on container div
  function handleKeyDown(e: React.KeyboardEvent) {
    e.preventDefault();
    const key = e.key.toLowerCase();
    if (key === "w" || key === "arrowup") keysRef.current.w = true;
    if (key === "a" || key === "arrowleft") keysRef.current.a = true;
    if (key === "s" || key === "arrowdown") keysRef.current.s = true;
    if (key === "d" || key === "arrowright") keysRef.current.d = true;
    if (key === "q") abilityRef.current = true;
  }

  function handleKeyUp(e: React.KeyboardEvent) {
    const key = e.key.toLowerCase();
    if (key === "w" || key === "arrowup") keysRef.current.w = false;
    if (key === "a" || key === "arrowleft") keysRef.current.a = false;
    if (key === "s" || key === "arrowdown") keysRef.current.s = false;
    if (key === "d" || key === "arrowright") keysRef.current.d = false;
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = ARENA_W / rect.width;
    const scaleY = ARENA_H / rect.height;
    mouseRef.current.x = (e.clientX - rect.left) * scaleX;
    mouseRef.current.y = (e.clientY - rect.top) * scaleY;
  }, []);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) {
      animRef.current = requestAnimationFrame(render);
      return;
    }
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    // Grid
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    for (let x = 0; x < ARENA_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
    }
    for (let y = 0; y < ARENA_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
    }

    // Obstacles
    ctx.fillStyle = "#374151";
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 2;
    for (const obs of OBSTACLES) {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }

    // Projectiles
    for (const proj of gameState.projectiles) {
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251, 191, 36, 0.3)";
      ctx.fill();
    }

    // Players
    for (const player of gameState.players) {
      if (!player.alive) continue;
      const char = CHARACTERS.find(c => c.id === player.characterId);
      const color = char?.color || "#ffffff";
      const isMe = player.id === myId;

      // Shield (Gojo)
      if (player.shielded) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
        ctx.fill();
      }

      // Slash (Sukuna)
      if (player.slashing) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, 120, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
        ctx.fill();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Dash trail (Itadori)
      if (player.dashing && player.characterId === "itadori") {
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(249, 115, 22, 0.4)";
        ctx.fill();
      }

      // Boost aura (Naoya)
      if (player.boosted) {
        // Speed lines around player
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS + 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Inner glow
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
        ctx.fill();
      }

      // Teleport flash (Naoya dash)
      if (player.dashing && player.characterId === "naoya") {
        ctx.beginPath();
        ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(6, 182, 212, 0.4)";
        ctx.fill();
      }

      // Player body
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isMe) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // HP bar
      const barW = 40;
      const barH = 4;
      const barX = player.x - barW / 2;
      const barY = player.y - PLAYER_RADIUS - 12;
      const hpRatio = player.hp / player.maxHp;
      ctx.fillStyle = "#374151";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#eab308" : "#ef4444";
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      // Nickname + character name
      ctx.fillStyle = isMe ? "#ffffff" : "#9ca3af";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${player.nickname}`, player.x, barY - 4);
    }

    // HUD
    const me = gameState.players.find(p => p.id === myId);
    if (me) {
      const char = CHARACTERS.find(c => c.id === me.characterId);
      if (char) {
        const cdSec = Math.ceil(me.abilityTimer / 1000);
        ctx.fillStyle = me.abilityTimer > 0 ? "#6b7280" : "#22c55e";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(
          `[Q] ${char.abilityName}${cdSec > 0 ? ` (${cdSec}s)` : " READY"}`,
          10, ARENA_H - 10
        );
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`HP: ${me.hp}/${me.maxHp}`, 10, ARENA_H - 30);

        // Boost indicator for Naoya
        if (me.boosted) {
          ctx.fillStyle = "#06b6d4";
          ctx.fillText("⚡ BOOSTED", 10, ARENA_H - 50);
        }
      }
    }

    // Game over
    if (gameState.gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      if (gameState.winnerId === myId) {
        ctx.fillStyle = "#22c55e";
        ctx.fillText("YOU WIN!", ARENA_W / 2, ARENA_H / 2 - 20);
      } else if (gameState.winnerNickname) {
        ctx.fillStyle = "#ef4444";
        ctx.fillText(`${gameState.winnerNickname} WINS!`, ARENA_W / 2, ARENA_H / 2 - 20);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillText("DRAW!", ARENA_W / 2, ARENA_H / 2 - 20);
      }
      ctx.fillStyle = "#9ca3af";
      ctx.font = "16px sans-serif";
      ctx.fillText("Click Close to exit", ARENA_W / 2, ARENA_H / 2 + 20);
    }

    animRef.current = requestAnimationFrame(render);
  }, [gameState, myId]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 outline-none"
    >
      <div className="flex items-center gap-4 mb-2">
        <h2 className="text-lg font-bold">Jujutsu Battle Arena</h2>
        <span className="text-gray-400 text-sm">WASD move · Click shoot · Q ability</span>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm font-semibold transition-colors"
        >
          Close
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={ARENA_W}
        height={ARENA_H}
        className="border border-gray-700 rounded-lg cursor-crosshair max-w-full"
        style={{ maxHeight: "80vh" }}
        onMouseMove={handleMouseMove}
        onMouseDown={() => { mouseRef.current.shooting = true; }}
        onMouseUp={() => { mouseRef.current.shooting = false; }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {!gameState && (
        <p className="text-gray-400 mt-4">Waiting for another player to join...</p>
      )}
    </div>
  );
}
