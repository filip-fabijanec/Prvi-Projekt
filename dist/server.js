import express from 'express';
import path from 'path';
import oidc from 'express-openid-connect';
const { auth } = oidc;
import dotenv from 'dotenv';
import process from 'process';
import { MongoClient } from 'mongodb';
dotenv.config();
const app = express();
app.set('trust proxy', 1);
app.set("views", path.join(import.meta.dirname, "views"));
app.set('view engine', 'pug');
app.use(express.static(path.join(import.meta.dirname, "public"))); //css and js are served as separate files (not included in pug)
const port = Number(process.env.PORT) || 4102;
const hostname = '0.0.0.0'; // must match the callback URL registered in Auth0
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const passes = client.db('passes').collection('passes');
const config = {
    authRequired: false,
    idpLogout: true, //logout not only from the app, but also from identity provider
    secret: process.env.SESSION_SECRET,
    baseURL: `https://prvi-projekt.onrender.com`,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: 'https://dev-mf5rcnqao3kqzeaw.us.auth0.com',
    clientSecret: process.env.CLIENT_SECRET,
    routes: {
        logout: false // library registers GET /logout only; POST is used instead (see below)
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
// logout changes state (removes session), so POST is used instead of GET
// (otherwise any page could log the user out with a link or redirect - logout CSRF)
app.post('/logout', (req, res) => res.oidc.logout());
app.get('/', async function (req, res) {
    const total = await passes.countDocuments();
    const active = await passes.countDocuments({ status: 'ACTIVE' });
    let username;
    if (req.oidc.isAuthenticated()) {
        username = req.oidc.user?.name ?? req.oidc.user?.sub;
    }
    res.render('index', { username, total, active });
});
// using requiresAuth() from express-openid-connect would redirect to the identity provider (302),
// but fetch would follow redirect and fail due to CORS (IdP's /authorize is not an API).
// BFF endpoints therefore return 401 and client decides what to do (e.g. go to /login)
function requiresAuthApi(req, res, next) {
    if (!req.oidc.isAuthenticated()) {
        res.status(401).send("Not authenticated");
        return;
    }
    next();
}
app.listen(port, hostname, () => {
    console.log(`BFF running at http://${hostname}:${port}/`);
});
