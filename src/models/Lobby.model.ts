import { Schema, model } from 'mongoose';


const LobbySchema = new Schema({
    host: {
        id: { type: String, required: true },
        username: { type: String, required: true }
    },
    guest: {
        id: { type: String, default: null },
        username: { type: String, default: null }
    },
    message: { type: String, default: '' },
    status: {
        type: String,
        enum: ['waiting', 'full'],
        default: 'waiting'
    },
    createdAt: { type: Date, default: Date.now }
});


export const Lobby = model('Lobby', LobbySchema);