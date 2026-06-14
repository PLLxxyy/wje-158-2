import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/stations
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { search, region } = req.query;

  let sql = 'SELECT * FROM stations WHERE 1=1';
  const params: any[] = [];

  if (search && typeof search === 'string') {
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  if (region && typeof region === 'string') {
    sql += ' AND region = ?';
    params.push(region);
  }

  sql += ' ORDER BY created_at DESC';
  const stations = db.prepare(sql).all(...params) as any[];

  // Calculate facility health rate for each station
  const result = stations.map((station: any) => {
    const facilities = db.prepare('SELECT * FROM facilities WHERE station_id = ?').all(station.id) as any[];
    const total = facilities.length;
    const goodCount = facilities.filter((f: any) => f.status === 'good').length;
    const healthRate = total > 0 ? Math.round((goodCount / total) * 100) : 0;
    return { ...station, facilities, health_rate: healthRate };
  });

  res.json(result);
});

// GET /api/stations/regions/list
router.get('/regions/list', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const regions = db.prepare('SELECT DISTINCT region FROM stations ORDER BY region').all() as any[];
  res.json(regions.map((r: any) => r.region));
});

// GET /api/stations/:id
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id) as any;
  if (!station) {
    res.status(404).json({ error: '站台不存在' });
    return;
  }

  const facilities = db.prepare('SELECT * FROM facilities WHERE station_id = ?').all(req.params.id) as any[];
  const total = facilities.length;
  const goodCount = facilities.filter((f: any) => f.status === 'good').length;
  const healthRate = total > 0 ? Math.round((goodCount / total) * 100) : 0;

  res.json({ ...station, facilities, health_rate: healthRate });
});

// POST /api/stations
router.post('/', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { name, location, region, lines, facilities } = req.body;
  if (!name || !location || !region || !lines) {
    res.status(400).json({ error: '请填写完整站台信息' });
    return;
  }

  const db = getDb();
  const stationId = uuidv4();

  db.prepare('INSERT INTO stations (id, name, location, region, lines) VALUES (?, ?, ?, ?, ?)').run(
    stationId, name, location, region, lines
  );

  // Create default facilities if provided
  const defaultFacilities = facilities || ['shelter', 'seat', 'sign', 'light', 'canopy'];
  const insertFacility = db.prepare('INSERT INTO facilities (id, station_id, type, status) VALUES (?, ?, ?, ?)');
  for (const fType of defaultFacilities) {
    insertFacility.run(uuidv4(), stationId, fType, 'good');
  }

  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(stationId) as any;
  const stationFacilities = db.prepare('SELECT * FROM facilities WHERE station_id = ?').all(stationId) as any[];

  res.status(201).json({ ...station, facilities: stationFacilities, health_rate: 100 });
});

// PUT /api/stations/:id
router.put('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '站台不存在' });
    return;
  }

  const { name, location, region, lines } = req.body;
  db.prepare('UPDATE stations SET name = ?, location = ?, region = ?, lines = ? WHERE id = ?').run(
    name, location, region, lines, req.params.id
  );

  res.json(db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id));
});

export default router;
