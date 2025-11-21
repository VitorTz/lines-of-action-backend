import { Router, Request, Response } from 'express';
import { Lobby } from '../models/Lobby.model';
import Game from '../models/Game.model';
import User from '../models/User.model';
import { authenticate, AuthRequest } from '../security';

const lobby = Router();


lobby.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { message } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({error: "not found", details: "usuário não encontrado"})
        }

        const created = await Lobby.create({
            host: { id: user.id, username: user.username },
            message: message ?? ''
        });

        return res.json(created);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


lobby.get('/', async (req: Request, res: Response) => {
    try {
        const list = await Lobby.find({ status: 'waiting' }).sort({ createdAt: 1 });
        return res.json(list);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


lobby.post('/:id/join', async (req, res) => {
    try {
        const { id, username } = req.body;
        const lb = await Lobby.findById(req.params.id);

        if (!lb) return res.status(404).json({ error: 'Lobby not found' });
        if (lb.status === 'full') return res.status(400).json({ error: 'Lobby is full' });
        if (lb.host?.id && lb.host.id === id) return res.status(400).json({ error: 'Host cannot join own lobby' });

        // Preencher guest
        lb.guest = { id, username };
        lb.status = 'full';
        await lb.save();

        // Criar o jogo automaticamente
        const game = await Game.create({
            playerBlack: lb.host!.id,
            playerWhite: lb.guest.id,
            status: 'active',
            turn: 'black',
            board: Array(8).fill(null).map(() => Array(8).fill(0)),
            moveHistory: []
        });

        return res.json({ lobby: lb, game });
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


lobby.delete('/:id', async (req, res) => {
    try {
        const { playerId } = req.body;
        const lb = await Lobby.findById(req.params.id);

        if (!lb) return res.status(404).json({ error: 'Lobby not found' });
        if (!lb.host?.id || lb.host.id !== playerId) {
            return res.status(403).json({ error: 'Only host can delete lobby' });
        }

        await lb.deleteOne();
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});



export default lobby;
