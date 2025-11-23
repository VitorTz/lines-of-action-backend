import { Router, Response, Request } from 'express';
import Game, { BLACK, WHITE } from '../models/Game.model';
import { isValidMove, checkEndGame } from '../service/game.logic';
import { authenticate, AuthRequest } from '../security';


const game = Router();


game.get('/', async (req: Request, res: Response) => {
    try {
        const { gameId } = req.query;

        if (!gameId) {
            return res.status(400).json({ error: 'gameId is required' });
        }

        const game = await Game.findById(gameId);
        return res.json(game);
    } catch (err) {
        return res.status(500).json({ error: 'Internal error', details: err });
    }
});


game.get('/match/history', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const id = req.userId;

        const matches = await Game.find({
            $or: [
                { playerBlack: id },
                { playerWhite: id }
            ],
            status: 'finished'
        })
            .populate('playerBlack')
            .populate('playerWhite')
            .populate('winner')
            .sort({ createdAt: -1 })
            .exec();

        const result = matches.map(match => ({
            gameId: match.id,
            playerBlack: match.playerBlack,
            playerWhite: match.playerWhite,
            winner: match.winner || null,
            gameCreatedAt: match.createdAt,
            gameUpdatedAt: match.updatedAt,
            gameNumMoves: match.moveHistory.length,
            gameMoves: match.moveHistory
        }));

        return res.json(result);

    } catch (error) {
        console.error('Erro ao buscar partidas:', error);
        return res.status(500).json({ error: 'Erro ao buscar partidas' });
    }
});


game.get('/match/history/one', async (req, res) => {
    try {

        const { gameId } = req.query
        
        console.log("gameId", gameId)

        const game = await Game.findById(gameId)
            .populate('playerBlack')
            .populate('playerWhite')
            .populate('winner')
            .sort({ createdAt: -1 })
            .exec();

        if (!game) {
            return res.status(404).json({ error: "Partida não encontrada" })
        }

        const result = {
            gameId: game.id,
            playerBlack: game.playerBlack,
            playerWhite: game.playerWhite,
            winner: game.winner || null,
            gameCreatedAt: game.createdAt,
            gameUpdatedAt: game.updatedAt,
            gameNumMoves: game.moveHistory.length,
            gameMoves: game.moveHistory
        }

        return res.json(result);

    } catch (error) {
        console.error('Erro ao buscar partidas:', error);
        return res.status(500).json({ error: 'Erro ao buscar partidas' });
    }
})


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
