import express from 'express'
import { auth } from 'express-oauth2-jwt-bearer'; //claimCheck, requireScope, ...
import process from 'process';

const app = express();
// app.use(cors()) is not needed because the incoming requests are issued from the BFF server side

const authServer = 'https://fer-web2.eu.auth0.com';

const checkJwt = auth({
  audience: 'FER-Web2 WebAPI',
  issuerBaseURL: `${authServer}`,
});
app.use(checkJwt);

app.get('/protected',  async function (req, res) {
  const accesstoken = req.auth!.token; //because of app.use(checkJwt)

  try{
    const userInfoResponse = await fetch(`${authServer}/userinfo`, {
      headers : {
        Authorization : `Bearer ${accesstoken}`
      }
    });
    if (!userInfoResponse.ok) {
      throw new Error(`userinfo returned ${userInfoResponse.status}`);
    }
    const user = await userInfoResponse.json();
    res.json(user);
  }
  catch(err) {
    console.log(err);
    res.status(502).send("Could not get user info");
  }
});

const hostname = process.env.HOSTNAME || '127.0.0.1';
const port = Number(process.env.PORT) || 4101;
app.listen(port, hostname, () => {
  console.log(`Web API running at http://${hostname}:${port}/`);
});
