const fs = require('fs');

if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
}

const { makeid } = require('./gen-id');
const express = require('express');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();

    // ✅ FIX: accept number from query OR body
    let num = req.query.number || req.body.number;

    // ✅ SAFETY CHECK
    if (!num) {
        return res.send({ error: "Phone number is required" });
    }

    async function MAJIN_BUU_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" })
                    )
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);

                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);

                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(5000);

                    let rf = `./temp/${id}/creds.json`;
                    const mega_url = await upload(
                        fs.createReadStream(rf),
                        `${sock.user.id}.json`
                    );

                    const string_session = mega_url.replace(
                        'https://mega.nz/file/',
                        ''
                    );

                    await sock.sendMessage(sock.user.id, {
                        text: "dante~" + string_session
                    });

                    await delay(50);
                    await sock.ws.close();
                    await removeFile('./temp/' + id);
                    process.exit();
                }

                if (
                    connection === "close" &&
                    lastDisconnect?.error?.output?.statusCode !== 401
                ) {
                    await delay(100);
                    MAJIN_BUU_PAIR_CODE();
                }
            });

        } catch (err) {
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                res.send({ error: "Service unavailable" });
            }
        }
    }

    return MAJIN_BUU_PAIR_CODE();
});

module.exports = router;
