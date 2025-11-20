import { IGame, type GameStatus, EMPTY, BLACK, WHITE } from '../models/Game.model';


function areAllPiecesConnected(board: number[][], playerColor: number): boolean {
  const pieces: { r: number; c: number }[] = [];

  // Encontra todas as peças do jogador (conectadas ou não)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === playerColor) {
        pieces.push({ r, c });
      }
    }
  }

  // Se tem 1 ou 0 peças, então por definição está conectado
  if (pieces.length <= 1) {
    return true;
  }

  // Busca pelo número de peças conectadas (DFS)
  const visited = new Set<string>();
  const stack: { r: number; c: number }[] = [pieces[0]];
  visited.add(`${pieces[0].r},${pieces[0].c}`);

  let connectedCount = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    connectedCount++;    
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = current.r + dr;
        const nc = current.c + dc;
        const key = `${nr},${nc}`;
        if (
          nr >= 0 && nr < 8 && nc >= 0 && nc < 8 &&
          board[nr][nc] === playerColor &&
          !visited.has(key)
        ) {
          visited.add(key);
          stack.push({ r: nr, c: nc });
        }
      }
    }
  }

  return connectedCount === pieces.length;
}

export function playerHasAnyMove(board: number[][], player: 'black' | 'white'): boolean {
  const pieceValue = player === 'black' ? BLACK : WHITE;
  const dirs = [
    [-1,  0], [1,  0],
    [ 0, -1], [0,  1],
    [-1, -1], [-1, 1],
    [ 1, -1], [ 1, 1]
  ];

  const rows = board.length;
  const cols = board[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] !== pieceValue) continue;
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
          if (validateMove(board, { r, c }, { r: rr, c: cc }, player)) {
            return true;
          }
          rr += dr;
          cc += dc;
        }
      }
    }
  }

  return false;
}

export function checkGameEnd(game: IGame): { status: GameStatus; winner: string | null } {
  const board = game.board
  
  // Verifica a vitória para ambos os jogadores
  const blackWon = areAllPiecesConnected(board, BLACK)
  const whiteWon = areAllPiecesConnected(board, WHITE)

  const playerWhoMoved = game.turn

  // Se ambos vencem, quem fez a jogada ganha  
  if (blackWon && whiteWon) {
    return {
      status: 'finished',
      winner: playerWhoMoved === 'black' ? (game.playerBlack as any).toString() : (game.playerWhite as any).toString()
    }
  }

  if (blackWon) {
    return {
      status: 'finished',
      winner: (game.playerBlack as any).toString(),
    }
  }
  
  if (whiteWon) {
    return {
      status: 'finished',
      winner: (game.playerWhite as any).toString(),
    }
  }

  const nextPlayer = game.turn
  const opponent = nextPlayer === 'black' ? 'white' : 'black'

  const nextPlayerHasMove = playerHasAnyMove(board, nextPlayer)

  // Se o próximo jogador não tem movimentos possíveis, então seu adversário vence
  if (!nextPlayerHasMove) {
    return {
      status: 'finished',
      winner: opponent === 'black'
        ? (game.playerBlack as any).toString()
        : (game.playerWhite as any).toString()
    }
  }
  
  return { status: 'active', winner: null }
}


export function validateMove(
  board: number[][],
  from: { r: number, c: number },
  to: { r: number, c: number },
  player: 'black' | 'white'
): boolean {

  const rows = board.length;
  const cols = board[0].length;

  // Verifica se o movimento está dentro dos limites do tabuleiro
  if (
    from.r < 0 || from.c < 0 || to.r < 0 || to.c < 0 ||
    from.r >= rows || from.c >= cols || to.r >= rows || to.c >= cols
  ) return false;

  // Verifica se o jogador que está fazendo o movimento está movendo uma peça que pertence a ele
  const piece = board[from.r][from.c];
  if (player === 'black' && piece !== BLACK) return false;
  if (player === 'white' && piece !== WHITE) return false;

  // Verifica se está movendo para a mesma casa
  if (from.r === to.r && from.c === to.c) return false;

  // Para extrair a direção do movimento
  const dr = Math.sign(to.r - from.r);
  const dc = Math.sign(to.c - from.c);

  // Verifica se o movimento é horizontal ou diagonal
  const isStraight = (dr === 0 && dc !== 0) || (dr !== 0 && dc === 0);
  const isDiagonal = Math.abs(to.r - from.r) === Math.abs(to.c - from.c);
  if (!isStraight && !isDiagonal) return false;

  // Conta o número de peças na direção do movimento
  let count = 0;
  let r = from.r + dr;
  let c = from.c + dc;
  while (r >= 0 && c >= 0 && r < rows && c < cols) {
    if (board[r][c] !== EMPTY) 
      count++;
    r += dr;
    c += dc;
  }

  const dist = Math.max(Math.abs(to.r - from.r), Math.abs(to.c - from.c));
  if (dist !== count) return false;

  // Verifica se pulou peça inimiga
  r = from.r + dr;
  c = from.c + dc;
  let jump = false;

  while (r !== to.r || c !== to.c) {
    const cell = board[r][c];
    if (cell !== EMPTY) {
      if (player === 'black' && cell === WHITE) jump = true;
      if (player === 'white' && cell === BLACK) jump = true;
    }
    r += dr;
    c += dc;
  }

  if (jump) 
    return false;  

  return true;
}