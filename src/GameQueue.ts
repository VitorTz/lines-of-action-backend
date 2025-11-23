

export interface QueueItem {

  rank: number;
  playerId: string;
  socketId: string;
  createdAt: number;

}


class GameQueue {

  private playerSocketMap = new Map<string, string>();
  private heap: QueueItem[] = [];

  private compare(a: QueueItem, b: QueueItem): number {
    // Maior rank tem prioridade. Em empate, ganha quem chegou primeiro
    if (a.rank !== b.rank) return b.rank - a.rank;
    return a.createdAt - b.createdAt;
  }

  private swap(i: number, j: number) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  hasPlayer(playerId: string): boolean {
    return this.playerSocketMap.has(playerId);
  }

  insert(item: QueueItem): void {
    // Se o jogador já existe, apenas atualiza o socketId
    if (this.playerSocketMap.has(item.playerId)) {
      this.playerSocketMap.set(item.playerId, item.socketId);
      const index = this.heap.findIndex(h => h.playerId === item.playerId);
      if (index !== -1) {
        this.heap[index].socketId = item.socketId;
      }
      return;
    }
    
    this.heap.push(item);
    this.playerSocketMap.set(item.playerId, item.socketId);
        
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(this.heap[i], this.heap[p]) >= 0) break;
      this.swap(i, p);
      i = p;
    }

    console.log("========== HEAP UPDATED ==========");
    this.heap.forEach(e => console.log(`Player: ${e.playerId}, Rank: ${e.rank}`));
    console.log(`Total players: ${this.playerSocketMap.size}`);
    console.log("==================================");
  }

  peek(): QueueItem | null {
    return this.heap[0] || null;
  }

  private removeTop(): QueueItem | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) {
      const top = this.heap.pop()!;
      this.playerSocketMap.delete(top.playerId);
      return top;
    }
    
    const top = this.heap[0];
    this.heap[0] = this.heap.pop()!;
        
    let i = 0;
    while (true) {
      let left = 2 * i + 1;
      let right = 2 * i + 2;
      let smallest = i;
      
      if (left < this.heap.length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < this.heap.length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      
      this.swap(i, smallest);
      i = smallest;
    }
    
    this.playerSocketMap.delete(top.playerId);
    return top;
  }

  removeByPlayerId(playerId: string): QueueItem | null {
    if (!this.playerSocketMap.has(playerId)) {
      return null;
    }

    const index = this.heap.findIndex(item => item.playerId === playerId);
    
    if (index === -1) {
      this.playerSocketMap.delete(playerId);
      return null;
    }
    
    const removed = this.heap[index];
        
    if (index === this.heap.length - 1) {
      this.heap.pop();
      this.playerSocketMap.delete(removed.playerId);
      return removed;
    }
        
    this.heap[index] = this.heap.pop()!;
        
    this.heapify(index);
    this.playerSocketMap.delete(removed.playerId);
    
    return removed;
  }

  private findPlayerBySocketId(socketId: string): string | null { 
    for (const [playerId, socket] of this.playerSocketMap.entries()) {
      if (socket === socketId) {
        return playerId;
      }
    }
    return null;
  }

  removeBySocketId(socketId: string): QueueItem | null {
    const playerId = this.findPlayerBySocketId(socketId);
    if (!playerId) return null;
    return this.removeByPlayerId(playerId);
  }

  private heapify(index: number): void {
    const n = this.heap.length;
        
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.heap[current], this.heap[parent]) >= 0) break;
      this.swap(current, parent);
      current = parent;
    }
        
    if (current !== index) return;
        
    while (true) {
      let left = 2 * current + 1;
      let right = 2 * current + 2;
      let smallest = current;
      
      if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === current) break;
      
      this.swap(current, smallest);
      current = smallest;
    }
  }

  match(): {a: QueueItem, b: QueueItem} | null {
    if (this.heap.length < 2) return null;

    const a = this.removeTop();
    if (!a) return null;

    let b = this.removeTop();
    
    // Garante que não está fazendo match do mesmo jogador consigo mesmo
    while (b && b.playerId === a.playerId) {
      b = this.removeTop();
    }
    
    if (!b) {
      // Não há outro jogador, reinsere o primeiro
      this.insert(a);
      return null;
    }

    console.log(`========== MATCH CREATED ==========`);
    console.log(`Player A: ${a.playerId} (Rank: ${a.rank})`);
    console.log(`Player B: ${b.playerId} (Rank: ${b.rank})`);
    console.log(`===================================`);

    return {a, b};
  }

  size(): number {
    return this.playerSocketMap.size;
  }

  getAll(): QueueItem[] {
    return [...this.heap];
  }

  // Para debug
  validate(): boolean {
    if (this.heap.length !== this.playerSocketMap.size) {
      console.error('INCONSISTENCY: heap size !== map size');
      return false;
    }

    for (const item of this.heap) {
      if (!this.playerSocketMap.has(item.playerId)) {
        console.error(`INCONSISTENCY: ${item.playerId} in heap but not in map`);
        return false;
      }
    }

    return true;
  }
}

export const gameQueue = new GameQueue();