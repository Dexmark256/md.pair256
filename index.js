const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// UI
app.get('/pair-ui', (req, res) => {
  res.sendFile(path.join(__dirname, 'pair.html'));
});

// API
app.use('/pair', require('./pair'));

app.get('/', (req, res) => res.redirect('/pair-ui'));

app.listen(PORT, () => console.log('Server running on ' + PORT));
