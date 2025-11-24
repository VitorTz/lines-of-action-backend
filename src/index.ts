import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import system from './routes/system';
import auth from './routes/auth';
import game from './routes/game';
import lobby from './routes/lobby';
import image from './routes/image';
import metrics from './routes/metrics';
import { initializeSocket } from './socket/socket';
import { createServer } from 'http';
import { Constants } from './constants';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import 'dotenv/config';
import { formatDateTimeBR } from './util';
import Game from './models/Game.model';


const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT; // 3000
const MONGODB_URI = process.env.MONGODB_URI; // mongodb://localhost:27017/linesdb
const CLIENT_URL = process.env.CLIENT_URL; // http://localhost:5173
const V = process.env.VERSION; // 1.0.0


async function startServer() {
  if (!MONGODB_URI) {
    console.error('Erro: MONGODB_URI não definida no .env');
    process.exit(1);
  }
  
  if (!existsSync(Constants.IMAGE_DIR)) {
    await fs.mkdir(Constants.IMAGE_DIR, { recursive: true });
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    
    app.use(cors({  
      origin: CLIENT_URL,
      credentials: true
    }));
    app.use(express.json());
    app.use(cookieParser());
    
    // Inicialização do socket que lida com o lobby de partidas e jogos
    initializeSocket(httpServer);
    
    // Rotas express
    app.use('/api/v1/system', system);
    app.use('/api/v1/auth', auth);
    app.use('/api/v1/game', game);
    app.use('/api/v1/lobby', lobby);
    app.use('/api/v1/image', image);
    app.use('/api/v1/metrics', metrics);
    
    // Rota de teste
    app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', version: V });
    });

    Game.deleteMany({})
    
    httpServer.listen(PORT, () => {
      console.log("====================================");
      console.log(`Lines of Action - BACKEND: v-${V}`);
      console.log(` Servidor Express: http://localhost:${PORT}`);
      console.log(` Socket.IO: ws://localhost:${PORT}`);
      console.log(` API REST: http://localhost:${PORT}/api/v1`);
      console.log(" now:", formatDateTimeBR(new Date()))
      console.log("====================================");
    });
    
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();