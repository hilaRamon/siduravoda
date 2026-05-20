import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

const uploadDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage });
const router = express.Router();

router.post('/core/upload-file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Missing file upload' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return res.status(201).json({
    file_url: `${baseUrl}/uploads/${req.file.filename}`,
    original_name: req.file.originalname,
  });
});

export default router;
