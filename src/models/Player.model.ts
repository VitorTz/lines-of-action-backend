import mongoose, { Schema, Document } from "mongoose";


export interface IPlayer extends Document {
    socketId: string    
    username: string
    status: 'online' | 'ready' | 'in-game'
    gameId: string
    connectedAt: Date
}


const playerSchema = new Schema<IPlayer>({
  socketId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['online', 'ready', 'in-game'], 
    default: 'online'
  },
  gameId: { type: String, default: null },
  connectedAt: { type: Date, default: Date.now }
});


const Player = mongoose.model<IPlayer>('Player', playerSchema);


export default Player;