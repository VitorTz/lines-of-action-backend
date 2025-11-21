import { Router, Request, Response } from 'express';
import User, { getUserResponse } from '../models/User.model'
import RefreshToken from '../models/RefreshToken.model';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { 
  authenticate, 
  generateAccessToken, 
  generateRefreshToken, 
  setTokenCookies, 
  AuthRequest, 
  verifyRefreshToken,
  comparePasswords
} from '../security';


const auth = Router();


auth.post('/signup', async (req: Request, res: Response) => {
  try {
    const { 
      username, 
      email, 
      password, 
      age,
      address
    } = req.body;    

    if (!username || !email || !password || !age || !address) {
      return res.status(400).json({ error: 'Os campos username, email, password, age e address são obrigatórios' });
    }

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email ou username já cadastrado' });
    }    

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = new User({
      username,
      email,
      password: hashedPassword,
      age: age,
      address: address
    });

    await user.save();

    // Gerar tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Salvar refresh token
    await new RefreshToken({ userId: user._id, token: refreshToken }).save();

    // Setar cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json(getUserResponse(user));
  } catch (error) {
    console.error('Erro no signup:', error);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});


// Login
auth.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar senha
    const isValidPassword = await comparePasswords(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Salvar refresh token
    await new RefreshToken({ 
      userId: user._id, 
      token: refreshToken 
    }).save();

    // Setar cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.json(getUserResponse(user));
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Obter usuário atual
auth.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(getUserResponse(user));
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});


// Renovar token
auth.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token não fornecido' });
    }

    // Verificar se o token existe no banco
    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    // Verificar token
    const decoded = verifyRefreshToken(refreshToken)

    // Buscar usuário
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Gerar novos tokens
    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    // Remover token antigo e salvar novo
    await RefreshToken.deleteOne({ token: refreshToken });
    await new RefreshToken({ userId: user._id, token: newRefreshToken }).save();

    // Setar novos cookies
    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.json(getUserResponse(user));
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});


// Logout
auth.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ error: 'Erro ao fazer logout' });
  }
});


// Atualizar perfil
auth.put('/user/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { username, age, address } = req.body;
    const updateData: any = {};

    if (username) updateData.username = username;
    if (age) updateData.age = age
    if (address) updateData.address = address

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(getUserResponse(user));
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Username ou email já em uso' });
    }
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});


auth.put('/user/profile/image', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { perfilImageUrl } = req.body

    const updateData = {
      perfilImageUrl: perfilImageUrl
    }    
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(getUserResponse(user));
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Erro ao atualizar imagem url' });
    }
    console.error('Erro ao atualizar imagem url:', error);
    res.status(500).json({ error: 'Erro ao atualizar imagem' });
  }
})


export default auth;