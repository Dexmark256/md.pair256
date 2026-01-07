const fs = require('fs');
const express = require('express');
const router = express.Router();
const pino = require('pino');
const { makeid } = require('./gen-id');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

function removeFile(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

router.get('/', async (req, res) => {
  let number = req.query.number;

  if (!number) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  number = number.replace(/\D/g, '');
  if (number.length < 10 || number.length > 15) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const id = makeid();
  const authDir = `./temp/${id}`;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
      },
      logger: pino({ level: 'fatal' }),
      browser: ['Chrome', 'Windows', '10'],
      printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    await delay(4000);

    if (!sock.authState.creds.registered) {
      const result = await sock.requestPairingCode(number);

      if (!result || !result.pairingCode) {
        removeFile(authDir);
        return res.status(500).json({
          error: 'WhatsApp did not approve pairing. Try again later.'
        });
      }

      return res.json({
        code: result.pairingCode
      });
    }

  } catch (err) {
    console.error(err);
    removeFile(authDir);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
