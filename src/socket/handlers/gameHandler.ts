import { Socket } from 'socket.io';
import Game from '../../models/Game.model';
import { getIO } from '../socket';
import User from '../../models/User.model';

interface MoveData {
  gameId: string;
  playerId: string;
  from: { row: number; col: number };
  to: { row: number; col: number };
  captured: boolean;
}

export const handleJoinGame = async (socket: Socket, data: { gameId: string, playerId: string }) => {
  try {
    console.log('handleJoinGame:', data);

    const game = await Game.findById(data.gameId);

    if (!game) {
      socket.emit('error', { message: 'Partida não encontrada' });
      return;
    }

    if (game.status !== 'active') {
      socket.emit('error', { message: 'Partida não está ativa' });
      return;
    }

    // Verifica se o jogador faz parte do jogo
    const isBlack = (game.playerBlack as string).toString() === data.playerId;
    const isWhite = (game.playerWhite  as string).toString() === data.playerId;

    if (!isBlack && !isWhite) {
      socket.emit('error', { message: 'Você não faz parte desta partida' });
      return;
    }

    // Atualiza o socketId do jogador que reconectou
    if (isBlack) {
      game.playerBlackSocketId = socket.id;
    } else {
      game.playerWhiteSocketId = socket.id;
    }
    await game.save();

    const b = await User.findById(game.playerBlack);
    const w = await User.findById(game.playerWhite);

    // Envia o estado atual do jogo para o jogador
    socket.emit('game-state', {
      gameId: game.id,
      board: game.board,
      turn: game.turn,
      moveHistory: game.moveHistory,
      playerBlack: game.playerBlack,
      playerWhite: game.playerWhite,
      playerBlackUsername: b ? b.username : '',
      playerWhiteUsername: w ? w.username : '',
      status: game.status
    });

    console.log(`Jogador ${data.playerId} entrou no jogo ${data.gameId}`);
  } catch (error) {
    console.error('Erro ao entrar no jogo:', error);
    socket.emit('error', { message: 'Erro ao entrar no jogo' });
  }
};

export const handleMakeMove = async (socket: Socket, data: MoveData) => {
  try {
    console.log('handleMakeMove:', data);

    const game = await Game.findById(data.gameId);

    if (!game) {
      socket.emit('error', { message: 'Partida não encontrada' });
      return;
    }

    if (game.status !== 'active') {
      socket.emit('error', { message: 'Partida não está ativa' });
      return;
    }

    // Verifica se é a vez do jogador
    const isBlack = (game.playerBlack as string).toString() === data.playerId;
    const isWhite = (game.playerWhite as string).toString() === data.playerId;

    if (!isBlack && !isWhite) {
      socket.emit('error', { message: 'Você não faz parte desta partida' });
      return;
    }

    const playerColor = isBlack ? 'black' : 'white';
    if (game.turn !== playerColor) {
      socket.emit('error', { message: 'Não é sua vez de jogar' });
      return;
    }

    // Atualiza o tabuleiro
    const newBoard = game.board.map(row => [...row]);
    const piece = newBoard[data.from.row][data.from.col];
    newBoard[data.to.row][data.to.col] = piece;
    newBoard[data.from.row][data.from.col] = 0; // EMPTY

    // Adiciona movimento ao histórico
    game.moveHistory.push({
      player: playerColor,
      from: data.from,
      to: data.to,
      captured: data.captured,
      timestamp: new Date()
    } as any);

    // Atualiza tabuleiro e turno
    game.board = newBoard;
    game.turn = playerColor === 'black' ? 'white' : 'black';
    await game.save();

    const io = getIO();

    // Notifica ambos os jogadores sobre o movimento
    const moveData = {
      gameId: game.id,
      from: data.from,
      to: data.to,
      captured: data.captured,
      player: playerColor,
      board: newBoard,
      turn: game.turn
    };

    io.to(game.playerBlackSocketId).emit('move-made', moveData);
    io.to(game.playerWhiteSocketId).emit('move-made', moveData);

    console.log(`Movimento realizado no jogo ${data.gameId}: ${playerColor} de (${data.from.row},${data.from.col}) para (${data.to.row},${data.to.col})`);
  } catch (error) {
    console.error('Erro ao fazer movimento:', error);
    socket.emit('error', { message: 'Erro ao fazer movimento' });
  }
};

export const handleGameOver = async (socket: Socket, data: { gameId: string, winner: 'black' | 'white' }) => {
  try {
    console.log('handleGameOver:', data);

    const game = await Game.findById(data.gameId);

    if (!game) {
      socket.emit('error', { message: 'Partida não encontrada' });
      return;
    }

    // Atualiza o status do jogo
    game.status = 'finished';
    game.winner = data.winner === 'black' ? game.playerBlack : game.playerWhite;
    game.endedAt = new Date();
    await game.save();

    const io = getIO();

    // Notifica ambos os jogadores que o jogo acabou
    const gameOverData = {
      gameId: game.id,
      winner: data.winner,
      winnerId: game.winner
    };

    const userWinner = await User.findById(data.winner === 'black' ? game.playerBlack : game.playerWhite);
    const userLoser = await User.findById(data.winner === 'black' ? game.playerWhite : game.playerBlack);

    if (userWinner) {
        userWinner.rank = userWinner.rank += 20
        userWinner.save()
    }
    
    if (userLoser) {
        userLoser.rank = userLoser.rank - 10 >= 0 ? userLoser.rank - 10 : 0
        userLoser.save()
    }

    io.to(game.playerBlackSocketId).emit('game-over', gameOverData);
    io.to(game.playerWhiteSocketId).emit('game-over', gameOverData);

    console.log(`Jogo ${data.gameId} finalizado. Vencedor: ${data.winner}`);
  } catch (error) {
    console.error('Erro ao finalizar jogo:', error);
    socket.emit('error', { message: 'Erro ao finalizar jogo' });
  }
};

export const handleGameDisconnect = async (socket: Socket) => {
  try {
    console.log(`Socket ${socket.id} desconectado do jogo`);

    // Verifica se o jogador está em uma partida ativa
    const game = await Game.findOne({
      status: 'active',
      $or: [
        { playerBlackSocketId: socket.id },
        { playerWhiteSocketId: socket.id }
      ]
    });

    if (game) {
      const io = getIO();
      const isBlack = socket.id === game.playerBlackSocketId;
      const opponentSocketId = isBlack ? game.playerWhiteSocketId : game.playerBlackSocketId;

      // Notifica o oponente sobre a desconexão
      io.to(opponentSocketId).emit('opponent-disconnected-game', {
        message: 'Seu oponente se desconectou',
        gameId: game.id
      });

      console.log(`Jogador desconectado do jogo ${game._id}`);
    }
  } catch (error) {
    console.error('Erro ao lidar com desconexão do jogo:', error);
  }
};

export const handleSurrender = async (socket: Socket, data: { gameId: string, playerId: string }) => {
  try {
    console.log('handleSurrender:', data);

    const game = await Game.findById(data.gameId);

    if (!game) {
      socket.emit('error', { message: 'Partida não encontrada' });
      return;
    }

    if (game.status !== 'active') {
      socket.emit('error', { message: 'Partida não está ativa' });
      return;
    }

    const isBlack = (game.playerBlack as string).toString() === data.playerId;
    const isWhite = (game.playerWhite as string).toString() === data.playerId;

    if (!isBlack && !isWhite) {
      socket.emit('error', { message: 'Você não faz parte desta partida' });
      return;
    }

    // Define o vencedor como o oponente
    game.status = 'finished';
    game.winner = isBlack ? game.playerWhite : game.playerBlack;
    game.endedAt = new Date();
    await game.save();

    const io = getIO();
    const winnerColor = isBlack ? 'white' : 'black';

    // Notifica ambos os jogadores
    const gameOverData = {
      gameId: game.id,
      winner: winnerColor,
      winnerId: game.winner,
      reason: 'surrender'
    };

    io.to(game.playerBlackSocketId).emit('game-over', gameOverData);
    io.to(game.playerWhiteSocketId).emit('game-over', gameOverData);

    console.log(`Jogo ${data.gameId} finalizado por desistência`);
  } catch (error) {
    console.error('Erro ao desistir:', error);
    socket.emit('error', { message: 'Erro ao desistir' });
  }
};