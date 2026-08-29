# WhisperRoom - Design Spec

No-login, room-code-based chat & voice chat web app.

## Problem

Sharing game room codes out loud in class is awkward. Need a simple way for friends to communicate privately — just enter a code and start chatting.

## Core Flow

1. User opens the site
2. Enters nickname + room code (or creates a new room)
3. Instantly joins a text chat room
4. Optionally clicks "Join Voice" to enable voice chat

## Room Code Format

- Pattern: `{english-word}-{2 digits}{2 letters}` (e.g., `cat-3K`, `moon-7R`, `fire-2X`)
- Word pool: ~100 common English words (cat, dog, moon, fire, star, etc.)
- Suffix: random 2-digit + 2-letter combo for uniqueness
- Generated server-side, guaranteed unique among active rooms

## Constraints

- Max 8 users per room
- Room auto-deletes when all users leave (no persistence)
- No chat history saved — only see messages after joining
- No login, no accounts, no cookies for auth
- Works on all modern browsers: Chrome, Firefox, Safari, Edge (desktop + mobile + tablet)

## Architecture

### Tech Stack

- **Frontend:** Next.js (App Router)
- **Real-time chat:** Socket.io (WebSocket with fallback)
- **Voice chat:** WebRTC (peer-to-peer)
- **Signaling server:** Socket.io (same server handles signaling)
- **Deployment:** Vercel (frontend) + separate Node.js server (Socket.io + signaling)

### Data Flow

```
User A (browser)
  ├── Socket.io ──── Server ──── Socket.io ── User B (browser)
  │                  (relay)
  └── WebRTC ─────────────────── P2P ──────── User B (browser)
```

- Text chat: messages go through the Socket.io server (relay)
- Voice chat: WebRTC peer-to-peer after signaling through Socket.io
- Server holds no persistent data — rooms exist only in memory

### Voice Chat (WebRTC)

- P2P mesh topology (each peer connects to every other peer)
- Max 8 peers = max 28 connections (manageable)
- Socket.io handles signaling (offer/answer/ICE candidates)
- STUN servers for NAT traversal (Google public STUN)
- Mute/unmute toggle per user

### Server State (in-memory only)

```
rooms: Map<roomCode, {
  users: Map<socketId, { nickname, inVoice }>
  createdAt: Date
}>
```

## Pages

### Landing Page (`/`)
- App name/logo
- Nickname input
- Room code input + "Join" button
- "Create Room" button (generates code, copies to clipboard)

### Chat Room (`/room/[code]`)
- Header: room code (click to copy) + user count + leave button
- Chat area: messages with nickname + timestamp
- Message input bar
- Voice chat panel: "Join Voice" button, list of voice participants, mute toggle

## MVP Scope

In:
- Room creation with unique code
- Join room by code
- Real-time text chat
- Voice chat with join/leave/mute
- Responsive design (mobile + desktop)
- Copy room code to clipboard

Out (future):
- File/image sharing
- Screen sharing
- Room passwords
- Persistent chat history
- User avatars
- Ads/monetization
- Admin/moderator controls

## Monetization Plan (post-MVP)

1. Google AdSense banner ads (first)
2. Premium features: 16-person rooms, screen share, file share, room passwords
3. Cosmetics: chat themes, emoji packs
