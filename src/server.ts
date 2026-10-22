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
  audience: 'https://fer-web-api',
  issuerBaseURL: 'https://dev-mf5rcnqao3kqzeaw.us.auth0.com/',
  tokenSigningAlg: 'RS256',
});
app.use(express.json());
app.use(requireAccessToken)
const port = Number(process.env.PORT) || 4102;
const hostname = '0.0.0.0'; // must match the callback URL registered in Auth0

const client = new MongoClient(process.env.MONGODB_URI!);
await client.connect();



const config = {
  authRequired: false,
  idpLogout: true, //logout not only from the app, but also from identity provider
  secret: process.env.SESSION_SECRET,
  baseURL: `https://prvi-projekt.onrender.com`,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: 'https://dev-mf5rcnqao3kqzeaw.us.auth0.com',
  clientSecret: process.env.CLIENT_SECRET,
  routes: {
    logout: false as const // library registers GET /logout only; POST is used instead (see below)
  },
  authorizationParams: {
    response_type: 'code',
    audience: 'https://fer-web-api',
    // offline_access is needed to get the refresh token ("Allow Offline Access" must be enabled for the API in Auth0)
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
// (otherwise any page could log the user out with a link or redirect - logout CSRF)
app.post('/logout', (req, res) => res.oidc.logout());

app.get('/', async function (req, res) {
  const total = await passes.countDocuments();
  const active = await passes.countDocuments({ status: 'ACTIVE' });
  let username: string | undefined;
  if (req.oidc.isAuthenticated()) {
    username = req.oidc.user?.name ?? req.oidc.user?.sub;
  }
  res.render('index', { username, total, active });
});

const BASE_URL = process.env.BASE_URL!;

const checkJwt = jwtAuth({
  audience: process.env.AUDIENCE,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
});

// API za automat: izdavanje propusnice
app.post('/passes', checkJwt, requiredScopes('create:passes'), express.json(), async (req, res) => {
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
app.get('/passes/:id', checkJwt, requiredScopes('read:passes'), async (req, res) => {
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

// using requiresAuth() from express-openid-connect would redirect to the identity provider (302),
// but fetch would follow redirect and fail due to CORS (IdP's /authorize is not an API).
// BFF endpoints therefore return 401 and client decides what to do (e.g. go to /login)
function requiresAuthApi(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.oidc.isAuthenticated()) {
    res.status(401).send("Not authenticated");
    return;
  }
  next();
}

app.listen(port, hostname, () => {    
  console.log(`BFF running at http://${hostname}:${port}/`);
});