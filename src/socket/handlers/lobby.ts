import { Socket } from 'socket.io';
import Player from '../../models/Player.model';
import Game, { IGame } from '../../models/Game.model';
import { getIO } from '../socket';


export const handleJoinLobby = async (socket: Socket, data: { username: string }) => {
  try {
    const player = await Player.findOneAndUpdate(
      { socketId: socket.id },
      { 
        socketId: socket.id,
        username: data.username,
        status: 'online',
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Enviar lista de jogadores para o novo jogador
    const allPlayers = await Player.find({ socketId: { $ne: socket.id } });
    socket.emit('lobby-players', allPlayers);

    // Notificar todos sobre o novo jogador
    socket.broadcast.emit('player-joined', player);

    console.log(`${data.username} entrou no lobby`);
  } catch (error) {
    console.error('Erro ao entrar no lobby:', error);
    socket.emit('error', { message: 'Erro ao entrar no lobby' });
  }
};

export const handleSetReady = async (socket: Socket, ready: boolean) => {
  try {
    const player = await Player.findOneAndUpdate(
      { socketId: socket.id },
      { status: ready ? 'ready' : 'online' },
      { new: true }
    );

    if (player) {
      const io = getIO();
      io.emit('player-status-changed', player);
    }
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
  }
};

export const handleChallengePlayer = async (socket: Socket, data: { targetSocketId: string }) => {
  try {
    const io = getIO();
    const challenger = await Player.findOne({ socketId: socket.id });
    const target = await Player.findOne({ socketId: data.targetSocketId });

    if (!challenger || !target) {
      socket.emit('error', { message: 'Jogador não encontrado' });
      return;
    }

    if (target.status === 'in-game') {
      socket.emit('error', { message: 'Jogador já está em uma partida' });
      return;
    }

    // Criar jogo
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await Game.create({
      gameId,
      player1: {
        socketId: challenger.socketId,
        username: challenger.username
      },
      player2: {
        socketId: target.socketId,
        username: target.username
      },
      status: 'active'
    });

    // Atualizar status dos jogadores
    await Player.updateMany(
      { socketId: { $in: [socket.id, data.targetSocketId] } },
      { status: 'in-game', gameId }
    );

    // Fazer ambos os jogadores entrarem na sala do jogo
    socket.join(gameId);
    io.sockets.sockets.get(data.targetSocketId)?.join(gameId);

    // Notificar ambos os jogadores sobre o início do jogo
    io.to(gameId).emit('game-started', {
      gameId,
      player1: {
        socketId: challenger.socketId,
        username: challenger.username
      },
      player2: {
        socketId: target.socketId,
        username: target.username
      }
    });

    // Atualizar lista de jogadores para todos no lobby
    const updatedPlayers = await Player.find();
    io.emit('lobby-players-update', updatedPlayers);

    console.log(`Jogo iniciado: ${gameId}`);
  } catch (error) {
    console.error('Erro ao criar jogo:', error);
    socket.emit('error', { message: 'Erro ao iniciar jogo' });
  }
};

export const handleRequestPlayers = async (socket: Socket) => {
  try {
    const players = await Player.find();
    socket.emit('lobby-players', players);
  } catch (error) {
    console.error('Erro ao buscar jogadores:', error);
  }
};


export const handleLeaveGame = async (socket: Socket) => {
  try {
    const io = getIO();
    const player = await Player.findOne({ socketId: socket.id });
    
    if (player && player.gameId) {
      const gameId = player.gameId;
      
      // Atualizar status do jogador
      await Player.findOneAndUpdate(
        { socketId: socket.id },
        { status: 'online', gameId: null }
      );

      // Sair da sala do jogo
      socket.leave(gameId);

      // Atualizar lista para todos
      const updatedPlayers = await Player.find();
      io.emit('lobby-players-update', updatedPlayers);

      console.log(`Jogador ${player.username} saiu do jogo ${gameId}`);
    }
  } catch (error) {
    console.error('Erro ao sair do jogo:', error);
  }
};


export const handleGameDisconnect = async (socket: Socket) => {
  try {
    const io = getIO();
    const player = await Player.findOne({ socketId: socket.id });
    
    if (player) {
      // Se estava em jogo, notificar o outro jogador
      if (player.gameId) {
        const game: IGame | any = await Game.findOne({ gameId: player.gameId });
        if (game) {
          const otherPlayerSocketId = game.player1.socketId === socket.id 
            ? game.player2.socketId 
            : game.player1.socketId;
          
          io.to(otherPlayerSocketId).emit('opponent-disconnected');
          
          // Atualizar status do outro jogador
          await Player.findOneAndUpdate(
            { socketId: otherPlayerSocketId },
            { status: 'online', gameId: null }
          );
        }
      }

      // Remover jogador do banco
      await Player.deleteOne({ socketId: socket.id });

      // Notificar todos sobre a saída
      socket.broadcast.emit('player-left', socket.id);

      console.log(`${player.username} desconectou`);
    }
  } catch (error) {
    console.error('Erro ao desconectar:', error);
  }
};