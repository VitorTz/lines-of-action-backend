import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import system from './routes/system';
import auth from './routes/auth';
import game from './routes/game';
import lobby from './routes/lobby';
import image from './routes/image';
import { initializeSocket } from './socket/socket';
import { createServer } from 'http';
import { Constants } from './constants';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import 'dotenv/config';


const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const CLIENT_URL = process.env.CLIENT_URL;
const V = process.env.VERSION;


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
    console.log('[Conectado ao MongoDB]');
    
    app.use(cors({  
      origin: CLIENT_URL,
      credentials: true
    }));
    app.use(express.json());
    app.use(cookieParser());
    
    // Inicialização do socket
    const io = initializeSocket(httpServer);
    
    // Rotas express
    app.use('/api/v1/system', system);
    app.use('/api/v1/auth', auth);
    app.use('/api/v1/game', game);
    app.use('/api/v1/lobby', lobby);
    app.use('/api/v1/image', image);
    
    // Rota de teste
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', version: V });
    });
    
    httpServer.listen(PORT, () => {
      console.log("====================================");
      console.log(`Lines of Action - BACKEND: v-${V}`);
      console.log(` Servidor Express: http://localhost:${PORT}`);
      console.log(` Socket.IO: ws://localhost:${PORT}`);
      console.log(` API REST: http://localhost:${PORT}/api/v1`);
      console.log("====================================");
    });
    
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();