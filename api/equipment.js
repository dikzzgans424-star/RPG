// api/equipment.js — Inventory, Equip, Unequip, Repair
// Logika disalin & disesuaikan persis dari rpg.js (bot WA): case 'equip',
// case 'unequip', case 'repair', case 'inventory'.
//
// GET  /api/equipment?id=SENDER_ID
//      -> { ok, gold, inventory:[{key,name,icon,qty}], gears:[...], equipped:{} }
//
// POST /api/equipment  { senderId, action:'equip',   idx, force? }
// POST /api/equipment  { senderId, action:'unequip', slot }
// POST /api/equipment  { senderId, action:'repair',  idx }
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const { recalculateStats, roleData } = require('./_rpg');
const { weaponTiers, toolTiers, armorTiers } = require('./_tiers');

function ribu(n) { return Number(Math.floor(n)).toLocaleString('id-ID'); }

const WEAPON_TYPES = ['sword', 'wand', 'dagger', 'scythe', 'bow', 'catalyst'];
const ARMOR_TYPES  = ['helmet', 'chestplate', 'leggings', 'boots', 'shield', 'armor'];
const ALL_SLOTS    = ['sword', 'axe', 'pickaxe', 'fishing_rod', 'hoe', 'armor', 'helmet', 'chestplate', 'leggings', 'boots', 'shield', 'wand', 'dagger', 'scythe', 'bow', 'catalyst'];

// Database emoji/nama rapi untuk item (persis bot)
const ITEM_INFO = {
    potion: '🧪 Potion', key_common: '🔑 Common Key', key_epic: '🗝️ Epic Key',
    key_legendary: '🔱 Legendary Key', mythril: '💎 Mythril', ancient_gold: '📀 Ancient Gold',
    dragon_scale: '🐲 Dragon Scale', dark_matter: '🌑 Dark Matter', iron: '⛓️ Iron Ore',
    gold_ore: '🟡 Gold Ore', diamond: '💎 Diamond', wood: '🪵 Wood', fish: '🐟 Fish', meat: '🥩 Raw Meat',
};

function gearMeta(type) {
    if (ARMOR_TYPES.includes(type))        return { icon: '🛡️', label: 'Def' };
    if (WEAPON_TYPES.includes(type))       return { icon: '⚔️', label: 'Atk' };
    if (type === 'pickaxe')                return { icon: '⛏️', label: 'Mining Pwr' };
    if (type === 'axe')                    return { icon: '🪓', label: 'Chop Pwr' };
    if (type === 'fishing_rod')            return { icon: '🎣', label: 'Luck' };
    if (type === 'hoe')                    return { icon: '🚜', label: 'Farm Pwr' };
    return { icon: '📦', label: 'Power' };
}

function gearLabel(g) {
    return g.name.includes('[T') ? g.name : `[T${g.tier || g.level}] ${g.name}`;
}

function buildView(user) {
    const items = Object.entries(user.inventory || {})
        .filter(([k, v]) => v > 0 && k !== 'item_box')
        .map(([k, v]) => ({
            key: k,
            name: ITEM_INFO[k] || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            qty: v,
        }));

    const gears = (user.ownedGears || []).map((g, i) => {
        const meta = gearMeta(g.type);
        const isEquipped = Object.values(user.equipped || {}).includes(g.id);
        return {
            idx: i,
            id: g.id,
            type: g.type,
            name: g.name,
            label: gearLabel(g),
            icon: meta.icon,
            statLabel: meta.label,
            bonusStat: g.bonusStat || 0,
            durability: g.durability,
            maxDurability: g.maxDurability,
            durabilityPct: Math.floor((g.durability / (g.maxDurability || 1)) * 100),
            equipped: isEquipped,
            tier: g.tier || g.level,
        };
    });

    return { gold: user.gold || 0, inventory: items, gears, equipped: user.equipped || {} };
}

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
            recalculateStats(user);
            return res.status(200).json({ ok: true, ...buildView(user) });
        }

        if (req.method !== 'POST') return res.status(405).json({ error: 'GET/POST only' });

        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
        const { senderId: rawSenderId, action } = body;
        if (!rawSenderId || !action) return res.status(400).json({ error: 'senderId & action wajib' });
        const senderId = normalizeJid(rawSenderId);

        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        if (!user.inventory) user.inventory = {};
        if (!user.ownedGears) user.ownedGears = [];
        if (!user.equipped) user.equipped = {};
        recalculateStats(user);

        // ═══════════════ EQUIP ═══════════════
        if (action === 'equip') {
            if (user.ownedGears.length === 0) return res.status(400).json({ error: '❌ Kamu tidak punya perlengkapan di gudang.' });

            const idx = parseInt(body.idx);
            const gear = user.ownedGears[idx];
            if (!gear) return res.status(400).json({ error: '❌ Nomor perlengkapan tidak ditemukan!' });

            let forcedBrokenMsg = null;
            if (gear.durability <= 0) {
                if (!body.force) {
                    return res.status(400).json({
                        error: `❌ ITEM RUSAK! "${gear.name}" tidak bisa dipakai karena rusak total.`,
                        needForce: true,
                    });
                }
                forcedBrokenMsg = `⚠️ DARURAT: Kamu memasang "${gear.name}" yang rusak. Tidak memberikan bonus stat!`;
            }

            const role = roleData[user.role];
            if (!role) return res.status(400).json({ error: '❌ Kamu belum memiliki kekuatan! Lakukan Ascension dulu.' });

            const allowedWeapons = Array.isArray(role.weapon) ? role.weapon : [role.weapon];

            if (['sword', 'wand', 'shield', 'dagger', 'scythe', 'bow', 'catalyst'].includes(gear.type)) {
                if (!allowedWeapons.includes(gear.type)) {
                    const roleWeaponTeks = allowedWeapons.map(w => w.toUpperCase()).join(' & ');
                    return res.status(400).json({ error: `❌ Role "${role.name}" hanya bisa menggunakan: ${roleWeaponTeks}` });
                }
            }

            if (WEAPON_TYPES.includes(gear.type)) {
                WEAPON_TYPES.forEach(s => { user.equipped[s] = null; });
            }

            if (user.equipped[gear.type] === gear.id) {
                return res.status(400).json({ error: `⚠️ "${gear.name}" sudah kamu pakai!` });
            }

            user.equipped[gear.type] = gear.id;
            recalculateStats(user);
            db.users[senderId] = user;
            await saveRpgDB(db);

            return res.status(200).json({
                ok: true,
                message: forcedBrokenMsg || `✅ EQUIP SUCCESS! "${gear.name}" terpasang.`,
                ...buildView(user),
            });
        }

        // ═══════════════ UNEQUIP ═══════════════
        if (action === 'unequip') {
            const type = (body.slot || '').toLowerCase();
            if (!type || !ALL_SLOTS.includes(type)) {
                return res.status(400).json({ error: `❌ Slot tidak valid. Pilihan: ${ALL_SLOTS.join(', ')}` });
            }
            if (!user.equipped[type]) {
                return res.status(400).json({ error: `❌ Kamu tidak sedang memakai item di slot "${type.toUpperCase()}".` });
            }

            const gearBefore = user.ownedGears.find(g => g.id === user.equipped[type]);
            user.equipped[type] = null;
            recalculateStats(user);
            db.users[senderId] = user;
            await saveRpgDB(db);

            const gearName = gearBefore ? gearLabel(gearBefore) : 'Perlengkapan';
            return res.status(200).json({
                ok: true,
                message: `✅ UNEQUIP SUCCESS! "${gearName}" dilepas dari slot ${type.toUpperCase()}.`,
                ...buildView(user),
            });
        }

        // ═══════════════ REPAIR ═══════════════
        if (action === 'repair') {
            const idx = parseInt(body.idx);
            const gear = user.ownedGears[idx];
            if (!gear) return res.status(400).json({ error: '❌ Perlengkapan tidak ditemukan.' });
            if (gear.durability >= gear.maxDurability) {
                return res.status(400).json({ error: `✨ "${gear.name}" masih dalam kondisi sempurna!` });
            }

            const isWeapon = WEAPON_TYPES.includes(gear.type);
            const isArmor  = ['armor', 'helmet', 'chestplate', 'leggings', 'boots', 'shield'].includes(gear.type);
            const currentTier = gear.tier || gear.level;

            const tierData = isWeapon
                ? weaponTiers.find(t => t.tier === currentTier)
                : (isArmor ? armorTiers.find(t => t.tier === currentTier) : toolTiers.find(t => t.tier === currentTier));
            if (!tierData) return res.status(400).json({ error: '❌ Blueprint purba tidak dapat dibaca.' });

            const maxDura = gear.maxDurability;
            const currDura = gear.durability;
            const dmgPercent = (maxDura - currDura) / maxDura;
            const isSevere = (currDura / maxDura) <= 0.5;

            const goldCost = Math.max(50, Math.floor((tierData.price || 500) * dmgPercent * 0.4));

            const reqMats = {};
            if (isSevere && tierData.craftCost) {
                for (const [mat, qty] of Object.entries(tierData.craftCost)) {
                    const halfQty = Math.ceil(qty * 0.5);
                    if (halfQty > 0) reqMats[mat] = halfQty;
                }
            }

            if (user.gold < goldCost) return res.status(400).json({ error: `❌ Gold tidak cukup! Butuh ${ribu(goldCost)} Gold.` });

            const missing = [];
            for (const [mat, qty] of Object.entries(reqMats)) {
                const has = user.inventory[mat] || 0;
                if (has < qty) missing.push(`${mat.replace(/_/g, ' ').toUpperCase()}: ${has}/${qty}`);
            }
            if (missing.length > 0) {
                return res.status(400).json({ error: `❌ MATERIAL TIDAK CUKUP! Butuh: ${missing.join(', ')} (Biaya jasa: ${ribu(goldCost)} Gold)` });
            }

            user.gold -= goldCost;
            for (const [mat, qty] of Object.entries(reqMats)) {
                user.inventory[mat] -= qty;
                if (user.inventory[mat] <= 0) delete user.inventory[mat];
            }
            gear.durability = gear.maxDurability;

            db.users[senderId] = user;
            await saveRpgDB(db);

            return res.status(200).json({
                ok: true,
                message: `🔨 PERBAIKAN SELESAI! "${gear.name}" kembali sempurna (-${ribu(goldCost)} Gold)`,
                goldCost,
                materialsUsed: reqMats,
                ...buildView(user),
            });
        }

        return res.status(400).json({ error: 'Action tidak dikenal (equip/unequip/repair)' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
