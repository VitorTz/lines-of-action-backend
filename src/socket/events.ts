import { Server, Socket } from 'socket.io';
import { 
  handleJoinLobby, 
  handleSetReady, 
  handleCancelLobby, 
  handleMatchFound, 
  handleDisconnect,
  handlePlayersOnLobby
} from './handlers/lobby';


export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`Cliente conectado. SocketId: ${socket.id}`);

    // Jogador entra na fila de lobby
    socket.on('join-lobby', (data) => handleJoinLobby(socket, data));

    socket.on('num-players-on-lobby', (data) => handlePlayersOnLobby(socket));

    // Jogador confirma que recebeu a notificação de partida encontrada
    socket.on('match-found', (data) => handleMatchFound(socket, data));

    // Jogador define se está pronto para começar
    socket.on('set-ready', (data) => handleSetReady(socket, data));

    // Jogador cancela a busca/partida
    socket.on('cancel-lobby', (data) => handleCancelLobby(socket, data));

    // Echo
    socket.on('echo', (msg) => {
      console.log("[SOCKET] [ECHO] ->", msg) 
      socket.emit('echo', msg); 
    });

    socket.on("heartbeat", () => {
      socket.emit("heartbeat-ack");
    });

    // Jogador desconecta
    socket.on('disconnect', () => {
      console.log(`Cliente desconectado. SocketId: ${socket.id}`);
      handleDisconnect(socket);
    });
  });
};
