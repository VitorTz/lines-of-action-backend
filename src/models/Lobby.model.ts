import { Schema, model, Document } from 'mongoose';
import { IUser } from './User.model';

export interface ILobby extends Document {
    host: { id: IUser['_id'], rank: number };
    guest: { id: IUser['_id'], rank: number } | null;
    status: 'waiting' | 'full';
    message: string | null;
}

const LobbySchema = new Schema<ILobby>({
    host: {
        id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        rank: {
            type: Number,
            required: true,
        }
    },

    guest: {
        id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        rank: {
            type: Number,
            default: null,
        }
    },

    status: {
        type: String,
        enum: ['waiting', 'full'],
        default: 'waiting',
        required: true,
    },

    message: {
        type: String,
        default: null,
    }

}, {
    timestamps: true,
});

export const Lobby = model<ILobby>('Lobby', LobbySchema);
