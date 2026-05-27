import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { attachUser, requireAuth } from '../middleware/auth.js';

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

router.use(attachUser);
router.use(requireAuth);

router.post('/core/upload-file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Missing file upload' });
  }

  const baseUrl = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return res.status(201).json({
    file_url: `${baseUrl}/uploads/${req.file.filename}`,
    original_name: req.file.originalname,
  });
});

export default router;
