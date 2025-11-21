import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { setupSocketEvents } from './events';


let io: Server | null = null;


export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  setupSocketEvents(io)
  
  console.log('Socket.IO inicializado');
  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO não foi inicializado! Chame initializeSocket primeiro.');
  }
  return io;
};


export default { initializeSocket, getIO };