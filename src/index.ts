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
const httpServer = createServer(app)
const PORT = process.env.PORT!;
const MONGODB_URI = process.env.MONGODB_URI!;
const V = 'v1.0'


async function startServer() {
  if (!MONGODB_URI) {
    console.error('Erro: MONGODB_URI não definida no .env');
    process.exit(1);
  }

  if (!existsSync(Constants.IMAGE_DIR)) {
    await fs.mkdir(Constants.IMAGE_DIR, { recursive: true });
  }

  try {
    // Conectar ao MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB com sucesso!');

    const io = initializeSocket(httpServer)
    
    app.use(cors({  
      origin: `http://localhost:${PORT}`,
      credentials: true
    }));

    app.use(express.json());
    app.use(cookieParser());
    
    app.use('/api/v1/system', system)
    app.use('/api/v1/auth', auth)
    app.use('/api/v1/game', game)
    app.use('/api/v1/lobby', lobby)
    app.use('/api/v1/image', image)

    app.listen(PORT, () => {
      console.log("====================================")
      console.log(V)
      console.log(`Mongodb rodando na porta ${PORT}`);   
      console.log("====================================")
    });

  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

startServer();