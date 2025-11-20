import mongoose, { Schema, Document } from 'mongoose';
import { IPlayer } from './Player.model';


export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type GameStatus = 'waiting' | 'active' | 'finished'


function createInitialBoard(): number[][] {
  const board = Array(8).fill(0).map(() => Array(8).fill(EMPTY));

  for (let i = 1; i <= 6; i++) {
    board[0][i] = BLACK;
    board[7][i] = BLACK;
    board[i][0] = WHITE;
    board[i][7] = WHITE;
  }
  
  return board;
}


export interface IMove extends Document {
  player: 'black' | 'white';
  from: { row: number; col: number };
  to: { row: number; col: number };
  captured: boolean;
  timestamp: Date;
}


// Representa uma jogada
const MoveSchema = new Schema<IMove>({
  player: { type: String, enum: ['black', 'white'], required: true },
  from: {
    row: { type: Number, required: true },
    col: { type: Number, required: true },
  },
  to: {
    row: { type: Number, required: true },
    col: { type: Number, required: true },
  },
  captured: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});


export interface IGame extends Document {
  playerBlack: IPlayer['_id'];
  playerWhite: IPlayer['_id'];
  status: 'waiting' | 'active' | 'finished';
  turn: 'black' | 'white';  
  board: number[][]; // 8x8: 0 = Vazio, 1 = Preta, 2 = Branca
  moveHistory: IMove[];
  winner?: IPlayer['_id'];
  createdAt: Date;
  updatedAt: Date;
}


// Representa um jogo
const GameSchema = new Schema<IGame>({
  playerBlack: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  playerWhite: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  status: { 
    type: String, 
    enum: ['waiting', 'active', 'finished'], 
    default: 'waiting' 
  },
  
  turn: { 
    type: String, 
    enum: ['black', 'white'], 
    default: 'black' 
  },
  
  board: { 
    type: [[Number]], 
    required: true, 
    default: createInitialBoard 
  },
  
  moveHistory: { type: [MoveSchema], required: true, default: [] },
  
  winner: { type: Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true  });


const Game = mongoose.model<IGame>('Game', GameSchema);


export default Game;