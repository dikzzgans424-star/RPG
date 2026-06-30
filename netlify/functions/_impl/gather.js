// api/gather.js — POST /api/gather
// Body: { senderId, type: 'mine'|'chop'|'fish' }
// Aktivitas life-skill instan: tambang/kayu/pancing. Mirip exact dengan rpg.js bot.
const { loadRpgDB, saveUserData, normalizeJid } = require('./_db');
const {
    recalculateStats, levelUpCheck, getEquippedItem, decreaseDurability,
    ORE_TABLE, WOOD_TABLE, FISH_TABLE, GATHER_COOLDOWN,
} = require('./_rpg');

const TOOL_SLOT  = { mine: 'pickaxe', chop: 'axe', fish: 'fishing_rod' };
const LAST_FIELD = { mine: 'lastMining', chop: 'lastWood', fish: 'lastFish' };
const COUNT_FIELD = { mine: 'miningCount', chop: 'woodcutCount', fish: 'fishingCount' };
const TOOL_LABEL = { mine: 'Pickaxe', chop: 'Axe (Kapak)', fish: 'Fishing Rod (Joran)' };

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
    const { senderId: rawSenderId, type } = body;

    if (!rawSenderId || !TOOL_SLOT[type]) return res.status(400).json({ error: 'senderId & type (mine/chop/fish) wajib diisi' });
    const senderId = normalizeJid(rawSenderId);

    try {
        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        if (!user.role) return res.status(400).json({ error: 'Pilih role dulu di bot WA' });

        recalculateStats(user);
        if (!user.inventory) user.inventory = {};

        const slot = TOOL_SLOT[type];
        const tool = getEquippedItem(user, slot);
        if (!tool) return res.status(400).json({ error: `❌ Kamu belum punya ${TOOL_LABEL[type]} terpasang! Equip/craft dulu di bot WA.` });

        const now = Date.now();
        const lastField = LAST_FIELD[type];
        const cooldown = GATHER_COOLDOWN[type];
        if (user[lastField] && now - user[lastField] < cooldown) {
            const sisa = Math.ceil((cooldown - (now - user[lastField])) / 1000);
            return res.status(400).json({ error: `⏳ Tenaga belum pulih. Tunggu ${sisa} detik lagi.`, cooldownLeft: sisa });
        }

        const toolTier  = tool.tier || tool.level || 1;
        const toolPower = tool.bonusStat || 1;
        const rewards = [];
        let totalExp = 0;

        if (type === 'mine') {
            const bonus = Math.floor(Math.sqrt(toolPower));
            ORE_TABLE.forEach(ore => {
                if (toolTier >= ore.minLvl) {
                    const chanceBoost = (toolTier * 0.01) + (toolPower / 50000);
                    if (Math.random() < (ore.chance + chanceBoost)) {
                        const amount = Math.floor(Math.random() * (ore.max - ore.min + 1)) + ore.min + bonus;
                        user.inventory[ore.key] = (user.inventory[ore.key] || 0) + amount;
                        totalExp += ore.exp * amount;
                        rewards.push({ name: ore.name, key: ore.key, amount });
                    }
                }
            });
            if (rewards.length === 0) {
                // Cooldown tetap harus jalan walau hasil kosong, supaya tombol
                // di frontend tidak bisa langsung di-spam-klik ulang.
                user[lastField] = now;
                user[COUNT_FIELD[type]] = (user[COUNT_FIELD[type]] || 0) + 1;
                await saveUserData(db, senderId, user);
                return res.status(200).json({
                    ok: true, empty: true,
                    message: '😔 Batu yang kamu pukul tidak menghasilkan apapun. Coba lagi nanti!',
                    cooldown: GATHER_COOLDOWN[type],
                    user: { lastMining: user.lastMining || 0, lastWood: user.lastWood || 0, lastFish: user.lastFish || 0 },
                });
            }
        } else if (type === 'chop') {
            const bonus = Math.floor(Math.sqrt(toolPower));
            WOOD_TABLE.forEach(item => {
                const chanceBoost = (toolTier * 0.015) + (toolPower / 50000);
                if (Math.random() < (item.chance + chanceBoost)) {
                    const amount = Math.floor(Math.random() * (item.max - item.min + 1)) + item.min + bonus;
                    user.inventory[item.key] = (user.inventory[item.key] || 0) + amount;
                    totalExp += item.exp * amount;
                    rewards.push({ name: item.name, key: item.key, amount });
                }
            });
            if (rewards.length === 0) {
                user[lastField] = now;
                user[COUNT_FIELD[type]] = (user[COUNT_FIELD[type]] || 0) + 1;
                await saveUserData(db, senderId, user);
                return res.status(200).json({
                    ok: true, empty: true,
                    message: '😔 Tidak ada yang bisa diambil.',
                    cooldown: GATHER_COOLDOWN[type],
                    user: { lastMining: user.lastMining || 0, lastWood: user.lastWood || 0, lastFish: user.lastFish || 0 },
                });
            }
        } else if (type === 'fish') {
            const luckBonus = (toolPower / 25000) * 0.40;
            FISH_TABLE.forEach(fish => {
                if (toolTier >= fish.minRod) {
                    if (Math.random() < (fish.chance + luckBonus)) {
                        const amount = Math.floor(Math.random() * (Math.floor(toolTier / 4) + 1)) + 1 + Math.floor(Math.sqrt(toolPower) / 5);
                        user.inventory[fish.key] = (user.inventory[fish.key] || 0) + amount;
                        totalExp += fish.exp * amount;
                        rewards.push({ name: fish.name, key: fish.key, amount });
                    }
                }
            });
            if (rewards.length === 0) {
                user.inventory.trash = (user.inventory.trash || 0) + 1;
                rewards.push({ name: 'Sampah Plastik', key: 'trash', amount: 1 });
                totalExp = 5;
            }
        }

        user[lastField] = now;
        user[COUNT_FIELD[type]] = (user[COUNT_FIELD[type]] || 0) + 1;
        user.exp = (user.exp || 0) + totalExp;

        const logLines = [];
        levelUpCheck(user, logLines);

        const durInfo = decreaseDurability(user, slot, 1);
        recalculateStats(user);
        await saveUserData(db, senderId, user);

        return res.status(200).json({
            ok: true,
            empty: false,
            tool: tool.name,
            rewards,
            totalExp,
            expText: `+${ribu(totalExp)}`,
            durability: durInfo,
            levelUpLog: logLines,
            user: {
                level: user.level, exp: user.exp, gold: user.gold,
                inventory: user.inventory,
                hp: user.hp, maxHp: user.maxHp, mana: user.mana, maxMana: user.maxMana,
                atk: user.atk, def: user.def,
                // Timestamp ini WAJIB dikembalikan supaya syncGatherCooldowns di frontend
                // bisa sinkronkan cooldown dengan benar setelah refresh Chrome.
                lastMining: user.lastMining || 0,
                lastWood: user.lastWood || 0,
                lastFish: user.lastFish || 0,
            },
            cooldown: GATHER_COOLDOWN[type],
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
