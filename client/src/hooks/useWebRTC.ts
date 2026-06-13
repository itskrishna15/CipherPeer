import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { 
  moderateMessage, 
  initializeModerationPipeline,
  ModerationResult
} from '../ai/moderationPipeline';
import { 
  generateUniqueId, 
  readFileSlice, 
  arrayBufferToBase64, 
  base64ToBlob, 
  FileMetadata, 
  FileReceiverSession 
} from '../utils/fileHelper';

const SIGNALING_URL = 'http://localhost:5000';
const CHUNK_SIZE = 49152; // 48KB raw -> becomes 64KB in base64 (WebRTC safe limit)

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  timestamp: number;
  isMe: boolean;
  isSystem?: boolean;
  isBlocked?: boolean;
  blockDetails?: {
    score: number;
    reasons: string[];
    details: any;
  };
  file?: {
    id: string;
    name: string;
    size: number;
    type: string;
    url?: string;
    progress: number;
    isComplete: boolean;
  };
}

export interface ConnectedPeer {
  socketId: string;
  username: string;
  peerInstance: Peer.Instance;
  connectionState: string;
  latency?: number;
}

export function useWebRTC(roomCode: string, username: string) {
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [aiStatus, setAiStatus] = useState<string>('Initializing AI...');
  const [isAiReady, setIsAiReady] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  
  // Keep peers in ref to access fresh values in callbacks
  const peersRef = useRef<Map<string, ConnectedPeer>>(new Map());
  
  // Cache received file chunks to avoid frequent re-renders
  // fileId -> Array of base64 chunks
  const fileChunksRef = useRef<Map<string, string[]>>(new Map());
  
  // Cache file receivers state
  const fileReceiversRef = useRef<Map<string, FileReceiverSession>>(new Map());

  // Initialize TensorFlow.js Toxicity model on mount
  useEffect(() => {
    const loadAI = async () => {
      try {
        setAiStatus('Loading toxicity model (25MB)...');
        await initializeModerationPipeline((status) => {
          setAiStatus(status);
        });
        setIsAiReady(true);
      } catch (err) {
        console.error('Failed to load TFJS model:', err);
        setAiStatus('Offline heuristics active');
        setIsAiReady(false);
      }
    };
    loadAI();
  }, []);

  // Set up socket and WebRTC peers
  useEffect(() => {
    if (!roomCode || !username) return;

    setConnectionStatus('connecting');
    const socket = io(SIGNALING_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      socket.emit('join-room', { roomCode, username });
    });

    // Received list of already joined users in the room
    socket.on('room-users', ({ users }: { users: { socketId: string; username: string }[] }) => {
      console.log('Room users list received:', users);
      setConnectionStatus(users.length > 0 ? 'connected' : 'connected'); // Connected to room, now waiting for P2P

      users.forEach((user) => {
        // Create an initiator Peer for each existing room participant
        createPeer(user.socketId, user.username, true, socket);
      });
    });

    // Another user joined the room
    socket.on('user-joined', ({ socketId, username: newUsername }) => {
      console.log(`User joined room: ${newUsername} (${socketId})`);
      // Create a receiver Peer (initiator: false) and wait for their offer
      createPeer(socketId, newUsername, false, socket);
    });

    // Received a signaling packet from a peer via server
    socket.on('signal', ({ senderSocketId, signal }) => {
      const peerWrapper = peersRef.current.get(senderSocketId);
      if (peerWrapper) {
        peerWrapper.peerInstance.signal(signal);
      }
    });

    // A peer left the room
    socket.on('user-left', ({ socketId, username: leftUsername }) => {
      console.log(`User left room: ${leftUsername} (${socketId})`);
      destroyPeer(socketId);
      
      // Post system announcement
      setMessages((prev) => [
        ...prev,
        {
          id: generateUniqueId(),
          senderId: 'system',
          senderName: 'System',
          text: `${leftUsername} disconnected.`,
          timestamp: Date.now(),
          isMe: false,
          isSystem: true
        }
      ]);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setConnectionStatus('disconnected');
      // Clear peers
      Array.from(peersRef.current.keys()).forEach(destroyPeer);
    });

    return () => {
      socket.disconnect();
      // Clear peers on unmount
      Array.from(peersRef.current.keys()).forEach(destroyPeer);
    };
  }, [roomCode, username]);

  // Peer management functions
  const createPeer = (peerSocketId: string, peerUsername: string, initiator: boolean, socket: Socket) => {
    console.log(`Creating peer connection: initiator=${initiator} to ${peerUsername}`);

    const peer = new Peer({
      initiator,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    const newPeerWrapper: ConnectedPeer = {
      socketId: peerSocketId,
      username: peerUsername,
      peerInstance: peer,
      connectionState: 'connecting'
    };

    peersRef.current.set(peerSocketId, newPeerWrapper);
    updatePeersList();

    // Signal handler (send local SDP/ICE details to the other browser)
    peer.on('signal', (data) => {
      socket.emit('signal', {
        targetSocketId: peerSocketId,
        signal: data
      });
    });

    // Connection established handler
    peer.on('connect', () => {
      console.log(`WebRTC DataChannel connected with ${peerUsername}`);
      const pw = peersRef.current.get(peerSocketId);
      if (pw) {
        pw.connectionState = 'connected';
        updatePeersList();
      }

      // System announcement
      setMessages((prev) => [
        ...prev,
        {
          id: generateUniqueId(),
          senderId: 'system',
          senderName: 'System',
          text: `Established secure P2P tunnel with ${peerUsername}`,
          timestamp: Date.now(),
          isMe: false,
          isSystem: true
        }
      ]);
    });

    // Receive message/file data from peer
    peer.on('data', (dataBuffer) => {
      try {
        const payload = JSON.parse(dataBuffer.toString());
        handleIncomingPeerMessage(peerSocketId, peerUsername, payload);
      } catch (err) {
        console.error('Failed to parse incoming peer payload:', err);
      }
    });

    peer.on('error', (err) => {
      console.error(`Peer connection error with ${peerUsername}:`, err);
      destroyPeer(peerSocketId);
    });

    peer.on('close', () => {
      console.log(`Peer connection closed with ${peerUsername}`);
      destroyPeer(peerSocketId);
    });
  };

  const destroyPeer = (socketId: string) => {
    const peerWrapper = peersRef.current.get(socketId);
    if (peerWrapper) {
      try {
        peerWrapper.peerInstance.destroy();
      } catch (e) {}
      peersRef.current.delete(socketId);
      updatePeersList();
    }
  };

  const updatePeersList = () => {
    setPeers(Array.from(peersRef.current.values()));
  };

  // Handle incoming payloads
  const handleIncomingPeerMessage = (senderSocketId: string, senderName: string, payload: any) => {
    switch (payload.type) {
      case 'text':
        setMessages((prev) => [
          ...prev,
          {
            id: payload.id || generateUniqueId(),
            senderId: senderSocketId,
            senderName,
            text: payload.text,
            timestamp: payload.timestamp || Date.now(),
            isMe: false
          }
        ]);
        break;

      case 'file-start':
        const meta = payload.metadata as FileMetadata;
        fileChunksRef.current.set(meta.id, []);
        fileReceiversRef.current.set(meta.id, {
          metadata: meta,
          chunks: [],
          chunksReceived: 0,
          progress: 0
        });

        // Add file placeholder in chat feed
        setMessages((prev) => [
          ...prev,
          {
            id: meta.id,
            senderId: senderSocketId,
            senderName,
            timestamp: Date.now(),
            isMe: false,
            file: {
              id: meta.id,
              name: meta.name,
              size: meta.size,
              type: meta.type,
              progress: 0,
              isComplete: false
            }
          }
        ]);
        break;

      case 'file-chunk':
        const { fileId, chunkIndex, chunkData } = payload;
        const receiver = fileReceiversRef.current.get(fileId);
        const chunks = fileChunksRef.current.get(fileId);

        if (receiver && chunks) {
          chunks[chunkIndex] = chunkData;
          receiver.chunksReceived++;
          receiver.progress = Math.round((receiver.chunksReceived / receiver.metadata.totalChunks) * 100);

          // Update state periodically to prevent lags
          if (receiver.progress % 5 === 0 || receiver.chunksReceived === receiver.metadata.totalChunks) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === fileId && msg.file) {
                  return {
                    ...msg,
                    file: {
                      ...msg.file,
                      progress: receiver.progress
                    }
                  };
                }
                return msg;
              })
            );
          }

          // If last chunk, reassemble
          if (receiver.chunksReceived === receiver.metadata.totalChunks) {
            const fullBase64 = chunks.join('');
            const blob = base64ToBlob(fullBase64, receiver.metadata.type);
            const objectUrl = URL.createObjectURL(blob);

            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === fileId && msg.file) {
                  return {
                    ...msg,
                    file: {
                      ...msg.file,
                      progress: 100,
                      isComplete: true,
                      url: objectUrl
                    }
                  };
                }
                return msg;
              })
            );

            // Clean caches
            fileChunksRef.current.delete(fileId);
            fileReceiversRef.current.delete(fileId);
          }
        }
        break;
    }
  };

  // Outbound messages: Local AI Moderation and transmit
  const sendMessage = useCallback(async (text: string): Promise<ModerationResult> => {
    if (!text.trim()) {
      return {
        isBlocked: false,
        score: 0,
        reasons: [],
        details: { toxicityScore: 0, spamScore: 0, phishingScore: 0, illegalScore: 0, toxicLabelsFlagged: [] }
      };
    }

    const messageId = generateUniqueId();
    const timestamp = Date.now();

    // 1. Locally moderate message before transmitting
    const modResult = await moderateMessage(text);

    if (modResult.isBlocked) {
      // Add local warning block message
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          senderId: 'me',
          senderName: 'You',
          text,
          timestamp,
          isMe: true,
          isBlocked: true,
          blockDetails: {
            score: modResult.score,
            reasons: modResult.reasons,
            details: modResult.details
          }
        }
      ]);
      return modResult;
    }

    // 2. Transmit clean message to all peers via P2P channels
    const payload = JSON.stringify({
      type: 'text',
      id: messageId,
      text,
      timestamp
    });

    peersRef.current.forEach((peerWrapper) => {
      if (peerWrapper.connectionState === 'connected') {
        try {
          peerWrapper.peerInstance.send(payload);
        } catch (e) {
          console.error(`Failed to send P2P message to ${peerWrapper.username}:`, e);
        }
      }
    });

    // 3. Add to local feed
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        senderId: 'me',
        senderName: 'You',
        text,
        timestamp,
        isMe: true
      }
    ]);

    return modResult;
  }, []);

  // Outbound Files: Read, announce, slice and stream
  const sendFile = useCallback(async (file: File) => {
    if (!file) return;

    const fileId = generateUniqueId();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    const metadata: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      totalChunks
    };

    // Add local chat bubble representing our uploading file
    setMessages((prev) => [
      ...prev,
      {
        id: fileId,
        senderId: 'me',
        senderName: 'You',
        timestamp: Date.now(),
        isMe: true,
        file: {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0,
          isComplete: false
        }
      }
    ]);

    const activePeers = Array.from(peersRef.current.values()).filter(p => p.connectionState === 'connected');

    if (activePeers.length === 0) {
      console.warn('No active peers to send file to.');
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === fileId && msg.file) {
            return {
              ...msg,
              text: 'File transfer failed: No peers connected.',
              file: undefined
            };
          }
          return msg;
        })
      );
      return;
    }

    // 1. Broadcast file-start metadata to peers
    const startPayload = JSON.stringify({
      type: 'file-start',
      metadata
    });

    activePeers.forEach((p) => {
      try {
        p.peerInstance.send(startPayload);
      } catch (e) {
        console.error(`Failed to send metadata to ${p.username}:`, e);
      }
    });

    // 2. Slice and transmit chunks sequentially
    try {
      for (let i = 0; i < totalChunks; i++) {
        const startBytes = i * CHUNK_SIZE;
        const endBytes = Math.min(startBytes + CHUNK_SIZE, file.size);

        const arrayBuffer = await readFileSlice(file, startBytes, endBytes);
        const base64Chunk = arrayBufferToBase64(arrayBuffer);

        const chunkPayload = JSON.stringify({
          type: 'file-chunk',
          fileId,
          chunkIndex: i,
          chunkData: base64Chunk
        });

        // Broadcast chunk to all active peers
        activePeers.forEach((p) => {
          try {
            p.peerInstance.send(chunkPayload);
          } catch (e) {
            console.error(`Failed to send chunk ${i} to ${p.username}:`, e);
          }
        });

        // Calculate progress
        const currentProgress = Math.round(((i + 1) / totalChunks) * 100);

        // Throttle state updates for screen rendering performance
        if (currentProgress % 5 === 0 || i === totalChunks - 1) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === fileId && msg.file) {
                return {
                  ...msg,
                  file: {
                    ...msg.file,
                    progress: currentProgress
                  }
                };
              }
              return msg;
            })
          );
        }

        // Yield slightly for CPU and data channel buffer breathing room
        if (i % 3 === 0) {
          await new Promise((r) => setTimeout(r, 15));
        }
      }

      // Mark transfer as complete locally
      const objectUrl = URL.createObjectURL(file);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === fileId && msg.file) {
            return {
              ...msg,
              file: {
                ...msg.file,
                progress: 100,
                isComplete: true,
                url: objectUrl
              }
            };
          }
          return msg;
        })
      );

    } catch (err) {
      console.error('File slicing or sending failed:', err);
    }
  }, []);

  return {
    peers,
    messages,
    connectionStatus,
    aiStatus,
    isAiReady,
    sendMessage,
    sendFile
  };
}
