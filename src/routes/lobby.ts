import { Router, Request, Response } from 'express';
import { ILobby, Lobby } from '../models/Lobby.model';
import Game, { createInitialBoard } from '../models/Game.model';
import User from '../models/User.model';
import { authenticate, AuthRequest } from '../security';
import { shuffle } from '../util';

const lobby = Router();


lobby.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { message } = req.body;
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({error: "not found", details: "usuário não encontrado"})
        }

        const created = await Lobby.create({
            host: {id: user.id, rank: user.rank},
            message: message ?? ''
        });

        return res.json(created);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


lobby.get('/', async (req: Request, res: Response) => {
    try {
        const { status, sort, order } = req.query;

        const filters: any = {};

        if (status === 'waiting' || status === 'full') {
            filters.status = status;
        }

        let sortQuery: any = {};

        if (sort === 'createdAt') {
            sortQuery = { createdAt: order === 'desc' ? -1 : 1 };
        }

        if (sort === 'rank') {
            sortQuery = { "host.rank": order === 'desc' ? -1 : 1 };
        }
        
        if (!sort) {
            sortQuery = { createdAt: 1 };
        }

        const list = await Lobby.find(filters).sort(sortQuery);

        return res.json(list);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


lobby.post('/:id/join', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        // user id inválido
        if (!req.userId) return res.status(400).json({ error: 'Invalid user id' });
        
        // Busca pelo lobby
        const lb = await Lobby.findById<ILobby>(req.params.id);
        
        // lobby não encontrado
        if (!lb) return res.status(404).json({ error: 'Lobby not found' });
        
        // Lobby está cheio
        if (lb.status === 'full') return res.status(400).json({ error: 'Lobby is full' });
        
        // Já é o host o lobby
        if (lb.host.id === req.userId) return res.status(400).json({ error: 'Host cannot join own lobby' });
        
        // Já é guest do lobby
        if (lb.guest && lb.guest.id === req.userId) return res.status(400).json({ error: 'You are already in this lobby' });

        // Busca pelos jogadores que farão parte do jogo
        const playerHost = await User.findById(lb.host.id!);
        const playerGuest = await User.findById(req.userId);

        if (!playerHost) {
            return res.status(400).json({ error: 'Player host não encontrado' });
        }

        if (!playerGuest) {
            return res.status(400).json({ error: 'Player guest não encontrado' });
        }
        
        lb.status = 'full';
        lb.guest = {id: playerGuest.id, rank: playerGuest.rank }

        await lb.save();
        
        const players = shuffle([playerHost, playerGuest])
        console.log(players)

        // Criar o jogo
        const game = await Game.create({
            playerBlack: players[0].id,
            playerWhite: players[1].id,
            status: 'active',
            turn: 'black',
            board: createInitialBoard(),
            moveHistory: []
        });

        return res.json({ lobby: lb, game });
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});



export default lobby;
