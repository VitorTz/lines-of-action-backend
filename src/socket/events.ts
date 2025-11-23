import { Server, Socket } from 'socket.io';
import { 
  handleJoinGameQueue, 
  handleMatchAccepted,
  handleExitQueue,
  handleQueueDisconnect  
} from './handlers/gameQueue';
import { 
  handleJoinGame, 
  handleGameDisconnect, 
  handleMakeMove, 
  handleGameOver, 
  handleSurrender 
} from './handlers/gameHandler';


export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`Cliente conectado. SocketId: ${socket.id}`);

    // [QUEUE]
      // Jogador entra na fila
      socket.on('join-queue', (data) => handleJoinGameQueue(socket, data));

      // Jogador diz que está pronto para começar uma partida
      socket.on('match-ready', (data) => handleMatchAccepted(socket, data));

      // Jogador sai do lobby
      socket.on('exit-queue', (data) => handleExitQueue(socket, data));

    // [GAME]
      socket.on('join-game', (data) => handleJoinGame(socket, data));
    
      // Jogador faz um movimento
      socket.on('make-move', (data) => handleMakeMove(socket, data));
      
      // Notificação de fim de jogo
      socket.on('game-over', (data) => handleGameOver(socket, data));
      
      // Jogador desiste
      socket.on('surrender', (data) => handleSurrender(socket, data));

    // [UTIL]
      // Echo
      socket.on('echo', (msg) => {
        console.log("[SOCKET] [ECHO] ->", msg) 
        socket.emit('echo', msg); 
      });

      socket.on("heartbeat", () => { socket.emit("heartbeat-ack"); });

      // Jogador desconecta
      socket.on('disconnect', () => {
        console.log(`Cliente desconectado. SocketId: ${socket.id}`);
        handleQueueDisconnect(socket);
        handleGameDisconnect(socket);
      });

  });
};
