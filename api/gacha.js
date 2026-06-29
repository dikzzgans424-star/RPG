// api/gacha.js — Treasure Chamber (Gacha/Crate system)
// Logika disalin persis dari rpg.js (bot WA): case 'gacha'/'gch'/'crate',
// cratePools, lootPools, getWeightedTier.
//
// GET  /api/gacha?id=SENDER_ID
//      -> { ok, crates:[{type,key,keyLabel,owned}], inventory }
// POST /api/gacha  { senderId, type, amount }   (amount 1-10)
const { loadRpgDB, saveUserData, normalizeJid } = require('./_db');

// ── Pools (persis dari bot, dengan key kategori dirapikan lowercase) ──
const lootPools = {
    materials: {
        common: ['stone', 'wood', 'leaf', 'coal', 'iron'],
        uncommon: ['silver', 'gold_ore', 'leather', 'maple_syrup'],
        rare: ['diamond', 'emerald', 'ruby', 'sapphire'],
        epic: ['mythril', 'void_crystal', 'astral_shard', 'ancient_ice'],
        legendary: ['nebulium_ingot', 'titan_blood', 'celestial_tear', 'dark_orbit_core', 'the_creator_spark'],
        mythic: ['divine_eye', 'spatial_ring', 'item_box', 'elixir_of_rebirth', 'chronos_hourglass'],
    },
    treasures: {
        common: ['trash', 'broken_glass'],
        uncommon: ['old_coin', 'iron_pendant'],
        rare: ['ancient_coin', 'silver_ring', 'jade'],
        epic: ['gold_bar', 'dragon_scale', 'phoenix_feather'],
        legendary: ['god_soul', 'omni_core', 'genesis_seed', 'abyss_heart', 'infinity_stone'],
        mythic: ['pandora_box', 'the_creator_spark', 'world_tree_root'],
    },
    consumables: {
        common: ['potion_hp_small'],
        uncommon: ['potion_hp_med', 'exp_scroll_small'],
        rare: ['potion_hp_large', 'exp_scroll_med'],
        epic: ['mega_potion', 'exp_scroll_large'],
        legendary: ['gods_elixir', 'immortality_tea'],
        mythic: ['ambrosia'],
    },
};

const cratePools = {
    common: { key: 'key_common', label: '⚪ Common Crate' },
    uncommon: { key: 'key_uncommon', label: '🔵 Uncommon Crate' },
    epic: { key: 'key_epic', label: '🟣 Epic Crate' },
    legendary: { key: 'key_legendary', label: '🌈 Legendary Crate' },
    mythic: { key: 'key_mythic', label: '⚡ Mythic Crate' },
};

function getWeightedTier(type) {
    const weights = {
        common: { common: 70, uncommon: 30 },
        uncommon: { uncommon: 65, rare: 35 },
        epic: { rare: 60, epic: 40 },
        legendary: { epic: 70, legendary: 30 },
        mythic: { legendary: 60, mythic: 40 },
    };
    const pool = weights[type];
    const rand = Math.random() * 100;
    let total = 0;
    for (const tier in pool) {
        total += pool[tier];
        if (rand <= total) return tier;
    }
    return 'common';
}

const TIER_EMOJI = { common: '⚪', uncommon: '🔵', rare: '🔵', epic: '🟣', legendary: '🌈', mythic: '⚡' };
function prettyName(key) { return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const { id: rawId } = req.query;
            if (!rawId) return res.status(400).json({ error: 'Parameter ?id= diperlukan' });
            const id = normalizeJid(rawId);
            const db = await loadRpgDB();
            const user = db.users?.[id];
            if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
            if (!user.inventory) user.inventory = {};

            const crates = Object.entries(cratePools).map(([type, c]) => ({
                type, key: c.key, label: c.label, owned: user.inventory[c.key] || 0,
            }));
            return res.status(200).json({ ok: true, crates });
        }

        if (req.method !== 'POST') return res.status(405).json({ error: 'GET/POST only' });

        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
        const { senderId: rawSenderId, type } = body;
        const amount = parseInt(body.amount) || 1;
        if (!rawSenderId || !type) return res.status(400).json({ error: 'senderId & type wajib' });
        const senderId = normalizeJid(rawSenderId);

        const config = cratePools[type];
        if (!config) return res.status(400).json({ error: `❌ Jenis crate tidak ada. Pilihan: ${Object.keys(cratePools).join(', ')}` });
        if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: '❌ Jumlah buka peti harus angka valid dan lebih dari 0!' });
        if (amount > 10) return res.status(400).json({ error: '❌ Maksimal buka 10 peti sekaligus agar energi tidak meledak!' });

        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        if (!user.inventory) user.inventory = {};

        const keyName = config.key;
        if ((user.inventory[keyName] || 0) < amount) {
            return res.status(400).json({ error: `❌ Kamu tidak punya ${amount}x ${prettyName(keyName)}!` });
        }

        user.inventory[keyName] -= amount;
        if (user.inventory[keyName] <= 0) delete user.inventory[keyName];

        const rolls = [];
        let totalAllItems = 0;
        let gotSpecialGlobal = false;

        for (let g = 0; g < amount; g++) {
            const rand = Math.random();
            const totalItems = rand < 0.2 ? 2 : rand < 0.8 ? 3 : rand < 0.95 ? 4 : 5;
            totalAllItems += totalItems;

            const guaranteedEpic = (type === 'legendary' || type === 'mythic');
            let gotEpic = false;
            let gotSpecial = false;
            const loot = [];

            // Special Isekai drops (Mythic & Legendary)
            if (type === 'mythic') {
                if (Math.random() <= 0.30 && !user.inventory['item_box']) {
                    user.inventory['item_box'] = 1;
                    loot.push({ key: 'item_box', name: 'ITEM BOX', tier: 'mythic', special: true });
                    gotSpecial = true;
                }
                if (Math.random() <= 0.60) {
                    user.inventory['spatial_ring'] = (user.inventory['spatial_ring'] || 0) + 1;
                    loot.push({ key: 'spatial_ring', name: 'SPATIAL RING', tier: 'mythic', special: true });
                    gotSpecial = true;
                }
                if (Math.random() <= 0.40 && !user.inventory['divine_eye']) {
                    user.inventory['divine_eye'] = 1;
                    loot.push({ key: 'divine_eye', name: 'DIVINE EYE', tier: 'mythic', special: true });
                    gotSpecial = true;
                }
            } else if (type === 'legendary') {
                if (Math.random() <= 0.15) {
                    user.inventory['spatial_ring'] = (user.inventory['spatial_ring'] || 0) + 1;
                    loot.push({ key: 'spatial_ring', name: 'SPATIAL RING', tier: 'mythic', special: true });
                    gotSpecial = true;
                }
            }

            for (let i = 0; i < totalItems; i++) {
                const selectedTier = getWeightedTier(type);
                if (selectedTier === 'epic' || selectedTier === 'legendary' || selectedTier === 'mythic') gotEpic = true;

                const diceCat = Math.random();
                const category = diceCat < 0.4 ? 'materials' : (diceCat < 0.8 ? 'treasures' : 'consumables');

                let pool = lootPools[category][selectedTier];
                if (!pool || pool.length === 0) pool = lootPools[category]['legendary'];
                if (!pool || pool.length === 0) continue;

                const item = pool[Math.floor(Math.random() * pool.length)];
                user.inventory[item] = (user.inventory[item] || 0) + 1;
                loot.push({ key: item, name: prettyName(item), tier: selectedTier, category });
            }

            if (guaranteedEpic && !gotEpic) {
                const forcedPool = lootPools.materials.epic;
                const forcedItem = forcedPool[Math.floor(Math.random() * forcedPool.length)];
                user.inventory[forcedItem] = (user.inventory[forcedItem] || 0) + 1;
                loot.push({ key: forcedItem, name: prettyName(forcedItem), tier: 'epic', bonus: true });
            }

            if (gotSpecial) gotSpecialGlobal = true;
            rolls.push({ loot, jackpot: totalItems >= 5 || gotSpecial });
        }

        await saveUserData(db, senderId, user);

        return res.status(200).json({
            ok: true,
            type,
            amount,
            rolls,
            totalAllItems,
            jackpot: totalAllItems >= 5 * amount * 0.6 || gotSpecialGlobal,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
