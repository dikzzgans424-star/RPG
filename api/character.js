// api/character.js — GET /api/character?id=SENDER_ID
const { loadRpgDB, normalizeJid } = require('./_db');
const { recalculateStats, roleData } = require('./_rpg');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { id: rawId } = req.query;
    if (!rawId) return res.status(400).json({ error: 'Parameter ?id= diperlukan' });
    const id = normalizeJid(rawId);

    try {
        const db = await loadRpgDB();
        const user = db.users?.[id];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan. Daftar dulu di bot WA dengan .rpgstart' });
        if (!user.role) return res.status(400).json({ error: 'Karakter belum memiliki role. Pilih role di bot WA dengan .choose' });

        // Recalculate stats to make sure they're fresh
        recalculateStats(user);

        // Get unlocked skills
        const role = roleData[user.role];
        const unlockedSkills = role ? Object.entries(role.skills)
            .filter(([lvl]) => user.level >= parseInt(lvl))
            .map(([lvl, skill]) => ({
                ...skill,
                reqLevel: parseInt(lvl),
                cooldownEnd: user.cooldowns?.[skill.name] || 0
            })) : [];

        // Battle states
        const battles = {
            dungeon: db.dungeonBattles?.[id] || null,
            hunt: db.huntBattle?.[id] || null,
            horde: db.hordeBattle?.[id] || null,
            beast: db.beastBattle?.[id] || null,
        };

        return res.status(200).json({
            ok: true,
            user: {
                senderId: id,
                role: user.role,
                level: user.level,
                exp: user.exp,
                gold: user.gold,
                hp: user.hp,
                maxHp: user.maxHp,
                mana: user.mana,
                maxMana: user.maxMana,
                atk: user.atk,
                def: user.def,
                speed: user.speed,
                critRate: user.critRate,
                dungeonFloor: user.dungeonFloor || 1,
                inventory: user.inventory || {},
                cooldowns: user.cooldowns || {},
                equipped: user.equipped || {},
                ownedGears: user.ownedGears || [],
            },
            roleInfo: role ? {
                name: role.name,
                emoji: role.emoji,
                description: role.description,
                weapon: role.weapon,
            } : null,
            unlockedSkills,
            battles,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
