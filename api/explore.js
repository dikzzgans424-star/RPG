// api/explore.js — POST /api/explore
// Body: { senderId }
// Logika persis sama dengan bot WA: random lokasi, gold+exp+drop+rare item.
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const { recalculateStats, levelUpCheck, EXPLORE_LOCATIONS, EXPLORE_COOLDOWN } = require('./_rpg');

function ribu(n) { return Number(Math.floor(n)).toLocaleString('id-ID'); }

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { senderId: rawId } = body;
    if (!rawId) return res.status(400).json({ error: 'senderId wajib' });
    const senderId = normalizeJid(rawId);

    try {
        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        if (!user.role) return res.status(400).json({ error: 'Pilih role dulu di bot WA' });

        recalculateStats(user);
        if (!user.inventory) user.inventory = {};

        const now = Date.now();
        const lastExplore = user.lastExplore || 0;
        const sisaMs = EXPLORE_COOLDOWN - (now - lastExplore);

        if (sisaMs > 0) {
            const sisa = Math.ceil(sisaMs / 1000);
            return res.status(400).json({ error: `⏳ Tunggu ${sisa} detik lagi.`, cooldownLeft: sisa });
        }

        // Logika persis dari bot
        const levelBonus = Math.floor(user.level * 2);
        const loc = EXPLORE_LOCATIONS[Math.floor(Math.random() * EXPLORE_LOCATIONS.length)];
        const getRare = Math.random() < 0.3;
        const dropQty = Math.floor(Math.random() * 3) + 1;
        const finalGold = loc.gold + levelBonus;
        const finalExp  = loc.exp  + levelBonus;

        user.gold += finalGold;
        user.exp  += finalExp;
        user.lastExplore = now;
        user.inventory[loc.drop] = (user.inventory[loc.drop] || 0) + dropQty;

        const rareKey = loc.item.toLowerCase().replace(/\s/g, '_');
        if (getRare) user.inventory[rareKey] = (user.inventory[rareKey] || 0) + 1;

        const logLines = [];
        levelUpCheck(user, logLines);

        db.users[senderId] = user;
        await saveRpgDB(db);

        return res.status(200).json({
            ok: true,
            location: loc.name,
            gold: finalGold,
            exp: finalExp,
            drop: { key: loc.drop, qty: dropQty },
            rare: getRare ? { key: rareKey, name: loc.item } : null,
            levelUpLog: logLines,
            cooldown: EXPLORE_COOLDOWN,
            user: {
                level: user.level, exp: user.exp, gold: user.gold,
                inventory: user.inventory, hp: user.hp, maxHp: user.maxHp,
                mana: user.mana, maxMana: user.maxMana,
                lastExplore: user.lastExplore,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
