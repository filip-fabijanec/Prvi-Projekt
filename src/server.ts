import express from 'express';
import path from 'path'
import oidc from 'express-openid-connect';
const { auth } = oidc;
import dotenv from 'dotenv'
import process from 'process';
import { MongoClient } from 'mongodb';
import { auth as jwtAuth, requiredScopes } from 'express-oauth2-jwt-bearer';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
dotenv.config()

const app = express();
app.set('trust proxy', 1);
app.set("views", path.join(import.meta.dirname, "views"));
app.set('view engine', 'pug');
app.use(express.static(path.join(import.meta.dirname, "public"))); //css and js are served as separate files (not included in pug)
const requireAccessToken = jwtAuth({
  audience: process.env.AUDIENCE,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
});
const port = Number(process.env.PORT) || 4102;

const client = new MongoClient(process.env.MONGODB_URI!);
await client.connect();
const BASE_URL = process.env.BASE_URL!;

const config = {
  authRequired: false,
  idpLogout: true, //logout not only from the app, but also from identity provider
  secret: process.env.SESSION_SECRET,
  baseURL: BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  clientSecret: process.env.CLIENT_SECRET,
  routes: {
    logout: false as const // library registers GET /logout only; POST is used instead (see below)
  },
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email offline_access',
  },
};
// auth router attaches /login and /callback routes to the baseURL (/logout is disabled in routes)
app.use(auth(config));

type Pass = {
  id: string;
  name: string;
  document: string;
  issuedAt: Date;
  status: 'ACTIVE' | 'CANCELLED';
};
const passes = client.db('passes').collection<Pass>('passes');

// logout changes state (removes session), so POST is used instead of GET
app.post('/logout', (req, res) => res.oidc.logout());

app.get('/', async function (req, res) {
  const total = await passes.countDocuments();
  const active = await passes.countDocuments({ status: 'ACTIVE' });
  let username: string | undefined;
  let list: Pass[] = [];
  if (req.oidc.isAuthenticated()) {
    username = req.oidc.user?.name ?? req.oidc.user?.sub;
    list = await passes.find().toArray();
  }
  res.render('index', { username, total, active, passes: list });
});

app.post('/passes/:id/cancel', requiresAuthApi, async (req, res) => {
  await passes.updateOne({ id: req.params.id }, { $set: { status: 'CANCELLED' } });
  res.redirect('/');
});

app.post('/passes/:id/delete', requiresAuthApi, async (req, res) => {
  await passes.deleteOne({ id: req.params.id });
  res.redirect('/');
});

// API za automat: izdavanje propusnice
app.post('/passes', requireAccessToken, requiredScopes('create:passes'), express.json(), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const document = typeof req.body?.document === 'string' ? req.body.document.trim() : '';
  if (!name || !document) {
    res.status(400).send('name and document are required');
    return;
  }
  const id = randomUUID();
  await passes.insertOne({ id, name, document, issuedAt: new Date(), status: 'ACTIVE' });

  const qr = await QRCode.toBuffer(`${BASE_URL}/info/${id}`, { type: 'png' }); // javna stranica
  res.status(201)
    .set('Location', `${BASE_URL}/passes/${id}`)                                // API ruta
    .type('image/png')
    .send(qr);
});

// API za automat: dohvat propusnice
app.get('/passes/:id', requireAccessToken, requiredScopes('read:passes'), async (req, res) => {
  const p = await passes.findOne({ id: req.params.id });
  if (!p) {
    res.sendStatus(404);
    return;
  }
  res.json({ id: p.id, name: p.name, document: p.document, issuedAt: p.issuedAt.toISOString(), status: p.status });
});

// Javna stranica za ljude (cilj QR koda)
app.get('/info/:id', async (req, res) => {
  const p = await passes.findOne({ id: req.params.id });
  if (!p) {
    res.status(404).send('Pass not found');
    return;
  }
  res.render('info', { pass: p });
});

function requiresAuthApi(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.oidc.isAuthenticated()) {
    res.status(401).send("Not authenticated");
    return;
  }
  next();
}

app.listen(port, '0.0.0.0');