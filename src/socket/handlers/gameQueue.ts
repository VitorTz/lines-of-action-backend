import { Socket } from 'socket.io';
import Game from '../../models/Game.model';
import { getIO } from '../socket';
import { gameQueue } from '../../GameQueue';
import User from '../../models/User.model';


const MAX_QUEUE_SIZE = 50;


export const handleJoinGameQueue = async (socket: Socket, data: { playerId: string, rank: number }) => {
  try {
    console.log("handleJoinGameQueue", socket.id, data);
    
    // Faz o socket entra na "sala pessoal" do usuário
    // Serve para encontrar o usuário posteriormente quando uma partida for achada
    socket.join(data.playerId);

    if (gameQueue.size() >= MAX_QUEUE_SIZE) {
      socket.emit('info', { message: 'A fila está cheia no momento.' });
      return;
    }

    // Verifica se já está na fila
    if (gameQueue.hasPlayer(data.playerId)) {
      socket.emit('info', { message: 'Você já está na fila' });
      return;
    }

    // Verifica se já está em uma partida pendente
    const gameExists = await Game.findOne({
      status: 'waiting',
      $or: [
        { playerBlack: data.playerId },
        { playerWhite: data.playerId },
      ]
    });

    if (gameExists) {
      // Atualiza o socketId do jogador na partida existente
      if (gameExists.playerBlack == data.playerId) {
        gameExists.playerBlackSocketId = socket.id;
      } else {
        gameExists.playerWhiteSocketId = socket.id;
      }
      await gameExists.save();

      const oponente = await User.findById(gameExists.playerBlack == data.playerId ? gameExists.playerWhite : gameExists.playerBlack);

      // Reenvia o match-found para reconectar o jogador
      getIO().to(data.playerId).emit('match-found', {
        gameId: gameExists.id,
        yourColor: gameExists.playerBlack == data.playerId ? 'black' : 'white',
        opponentUsername: oponente ? oponente.username : '',
        opponentRank: oponente ? oponente.rank : 0,
        yourRank: data.rank
      });      
      return;
    }

    gameQueue.removeByPlayerId(data.playerId);

    // Adiciona o jogador na fila
    gameQueue.insert({
      playerId: data.playerId,
      rank: data.rank,
      socketId: socket.id,
      createdAt: Date.now()
    });

    // Tenta criar uma partida
    const match = gameQueue.match();

    if (match) {
      // Garante que não existam partidas pendentes dos jogadores
      await Game.deleteMany({
        status: "waiting",
        $or: [
          { playerBlack: match.a.playerId },
          { playerWhite: match.a.playerId },
          { playerBlack: match.b.playerId },
          { playerWhite: match.b.playerId }
        ]
      });

      // Cria nova partida
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

      const whiteUser = await User.findById(match.b.playerId)
      const blackUser = await User.findById(match.a.playerId)

      // Envia notificação de partida encontrada para o jogador Black
      io.to(match.a.playerId).emit('match-found', {
        gameId: newGame.id,
        yourColor: 'black',
        opponentUsername: whiteUser ? whiteUser.username : '',
        opponentRank: match.b.rank,
        yourRank: match.a.rank
      });

      // Envia notificação de partida encontrada para o jogador White
      io.to(match.b.playerId).emit('match-found', {
        gameId: newGame.id,
        yourColor: 'white',
        opponentUsername: blackUser ? blackUser.username : '',
        opponentRank: match.a.rank,
        yourRank: match.b.rank
      });

      console.log(`Partida criada [esperando jogadores aceitarem]: ${newGame._id} - Black: ${match.a.playerId} vs White: ${match.b.playerId}`);
    } else {
      socket.emit('on-queue');  // Não há jogadores suficientes, continua na fila      
    }
  } catch (error) {
    console.error('Erro ao entrar no lobby:', error);
    socket.emit('error', { message: 'Erro ao entrar no lobby' });
  }
};

export const handleMatchAccepted = async (socket: Socket, data: { playerId: string, gameId: string }) => {
  try {
    console.log('handleMatchAccepted', data);    
    const game = await Game.findById(data.gameId);
    
    if (!game) {
      socket.emit('error', { message: 'Partida não encontrada' });
      return;
    }

    if (!game || game.status !== 'waiting') {
      socket.emit('error', { message: 'Partida não está mais disponível' });
      return;
    }
    
    socket.join(data.playerId);
    socket.join(data.gameId);

    const io = getIO();
    const isBlack = data.playerId === (game.playerBlack as string).toString();
    const isWhite = data.playerId === (game.playerWhite as string).toString();

    if (!isBlack && !isWhite) {
      socket.emit('error', { message: 'Você não faz parte desta partida' });
      return;
    }

    // Atualiza o status de ready do jogador
    if (isBlack) {
      game.playerBlackIsReady = true;
    } else if (isWhite) {
      game.playerWhiteIsReady = true;
    }

    await game.save();

    // Se ambos aceitaram, inicia o jogo
    if (game.playerBlackIsReady && game.playerWhiteIsReady) {
      game.status = 'active';
      game.startedAt = new Date();
      await game.save();

      // Notifica ambos os jogadores
      io.to((game.playerBlack as any).toString()).emit('game-start', {
        gameId: game.id,
        color: 'black'
      });

      io.to((game.playerWhite as any).toString()).emit('game-start', {
        gameId: game.id,
        color: 'white'
      });

      console.log(`Jogo iniciado: ${game._id}`);
    } else {
      // Notifica o oponente que este jogador aceitou
      const opponentId = isBlack ? game.playerWhite : game.playerBlack;
      io.to((opponentId as any).toString()).emit('opponent-ready', {
        message: 'Seu oponente aceitou a partida'
      });
    }
  } catch (error) {
    console.error('Erro no handleMatchAccepted:', error);
    socket.emit('error', { message: 'Erro ao aceitar partida' });
  }
};

export const handleExitQueue = async (socket: Socket, data: { playerId: string }) => {
  try {
    console.log('handleExitQueue:', data);

    // Remove o jogador da fila de espera
    const removed = gameQueue.removeByPlayerId(data.playerId);

    if (removed) {
      socket.emit('exit-queue');
      console.log(`Jogador ${removed.playerId} saiu da fila`);
      return;
    }

    // Se não está na fila, verifica se está em uma partida esperando
    const game = await Game.findOne({
      status: 'waiting',
      $or: [
        { playerBlack: data.playerId },
        { playerWhite: data.playerId }
      ]
    });

    if (game) {
      const io = getIO();
      const opponentId = data.playerId === (game.playerBlack as any).toString() ? 
        (game.playerBlack as any).toString() : 
        (game.playerWhite as any).toString()
      // Notifica o oponente que a partida foi cancelada
      io.to(opponentId).emit('match-cancelled-by-opponent');
      // Deleta o jogo
      await Game.deleteOne({ _id: game._id });
      socket.emit('exit-queue');
      console.log(`Partida ${game._id} cancelada por ${data.playerId}`);
    } else {
      socket.emit('exit-queue');
    }

  } catch (error) {
    console.error('Erro ao cancelar lobby:', error);
    socket.emit('error', { message: 'Erro ao cancelar' });
  }
};

export const handleQueueDisconnect = async (socket: Socket) => {
  try {
    console.log(`Socket ${socket.id} desconectado`);

    // Remove da fila se estiver esperando
    const removedFromQueue = gameQueue.removeBySocketId(socket.id);
    if (removedFromQueue) {
      console.log(`Jogador ${removedFromQueue.playerId} removido da fila por desconexão`);
    }

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
      const opponentId = isBlack ? (game.playerWhite as any).toString() : (game.playerBlack as any).toString();

      if (game.status === 'waiting') {
        // Partida ainda não iniciada, cancela
        io.to(opponentId).emit('match-cancelled-by-opponent');
        await Game.deleteOne({ _id: game._id });
        console.log(`Partida ${game._id} cancelada por desconexão`);
      } else if (game.status === 'active') {
        // Partida ativa, marca como abandonada
        game.status = 'abandoned';
        game.winner = isBlack ? game.playerWhite : game.playerBlack;
        game.endedAt = new Date();
        await game.save();
        io.to(opponentId).emit('opponent-disconnected', {
          message: 'Seu oponente se desconectou durante a partida'
        });
        console.log(`Partida ${game._id} abandonada por desconexão`);
      }
    }
  } catch (error) {
    console.error('Erro ao lidar com desconexão:', error);
  }
};
