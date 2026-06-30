// api/stats.js — GET /api/stats?id=...
// Mengembalikan profil lengkap karakter (sama dengan bot: stats, equipment, rank)
const { loadRpgDB, normalizeJid } = require('./_db');
const { recalculateStats, roleData, getReqExp, getEquippedItem } = require('./_rpg');

function getRank(level, role) {
    if (level >= 1000) return '👑 Mythical Legend';
    if (level >= 500)  return '🌟 Immortal';
    if (level >= 300)  return '💎 Diamond';
    if (level >= 200)  return '🔮 Master';
    if (level >= 100)  return '⚔️ Elite';
    if (level >= 50)   return '🛡️ Knight';
    if (level >= 25)   return '🗡️ Warrior';
    if (level >= 10)   return '🪖 Adventurer';
    return '🌱 Novice';
}

function getWeaponSlots(role) {
    const map = {
        fighter:   ['sword', 'shield'],
        mage:      ['wand'],
        defender:  ['shield', 'sword'],
        assassin:  ['dagger'],
        wraith:    ['scythe'],
        archer:    ['bow'],
        alchemist: ['catalyst'],
    };
    return [...(map[role] || ['sword']), 'helmet', 'chestplate', 'leggings', 'boots', 'fishing_rod', 'pickaxe', 'axe', 'hoe'];
}

const EQ_ICONS = {
    sword: '⚔️', wand: '🪄', shield: '🔰', helmet: '🪖',
    chestplate: '👕', leggings: '👖', boots: '🥾',
    fishing_rod: '🎣', pickaxe: '⛏️', axe: '🪓', hoe: '🌾',
    dagger: '🗡️', scythe: '⚰️', bow: '🏹', catalyst: '🧪',
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    const rawId = req.query?.id;
    if (!rawId) return res.status(400).json({ error: 'id wajib diisi' });
    const senderId = normalizeJid(rawId);

    try {
        const db = await loadRpgDB();
        const u = db.users?.[senderId];
        if (!u) return res.status(404).json({ error: 'Karakter tidak ditemukan' });

        recalculateStats(u);

        const reqExp     = getReqExp(u.level);
        const percentExp = Math.min(100, Math.floor((u.exp / reqExp) * 100));
        const rank       = getRank(u.level, u.role);
        const roleInfo   = roleData[u.role] || {};

        // Equipment list persis seperti stats bot
        const slots      = getWeaponSlots(u.role);
        const equipment  = slots.map(slot => {
            const itemKey = u.equipped?.[slot];
            const icon    = EQ_ICONS[slot] || '📦';
            if (!itemKey) return { slot, icon, name: null };
            const itemData = getEquippedItem(u, slot) || {};
            return {
                slot,
                icon,
                name:  itemData.name || itemKey,
                tier:  itemData.tier || 0,
                dura:  itemData.durability !== undefined ? itemData.durability : null,
                maxDura: itemData.maxDurability || null,
            };
        }).filter(e => e.name !== null); // hanya tampilkan yang equipped

        return res.status(200).json({
            ok: true,
            profile: {
                role:        u.role,
                roleEmoji:   roleInfo.emoji || '🗡️',
                level:       u.level,
                exp:         u.exp,
                reqExp,
                percentExp,
                rank,
                gold:        u.gold,
                spouse:      u.spouse || null,
            },
            stats: {
                hp:       u.hp,
                maxHp:    u.maxHp,
                mana:     u.mana,
                maxMana:  u.maxMana,
                atk:      u.atk,
                def:      u.def,
                speed:    u.speed,
                critRate: u.critRate,
                dungeonFloor: u.dungeonFloor || 1,
            },
            equipment,
            passives: Object.entries(roleInfo.passives || {})
                .filter(([lvl]) => u.level >= parseInt(lvl))
                .map(([lvl, p]) => ({ lvl: parseInt(lvl), name: p.name, description: p.description })),
            skills: Object.entries(roleInfo.skills || {})
                .filter(([lvl]) => u.level >= parseInt(lvl))
                .map(([lvl, s]) => ({ lvl: parseInt(lvl), name: s.name, description: s.description })),
            timestamps: {
                lastExplore:    u.lastExplore    || 0,
                lastTreasure:   u.lastTreasure   || 0,
                lastHuntAnimal: u.lastHuntAnimal || 0,
                lastHunt:       u.lastHunt       || 0,
                lastDungeon:    u.lastDungeon    || 0,
                lastBoss:       u.lastBoss       || 0,
                lastHorde:      u.lastHorde      || 0,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
