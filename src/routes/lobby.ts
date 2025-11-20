import { Router, Request, Response } from 'express';
import User from '../models/User.model'
import RefreshToken from '../models/RefreshToken.model';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextFunction } from 'express';
import 'dotenv/config';



const lobby = Router();

const connectedPlayers = new Map<string, any>();