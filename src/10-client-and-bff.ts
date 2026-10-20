import express from 'express';
import path from 'path'
import oidc from 'express-openid-connect';
const { auth } = oidc;
import dotenv from 'dotenv'
import process from 'process';
dotenv.config()

const app = express();
app.set("views", path.join(import.meta.dirname, "views"));
app.set('view engine', 'pug');
app.use(express.static(path.join(import.meta.dirname, "public"))); //css and js are served as separate files (not included in pug)

const port = Number(process.env.PORT) || 4102;
const hostname = '0.0.0.0'; // must match the callback URL registered in Auth0
const webApiUri = process.env.WEB_API_URI || 'http://127.0.0.1:4101';

const config = {
  authRequired: false,
  idpLogout: true, //logout not only from the app, but also from identity provider
  secret: process.env.SESSION_SECRET,
  baseURL: `https://prvi-projekt.onrender.com`,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: 'https://fer-web2.eu.auth0.com',
  clientSecret: process.env.CLIENT_SECRET,
  routes: {
    logout: false as const // library registers GET /logout only; POST is used instead (see below)
  },
  authorizationParams: {
    response_type: 'code',
    audience: 'FER-Web2 WebAPI',
    // offline_access is needed to get the refresh token ("Allow Offline Access" must be enabled for the API in Auth0)
    scope: 'openid profile email offline_access',
  },
};
// auth router attaches /login and /callback routes to the baseURL (/logout is disabled in routes)
app.use(auth(config));

// logout changes state (removes session), so POST is used instead of GET
// (otherwise any page could log the user out with a link or redirect - logout CSRF)
app.post('/logout', (req, res) => res.oidc.logout());

app.get('/', function (req, res) {
  let username: string | undefined;
  if (req.oidc.isAuthenticated()) {
    username = req.oidc.user?.name ?? req.oidc.user?.sub;
  }
  res.render('index', { username });
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

app.get('/bff/protected', requiresAuthApi, async function (req, res) {
  try {
    const accessToken = await getAccessToken(req);
    const response = await fetch(`${webApiUri}/protected`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000) // do not wait forever if web API does not respond
    });
    if (!response.ok) {
      throw new Error(`Web API returned ${response.status}`);
    }
    res.json(await response.json());
  }
  catch (err) {
    console.log(err);
    res.status(502).send("Could not reach the protected resource");
  }
});

async function getAccessToken(req: express.Request): Promise<string> {
  let token = req.oidc.accessToken;
  if (!token) {    
    throw new Error("No access token in session");
  }
  if (token.isExpired()) {
    token = await token.refresh();
  }
  return token.access_token;
}

app.listen(port, hostname, () => {    
  console.log(`BFF running at http://${hostname}:${port}/`);
});