import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { formatBytes, getDbStatus } from '../util';
import { DBInfo, DBHealthCheck } from '../types/db';


const system = Router();


system.get('/', async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const dbStatus: string = getDbStatus(mongoose.connection);

  let dbInfo: DBInfo = { status: dbStatus, };

  if (dbStatus === 'connected') {
    try {
      dbInfo.name = mongoose.connection.db!.databaseName;
      const collections = await mongoose.connection.db!.listCollections().toArray();
      dbInfo.collections = collections.map((collection) => collection.name);
      const stats = await mongoose.connection.db!.stats();
      dbInfo.storageSize = formatBytes(stats.storageSize);
      dbInfo.totalSize = formatBytes(stats.totalSize);

    } catch (error: any) {
      console.error('Erro ao buscar informações do DB:', error);
      dbInfo.error = error.message || 'Falha ao buscar informações do DB';
    }
  }

  const healthCheck: DBHealthCheck = {
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    database: dbInfo,
    memory: {
      rss: formatBytes(memoryUsage.rss),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      heapUsed: formatBytes(memoryUsage.heapUsed),
      external: formatBytes(memoryUsage.external),
    },
  };

  res.status(200).json(healthCheck);
});

export default system;