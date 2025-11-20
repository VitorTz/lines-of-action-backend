import { Server, Socket } from 'socket.io';
import { handleJoinLobby, handleSetReady, handleLeaveGame, handleGameDisconnect, handleRequestPlayers, handleChallengePlayer } from './handlers/lobby';


export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Cliente conectado:', socket.id);    
    socket.on('join-lobby', (data) => handleJoinLobby(socket, data));
    socket.on('set-ready', (ready) => handleSetReady(socket, ready));
    socket.on('leave-game', () => handleLeaveGame(socket));
    socket.on('disconnect', () => handleGameDisconnect(socket));    
    socket.on('challenge-player', (data) => handleChallengePlayer(socket, data));
    socket.on('request-players', () => handleRequestPlayers(socket));
  });
};
