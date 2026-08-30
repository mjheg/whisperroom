import type { Server } from "socket.io";
import {
  ARENA_W, ARENA_H, PLAYER_RADIUS, PLAYER_SPEED,
  PROJECTILE_SPEED, PROJECTILE_RADIUS, TICK_RATE,
  CHARACTERS, OBSTACLES, SPAWN_POSITIONS,
  type ArenaPlayer, type Projectile, type ArenaState,
} from "./arena";

interface PlayerInput {
  keys: { w: boolean; a: boolean; s: boolean; d: boolean };
  mouseX: number;
  mouseY: number;
  shooting: boolean;
  ability: boolean;
}

interface ArenaRoom {
  roomCode: string;
  players: Map<string, ArenaPlayer>;
  inputs: Map<string, PlayerInput>;
  projectiles: Projectile[];
  interval: ReturnType<typeof setInterval> | null;
  projectileIdCounter: number;
  shootCooldowns: Map<string, number>; // ms remaining
}

const arenaRooms = new Map<string, ArenaRoom>();

function rectCircleCollision(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number, cr: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (cr * cr);
}

function clampToArena(x: number, y: number, radius: number): { x: number; y: number } {
  return {
    x: Math.max(radius, Math.min(ARENA_W - radius, x)),
    y: Math.max(radius, Math.min(ARENA_H - radius, y)),
  };
}

function collidesWithObstacle(x: number, y: number, radius: number): boolean {
  for (const obs of OBSTACLES) {
    if (rectCircleCollision(obs.x, obs.y, obs.w, obs.h, x, y, radius)) {
      return true;
    }
  }
  return false;
}

function tick(arena: ArenaRoom, io: Server) {
  const alivePlayers = Array.from(arena.players.values()).filter(p => p.alive);

  // Update ability cooldowns
  for (const player of arena.players.values()) {
    if (player.abilityTimer > 0) {
      player.abilityTimer = Math.max(0, player.abilityTimer - TICK_RATE);
    }
    // Shield timer
    if (player.shielded && player.abilityTimer <= 0) {
      // Shield handled separately below
    }
    player.dashing = false;
    player.slashing = false;
  }

  // Update shoot cooldowns
  for (const [id, cd] of arena.shootCooldowns) {
    if (cd > 0) arena.shootCooldowns.set(id, cd - TICK_RATE);
  }

  // Process inputs
  for (const [socketId, input] of arena.inputs) {
    const player = arena.players.get(socketId);
    if (!player || !player.alive) continue;

    // Movement
    let dx = 0, dy = 0;
    if (input.keys.w) dy -= 1;
    if (input.keys.s) dy += 1;
    if (input.keys.a) dx -= 1;
    if (input.keys.d) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / len) * PLAYER_SPEED;
      dy = (dy / len) * PLAYER_SPEED;

      const newX = player.x + dx;
      const newY = player.y + dy;
      const clamped = clampToArena(newX, newY, PLAYER_RADIUS);

      if (!collidesWithObstacle(clamped.x, clamped.y, PLAYER_RADIUS)) {
        player.x = clamped.x;
        player.y = clamped.y;
      }
    }

    // Shooting
    if (input.shooting && (arena.shootCooldowns.get(socketId) || 0) <= 0) {
      const angle = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);
      arena.projectiles.push({
        id: `proj-${arena.projectileIdCounter++}`,
        ownerId: socketId,
        x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 5),
        y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 5),
        vx: Math.cos(angle) * PROJECTILE_SPEED,
        vy: Math.sin(angle) * PROJECTILE_SPEED,
        damage: 12,
      });
      arena.shootCooldowns.set(socketId, 300); // 300ms cooldown
    }

    // Ability
    if (input.ability && player.abilityTimer <= 0) {
      const char = CHARACTERS.find(c => c.id === player.characterId);
      if (!char) continue;

      if (char.id === "gojo") {
        // Infinity - shield for 3 seconds
        player.shielded = true;
        player.abilityTimer = char.abilityCooldown * 1000;
        setTimeout(() => { player.shielded = false; }, 3000);
      } else if (char.id === "sukuna") {
        // Cleave - area damage around player
        player.slashing = true;
        player.abilityTimer = char.abilityCooldown * 1000;
        for (const other of alivePlayers) {
          if (other.id === socketId) continue;
          const dist = Math.sqrt((other.x - player.x) ** 2 + (other.y - player.y) ** 2);
          if (dist < 120 && !other.shielded) {
            other.hp = Math.max(0, other.hp - 35);
            if (other.hp <= 0) other.alive = false;
          }
        }
      } else if (char.id === "itadori") {
        // Black Flash - dash forward and damage on contact
        player.dashing = true;
        player.abilityTimer = char.abilityCooldown * 1000;
        const angle = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);
        const dashDist = 100;
        const newX = player.x + Math.cos(angle) * dashDist;
        const newY = player.y + Math.sin(angle) * dashDist;
        const clamped = clampToArena(newX, newY, PLAYER_RADIUS);
        if (!collidesWithObstacle(clamped.x, clamped.y, PLAYER_RADIUS)) {
          player.x = clamped.x;
          player.y = clamped.y;
        }
        // Damage anyone near endpoint
        for (const other of alivePlayers) {
          if (other.id === socketId) continue;
          const dist = Math.sqrt((other.x - player.x) ** 2 + (other.y - player.y) ** 2);
          if (dist < 40 && !other.shielded) {
            other.hp = Math.max(0, other.hp - 25);
            if (other.hp <= 0) other.alive = false;
          }
        }
      }
    }
  }

  // Update projectiles
  arena.projectiles = arena.projectiles.filter(proj => {
    proj.x += proj.vx;
    proj.y += proj.vy;

    // Out of bounds
    if (proj.x < 0 || proj.x > ARENA_W || proj.y < 0 || proj.y > ARENA_H) return false;

    // Hit obstacle
    if (collidesWithObstacle(proj.x, proj.y, PROJECTILE_RADIUS)) return false;

    // Hit player
    for (const player of arena.players.values()) {
      if (!player.alive || player.id === proj.ownerId) continue;
      const dist = Math.sqrt((player.x - proj.x) ** 2 + (player.y - proj.y) ** 2);
      if (dist < PLAYER_RADIUS + PROJECTILE_RADIUS) {
        if (!player.shielded) {
          player.hp = Math.max(0, player.hp - proj.damage);
          if (player.hp <= 0) player.alive = false;
        }
        return false;
      }
    }

    return true;
  });

  // Check win condition
  const aliveNow = Array.from(arena.players.values()).filter(p => p.alive);
  let gameOver = false;
  let winnerId: string | null = null;
  let winnerNickname: string | null = null;

  if (aliveNow.length <= 1 && arena.players.size > 1) {
    gameOver = true;
    if (aliveNow.length === 1) {
      winnerId = aliveNow[0].id;
      winnerNickname = aliveNow[0].nickname;
    }
  }

  // Broadcast state
  const state: ArenaState = {
    players: Array.from(arena.players.values()),
    projectiles: arena.projectiles,
    gameOver,
    winnerId,
    winnerNickname,
  };

  io.to(arena.roomCode).emit("arena:state", state);

  if (gameOver && arena.interval) {
    clearInterval(arena.interval);
    arena.interval = null;
    // Clean up after a delay
    setTimeout(() => arenaRooms.delete(arena.roomCode), 5000);
  }
}

export function setupArena(io: Server, socket: import("socket.io").Socket, getCurrentRoom: () => string | null, getRoomUsers: () => Map<string, { nickname: string }> | null) {
  socket.on("arena:start", (characterId: string) => {
    const roomCode = getCurrentRoom();
    if (!roomCode) return;

    let arena = arenaRooms.get(roomCode);
    if (!arena) {
      arena = {
        roomCode,
        players: new Map(),
        inputs: new Map(),
        projectiles: [],
        interval: null,
        projectileIdCounter: 0,
        shootCooldowns: new Map(),
      };
      arenaRooms.set(roomCode, arena);
    }

    // Add this player
    const users = getRoomUsers();
    const user = users?.get(socket.id!);
    if (!user) return;

    const char = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
    const spawnIdx = arena.players.size % SPAWN_POSITIONS.length;
    const spawn = SPAWN_POSITIONS[spawnIdx];

    const player: ArenaPlayer = {
      id: socket.id!,
      nickname: user.nickname,
      characterId: char.id,
      x: spawn.x,
      y: spawn.y,
      hp: char.hp,
      maxHp: char.hp,
      alive: true,
      shielded: false,
      abilityTimer: 0,
    };

    arena.players.set(socket.id!, player);

    // Notify all in room that someone joined arena
    io.to(roomCode).emit("arena:started", { players: Array.from(arena.players.values()) });

    // Start game loop if not running
    if (!arena.interval && arena.players.size >= 2) {
      arena.interval = setInterval(() => tick(arena!, io), TICK_RATE);
    }
  });

  socket.on("arena:input", (input) => {
    const roomCode = getCurrentRoom();
    if (!roomCode) return;
    const arena = arenaRooms.get(roomCode);
    if (!arena) return;
    arena.inputs.set(socket.id!, input);
  });

  socket.on("arena:join", (characterId: string) => {
    // Same as arena:start — allows joining an existing game
    socket.emit("arena:start", characterId);
  });

  // Clean up on disconnect
  socket.on("disconnect", () => {
    const roomCode = getCurrentRoom();
    if (!roomCode) return;
    const arena = arenaRooms.get(roomCode);
    if (!arena) return;
    const player = arena.players.get(socket.id!);
    if (player) {
      player.alive = false;
      player.hp = 0;
    }
    arena.inputs.delete(socket.id!);
  });
}
