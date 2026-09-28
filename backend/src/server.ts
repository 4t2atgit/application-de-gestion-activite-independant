import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import clientsRouter from './routes/clients';
import facturesRouter from './routes/factures';
import fraisRouter from './routes/frais';
import encaissementsRouter from './routes/encaissements';
import heuresRouter from './routes/heures';
import projetsRouter from './routes/projets';
import corbeilleRouter from './routes/corbeille';
import issuerRouter from './routes/issuer';
import { getDashboardStats } from './services/dashboardService';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const [key, ...rest] = line.split('=');
    if (key && !process.env[key] && rest.length > 0) {
      process.env[key] = rest.join('=');
    }
  }
}

export const app = express();
const port = Number.parseInt(process.env.PORT ?? '3001', 10);

app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/dashboard', async (_request, response) => {
  try {
    response.json(await getDashboardStats());
  } catch (error) {
    console.error('Erreur dashboard', error);
    response.status(500).json({ message: 'Impossible de charger le dashboard.' });
  }
});

app.use('/api/clients', clientsRouter);
app.use('/api/projets', projetsRouter);
app.use('/api/heures', heuresRouter);
app.use('/api/factures', facturesRouter);
app.use('/api/frais', fraisRouter);
app.use('/api/encaissements', encaissementsRouter);
app.use('/api/issuer', issuerRouter);
app.use('/api/corbeille', corbeilleRouter);

export function startServer() {
  return app.listen(port, () => {
    console.log(`Backend démarré sur http://localhost:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
