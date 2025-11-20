import { Router } from 'express';
import Game, { BLACK, WHITE } from '../models/Game.model';
import { isValidMove, checkEndGame } from '../service/game.logic';


const game = Router();

// Busca jogos por status e/ou Jogador
// body: { status, player }
game.get('/', async (req, res) => {
    try {
        const { status, player } = req.query;

        const filter: any = {};

        if (status) filter.status = status;
        if (player) filter.$or = [
            { 'players.black': player },
            { 'players.white': player }
        ];

        const games = await Game.find(filter);
        return res.json(games);

    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});

// Criar novo jogo
// body: { playerBlack, playerWhite }
game.post('/create', async (req, res) => {
    try {
        const {
            playerBlack,
            playerWhite
        } = req.body;

        if (!playerBlack || !playerWhite) {
            return res.status(400).json({ error: 'Players required' });
        }

        const newGame = await Game.create({
            playerBlack,
            playerWhite,
            status: 'active'
        });
        return res.json(newGame);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


game.delete('/:id', async (req, res) => {
    try {
        const deleted = await Game.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Game not found' });
        }
        return res.json({ success: true, message: 'Game deleted' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


// Buscar jogo
// params: id
game.get('/:id', async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        return res.json(game);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});

// params: id (id do jogo)
// body: { player, from: {r,c}, to: {r,c} }
game.post('/:id/move', async (req, res) => {
    try {
        const { player, from, to } = req.body;
        const gameData = await Game.findById(req.params.id);

        if (!gameData) return res.status(404).json({ error: 'Game not found' });
        if (gameData.status !== 'active') return res.status(400).json({ error: 'Game not active' });
        if (gameData.turn !== player) return res.status(400).json({ error: 'Not your turn' });

        const board = gameData.board;

        const valid = isValidMove(
            board,
            { r: from.r, c: from.c },
            { r: to.r, c: to.c },
            player
        );

        if (!valid) return res.status(400).json({ error: 'Invalid move' });

        // Aplicar movimento
        const piece = player === 'black' ? BLACK : WHITE;
        board[from.r][from.c] = 0;
        board[to.r][to.c] = piece;

        // Registrar histórico
        gameData.moveHistory.push({
            player,
            from: { row: from.r, col: from.c },
            to: { row: to.r, col: to.c },
            captured: false,
            timestamp: new Date()
        } as any);

        // Alternar turno
        gameData.turn = player === 'black' ? 'white' : 'black';

        // Verificar fim de jogo
        const endState = checkEndGame(gameData);
        if (endState.status === 'finished') {
            gameData.status = 'finished';
            gameData.winner = endState.winner;
        }

        await gameData.save();
        return res.json(gameData);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


// Atualizar status do jogo
// params: id
// body: { status }
// valis status: waiting', 'active', 'finished
game.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['waiting', 'active', 'finished'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const gameData = await Game.findById(req.params.id);
        if (!gameData) return res.status(404).json({ error: 'Game not found' });

        gameData.status = status;
        await gameData.save();

        return res.json(gameData);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


export default game;
