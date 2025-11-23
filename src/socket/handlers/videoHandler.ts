import { Socket } from 'socket.io';
import Game from '../../models/Game.model';
import { getIO } from '../socket';

export const handleVideoSignal = async (socket: Socket, data: { gameId: string, signal: any }) => {
  try {
    // Busca a partida para saber quem é o oponente
    const game = await Game.findById(data.gameId);
    if (!game) return;

    const io = getIO();
    
    // Descobre quem é o oponente baseado no socket que enviou
    let opponentSocketId: string | null = null;

    if (socket.id === game.playerBlackSocketId) {
      opponentSocketId = game.playerWhiteSocketId;
    } else if (socket.id === game.playerWhiteSocketId) {
      opponentSocketId = game.playerBlackSocketId;
    }

    // Se o oponente estiver conectado, repassa o sinal
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('video-signal', {
        signal: data.signal,
        from: socket.id
      });
    }

  } catch (error) {
    console.error('Erro no video handler:', error);
  }
};