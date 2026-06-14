import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// GET /api/repairs - List repair orders
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { status } = req.query;

  let sql = `
    SELECT ro.*, s.name as station_name, s.location as station_location
    FROM repair_orders ro
    JOIN stations s ON ro.station_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'repairer') {
    sql += ' AND (ro.repairer_id = ? OR ro.repairer_id IS NULL)';
    params.push(req.user!.userId);
  }

  if (status && typeof status === 'string') {
    sql += ' AND ro.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY CASE ro.status WHEN "pending" THEN 0 WHEN "in_progress" THEN 1 ELSE 2 END, ro.created_at DESC';
  const orders = db.prepare(sql).all(...params) as any[];

  res.json(orders);
});

// GET /api/repairs/:id
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT ro.*, s.name as station_name, s.location as station_location, s.region as station_region
    FROM repair_orders ro
    JOIN stations s ON ro.station_id = s.id
    WHERE ro.id = ?
  `).get(req.params.id) as any;

  if (!order) {
    res.status(404).json({ error: '工单不存在' });
    return;
  }

  res.json(order);
});

// POST /api/repairs/:id/accept - Repairer accepts order
router.post('/:id/accept', authMiddleware, roleMiddleware('repairer'), (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(req.params.id) as any;
  if (!order) {
    res.status(404).json({ error: '工单不存在' });
    return;
  }

  if (order.status !== 'pending') {
    res.status(400).json({ error: '该工单已被接单或已完成' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE repair_orders SET status = ?, repairer_id = ?, assigned_at = ? WHERE id = ?').run(
    'in_progress', req.user!.userId, now, req.params.id
  );

  res.json({ message: '已接单' });
});

// POST /api/repairs/:id/complete - Complete repair with photo
router.post('/:id/complete', authMiddleware, roleMiddleware('repairer'), upload.single('photo'), (req: Request & { file?: Express.Multer.File }, res: Response) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(req.params.id) as any;
  if (!order) {
    res.status(404).json({ error: '工单不存在' });
    return;
  }

  if (order.status === 'completed') {
    res.status(400).json({ error: '该工单已完成' });
    return;
  }

  const now = new Date().toISOString();
  const photoPath = req.file ? `/uploads/${req.file.filename}` : '';
  const repair_desc = (req.body as any).repair_desc || '';

  db.prepare('UPDATE repair_orders SET status = ?, repair_photo = ?, repair_desc = ?, completed_at = ? WHERE id = ?').run(
    'completed', photoPath, repair_desc, now, req.params.id
  );

  // Update facility status back to good
  db.prepare('UPDATE facilities SET status = ?, description = ? WHERE id = ?').run('good', '', order.facility_id);

  // Update inspection item repaired status
  db.prepare('UPDATE inspection_items SET repaired = 1 WHERE id = ?').run(order.inspection_item_id);

  res.json({ message: '维修完成' });
});

export default router;
