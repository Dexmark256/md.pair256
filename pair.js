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

const cooldown = new Map();

if (!fs.existsSync('./temp')) {
  fs.mkdirSync('./temp');
}

function removeFile(path) {
  if (fs.existsSync(path)) {
    fs.rmSync(path, { recursive: true, force: true });
  }
}

router.get('/', async (req, res) => {
  let num = req.query.number;

  if (!num) {
    return res.send({ error: 'Phone number is required' });
  }

  // Clean & validate number
  num = num.replace(/\D/g, '');
  if (num.length < 10 || num.length > 15) {
    return res.send({ error: 'Invalid phone number format' });
  }

  // Cooldown (30 minutes)
  if (cooldown.has(num)) {
    return res.send({
      error: 'Please wait 30–60 minutes before requesting another pairing code'
    });
  }

  cooldown.set(num, true);
  setTimeout(() => cooldown.delete(num), 30 * 60 * 1000);

  const id = makeid();
  const authPath = `./temp/${id}`;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: 'fatal' })
        )
      },
      logger: pino({ level: 'fatal' }),
      printQRInTerminal: false,
      browser: ['Chrome', 'Windows', '10']
    });

    sock.ev.on('creds.update', saveCreds);

    // Give WhatsApp time
    await delay(5000);

    if (!sock.authState.creds.registered) {
      const response = await sock.requestPairingCode(num);

      // WhatsApp did NOT approve
      if (!response || !response.pairingCode) {
        await removeFile(authPath);
        return res.send({
          error: 'WhatsApp did not approve pairing. Please wait and try again.'
        });
      }

      // WhatsApp approved — send real code
      return res.send({
        code: response.pairingCode
      });
    }

  } catch (err) {
    console.error(err);
    await removeFile(authPath);
    return res.send({
      error: 'Service temporarily unavailable. Try again later.'
    });
  }
});

module.exports = router;
