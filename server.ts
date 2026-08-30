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
