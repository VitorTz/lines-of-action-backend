import { Router, Request, Response } from 'express';
import User, { getUserResponse } from '../models/User.model';


const metrics = Router();


/**
 * GET /metrics/users
 * Retorna usuários ordenados por rank, idade ou data de criação.
 * Suporta paginação e filtros opcionais.
 */
metrics.get('/users/rank', async (req: Request, res: Response) => {
  try {
    const {
      sort = 'rank',     // rank | age | createdAt
      order = 'desc',    // asc | desc
      minRank,
      maxRank,
      minAge,
      maxAge,
      limit = '50',
      offset = '0'
    } = req.query;

    const parsedLimit = Math.min(Number(limit) || 50, 200);
    const parsedOffset = Number(offset) || 0;

    // Filtros dinâmicos
    const filter: any = {};

    if (minRank !== undefined) filter.rank = { ...filter.rank, $gte: Number(minRank) };
    if (maxRank !== undefined) filter.rank = { ...filter.rank, $lte: Number(maxRank) };

    if (minAge !== undefined) filter.age = { ...filter.age, $gte: Number(minAge) };
    if (maxAge !== undefined) filter.age = { ...filter.age, $lte: Number(maxAge) };

    // Ordenação
    const sortFields: any = {
      rank: 'rank',
      age: 'age',
      createdAt: 'createdAt'
    };

    const sortKey = sortFields[sort as string] || 'rank';
    const sortDirection = order === 'asc' ? 1 : -1;

    const users = await User.find(filter)
      .sort({ [sortKey]: sortDirection })
      .skip(parsedOffset)
      .limit(parsedLimit);

    return res.json({
      count: users.length,
      items: users.map(getUserResponse)
    });

  } catch (err) {
    console.error('Error fetching user metrics:', err);
    return res.status(500).json({ error: 'Failed to fetch user metrics' });
  }
});


export default metrics;
