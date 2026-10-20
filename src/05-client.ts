import express from 'express';
import path from 'path'
import process from 'process';
const app = express();

app.set("views", path.join(import.meta.dirname, "views"));
app.set('view engine', 'pug');
app.use(express.static(path.join(import.meta.dirname, "public"))); //css and js are served as separate files (not included in pug)

app.get('/', function (req, res) {    
    res.render('index');
});


const hostname = '0.0.0.0';
const port = Number(process.env.PORT) || 10000;
app.listen(port, hostname, () => {
  console.log(`SPA hosted at http://${hostname}:${port}/`);
});