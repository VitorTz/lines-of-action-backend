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
  handleSurrender,
  handleGameChatMessage
} from './handlers/gameHandler';
import {
  handleJoinGlobalChat,
  handleGlobalChatMessage,
  handleGlobalDisconnect
} from './handlers/globalChatHandler';
import {
  handleJoinLobbyChat,
  handleLobbyChatMessage,
  handleLeaveLobbyChat
} from './handlers/lobbyChatHandler';
import { handleVideoSignal } from './handlers/videoHandler';


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

    // Jogador desiste
    socket.on('surrender', (data) => handleSurrender(socket, data));

    // [GAME CHAT]
    socket.on('send-game-message', (data) => handleGameChatMessage(socket, data));

    // [VIDEO CHAT]
    socket.on('video-signal', (data) => handleVideoSignal(socket, data));

    // [GLOBAL CHAT]
    socket.on('join-global-chat', (data) => handleJoinGlobalChat(io, socket, data));
    socket.on('send-global-chat-message', (data) => handleGlobalChatMessage(io, socket, data));

    // [CHAT FILA DE PARTIDAS]
    // [LOBBY CHAT]
    socket.on('join-lobby-chat', (data) => handleJoinLobbyChat(socket, data));
    socket.on('leave-lobby-chat', () => handleLeaveLobbyChat(socket));
    socket.on('send-lobby-message', (data) => handleLobbyChatMessage(io, socket, data));

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
      handleGlobalDisconnect(io, socket);
    });

  });
};
