import express from 'express';

const router = express.Router();

router.get('/me', (_req, res) => {
  res.json({});
});

export default router;
