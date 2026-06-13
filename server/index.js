const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'cipherpeer-signaling' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Map to keep track of active rooms and their participants
// roomCode -> Map(socketId -> { username, socketId })
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // When a user requests to enter a specific room
  socket.on('join-room', ({ roomCode, username }) => {
    socket.join(roomCode);
    
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, new Map());
    }
    
    const roomUsers = rooms.get(roomCode);
    roomUsers.set(socket.id, { username, socketId: socket.id });
    
    console.log(`User "${username}" (${socket.id}) joined room: ${roomCode}`);
    
    // Get list of all other users already in this room
    const otherUsers = Array.from(roomUsers.values()).filter(user => user.socketId !== socket.id);
    
    // Send list of existing users to the newly joined user
    socket.emit('room-users', { users: otherUsers });
    
    // Notify all existing users in the room about the new participant
    socket.to(roomCode).emit('user-joined', {
      socketId: socket.id,
      username
    });
  });

  // Relay WebRTC signaling data (SDP offers, answers, ICE candidates)
  socket.on('signal', ({ targetSocketId, signal }) => {
    io.to(targetSocketId).emit('signal', {
      senderSocketId: socket.id,
      signal
    });
  });

  // Clean up on disconnect
  socket.on('disconnecting', () => {
    // Check all rooms the socket is currently in
    for (const roomCode of socket.rooms) {
      if (rooms.has(roomCode)) {
        const roomUsers = rooms.get(roomCode);
        const user = roomUsers.get(socket.id);
        if (user) {
          roomUsers.delete(socket.id);
          console.log(`User "${user.username}" (${socket.id}) left room: ${roomCode}`);
          
          if (roomUsers.size === 0) {
            rooms.delete(roomCode);
          } else {
            // Notify other peers that this user disconnected
            socket.to(roomCode).emit('user-left', {
              socketId: socket.id,
              username: user.username
            });
          }
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server listening on port ${PORT}`);
});

module.exports = app;
