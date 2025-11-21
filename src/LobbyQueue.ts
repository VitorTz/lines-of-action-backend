import { Mutex } from 'async-mutex';

const mutex = new Mutex();

export interface LobbyItem {
  playerId: string;
  createdAt: number;
  rank: number;
  socketId: string;
}

class LobbyQueue {

  private playersSet = new Set<string>();
  private heap: LobbyItem[] = [];

  private compare(a: LobbyItem, b: LobbyItem) {
    if (a.rank !== b.rank) return b.rank - a.rank;
    return a.createdAt - b.createdAt;
  }

  private swap(i: number, j: number) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  async hasPlayer(playerId: string): Promise<boolean> {
    const release = await mutex.acquire()
    try {
      return this.playersSet.has(playerId)
    } finally{
      release()
    }
  }

  async insert(item: LobbyItem) {
    const release = await mutex.acquire();

    try {
      if (this.playersSet.has(item.playerId)) {       
        return
      }
    } finally {
        release()
    }

    try {
      this.heap.push(item);
      this.playersSet.add(item.playerId)
      let i = this.heap.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (this.compare(this.heap[i], this.heap[p]) < 0) break;
        this.swap(i, p);
        i = p;
      }
    } finally {
      console.log("==========")
      this.heap.forEach(e => console.log(e))
      console.log(this.playersSet)
      console.log("==========")
      release();
    }
  }

  async peek(): Promise<LobbyItem | null> {
    const release = await mutex.acquire();
    try {
      return this.heap[0] || null;
    } finally {
      release();
    }
  }

  async removeTop(): Promise<LobbyItem | null> {
    const release = await mutex.acquire();
    try {
      if (this.heap.length === 0) return null;
      if (this.heap.length === 1) return this.heap.pop()!;
      
      const top = this.heap[0];
      this.heap[0] = this.heap.pop()!;
      let i = 0;
      
      while (true) {
        let left = 2 * i + 1;
        let right = 2 * i + 2;
        let largest = i;
        
        if (left < this.heap.length && this.compare(this.heap[left], this.heap[largest]) > 0) {
          largest = left;
        }
        if (right < this.heap.length && this.compare(this.heap[right], this.heap[largest]) > 0) {
          largest = right;
        }
        if (largest === i) break;
        
        this.swap(i, largest);
        i = largest;
      }
      this.playersSet.delete(top.playerId)
      return top;
    } finally {
      release();
    }
  }

  async removeByPlayerId(playerId: string) {
    const release = await mutex.acquire();
    
    try {
      if (!this.playersSet.has(playerId)) {
        return
      }
    } finally {
      release()
    }

    try {
      const index = this.heap.findIndex(item => item.playerId === playerId);
      
      if (index === -1) return null;
      
      const removed = this.heap[index];
      
      // Se for o último elemento, apenas remove
      if (index === this.heap.length - 1) {
        this.heap.pop();
        return removed;
      }
      
      // Substitui pelo último elemento
      this.heap[index] = this.heap.pop()!;
      
      // Reordena o heap
      this.heapify(index);
      this.playersSet.delete(removed.playerId)
      return removed;
    } finally {
      release();
    }
  }

  async removeBySocketId(socketId: string): Promise<LobbyItem | null> {
    const release = await mutex.acquire();
    try {
      const index = this.heap.findIndex(item => item.socketId === socketId);
      
      if (index === -1) return null;
      
      const removed = this.heap[index];
      
      // Se for o último elemento, apenas remove
      if (index === this.heap.length - 1) {
        this.heap.pop();
        return removed;
      }
      
      // Substitui pelo último elemento
      this.heap[index] = this.heap.pop()!;
      
      // Reordena o heap
      this.heapify(index);
      this.playersSet.delete(removed.playerId)
      return removed;
    } finally {
      release();
    }
  }

  private heapify(index: number): void {
    const n = this.heap.length;
    
    // Tenta subir
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parent]) <= 0) break;
      this.swap(index, parent);
      index = parent;
    }
    
    // Tenta descer
    while (true) {
      let left = 2 * index + 1;
      let right = 2 * index + 2;
      let largest = index;
      
      if (left < n && this.compare(this.heap[left], this.heap[largest]) > 0) {
        largest = left;
      }
      if (right < n && this.compare(this.heap[right], this.heap[largest]) > 0) {
        largest = right;
      }
      if (largest === index) break;
      
      this.swap(index, largest);
      index = largest;
    }
  }

  async cleanup(timeoutMs: number): Promise<LobbyItem[]> {
    const removed: LobbyItem[] = [];
    const release = await mutex.acquire();
    try {
      const now = Date.now();
      this.heap = this.heap.filter(e => {
        const expired = now - e.createdAt >= timeoutMs;
        if (expired) removed.push(e);
        return !expired;
      });
      removed.forEach(p => this.playersSet.delete(p.playerId))
    } finally {
      release();
    }
    return removed;
  }

  async match(): Promise<{a: LobbyItem, b: LobbyItem} | null> {
    const a: LobbyItem | null = await this.removeTop();
    let b: LobbyItem | null = null

    do {
      b = await this.removeTop()
    } while (a !== null && b !== null && b.playerId !== a.playerId)    
    
    if (!a || !b) {
      if (a) await this.insert(a);
      if (b) await this.insert(b);
      return null;
    }
    
    return {a, b};
  }

  size(): number {
    return this.playersSet.size
  }

  async getAll(): Promise<LobbyItem[]> {
    const release = await mutex.acquire();
    try {
      return [...this.heap];
    } finally {
      release();
    }
  }
}

export const lobbyQueue = new LobbyQueue();