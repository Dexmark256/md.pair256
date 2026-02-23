const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const router = express.Router();

function removeFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {

    const id = makeid();
    const tempDir = path.join(__dirname, 'temp', id);

    // Clean number (only digits)
    const phoneNumber = (req.query.number || '').replace(/\D/g, '');

    // Must be international format
    if (!phoneNumber || phoneNumber.length < 10) {
        return res.status(400).send({
            error: "Provide full international number. Example: 2567xxxxxx"
        });
    }

    async function createSocketSession() {

        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        const logger = pino({ level: "silent" });

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.ubuntu("Chrome"), // safer
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {

                console.log("✅ Connected:", sock.user.id);

                await delay(3000);

                try {
                    const credsPath = path.join(tempDir, 'creds.json');

                    if (!fs.existsSync(credsPath)) {
                        throw new Error("Session file not found");
                    }

                    const sessionData = fs.readFileSync(credsPath);
                    const base64 = sessionData.toString('base64');
                    const sessionId = "MAJIN-BUU~" + base64;

                    await sock.sendMessage(sock.user.id, {
                        text:
`🚀 *MAJIN-BUU Session Created!*

⚠️ Never share your session ID.

Your Session ID:
${sessionId}`
                    });

                    console.log("📦 Session generated successfully");

                } catch (err) {
                    console.error("❌ Session Error:", err.message);
                } finally {
                    await delay(1000);
                    await sock.ws.close();
                    removeFolder(tempDir);
                }
            }

            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;

                if (statusCode === 401) {
                    console.log("❌ Pairing failed or session invalid");
                    removeFolder(tempDir);
                } else {
                    console.log("🔁 Connection closed. Not reconnecting.");
                    removeFolder(tempDir);
                }
            }
        });

        // Request pairing code ONLY if not registered
        if (!sock.authState.creds.registered) {
            await delay(2000);

            try {
                const pairingCode = await sock.requestPairingCode(phoneNumber);

                console.log("🔑 Pairing Code:", pairingCode);

                if (!res.headersSent) {
                    return res.send({ code: pairingCode });
                }

            } catch (err) {
                console.error("❌ Pairing Error:", err.message);
                removeFolder(tempDir);

                if (!res.headersSent) {
                    return res.status(500).send({
                        error: "Failed to generate pairing code. Try again later."
                    });
                }
            }
        }
    }

    try {
        await createSocketSession();
    } catch (err) {
        console.error("🚨 Fatal Error:", err.message);
        removeFolder(tempDir);

        if (!res.headersSent) {
            res.status(500).send({
                error: "Service Unavailable. Try again later."
            });
        }
    }
});

module.exports = router;
