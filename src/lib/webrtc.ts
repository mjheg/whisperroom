"use client";

import { getSocket } from "./socket";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class WebRTCManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private remoteAudios: Map<string, HTMLAudioElement> = new Map();
  private _isMuted = false;
  private onPeersChanged: () => void;

  constructor(onPeersChanged: () => void) {
    this.onPeersChanged = onPeersChanged;
  }

  get isMuted() {
    return this._isMuted;
  }

  get activePeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  async joinVoice() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const socket = getSocket();

    socket.on("voice:signal", async ({ from, signal }) => {
      const signalData = signal as { type: string; sdp?: string; candidate?: RTCIceCandidateInit };

      if (signalData.type === "offer") {
        const pc = this.createPeer(from);
        await pc.setRemoteDescription(new RTCSessionDescription(signalData as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice:signal", { to: from, signal: answer });
      } else if (signalData.type === "answer") {
        const pc = this.peers.get(from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData as RTCSessionDescriptionInit));
        }
      } else if (signalData.candidate) {
        const pc = this.peers.get(from);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      }
    });

    socket.on("voice:user-joined", async (peerId) => {
      if (peerId === socket.id) return;
      const pc = this.createPeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("voice:signal", { to: peerId, signal: offer });
    });

    socket.on("voice:user-left", (peerId) => {
      this.removePeer(peerId);
    });

    socket.emit("voice:join");
  }

  private createPeer(peerId: string): RTCPeerConnection {
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit("voice:signal", {
          to: peerId,
          signal: { candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      this.remoteAudios.set(peerId, audio);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.removePeer(peerId);
      }
    };

    this.peers.set(peerId, pc);
    this.onPeersChanged();
    return pc;
  }

  private removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    const audio = this.remoteAudios.get(peerId);
    if (audio) {
      audio.srcObject = null;
      this.remoteAudios.delete(peerId);
    }
    this.onPeersChanged();
  }

  toggleMute(): boolean {
    this._isMuted = !this._isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this._isMuted;
      });
    }
    return this._isMuted;
  }

  leaveVoice() {
    const socket = getSocket();
    socket.emit("voice:leave");
    socket.off("voice:signal");
    socket.off("voice:user-joined");
    socket.off("voice:user-left");

    this.peers.forEach((pc) => pc.close());
    this.peers.clear();

    this.remoteAudios.forEach((audio) => {
      audio.srcObject = null;
    });
    this.remoteAudios.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this._isMuted = false;
    this.onPeersChanged();
  }

  destroy() {
    this.leaveVoice();
  }
}
