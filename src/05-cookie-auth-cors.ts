import * as auth from './05-auth-middleware.ts';
import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors({credentials: true, origin: 'http://127.0.0.1:4072'}));
app.use(express.json());

auth.initCookieAuth(app);

app.get('/',  function (req, res) {
    res.json({'it' : "works"});  //just a dummy message for debug purpose
});

app.post('/login',  function (req, res) {    
    const username = req.body.username;
	const password = req.body.password;
    if (password !== 'some password') {
        res.status(401).send("Invalid username or password");
    }
    else {        
        auth.signInUser(res, username);
        res.sendStatus(204);
    }
});

app.post('/logout',   function (req, res) {
    auth.signOutUser(res);
    res.sendStatus(204);
});

app.get('/protected', function (req, res) {     
    if (!req.user)      
        res.status(401).send("Invalid or missing cookie");
     
    else {
        const username = req.user.username;  
                    
        if (username.toLowerCase() === 'alice' || username.toLowerCase() === 'bob') {
            const data = {       
                'CurrentTime' : Date.now(),     
                'Message' : `Welcome ${username}`
            };
            res.json(data);
        }
        else {
            res.status(403);
            res.end('Forbidden for ' + username);
        }     
    }         
});

const hostname = '127.0.0.1';
const port = 4071;
app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});