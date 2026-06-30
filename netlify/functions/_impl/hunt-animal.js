// api/hunt-animal.js — POST /api/hunt-animal
// Body: { senderId }
// Logika persis sama dengan bot WA: random hewan, daging + 30% leather.
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const {
    recalculateStats, levelUpCheck, decreaseDurability,
    getEquippedItem, HUNT_ANIMALS, HUNT_ANIMAL_COOLDOWN,
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
        if (!user.inventory) user.inventory = {};

        const now = Date.now();
        const lastHuntAnimal = user.lastHuntAnimal || 0;
        const sisaMs = HUNT_ANIMAL_COOLDOWN - (now - lastHuntAnimal);
        if (sisaMs > 0) {
            const sisa = Math.ceil(sisaMs / 1000);
            return res.status(400).json({ error: `⏳ Hewan bersembunyi. Tunggu ${sisa} detik lagi.`, cooldownLeft: sisa });
        }

        // Weapon tier bonus (persis bot)
        const activeWeaponSlot = ['sword','wand','dagger','scythe','bow','catalyst']
            .find(slot => user.equipped?.[slot]);
        const eqWeapon = activeWeaponSlot ? getEquippedItem(user, activeWeaponSlot) : null;
        const weaponLvl  = eqWeapon ? (eqWeapon.tier || eqWeapon.level || 0) : 0;
        const bonusMeat  = Math.floor(weaponLvl / 2);

        const animal   = HUNT_ANIMALS[Math.floor(Math.random() * HUNT_ANIMALS.length)];
        const finalQty = animal.qty + bonusMeat;
        const expGained = animal.exp + (weaponLvl * 2);
        const dapetKulit = Math.random() < 0.3;

        user.inventory[animal.meat] = (user.inventory[animal.meat] || 0) + finalQty;
        if (dapetKulit) user.inventory.leather = (user.inventory.leather || 0) + 1;
        user.exp += expGained;
        user.lastHuntAnimal = now;

        const durLogs = [];
        if (activeWeaponSlot) {
            const d = decreaseDurability(user, activeWeaponSlot, 1);
            if (d.broke) durLogs.push(d.msg);
        }

        const logLines = [];
        levelUpCheck(user, logLines);
        recalculateStats(user);

        db.users[senderId] = user;
        await saveRpgDB(db);

        return res.status(200).json({
            ok: true,
            animal: animal.name,
            meat: animal.meat,
            qty: finalQty,
            leather: dapetKulit,
            exp: expGained,
            durabilityLogs: durLogs,
            levelUpLog: logLines,
            cooldown: HUNT_ANIMAL_COOLDOWN,
            user: {
                level: user.level, exp: user.exp, gold: user.gold,
                hp: user.hp, maxHp: user.maxHp, mana: user.mana, maxMana: user.maxMana,
                inventory: user.inventory,
                lastHuntAnimal: user.lastHuntAnimal,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
