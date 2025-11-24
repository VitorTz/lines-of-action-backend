import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User.model';
import { IGame } from './Game.model';

export interface IGameChat extends Document {
  gameId: IGame['_id'];
  senderId: IUser['_id'] | null;   
  senderRole: 'black' | 'white' | 'system';
  message: string;
  createdAt: Date;
}

const GameChatSchema = new Schema<IGameChat>({
  gameId: {
    type: Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
    index: true
  },

  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  senderRole: {
    type: String,
    enum: ['black', 'white', 'system'],
    required: true
  },

  message: {
    type: String,
    required: true,
    trim: true
  },

}, { timestamps: { createdAt: true, updatedAt: false } });


const GameChat = mongoose.model<IGameChat>('GameChat', GameChatSchema);

export default GameChat;
