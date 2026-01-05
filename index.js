const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase listener limit (Baileys safe)
require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware MUST be before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const __path = process.cwd();

// Routes
const server = require('./qr');
const code = require('./pair');

app.use('/server', server);
app.use('/code', code);

app.get('/pair', (req, res) => {
  res.sendFile(path.join(__path, 'pair.html'));
});

app.get('/qr', (req, res) => {
  res.sendFile(path.join(__path, 'qr.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__path, 'main.html'));
});

// Start server (Render-safe)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
