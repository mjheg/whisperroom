import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { generateRoomCode } from "./src/lib/roomCode";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  User,
} from "./src/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface RoomState {
  users: Map<string, User>;
  createdAt: Date;
}

const rooms = new Map<string, RoomState>();

// Tic-Tac-Toe game state
interface TTTGame {
  id: string;
  players: [string, string]; // socket ids
  nicknames: [string, string];
  board: string[]; // "" | "X" | "O"
  turn: string; // socket id of whose turn
  winner: string | null;
  draw: boolean;
}
const tttGames = new Map<string, TTTGame>();
const pendingInvites = new Map<string, string>(); // gameId -> challenger socketId

function checkTTTWinner(board: string[]): string | null {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6],         // diags
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function getActiveCodes(): Set<string> {
  return new Set(rooms.keys());
}

function broadcastUserList(io: Server, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const users = Array.from(room.users.values());
  io.to(roomCode).emit("room:joined", { code: roomCode, users });
}

app.prepare().then(() => {
  const httpServer = createServer(handle);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
    path: "/api/socketio",
  });

  io.on("connection", (socket) => {
    let currentRoom: string | null = null;

    socket.on("room:create", (nickname, callback) => {
      const code = generateRoomCode(getActiveCodes());
      // Create empty room — user will join via room:join after page navigation
      const room: RoomState = { users: new Map(), createdAt: new Date() };
      rooms.set(code, room);
      callback(code);
    });

    socket.on("room:join", ({ code, nickname }) => {
      // Leave current room first if already in one
      if (currentRoom) {
        const prevRoom = rooms.get(currentRoom);
        if (prevRoom) {
          prevRoom.users.delete(socket.id!);
          socket.leave(currentRoom);
          socket.to(currentRoom).emit("room:user-left", socket.id!);
          if (prevRoom.users.size === 0) {
            rooms.delete(currentRoom);
          } else {
            broadcastUserList(io, currentRoom);
          }
        }
        currentRoom = null;
      }

      const room = rooms.get(code);
      if (!room) {
        socket.emit("room:not-found");
        return;
      }
      if (room.users.size >= 8) {
        socket.emit("room:full");
        return;
      }
      const user: User = { socketId: socket.id!, nickname, inVoice: false };
      room.users.set(socket.id!, user);
      socket.join(code);
      currentRoom = code;
      socket.to(code).emit("room:user-joined", user);
      broadcastUserList(io, code);
    });

    socket.on("chat:send", (text) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (!user) return;
      const message = {
        id: `${socket.id}-${Date.now()}`,
        nickname: user.nickname,
        text,
        timestamp: Date.now(),
      };
      io.to(currentRoom).emit("chat:message", message);
    });

    socket.on("chat:gif", (gifUrl) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (!user) return;
      const message = {
        id: `${socket.id}-${Date.now()}`,
        nickname: user.nickname,
        text: "",
        type: "gif" as const,
        gifUrl,
        timestamp: Date.now(),
      };
      io.to(currentRoom).emit("chat:message", message);
    });

    // Tic-Tac-Toe
    socket.on("game:ttt-start", (opponentId) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const me = room.users.get(socket.id!);
      const opponent = room.users.get(opponentId);
      if (!me || !opponent) return;
      const gameId = `ttt-${Date.now()}`;
      pendingInvites.set(gameId, socket.id!);
      // Send invite to opponent
      io.to(opponentId).emit("game:ttt-invite", {
        gameId,
        from: socket.id!,
        fromNickname: me.nickname,
      });
    });

    socket.on("game:ttt-accept", (gameId) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      // Find who sent the invite (gameId contains the info, but we need the challenger)
      // Extract from the invite — the "from" socket sent the invite
      // For simplicity, we store a pending invite map
      const fromId = pendingInvites.get(gameId);
      if (!fromId) return;
      pendingInvites.delete(gameId);

      const game: TTTGame = {
        id: gameId,
        players: [fromId, socket.id!],
        nicknames: [
          room.users.get(fromId)?.nickname || "Player 1",
          room.users.get(socket.id!)?.nickname || "Player 2",
        ],
        board: Array(9).fill(""),
        turn: fromId, // challenger goes first
        winner: null,
        draw: false,
      };
      tttGames.set(gameId, game);
      // Notify both players
      io.to(fromId).emit("game:ttt-started", {
        gameId, players: game.players, nicknames: game.nicknames, board: game.board, turn: game.turn,
      });
      io.to(socket.id!).emit("game:ttt-started", {
        gameId, players: game.players, nicknames: game.nicknames, board: game.board, turn: game.turn,
      });
    });

    socket.on("game:ttt-move", ({ index, gameId }) => {
      const game = tttGames.get(gameId);
      if (!game) return;
      if (game.turn !== socket.id!) return;
      if (game.board[index] !== "") return;
      if (game.winner || game.draw) return;

      const mark = game.players[0] === socket.id! ? "X" : "O";
      game.board[index] = mark;

      const winnerMark = checkTTTWinner(game.board);
      if (winnerMark) {
        game.winner = winnerMark === "X" ? game.players[0] : game.players[1];
      } else if (game.board.every(c => c !== "")) {
        game.draw = true;
      } else {
        game.turn = game.players[0] === socket.id! ? game.players[1] : game.players[0];
      }

      const update = { gameId, board: game.board, turn: game.turn, winner: game.winner, draw: game.draw };
      io.to(game.players[0]).emit("game:ttt-update", update);
      io.to(game.players[1]).emit("game:ttt-update", update);

      if (game.winner || game.draw) {
        tttGames.delete(gameId);
      }
    });

    socket.on("voice:join", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (!user) return;
      user.inVoice = true;
      io.to(currentRoom).emit("voice:user-joined", socket.id!);
      broadcastUserList(io, currentRoom);
    });

    socket.on("voice:leave", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (!user) return;
      user.inVoice = false;
      io.to(currentRoom).emit("voice:user-left", socket.id!);
      broadcastUserList(io, currentRoom);
    });

    socket.on("voice:signal", ({ to, signal }) => {
      socket.to(to).emit("voice:signal", { from: socket.id!, signal });
    });

    socket.on("disconnect", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const user = room.users.get(socket.id!);
      if (user?.inVoice) {
        io.to(currentRoom).emit("voice:user-left", socket.id!);
      }
      room.users.delete(socket.id!);
      socket.to(currentRoom).emit("room:user-left", socket.id!);
      if (room.users.size === 0) {
        rooms.delete(currentRoom);
      } else {
        broadcastUserList(io, currentRoom);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> WhisperRoom running on http://localhost:${port}`);
  });
});
