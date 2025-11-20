import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import crypto from 'crypto';
import busboy from 'busboy';
import { Constants } from '../constants';


const image = Router();


// Configurações
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];


// Interfaces
interface UploadedFile {

  fieldname: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;

}

interface UploadRequest extends Request {
  uploadedFiles?: UploadedFile[];
  uploadedFields?: Record<string, string>;
}


interface ImageMetadata {
  filename: string;
  url: string;
  size: number;
  created: Date;
  modified: Date;
}

interface DeleteResult {
  deleted: string[];
  notFound: string[];
  errors: string[];
}



// Função auxiliar para gerar nome único
const generateUniqueFilename = (originalName: string): string => {
  const ext = path.extname(originalName);
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}${ext}`;
};


// Função auxiliar para validar tipo de imagem
const isValidImageType = (contentType: string): boolean => {
  return ALLOWED_TYPES.includes(contentType);
};


// Middleware para processar upload usando Busboy
const processUpload = (req: UploadRequest, res: Response, next: NextFunction): void => {
  if (!req.is('multipart/form-data')) {
    res.status(400).json({ error: 'Content-Type deve ser multipart/form-data' });
    return;
  }

  const bb = busboy({ 
    headers: req.headers,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 10
    }
  });

  const files: UploadedFile[] = [];
  const fields: Record<string, string> = {};
  let hasError = false;
  let pendingWrites = 0;

  bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: busboy.FileInfo) => {
    const { filename, mimeType } = info;

    if (!isValidImageType(mimeType)) {
      hasError = true;
      file.resume();
      return;
    }

    const uniqueFilename = generateUniqueFilename(filename);
    const filepath = path.join(Constants.IMAGE_DIR, uniqueFilename);
    const writeStream = createWriteStream(filepath);

    pendingWrites++;

    file.pipe(writeStream);

    writeStream.on('finish', () => {
      files.push({
        fieldname,
        filename: uniqueFilename,
        originalName: filename,
        mimetype: mimeType,
        size: writeStream.bytesWritten,
        path: filepath
      });
      pendingWrites--;
      
      if (pendingWrites === 0 && req.readable === false) {
        finishUpload();
      }
    });

    writeStream.on('error', () => {
      hasError = true;
      pendingWrites--;
    });
  });

  bb.on('field', (fieldname: string, value: string) => {
    fields[fieldname] = value;
  });

  const finishUpload = () => {
    if (hasError) {
      res.status(400).json({ 
        error: 'Formato de arquivo inválido. Apenas imagens são permitidas.' 
      });
      return;
    }
    req.uploadedFiles = files;
    req.uploadedFields = fields;
    next();
  };

  bb.on('finish', () => {
    if (pendingWrites === 0) {
      finishUpload();
    }
  });

  bb.on('error', (error: Error) => {
    res.status(500).json({ error: 'Erro ao processar upload' });
  });

  req.pipe(bb);
};

// POST - Upload de imagem (somente admin)
image.post('/upload', processUpload, async (req: UploadRequest, res: Response): Promise<void> => {
  try {
    console.log("112")
    if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
      res.status(400).json({ error: 'Nenhuma imagem foi enviada' });
      return;
    }

    const file = req.uploadedFiles[0];

    res.status(201).json({
      message: 'Imagem enviada com sucesso',
      filename: file.filename,
      url: `/api/images/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
  }
});

// POST - Upload múltiplo de imagens (somente admin)
image.post('/upload-multiple', processUpload, async (req: UploadRequest, res: Response): Promise<void> => {
  try {
    if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
      res.status(400).json({ error: 'Nenhuma imagem foi enviada' });
      return;
    }

    const uploadedFiles = req.uploadedFiles.map(file => ({
      filename: file.filename,
      url: `/api/images/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    }));

    res.status(201).json({
      message: `${req.uploadedFiles.length} imagens enviadas com sucesso`,
      files: uploadedFiles
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer upload das imagens' });
  }
});


// Servir imagem
image.get('/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    
    const safeName = path.basename(filename);
    const filepath = path.join(Constants.IMAGE_DIR, safeName);
    
    // Verificar se o arquivo existe
    try {
      await fs.access(filepath);
    } catch {
      res.status(404).json({ error: 'Imagem não encontrada' });
      return;
    }

    // Obter informações do arquivo
    const stats = await fs.stat(filepath);
    const ext = path.extname(safeName).toLowerCase();
    
    // Definir Content-Type correto
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    // Cache e otimização
    res.set({
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Content-Length': stats.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': `"${stats.mtime.getTime()}-${stats.size}"`,
      'Last-Modified': stats.mtime.toUTCString()
    });
    
    if (req.headers['if-none-match'] === `"${stats.mtime.getTime()}-${stats.size}"`) {
      res.status(304).end();
      return;
    }
    
    res.sendFile(filepath);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar imagem' });
  }
});


// GET - Listar todas as imagens com metadados
image.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const files = await fs.readdir(Constants.IMAGE_DIR);
    
    const imagePromises = files
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(async (file): Promise<ImageMetadata> => {
        const filepath = path.join(Constants.IMAGE_DIR, file);
        const stats = await fs.stat(filepath);
        
        return {
          filename: file,
          url: `/api/images/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      });

    const images = await Promise.all(imagePromises);

    res.json({
      count: images.length,
      images: images.sort((a, b) => b.created.getTime() - a.created.getTime())
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar imagens' });
  }
});


// DELETE - Deletar imagem
image.delete('/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filepath = path.join(Constants.IMAGE_DIR, safeName);

    // Verificar se o arquivo existe
    try {
      await fs.access(filepath);
    } catch {
      res.status(404).json({ error: 'Imagem não encontrada' });
      return;
    }

    // Deletar arquivo
    await fs.unlink(filepath);

    res.json({ 
      message: 'Imagem deletada com sucesso',
      filename: safeName
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar imagem' });
  }
});

// DELETE - Deletar múltiplas imagens (somente admin)
image.delete('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filenames } = req.body as { filenames: string[] };

    if (!Array.isArray(filenames) || filenames.length === 0) {
      res.status(400).json({ error: 'Lista de filenames inválida' });
      return;
    }

    const results: DeleteResult = {
      deleted: [],
      notFound: [],
      errors: []
    };

    for (const filename of filenames) {
      const safeName = path.basename(filename);
      const filepath = path.join(Constants.IMAGE_DIR, safeName);
      
      try {
        await fs.access(filepath);
        await fs.unlink(filepath);
        results.deleted.push(safeName);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          results.notFound.push(safeName);
        } else {
          results.errors.push(safeName);
        }
      }
    }

    res.json({
      message: `${results.deleted.length} imagens deletadas com sucesso`,
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar imagens' });
  }
});

export default image;