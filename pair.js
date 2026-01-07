
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const number = req.query.number;
  if (!number) {
    return res.status(400).json({ error: "Phone number required" });
  }

  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  return res.json({ code });
});

module.exports = router;
