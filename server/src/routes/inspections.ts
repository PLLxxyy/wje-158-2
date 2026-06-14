import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/inspections - Get inspection tasks
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { status, date } = req.query;
  const today = date as string || new Date().toISOString().split('T')[0];

  let sql = `
    SELECT i.*, s.name as station_name, s.location as station_location, s.region as station_region
    FROM inspections i
    JOIN stations s ON i.station_id = s.id
    WHERE i.date = ?
  `;
  const params: any[] = [today];

  // Inspectors only see their own tasks
  if (req.user!.role === 'inspector') {
    sql += ' AND i.inspector_id = ?';
    params.push(req.user!.userId);
  }

  if (status && typeof status === 'string') {
    sql += ' AND i.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY i.status ASC, s.name ASC';
  const inspections = db.prepare(sql).all(...params) as any[];

  // Add facility count for each
  const result = inspections.map((insp: any) => {
    const facilityCount = db.prepare('SELECT COUNT(*) as count FROM facilities WHERE station_id = ?').get(insp.station_id) as { count: number };
    return { ...insp, facility_count: facilityCount.count };
  });

  res.json(result);
});

// GET /api/inspections/:id
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const inspection = db.prepare(`
    SELECT i.*, s.name as station_name, s.location as station_location, s.region as station_region, s.lines as station_lines
    FROM inspections i
    JOIN stations s ON i.station_id = s.id
    WHERE i.id = ?
  `).get(req.params.id) as any;

  if (!inspection) {
    res.status(404).json({ error: '巡检任务不存在' });
    return;
  }

  // Get facilities for this station
  const facilities = db.prepare('SELECT * FROM facilities WHERE station_id = ?').all(inspection.station_id) as any[];

  // Get inspection items if they exist
  const items = db.prepare('SELECT * FROM inspection_items WHERE inspection_id = ?').all(req.params.id) as any[];

  res.json({ ...inspection, facilities, items });
});

// POST /api/inspections/:id/start - Start inspection
router.post('/:id/start', authMiddleware, roleMiddleware('inspector'), (req: Request, res: Response) => {
  const db = getDb();
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id) as any;
  if (!inspection) {
    res.status(404).json({ error: '巡检任务不存在' });
    return;
  }

  if (inspection.status !== 'pending') {
    res.status(400).json({ error: '该任务已开始或已完成' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE inspections SET status = ?, started_at = ? WHERE id = ?').run('in_progress', now, req.params.id);

  // Create inspection items for each facility
  const facilities = db.prepare('SELECT * FROM facilities WHERE station_id = ?').all(inspection.station_id) as any[];
  const insertItem = db.prepare('INSERT INTO inspection_items (id, inspection_id, facility_id, facility_type) VALUES (?, ?, ?, ?)');

  for (const f of facilities) {
    insertItem.run(uuidv4(), req.params.id, f.id, f.type);
  }

  res.json({ message: '巡检已开始' });
});

// PUT /api/inspections/:id/items/:itemId - Update inspection item
router.put('/:id/items/:itemId', authMiddleware, roleMiddleware('inspector'), (req: Request, res: Response) => {
  const db = getDb();
  const { result, damage_desc } = req.body;

  if (!result || !['good', 'damaged', 'missing'].includes(result)) {
    res.status(400).json({ error: '请选择检查结果' });
    return;
  }

  const item = db.prepare('SELECT * FROM inspection_items WHERE id = ? AND inspection_id = ?').get(req.params.itemId, req.params.id);
  if (!item) {
    res.status(404).json({ error: '检查项不存在' });
    return;
  }

  db.prepare('UPDATE inspection_items SET result = ?, damage_desc = ? WHERE id = ?').run(result, damage_desc || '', req.params.itemId);

  res.json({ message: '检查项已更新' });
});

// POST /api/inspections/:id/submit - Submit inspection
router.post('/:id/submit', authMiddleware, roleMiddleware('inspector'), (req: Request, res: Response) => {
  const db = getDb();
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id) as any;
  if (!inspection) {
    res.status(404).json({ error: '巡检任务不存在' });
    return;
  }

  if (inspection.status !== 'in_progress') {
    res.status(400).json({ error: '该任务状态不允许提交' });
    return;
  }

  // Check all items have results
  const items = db.prepare('SELECT * FROM inspection_items WHERE inspection_id = ?').all(req.params.id) as any[];
  const unchecked = items.filter((i: any) => !i.result);
  if (unchecked.length > 0) {
    res.status(400).json({ error: `还有 ${unchecked.length} 项未检查` });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE inspections SET status = ?, completed_at = ? WHERE id = ?').run('completed', now, req.params.id);

  // Update facility statuses based on inspection results
  const updateFacility = db.prepare('UPDATE facilities SET status = ?, description = ? WHERE id = ?');

  // Create repair orders for damaged/missing items
  const insertOrder = db.prepare(`
    INSERT INTO repair_orders (id, inspection_item_id, station_id, facility_id, facility_type, damage_desc, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  let orderCount = 0;
  for (const item of items) {
    if (item.result === 'good') {
      updateFacility.run('good', '', item.facility_id);
    } else if (item.result === 'damaged') {
      updateFacility.run('damaged', item.damage_desc, item.facility_id);
      insertOrder.run(uuidv4(), item.id, inspection.station_id, item.facility_id, item.facility_type, item.damage_desc, now);
      orderCount++;
    } else if (item.result === 'missing') {
      updateFacility.run('missing', item.damage_desc || '设施缺失', item.facility_id);
      insertOrder.run(uuidv4(), item.id, inspection.station_id, item.facility_id, item.facility_type, item.damage_desc || '设施缺失', now);
      orderCount++;
    }
  }

  res.json({ message: '巡检已完成提交', repair_orders_created: orderCount });
});

export default router;
