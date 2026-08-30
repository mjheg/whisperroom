"use client";

import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";

interface TicTacToeProps {
  gameId: string;
  players: [string, string];
  nicknames: [string, string];
  onClose: () => void;
}

export default function TicTacToe({ gameId, players, nicknames, onClose }: TicTacToeProps) {
  const [board, setBoard] = useState<string[]>(Array(9).fill(""));
  const [turn, setTurn] = useState(players[0]);
  const [winner, setWinner] = useState<string | null>(null);
  const [draw, setDraw] = useState(false);

  const socket = getSocket();
  const myId = socket.id;
  const myIndex = players[0] === myId ? 0 : 1;
  const myMark = myIndex === 0 ? "X" : "O";
  const isMyTurn = turn === myId && !winner && !draw;

  useEffect(() => {
    socket.on("game:ttt-update", (data) => {
      if (data.gameId !== gameId) return;
      setBoard(data.board);
      setTurn(data.turn);
      setWinner(data.winner);
      setDraw(data.draw);
    });

    return () => {
      socket.off("game:ttt-update");
    };
  }, [gameId, socket]);

  function handleClick(index: number) {
    if (!isMyTurn || board[index] !== "") return;
    socket.emit("game:ttt-move", { index, gameId });
  }

  function getStatus() {
    if (winner) {
      return winner === myId ? "You win!" : `${nicknames[players.indexOf(winner)]} wins!`;
    }
    if (draw) return "Draw!";
    return isMyTurn ? "Your turn" : `${nicknames[players.indexOf(turn)]}'s turn`;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-xs">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Tic-Tac-Toe</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <p className="text-center text-sm mb-1 text-gray-400">
          {nicknames[0]} (X) vs {nicknames[1]} (O)
        </p>
        <p className="text-center text-sm mb-4 text-gray-300">
          You are <span className="font-bold text-blue-400">{myMark}</span>
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              disabled={!isMyTurn || cell !== ""}
              className={`w-full aspect-square text-3xl font-bold rounded-lg transition-colors
                ${cell === "" && isMyTurn
                  ? "bg-gray-700 hover:bg-gray-600 cursor-pointer"
                  : "bg-gray-700/50 cursor-default"}
                ${cell === "X" ? "text-blue-400" : "text-red-400"}`}
            >
              {cell}
            </button>
          ))}
        </div>

        <p className={`text-center font-semibold ${winner === myId ? "text-green-400" : winner ? "text-red-400" : draw ? "text-yellow-400" : "text-gray-300"}`}>
          {getStatus()}
        </p>

        {(winner || draw) && (
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
