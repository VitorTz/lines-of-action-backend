import { Socket } from 'socket.io';
import Game, { BLACK, WHITE } from '../../models/Game.model';
import { getIO } from '../socket';
import User from '../../models/User.model';
import { arePiecesConnected } from '../../util';


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

    // Cria uma sala com o gameId. Comunicação do jogo pelos sockets será feita através da sala
    // Se o socket cair e voltar, ele sempre vai entrar na sala correta do jogo
    socket.join(data.gameId);

    // Verifica se o jogador faz parte do jogo
    const isBlack = (game.playerBlack as any).toString() === data.playerId;
    const isWhite = (game.playerWhite as any).toString() === data.playerId;

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
    const isBlack = (game.playerBlack as any).toString() === data.playerId;
    const isWhite = (game.playerWhite as any).toString() === data.playerId;

    if (!isBlack && !isWhite) {
      socket.emit('error', { message: 'Você não faz parte desta partida' });
      return;
    }

    // Atualiza o id dos sockets dos jogadores
    if (isBlack) {
      game.playerBlackSocketId = socket.id
    } else {
      game.playerWhiteSocketId = socket.id
    }

    const playerColor = isBlack ? 'black' : 'white';
    if (game.turn !== playerColor) {
      socket.emit('error', { message: 'Não é sua vez de jogar' });
      return;
    }

    // Força o socket a entrar na sala do jogo (não faz nada se já estiver)
    socket.join(data.gameId)

    // TODO: Verificar se é um movimento válido

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

    const moveData = {
      gameId: game.id,
      from: data.from,
      to: data.to,
      captured: data.captured,
      player: playerColor,
      board: newBoard,
      playerId: data.playerId,
      turn: game.turn
    };

    // Notifica os jogadores na sala sobre o movimento
    const io = getIO()
    io.to(data.gameId).emit('move-made', moveData);

    console.log(`Movimento realizado no jogo ${data.gameId}: ${playerColor} (${data.from.row},${data.from.col}) -> (${data.to.row},${data.to.col})`);

    // Verifica game over
    const areBlackPiecesConnected = arePiecesConnected(newBoard, BLACK)
    const areWhitePiecesConnected = arePiecesConnected(newBoard, WHITE)

    if (areBlackPiecesConnected && areWhitePiecesConnected) {
      // Quem fez o movimento ganha
      game.winner = isBlack ? game.playerBlack : game.playerWhite
    } else if (areBlackPiecesConnected) {
      game.winner = game.playerBlack
    } else if (areWhitePiecesConnected) {
      game.winner = game.playerWhite
    }

    if (game.winner) {
      game.status = 'finished'
      game.endedAt = new Date()
      game.save()      

      const winner = await User.findById(game.winner)
      if (winner) {
        winner.rank += 20
        winner.save()
      }

      const loser = await User.findById(game.winner == game.playerBlack ? game.playerWhite : game.playerBlack)
      if (loser) {
        loser.rank = loser!.rank - 10 >= 0 ? loser!.rank - 10 : 0
        loser.save()
      }

      const gameOverData = {
        winnerUsername: winner!.username,
        gameId: game.id,
        reason: 'connect'
      };

      io.to(data.gameId).emit('game-over', gameOverData);
      console.log(`Jogo ${data.gameId} finalizado. Vencedor: ${game.winner}`);
    }
  } catch (error) {
    console.error('Erro ao fazer movimento:', error);
    socket.emit('error', { message: 'Erro ao fazer movimento' });
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
      io.to(game.id).emit('opponent-disconnected-game', {
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

    const isBlack = (game.playerBlack as any).toString() === data.playerId;
    const isWhite = (game.playerWhite as any).toString() === data.playerId;

    if (!isBlack && !isWhite) {
      socket.emit('error', { message: 'Você não faz parte desta partida' });
      return;
    }

    socket.join(data.gameId)

    // Define o vencedor como o oponente
    game.status = 'finished';
    game.winner = (game.playerBlack as any).toString() === data.playerId ? game.playerWhite : game.playerBlack;
    game.endedAt = new Date();
    await game.save();

    const userWinner = await User.findById(game.winner);
    const userLoser = await User.findById((game.playerBlack as any).toString() === data.playerId ? game.playerBlack : game.playerWhite);

    if (userWinner) {
      userWinner.rank = userWinner.rank += 20
      userWinner.save()
    }

    if (userLoser) {
      userLoser.rank = userLoser.rank - 10 >= 0 ? userLoser.rank - 10 : 0
      userLoser.save()
    }

    const gameOverData = {
      winnerUsername: userWinner!.username,
      gameId: game.id,
      reason: 'surrender'
    };
    
    // Notifica ambos os jogadores
    const io = getIO()
    io.to(data.gameId).emit('game-over', gameOverData);    
    console.log(`Jogo ${data.gameId} finalizado por desistência`);
  } catch (error) {
    console.error('Erro ao desistir:', error);
    socket.emit('error', { message: 'Erro ao desistir' });
  }
};


export const handleGameChatMessage = async (socket: Socket, data: { gameId: string, message: string, playerId: string }) => {
  try {
    const game = await Game.findById(data.gameId);

    if (!game) {
      socket.emit('error', { message: 'Jogo não encotrado' });
      return;
    }

    socket.join(data.gameId)

    const messageData = {
      senderId: data.playerId,
      text: data.message,
      timestamp: Date.now()
    };

    // Envia para as pessoas na sala
    const io = getIO()
    io.to(data.gameId).emit('game-chat-message', messageData)
  } catch (error) {
    console.error('Erro no chat do jogo:', error);
  }
};