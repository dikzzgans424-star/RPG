// api/adventure.js — POST /api/adventure
// Body: { senderId }
// Logika persis sama dengan bot WA: random event, gold+exp, HP berkurang, durability weapon/armor.
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const {
    recalculateStats, levelUpCheck, decreaseDurability,
    getEquippedItem, ADVENTURE_EVENTS, ADVENTURE_COOLDOWN,
} = require('./_rpg');

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

        // Cek HP minimal (sama dengan bot)
        if (user.hp < 30) return res.status(400).json({ error: '❌ HP kamu terlalu rendah! Minimal 30 HP.' });

        const now = Date.now();
        const lastTreasure = user.lastTreasure || 0;
        const sisaMs = ADVENTURE_COOLDOWN - (now - lastTreasure);
        if (sisaMs > 0) {
            const sisa = Math.ceil(sisaMs / 1000);
            return res.status(400).json({ error: `⏳ Tunggu ${sisa} detik lagi.`, cooldownLeft: sisa });
        }

        // Weapon tier bonus (sama dengan bot)
        const wType = ['sword','wand','dagger','scythe','bow','catalyst'].find(s => user.equipped?.[s]);
        const eqSword = wType ? getEquippedItem(user, wType) : null;
        const swordLvl = eqSword ? (eqSword.tier || 0) : 0;
        const swordBonus = 1 + (swordLvl * 0.1);

        const event = ADVENTURE_EVENTS[Math.floor(Math.random() * ADVENTURE_EVENTS.length)];
        const finalGold = Math.floor(event.gold * swordBonus);
        // HP loss dikurangi DEF, minimal -2 (persis bot)
        const hpLoss = Math.min(-2, event.hp + (user.def || 0));

        user.gold += finalGold;
        user.exp  += event.exp;
        user.hp    = Math.max(1, user.hp + hpLoss);
        user.lastTreasure = now;

        const durLogs = [];
        // Decrease weapon durability (30% chance, sama dengan bot)
        if (wType && Math.random() < 0.3) {
            const d = decreaseDurability(user, wType, 1);
            if (d.broke) durLogs.push(d.msg);
        }
        // Decrease armor/shield (50% chance, sama dengan bot)
        if (Math.random() < 0.5) {
            if (user.equipped?.shield && Math.random() < 0.5) {
                const d = decreaseDurability(user, 'shield', 1);
                if (d.broke) durLogs.push(d.msg);
            } else {
                const armorParts = ['helmet','chestplate','leggings','boots'];
                const part = armorParts[Math.floor(Math.random() * armorParts.length)];
                const d = decreaseDurability(user, part, 1);
                if (d.broke) durLogs.push(d.msg);
            }
        }

        const logLines = [];
        levelUpCheck(user, logLines);
        recalculateStats(user);

        db.users[senderId] = user;
        await saveRpgDB(db);

        return res.status(200).json({
            ok: true,
            event: event.msg,
            gold: finalGold,
            exp: event.exp,
            hpLoss,
            durabilityLogs: durLogs,
            levelUpLog: logLines,
            cooldown: ADVENTURE_COOLDOWN,
            user: {
                level: user.level, exp: user.exp, gold: user.gold,
                hp: user.hp, maxHp: user.maxHp, mana: user.mana, maxMana: user.maxMana,
                atk: user.atk, def: user.def, inventory: user.inventory,
                lastTreasure: user.lastTreasure,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
