import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';


const JWT_SECRET = process.env.JWT_SECRET!
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
const ACCESS_TOKEN_EXPIRE_TIME_IN_MILLISECONDS = parseInt(process.env.ACCESS_TOKEN_EXPIRE_TIME_IN_MINUTES || '900000')
const REFRESH_TOKEN_EXPIRE_TIME_IN_MILLISECONDS = parseInt(process.env.REFRESH_TOKEN_EXPIRE_TIM_IN_DAYS || '2592000000')


export interface AuthRequest extends Request {

  userId?: string;

}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};


export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRE_TIME_IN_MILLISECONDS });
};


export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRE_TIME_IN_MILLISECONDS });
};


export const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_EXPIRE_TIME_IN_MILLISECONDS
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRE_TIME_IN_MILLISECONDS
  });
};


export function verifyRefreshToken(refreshToken: any): { userId: string } {
    return jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string }
}


export async function comparePasswords(password1: string, password2: string): Promise<boolean> {
    return await bcrypt.compare(password1, password1)
}