import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

// ============ CONFIGURATION ============
const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============ MIDDLEWARE ============
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// ============ AUTHENTICATION ============
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    req.user = { id: 'user-' + token.substring(0, 8), email: 'admin@retrobus.local', role: 'admin' };
  }
  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

app.use(authMiddleware);

// ============ HELPERS ============
const uid = () => Math.random().toString(36).substring(2, 9);
const today = () => new Date().toISOString().split('T')[0];

// ============ IN-MEMORY DATA STORES ============
const state = {
  members: [
    {
      id: 'cmi6m56ex00015c2kkcgm0pcf',
      email: 'belaidiw91@gmail.com',
      firstName: 'WAIYL',
      lastName: 'BELAIDI',
      status: 'ACTIVE',
      permissions: ['view_dashboard', 'view_vehicles'],
      createdAt: new Date().toISOString()
    }
  ],
  vehicles: [
    {
      parc: '920',
      marque: 'Mercedes-Benz',
      modele: 'Citaro',
      etat: 'Préservé',
      fuel: 49,
      id: 1,
      createdAt: new Date().toISOString()
    }
  ],
  events: [
    {
      id: 'event-' + uid(),
      title: 'Événement exemple',
      description: 'Description',
      date: new Date().toISOString(),
      status: 'PUBLISHED',
      createdAt: new Date().toISOString()
    }
  ],
  siteUsers: [],
  transactions: [],
  expenseReports: [],
  retroNews: [],
  flashes: [],
  devisLines: [],
  quoteTemplates: [],
  financialDocuments: [],
  notifications: [],
  bankBalance: 150,
  scheduled: [],
  vehicleUsages: [],
  vehicleMaintenance: [],
  vehicleServiceSchedule: [],
  retroRequests: []
};

// ============ ROUTES: HEALTH & AUTH ============
app.get(['/api/health', '/health'], (req, res) => 
  res.json({ ok: true, time: new Date().toISOString(), version: '1.0.0' })
);

app.post(['/auth/login', '/api/auth/login'], (req, res) => {
  const { email, password } = req.body;
  res.json({
    success: true,
    token: 'token-' + Math.random().toString(36).substring(2, 15),
    user: { id: 'user-1', email: email || 'admin@retrobus.local', role: 'admin' }
  });
});

app.get(['/auth/me', '/api/auth/me'], requireAuth, (req, res) => 
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role })
);

app.get('/api/me', requireAuth, (req, res) => 
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role })
);

// ============ ROUTES: PUBLIC ============
app.get('/site-config', (req, res) => 
  res.json({ name: 'Rétrobus Essonne', version: '1.0', apiUrl: 'http://localhost:8080' })
);

app.get('/public/events', (req, res) => 
  res.json({ events: state.events.filter(e => e.status === 'PUBLISHED') })
);

app.get('/public/events/:id', (req, res) => {
  const event = state.events.find(e => e.id === req.params.id);
  res.json(event || { error: 'Not found' });
});

app.get('/public/vehicles', (req, res) => 
  res.json({ vehicles: state.vehicles })
);

app.get('/public/vehicles/:id', (req, res) => {
  const vehicle = state.vehicles.find(v => v.parc === req.params.id);
  res.json(vehicle || { error: 'Not found' });
});

// ============ ROUTES: INTERNAL (requireAuth) ============

// Events
app.get(['/events', '/api/events'], requireAuth, (req, res) => 
  res.json({ events: state.events })
);

app.get(['/events/:id', '/api/events/:id'], requireAuth, (req, res) => {
  const event = state.events.find(e => e.id === req.params.id);
  res.json(event || { error: 'Not found' });
});

app.post(['/events', '/api/events'], requireAuth, (req, res) => {
  const event = { 
    id: 'event-' + uid(), 
    status: 'DRAFT', 
    createdAt: new Date().toISOString(), 
    ...req.body 
  };
  state.events.push(event);
  res.status(201).json({ event });
});

app.put(['/events/:id', '/api/events/:id'], requireAuth, (req, res) => {
  const idx = state.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  state.events[idx] = { ...state.events[idx], ...req.body };
  res.json({ event: state.events[idx] });
});

app.delete(['/events/:id', '/api/events/:id'], requireAuth, (req, res) => {
  state.events = state.events.filter(e => e.id !== req.params.id);
  res.json({ ok: true });
});

// Vehicles
app.get(['/vehicles', '/api/vehicles'], requireAuth, (req, res) => 
  res.json({ vehicles: state.vehicles })
);

app.get(['/vehicles/:parc', '/api/vehicles/:parc'], requireAuth, (req, res) => {
  const vehicle = state.vehicles.find(v => v.parc === req.params.parc);
  res.json({ vehicle: vehicle || null });
});

app.put(['/vehicles/:parc', '/api/vehicles/:parc'], requireAuth, (req, res) => {
  const idx = state.vehicles.findIndex(v => v.parc === req.params.parc);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  state.vehicles[idx] = { ...state.vehicles[idx], ...req.body };
  res.json({ vehicle: state.vehicles[idx] });
});

// Members
app.get(['/members', '/api/members'], requireAuth, (req, res) => 
  res.json({ members: state.members })
);

app.get(['/members/:id', '/api/members/:id'], requireAuth, (req, res) => {
  const member = state.members.find(m => m.id === req.params.id);
  res.json(member || { error: 'Not found' });
});

app.post(['/members', '/api/members'], requireAuth, (req, res) => {
  const member = { 
    id: uid(), 
    createdAt: new Date().toISOString(),
    permissions: ['view_dashboard'],
    ...req.body 
  };
  state.members.push(member);
  res.status(201).json({ member });
});

app.put(['/members/:id', '/api/members/:id'], requireAuth, (req, res) => {
  const idx = state.members.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  state.members[idx] = { ...state.members[idx], ...req.body };
  res.json({ member: state.members[idx] });
});

// Finance
app.get(['/finance/stats', '/api/finance/stats'], requireAuth, (req, res) => {
  const revenue = state.transactions.filter(t => t.type === 'recette').reduce((s, t) => s + t.amount, 0);
  const expenses = state.transactions.filter(t => t.type === 'depense').reduce((s, t) => s + t.amount, 0);
  res.json({ 
    data: { 
      monthlyRevenue: revenue, 
      monthlyExpenses: expenses, 
      currentBalance: state.bankBalance,
      activeMembers: state.members.length 
    } 
  });
});

app.post(['/finance/transactions', '/api/finance/transactions'], requireAuth, (req, res) => {
  const transaction = { id: uid(), createdAt: new Date().toISOString(), ...req.body };
  state.transactions.push(transaction);
  state.bankBalance += transaction.amount;
  res.status(201).json({ transaction });
});

// Flash (news/alerts)
app.get(['/flashes', '/api/flashes'], (req, res) => 
  res.json(state.flashes)
);

app.post(['/flashes', '/api/flashes'], requireAuth, (req, res) => {
  const flash = { id: uid(), createdAt: new Date().toISOString(), ...req.body };
  state.flashes.unshift(flash);
  res.status(201).json(flash);
});

app.put(['/flashes/:id', '/api/flashes/:id'], requireAuth, (req, res) => {
  const idx = state.flashes.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  
  state.flashes[idx] = { ...state.flashes[idx], ...req.body };
  res.json(state.flashes[idx]);
});

app.delete(['/flashes/:id', '/api/flashes/:id'], requireAuth, (req, res) => {
  state.flashes = state.flashes.filter(f => f.id !== req.params.id);
  res.json({ ok: true });
});

// Retro News
app.get(['/api/retro-news', '/retro-news'], (req, res) => 
  res.json({ news: state.retroNews })
);

app.post(['/api/retro-news', '/retro-news'], requireAuth, (req, res) => {
  const news = { 
    id: 'rn' + Date.now(), 
    publishedAt: new Date().toISOString(),
    ...req.body 
  };
  state.retroNews.unshift(news);
  res.status(201).json({ news });
});

// ============ ERROR HANDLING ============
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============ SERVER START ============
app.listen(PORT, () => {
  console.clear();
  console.log('🚀 Serveur prêt sur le port ' + PORT);
  console.log('📍 Frontend: http://localhost:5173');
  console.log('📍 API: http://localhost:' + PORT);
  console.log('✅ Données en mémoire - données perdues à chaque redémarrage');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Arrêt du serveur...');
  await prisma.$disconnect();
  process.exit(0);
});
