import { Connection } from "mongoose";


export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};


export function getDbStatus(connection: Connection): string {
  if (!connection) { return "unknown" }
  const state = connection.readyState;
  switch (state) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
};


export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


export function formatDateTimeBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();

  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0')

  return `${d}/${m}/${y} ${h}:${min}:${sec}`;
}


export function arePiecesConnected(board: number[][], piece: number): boolean {
  const rows = 8;
  const cols = 8;

  // Lista todas as posições da peça
  const positions: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === piece) {
        positions.push({ r, c });
      }
    }
  }

  // Se tem 1 ou menos peças, então está conectado
  if (positions.length <= 1) return true;

  // BFS/DFS para ver se todas estão conectadas
  const visited = new Set<string>();
  const queue: { r: number; c: number }[] = [positions[0]];
  visited.add(`${positions[0].r},${positions[0].c}`);

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  while (queue.length > 0) {
    const { r, c } = queue.shift()!;

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

      if (board[nr][nc] === piece) {
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }

  // Conectado se visitou todas as peças
  return visited.size === positions.length;
}