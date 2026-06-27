// api/battle-start.js — POST /api/battle-start
// Body: { senderId, mode: 'hunt'|'dungeon'|'beast'|'horde' }
const { loadRpgDB, saveUserData, saveBattleState, normalizeJid } = require('./_db');
const { recalculateStats, HUNT_MONSTERS, DUNGEON_MONSTERS, BOSS_MONSTERS } = require('./_rpg');

const BATTLE_TYPE_MAP = {
    hunt: 'huntBattle',
    dungeon: 'dungeonBattles',
    beast: 'beastBattle',
    horde: 'hordeBattle',
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { senderId: rawSenderId, mode } = body;
    if (!rawSenderId || !mode) return res.status(400).json({ error: 'senderId & mode wajib diisi' });
    if (!BATTLE_TYPE_MAP[mode]) return res.status(400).json({ error: 'Mode tidak valid' });
    const senderId = normalizeJid(rawSenderId);

    try {
        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        if (!user.role) return res.status(400).json({ error: 'Karakter belum memiliki role' });

        recalculateStats(user);

        // Check sudah ada battle
        const bt = BATTLE_TYPE_MAP[mode];
        if (db[bt]?.[senderId]) return res.status(400).json({ error: `Kamu masih dalam pertarungan ${mode}!` });
        // Check battle modes lain
        for (const [m, t] of Object.entries(BATTLE_TYPE_MAP)) {
            if (m !== mode && db[t]?.[senderId]) {
                return res.status(400).json({ error: `Selesaikan pertarungan ${m} dulu!` });
            }
        }

        let battleData;
        const now = Date.now();

        if (mode === 'hunt') {
            const monster = HUNT_MONSTERS[Math.floor(Math.random() * HUNT_MONSTERS.length)];
            const lvlScale = Math.max(1, user.level / 10);
            battleData = {
                monster: { ...monster },
                monsterHp: Math.floor(monster.hp * lvlScale),
                monsterMaxHp: Math.floor(monster.hp * lvlScale),
                monsterAtk: Math.floor(monster.atk * lvlScale),
                monsterDef: monster.def,
                defendState: false,
                dodgeState: false,
                monsterStunned: false,
                monsterAilment: null,
                timeStop: 0,
                combatFlow: 0,
                buffs: { atk: 1, def: 1, speed: 1 },
                isBoss: false,
                startTime: now,
                lastAction: now,
                turn: 1,
            };
        } else if (mode === 'dungeon') {
            const floor = user.dungeonFloor || 1;
            const isBoss = floor % 10 === 0;
            let monster;
            if (isBoss) {
                monster = BOSS_MONSTERS[Math.floor(Math.random() * BOSS_MONSTERS.length)];
            } else {
                monster = DUNGEON_MONSTERS[Math.floor(Math.random() * DUNGEON_MONSTERS.length)];
            }
            const floorScale = 1 + (floor * 0.1);
            battleData = {
                monster: { ...monster },
                monsterHp: Math.floor(monster.hp * floorScale),
                monsterMaxHp: Math.floor(monster.hp * floorScale),
                monsterAtk: Math.floor(20 + (floor * 20)),
                monsterDef: Math.floor(10 + (floor * 5)),
                isBoss,
                floor,
                defendState: false,
                dodgeState: false,
                monsterStunned: false,
                monsterAilment: null,
                timeStop: 0,
                combatFlow: 0,
                buffs: { atk: 1, def: 1, speed: 1 },
                isWaitingRebirth: false,
                startTime: now,
                lastAction: now,
                turn: 1,
            };
        } else if (mode === 'beast') {
            const boss = BOSS_MONSTERS[Math.floor(Math.random() * BOSS_MONSTERS.length)];
            battleData = {
                monster: { ...boss },
                monsterHp: boss.hp * 2,
                monsterMaxHp: boss.hp * 2,
                monsterAtk: Math.floor(boss.atk * 1.5),
                monsterDef: boss.def,
                isBoss: true,
                phase: 1,
                maxPhase: 3,
                defendState: false,
                dodgeState: false,
                monsterStunned: false,
                monsterAilment: null,
                timeStop: 0,
                combatFlow: 0,
                buffs: { atk: 1, def: 1, speed: 1 },
                startTime: now,
                lastAction: now,
                turn: 1,
            };
        } else if (mode === 'horde') {
            const wave = 1;
            const maxWave = 10;
            const isBossWave = false;
            const hordeMonster = DUNGEON_MONSTERS[0];
            battleData = {
                wave,
                maxWave,
                monster: { ...hordeMonster },
                monsterHp: hordeMonster.hp,
                monsterMaxHp: hordeMonster.hp,
                monsterAtk: hordeMonster.atk,
                monsterDef: hordeMonster.def,
                isBossWave,
                defendState: false,
                dodgeState: false,
                monsterStunned: false,
                monsterAilment: null,
                timeStop: 0,
                combatFlow: 0,
                buffs: { atk: 1, def: 1, speed: 1 },
                totalKills: 0,
                totalGold: 0,
                totalExp: 0,
                startTime: now,
                lastAction: now,
                turn: 1,
            };
        }

        await saveBattleState(db, bt, senderId, battleData);
        await saveUserData(db, senderId, user);

        return res.status(200).json({ ok: true, battle: battleData, mode });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
