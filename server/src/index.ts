import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDb } from './database';
import authRoutes from './routes/auth';
import stationRoutes from './routes/stations';
import inspectionRoutes from './routes/inspections';
import repairRoutes from './routes/repairs';
import statsRoutes from './routes/stats';

const app = express();
const PORT = Number(process.env.PORT) || 3204;

// Initialize database on startup
getDb();
console.log('Database initialized');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
