"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import type { DrawStroke } from "@/types";

const COLORS = ["#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ec4899"];
const WIDTHS = [2, 4, 8];

interface DrawBoardProps {
  onClose: () => void;
}

export default function DrawBoard({ onClose }: DrawBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#ffffff");
  const [width, setWidth] = useState(4);
  const [drawing, setDrawing] = useState(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: DrawStroke) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    socket.on("draw:stroke", (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawStroke(ctx, data);
    });

    socket.on("draw:clear", () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off("draw:stroke");
      socket.off("draw:clear");
    };
  }, [drawStroke]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setDrawing(true);
    const pos = getPos(e);
    currentStroke.current = [pos];
  }

  function handleMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    currentStroke.current.push(pos);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points = currentStroke.current;
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  }

  function handleEnd() {
    if (!drawing) return;
    setDrawing(false);
    if (currentStroke.current.length > 1) {
      const socket = getSocket();
      const stroke: DrawStroke = {
        points: currentStroke.current,
        color,
        width,
      };
      socket.emit("draw:stroke", stroke);
    }
    currentStroke.current = [];
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const socket = getSocket();
    socket.emit("draw:clear");
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl overflow-hidden w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
          <h3 className="font-bold">Draw Board</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <canvas
          ref={canvasRef}
          width={500}
          height={400}
          className="w-full bg-gray-900 cursor-crosshair touch-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />

        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-700">
          {/* Colors */}
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${color === c ? "ring-2 ring-white scale-110" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Width */}
          <div className="flex gap-1 ml-2">
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
                  ${width === w ? "bg-gray-600" : "bg-gray-700 hover:bg-gray-600"}`}
              >
                <div className="bg-white rounded-full" style={{ width: w * 2, height: w * 2 }} />
              </button>
            ))}
          </div>

          <button
            onClick={handleClear}
            className="ml-auto px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-semibold transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
