import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/stats/health-ranking - Station health rate ranking
router.get('/health-ranking', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const stations = db.prepare('SELECT * FROM stations ORDER BY name').all() as any[];

  const ranking = stations.map((station: any) => {
    const facilities = db.prepare('SELECT * FROM facilities WHERE station_id = ?').all(station.id) as any[];
    const total = facilities.length;
    const goodCount = facilities.filter((f: any) => f.status === 'good').length;
    const damagedCount = facilities.filter((f: any) => f.status === 'damaged').length;
    const missingCount = facilities.filter((f: any) => f.status === 'missing').length;
    const healthRate = total > 0 ? Math.round((goodCount / total) * 100) : 0;

    return {
      station_id: station.id,
      station_name: station.name,
      region: station.region,
      total_facilities: total,
      good_count: goodCount,
      damaged_count: damagedCount,
      missing_count: missingCount,
      health_rate: healthRate
    };
  });

  ranking.sort((a: any, b: any) => b.health_rate - a.health_rate);
  res.json(ranking);
});

// GET /api/stats/repair-timeliness - Repair order timeliness
router.get('/repair-timeliness', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const db = getDb();

  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM repair_orders').get() as { count: number };
  const completedOrders = db.prepare('SELECT COUNT(*) as count FROM repair_orders WHERE status = ?').get('completed') as { count: number };
  const pendingOrders = db.prepare('SELECT COUNT(*) as count FROM repair_orders WHERE status = ?').get('pending') as { count: number };
  const inProgressOrders = db.prepare('SELECT COUNT(*) as count FROM repair_orders WHERE status = ?').get('in_progress') as { count: number };

  // Timely = completed within 24 hours
  const timelyOrders = db.prepare(`
    SELECT COUNT(*) as count FROM repair_orders
    WHERE status = 'completed'
    AND completed_at IS NOT NULL
    AND created_at IS NOT NULL
    AND (julianday(completed_at) - julianday(created_at)) <= 1
  `).get() as { count: number };

  const timelinessRate = completedOrders.count > 0
    ? Math.round((timelyOrders.count / completedOrders.count) * 100)
    : 0;

  // Recent orders with detail
  const recentOrders = db.prepare(`
    SELECT ro.*, s.name as station_name,
      CASE WHEN ro.completed_at IS NOT NULL AND ro.created_at IS NOT NULL
        THEN ROUND((julianday(ro.completed_at) - julianday(ro.created_at)) * 24, 1)
        ELSE NULL END as hours_taken
    FROM repair_orders ro
    JOIN stations s ON ro.station_id = s.id
    ORDER BY ro.created_at DESC
    LIMIT 20
  `).all() as any[];

  res.json({
    summary: {
      total: totalOrders.count,
      completed: completedOrders.count,
      pending: pendingOrders.count,
      in_progress: inProgressOrders.count,
      timely_count: timelyOrders.count,
      timeliness_rate: timelinessRate
    },
    recent_orders: recentOrders
  });
});

// GET /api/stats/inspection-completion - Monthly inspection completion rate
router.get('/inspection-completion', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const db = getDb();

  // Get current month data
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-31`;

  const totalInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections WHERE date BETWEEN ? AND ?
  `).get(monthStart, monthEnd) as { count: number };

  const completedInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections WHERE date BETWEEN ? AND ? AND status = 'completed'
  `).get(monthStart, monthEnd) as { count: number };

  const completionRate = totalInspections.count > 0
    ? Math.round((completedInspections.count / totalInspections.count) * 100)
    : 0;

  // Daily breakdown for the month
  const dailyBreakdown = db.prepare(`
    SELECT date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM inspections
    WHERE date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date
  `).all(monthStart, monthEnd) as any[];

  // By station breakdown
  const stationBreakdown = db.prepare(`
    SELECT s.name as station_name,
      COUNT(i.id) as total,
      SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM inspections i
    JOIN stations s ON i.station_id = s.id
    WHERE i.date BETWEEN ? AND ?
    GROUP BY s.id
    ORDER BY s.name
  `).all(monthStart, monthEnd) as any[];

  res.json({
    summary: {
      month: `${year}-${month}`,
      total: totalInspections.count,
      completed: completedInspections.count,
      completion_rate: completionRate
    },
    daily_breakdown: dailyBreakdown,
    station_breakdown: stationBreakdown
  });
});

export default router;
