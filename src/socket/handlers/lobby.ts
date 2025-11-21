import { Socket } from 'socket.io';
import Game, { createInitialBoard } from '../../models/Game.model';
import { getIO } from '../socket';
import { lobbyQueue } from '../../LobbyQueue';
import User from '../../models/User.model';
import { Mutex } from 'async-mutex';

const mutex = new Mutex();


export const handleJoinLobby = async (socket: Socket, data: { playerId: string, rank: number }) => {

  if (await lobbyQueue.hasPlayer(data.playerId)) {
    socket.emit('error', { message: 'Você já está na fila' });
    return
  }
  
  try {
    console.log(socket.id, data)

    const gameExists = await Game.findOne({
      status: 'waiting',
      $or: [
        {playerBlack: data.playerId},
        {playerWhite: data.playerId},
      ]
    });

    if (gameExists) {
      if (gameExists.playerBlack == data.playerId) {
        gameExists.playerBlackSocketId = socket.id
      } else {
        gameExists.playerWhiteSocketId = socket.id
      }
      gameExists.save()
      socket.emit('error', { message: 'Você já está esperando pelo começo de uma partida' });
      return;
    }

    await lobbyQueue.insert({
      playerId: data.playerId,
      rank: data.rank,
      socketId: socket.id,
      createdAt: Date.now()
    })

    // Vai tentar criar uma partida entre os dois jogadores com maior rank
    const match = await lobbyQueue.match();
    
    if (match) {
      await Game.deleteMany({
        status: "waiting",
        $or: [
          { playerBlack: match.a.playerId },
          { playerWhite: match.a.playerId },
          { playerBlack: match.b.playerId },
          { playerWhite: match.b.playerId }
        ]
      });

      const newGame = await Game.create({
        playerBlack: match.a.playerId,
        playerWhite: match.b.playerId,
        playerBlackSocketId: match.a.socketId,
        playerWhiteSocketId: match.b.socketId,
        playerBlackIsReady: false,
        playerWhiteIsReady: false,
        status: 'waiting'
      });

      const io = getIO();
      
      // Envia notificação de partida encontrada para o jogador Black
      io.to(match.a.socketId).emit('match-found', {
        gameId: newGame.id,
        yourColor: 'black',
        opponentRank: match.b.rank,
        yourRank: match.a.rank
      });

      // Envia notificação de partida encontrada para o jogador White
      io.to(match.b.socketId).emit('match-found', {
        gameId: newGame.id,
        yourColor: 'white',
        opponentRank: match.a.rank,
        yourRank: match.b.rank
      });

      console.log(`Partida criada: ${newGame._id} - Black: ${match.a.playerId} vs White: ${match.b.playerId}`);
    } else {
      socket.emit('searching', { message: 'Procurando adversário...' });
      socket.emit('num-players-on-lobby', await lobbyQueue.size());
    }
  } catch (error) {
    console.error('Erro ao entrar no lobby:', error);
    socket.emit('error', { message: 'Erro ao entrar no lobby' });
  }
  
};

export const handleMatchFound = async (socket: Socket, data: { rank: number, gameId: string }) => {
  try {
    console.log('Match found acknowledgment:', data);
    
    const game = await Game.findById(data.gameId);
    
    if (!game) {
      socket.emit('error', { message: 'Partida não encontrada' });
      return;
    }

    // Confirma que o jogador recebeu a notificação de partida
    const io = getIO();
    const isBlack = socket.id === game.playerBlackSocketId;
    const opponentSocketId = isBlack ? game.playerWhiteSocketId : game.playerBlackSocketId;

    io.to(opponentSocketId).emit('opponent-connected', {
      message: 'Seu oponente está pronto para começar'
    });
  } catch (error) {
    console.error('Erro no handleMatchFound:', error);
    socket.emit('error', { message: 'Erro ao encontrar partida' });
  }
};

export const handleSetReady = async (socket: Socket, data: { ready: boolean, gameId: string }) => {
  try {
    const game = await Game.findOne({
      _id: data.gameId,
      status: 'waiting',
      $or: [
        { playerBlackSocketId: socket.id },
        { playerWhiteSocketId: socket.id }
      ]
    });

    if (!game) {
      socket.emit('error', { message: 'Você não faz parte de nenhum jogo em andamento' });  
      return;
    }

    const io = getIO();
    const isBlack = socket.id === game.playerBlackSocketId;
    const opponentSocketId = isBlack ? game.playerWhiteSocketId : game.playerBlackSocketId;

    // Atualiza o status de ready do jogador
    if (isBlack) {
      game.playerBlackIsReady = data.ready;
    } else {
      game.playerWhiteIsReady = data.ready;
    }

    await game.save();

    // Notifica o oponente sobre a mudança de status
    io.to(opponentSocketId).emit('opponent-ready-status', {
      isReady: data.ready
    });

    // Notifica o próprio jogador
    socket.emit('ready-status-updated', {
      isReady: data.ready
    });

    // Se ambos estão prontos, inicia o jogo
    if (game.playerBlackIsReady && game.playerWhiteIsReady) {
      game.status = 'active';
      game.startedAt = new Date();
      await game.save();

      // Busca informações dos jogadores
      const [playerBlack, playerWhite] = await Promise.all([
        User.findById(game.playerBlack),
        User.findById(game.playerWhite)
      ]);

      if (!playerBlack || !playerWhite) {
        console.log("não foram encontrados todos os jogadores para iniciar a partida")
        socket.emit('error', { message: 'Erro ao encontrar os jogadores' });
        return
      }

      const gameData = {
        gameId: game.id,
        playerBlack: {
          id: playerBlack.id,
          name: playerBlack.username,
          rank: playerBlack.rank
        },
        playerWhite: {
          id: playerWhite.id,
          name: playerWhite.username,
          rank: playerWhite.rank
        },
        board: createInitialBoard(),
        currentTurn: 'black',
        startedAt: game.startedAt
      };

      // Notifica ambos os jogadores que o jogo começou
      io.to(game.playerBlackSocketId).emit('game-started', gameData);
      io.to(game.playerWhiteSocketId).emit('game-started', gameData);

      console.log(`Jogo iniciado: ${game._id}`);
    }
  } catch (error) {
    console.error('Erro ao definir ready:', error);
    socket.emit('error', { message: 'Erro ao definir status de pronto' });
  }
};

export const handleCancelLobby = async (socket: Socket, data: { playerId: string }) => {
  try {
    // Remove o jogador da fila de espera
    const removed = await lobbyQueue.removeByPlayerId(data.playerId);
    
    if (removed) {
      socket.emit('lobby-cancelled', { message: 'Você saiu da fila de espera' });
      console.log(`Jogador ${removed.playerId} saiu da fila`);
      return;
    }

    // Se não está na fila, verifica se está em uma partida esperando
    const game = await Game.findOne({
      status: 'waiting',
      $or: [
        { playerBlackSocketId: socket.id },
        { playerWhiteSocketId: socket.id }
      ]
    });

    if (game) {
      const io = getIO();
      const isBlack = socket.id === game.playerBlackSocketId;
      const opponentSocketId = isBlack ? game.playerWhiteSocketId : game.playerBlackSocketId;

      // Notifica o oponente que a partida foi cancelada
      io.to(opponentSocketId).emit('match-cancelled', {
        message: 'Seu oponente cancelou a partida'
      });

      // Deleta o jogo
      await Game.deleteOne({ _id: game._id });

      socket.emit('lobby-cancelled', { message: 'Você cancelou a partida' });
      console.log(`Partida ${game._id} cancelada por ${isBlack ? 'Black' : 'White'}`);
    }
  } catch (error) {
    console.error('Erro ao cancelar lobby:', error);
    socket.emit('error', { message: 'Erro ao cancelar' });
  }
};


export const handleDisconnect = async (socket: Socket) => {
  try {
    // Remove da fila se estiver esperando
    await lobbyQueue.removeBySocketId(socket.id);

    // Verifica se está em uma partida
    const game = await Game.findOne({
      status: { $in: ['waiting', 'active'] },
      $or: [
        { playerBlackSocketId: socket.id },
        { playerWhiteSocketId: socket.id }
      ]
    });

    if (game) {
      const io = getIO();
      const isBlack = socket.id === game.playerBlackSocketId;
      const opponentSocketId = isBlack ? game.playerWhiteSocketId : game.playerBlackSocketId;

      if (game.status === 'waiting') {
        // Se estava esperando, cancela a partida
        io.to(opponentSocketId).emit('match-cancelled', {
          message: 'Seu oponente se desconectou'
        });
        await Game.deleteOne({ _id: game._id });
      } else if (game.status === 'active') {
        // Se estava jogando, marca como abandonada
        game.status = 'abandoned';
        game.winner = isBlack ? game.playerWhite : game.playerBlack;
        game.endedAt = new Date();
        await game.save();

        io.to(opponentSocketId).emit('opponent-disconnected', {
          message: 'Seu oponente se desconectou. Você venceu!',
          gameId: game.id
        });
      }

      console.log(`Jogador desconectado da partida ${game._id}`);
    }
  } catch (error) {
    console.error('Erro ao lidar com desconexão:', error);
  }
};


export async function handlePlayersOnLobby(socket: Socket) {
  try {
    const n = await lobbyQueue.size()
    console.log("[SOCKET] [num-players-on-lobby] r:", n)
    socket.emit('num-players-on-lobby', n)
  } catch (error) {
    console.error('Erro em handlePlayersOnLobby:', error);
    socket.emit('error', { message: 'Erro ao cancelar' });
  }
}