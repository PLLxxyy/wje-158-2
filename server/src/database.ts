import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '..', 'database.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDatabase();
  }
  return db;
}

function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'inspector', 'repairer')),
      real_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      region TEXT NOT NULL,
      lines TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('shelter', 'seat', 'sign', 'light', 'canopy')),
      status TEXT NOT NULL DEFAULT 'good' CHECK(status IN ('good', 'damaged', 'missing')),
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      inspector_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (inspector_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_items (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      facility_id TEXT NOT NULL,
      facility_type TEXT NOT NULL,
      result TEXT CHECK(result IN ('good', 'damaged', 'missing')),
      damage_desc TEXT DEFAULT '',
      photo TEXT DEFAULT '',
      repaired INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (facility_id) REFERENCES facilities(id)
    );

    CREATE TABLE IF NOT EXISTS repair_orders (
      id TEXT PRIMARY KEY,
      inspection_item_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      facility_id TEXT NOT NULL,
      facility_type TEXT NOT NULL,
      damage_desc TEXT NOT NULL,
      damage_photo TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
      repairer_id TEXT,
      repair_photo TEXT DEFAULT '',
      repair_desc TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      assigned_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (facility_id) REFERENCES facilities(id)
    );
  `);

  // Database migration: add repaired column to inspection_items if not exists
  const columnInfo = db.prepare("PRAGMA table_info(inspection_items)").all() as any[];
  const hasRepairedColumn = columnInfo.some(col => col.name === 'repaired');
  if (!hasRepairedColumn) {
    db.prepare("ALTER TABLE inspection_items ADD COLUMN repaired INTEGER NOT NULL DEFAULT 0").run();
  }

  // Data migration: backfill repaired status from completed repair orders
  db.prepare(`
    UPDATE inspection_items
    SET repaired = 1
    WHERE id IN (
      SELECT inspection_item_id
      FROM repair_orders
      WHERE status = 'completed'
    )
    AND repaired = 0
  `).run();

  // Check if seed data exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    seedData();
  }
}

function seedData(): void {
  const adminId = uuidv4();
  const inspectorId = uuidv4();
  const repairerId = uuidv4();

  const hash = bcrypt.hashSync('123456', 10);

  const insertUser = db.prepare('INSERT INTO users (id, username, password, role, real_name) VALUES (?, ?, ?, ?, ?)');
  insertUser.run(adminId, 'admin', hash, 'admin', '系统管理员');
  insertUser.run(inspectorId, 'inspector', hash, 'inspector', '张巡检');
  insertUser.run(repairerId, 'repairer', hash, 'repairer', '李维修');

  const regions = ['朝阳区', '海淀区', '西城区', '东城区', '丰台区'];
  const stationNames = [
    '中关村南站', '海淀黄庄站', '西直门站', '东直门站', '国贸站',
    '望京站', '五道口站', '西单站', '王府井站', '三元桥站',
    '建国门站', '复兴门站', '崇文门站', '宣武门站', '丰台科技园站',
    '上地站', '回龙观站', '天通苑站', '大望路站', '双井站'
  ];
  const lines = [
    '1号线', '2号线', '4号线', '5号线', '6号线',
    '8号线', '10号线', '13号线', '15号线', '亦庄线'
  ];

  const facilityTypes = ['shelter', 'seat', 'sign', 'light', 'canopy'] as const;

  const insertStation = db.prepare('INSERT INTO stations (id, name, location, region, lines) VALUES (?, ?, ?, ?, ?)');
  const insertFacility = db.prepare('INSERT INTO facilities (id, station_id, type, status) VALUES (?, ?, ?, ?)');

  for (let i = 0; i < 20; i++) {
    const stationId = uuidv4();
    const region = regions[i % regions.length];
    const line1 = lines[i % lines.length];
    const line2 = lines[(i + 3) % lines.length];
    const stationLines = i % 3 === 0 ? line1 : `${line1},${line2}`;
    const location = `${region}${stationNames[i].replace('站', '')}路口`;

    insertStation.run(stationId, stationNames[i], location, region, stationLines);

    for (const fType of facilityTypes) {
      const status = Math.random() > 0.85 ? 'damaged' : Math.random() > 0.9 ? 'missing' : 'good';
      insertFacility.run(uuidv4(), stationId, fType, status);
    }
  }

  // Seed some inspections
  const stations = db.prepare('SELECT id FROM stations LIMIT 5').all() as { id: string }[];
  const insertInspection = db.prepare('INSERT INTO inspections (id, station_id, inspector_id, date, status, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const today = new Date().toISOString().split('T')[0];

  for (const station of stations) {
    const inspId = uuidv4();
    insertInspection.run(inspId, station.id, inspectorId, today, 'pending', null, null);
  }

  // Seed a completed inspection with repair order
  if (stations.length > 0) {
    const completedInspId = uuidv4();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    insertInspection.run(completedInspId, stations[0].id, inspectorId, yesterday, 'completed', `${yesterday} 09:00:00`, `${yesterday} 10:30:00`);

    const damagedFacility = db.prepare('SELECT id, type FROM facilities WHERE station_id = ? AND status = ?').get(stations[0].id, 'damaged') as { id: string; type: string } | undefined;
    if (damagedFacility) {
      const itemId = uuidv4();
      db.prepare('INSERT INTO inspection_items (id, inspection_id, facility_id, facility_type, result, damage_desc) VALUES (?, ?, ?, ?, ?, ?)').run(
        itemId, completedInspId, damagedFacility.id, damagedFacility.type, 'damaged', '候车亭玻璃破损'
      );

      const orderId = uuidv4();
      db.prepare('INSERT INTO repair_orders (id, inspection_item_id, station_id, facility_id, facility_type, damage_desc, status, repairer_id, assigned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        orderId, itemId, stations[0].id, damagedFacility.id, damagedFacility.type, '候车亭玻璃破损', 'in_progress', repairerId, `${yesterday} 14:00:00`
      );
    }
  }

  console.log('Database seeded successfully');
}
