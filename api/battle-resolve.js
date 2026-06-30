// api/battle-resolve.js — POST /api/battle-resolve
// Dipakai oleh battle real-time 2D (battle2d.js). Client cuma melaporkan HASIL
// pertarungan (menang/kalah/kabur/lanjut stage) + state akhir (hp/mana/cooldowns/
// potion terpakai) — SEMUA reward (gold/exp/loot) tetap dihitung di server dari
// data monster yang sudah di-lock saat battle-start, supaya client tidak bisa
// menyuntik jumlah reward sendiri. Ini trade-off yang disengaja: combat real-time
// (gerak/dash/timing) berjalan di client untuk responsivitas, tapi ekonomi tetap
// server-authoritative seperti battle-action.js versi lama.
//
// Body: {
//   senderId, mode, event: 'stage_clear' | 'final_win' | 'lose' | 'flee',
//   hp, mana,                 // state akhir player (di-clamp server)
//   potionsUsed,               // jumlah potion dipakai selama battle (di-clamp ke stok)
//   skillCooldowns: { [skillName]: cdEndTimestamp },
//   buffs: { atk, def, speed } // buff sementara yang aktif (untuk dungeon next-floor dilepas)
// }
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const {
    recalculateStats, levelUpCheck, getRandomLoot, DUNGEON_MONSTERS, BOSS_MONSTERS
} = require('./_rpg');

const BATTLE_TYPE_MAP = { hunt: 'huntBattle', dungeon: 'dungeonBattles', beast: 'beastBattle', horde: 'hordeBattle' };
const LAST_FIELD = { hunt: 'lastHunt', dungeon: 'lastDungeon', beast: 'lastBoss', horde: 'lastHorde' };
const LOSE_HP = { hunt: 20, dungeon: 20, beast: 5, horde: 10 };

function setBattle(db, bt, senderId, data) {
    if (!db[bt]) db[bt] = {};
    if (data === null) delete db[bt][senderId];
    else db[bt][senderId] = data;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { senderId: rawSenderId, mode, event, hp, mana, potionsUsed, skillCooldowns, buffs } = body;
    if (!rawSenderId || !mode || !event) return res.status(400).json({ error: 'senderId, mode, event wajib' });
    const senderId = normalizeJid(rawSenderId);
    const bt = BATTLE_TYPE_MAP[mode];
    if (!bt) return res.status(400).json({ error: 'Mode tidak valid' });

    try {
        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });

        const b = db[bt]?.[senderId];
        if (!b) return res.status(400).json({ error: 'Tidak ada battle aktif. Mulai dulu!' });

        recalculateStats(user);

        // Sync state akhir dari client (di-clamp ke batas wajar)
        if (typeof hp === 'number')   user.hp   = Math.max(0, Math.min(user.maxHp, Math.floor(hp)));
        if (typeof mana === 'number') user.mana = Math.max(0, Math.min(user.maxMana, Math.floor(mana)));
        if (potionsUsed > 0) {
            const used = Math.min(potionsUsed, user.inventory?.potion || 0);
            if (used > 0 && user.inventory) user.inventory.potion -= used;
        }
        if (skillCooldowns && typeof skillCooldowns === 'object') {
            if (!user.cooldowns) user.cooldowns = {};
            for (const [k, v] of Object.entries(skillCooldowns)) {
                if (typeof v === 'number') user.cooldowns[k] = v;
            }
        }

        let result = { ok: true, event };
        let reward = null;

        if (event === 'flee') {
            if (mode !== 'dungeon') user[LAST_FIELD[mode]] = Date.now();
            setBattle(db, bt, senderId, null);

        } else if (event === 'lose') {
            user.hp = LOSE_HP[mode] || 20;
            user[LAST_FIELD[mode]] = Date.now();
            setBattle(db, bt, senderId, null);

        } else if (event === 'stage_clear') {
            // Hanya valid untuk beast (next phase) & horde (next wave) — monster
            // berikutnya DITENTUKAN SERVER, bukan client.
            if (mode === 'beast') {
                if (b.phase >= (b.maxPhase || 3)) return res.status(400).json({ error: 'Phase sudah maksimal' });
                b.phase++;
                b.monsterHp = Math.floor(b.monsterMaxHp / b.maxPhase);
                b.monsterAtk = Math.floor(b.monsterAtk * 1.2);
                setBattle(db, bt, senderId, b);
                result.battle = b;
            } else if (mode === 'horde') {
                b.totalKills = (b.totalKills || 0) + 1;
                b.totalGold  = (b.totalGold  || 0) + b.monster.gold;
                b.totalExp   = (b.totalExp   || 0) + b.monster.exp;
                if (b.wave >= b.maxWave) return res.status(400).json({ error: 'Wave sudah maksimal, pakai final_win' });
                b.wave++;
                const isBossWave = b.wave % 5 === 0 || b.wave === b.maxWave;
                const nextMon = isBossWave
                    ? BOSS_MONSTERS[Math.floor(Math.random() * BOSS_MONSTERS.length)]
                    : DUNGEON_MONSTERS[Math.floor(Math.random() * DUNGEON_MONSTERS.length)];
                const waveMult = 1 + (b.wave * 0.15);
                b.monster = { ...nextMon };
                b.monsterHp = Math.floor(nextMon.hp * waveMult);
                b.monsterMaxHp = b.monsterHp;
                b.monsterAtk = Math.floor(nextMon.atk * waveMult);
                b.monsterDef = nextMon.def;
                b.isBossWave = isBossWave;
                setBattle(db, bt, senderId, b);
                result.battle = b;
            } else {
                return res.status(400).json({ error: 'stage_clear tidak berlaku untuk mode ini' });
            }

        } else if (event === 'final_win') {
            let gold, exp, loot;
            if (mode === 'hunt') {
                gold = b.monster.gold; exp = b.monster.exp; loot = getRandomLoot(false);
                user.lastHunt = Date.now();
            } else if (mode === 'dungeon') {
                gold = Math.floor(1000 + ((b.floor || 1) * 100));
                exp  = Math.floor(500 + ((b.floor || 1) * 50));
                loot = getRandomLoot(b.isBoss, b.floor);
                user.dungeonFloor = (user.dungeonFloor || 1) + 1;
                // Dungeon tidak pernah kena cooldown saat menang (sama seperti versi lama)
            } else if (mode === 'beast') {
                if (b.phase < (b.maxPhase || 3)) return res.status(400).json({ error: 'Phase belum tuntas, pakai stage_clear' });
                gold = Math.floor(b.monster.gold * 3);
                exp  = Math.floor(b.monster.exp * 3);
                loot = getRandomLoot(true);
                user.lastBoss = Date.now();
            } else if (mode === 'horde') {
                if (b.wave < b.maxWave) return res.status(400).json({ error: 'Wave belum tuntas, pakai stage_clear' });
                b.totalKills = (b.totalKills || 0) + 1;
                b.totalGold  = (b.totalGold  || 0) + b.monster.gold;
                b.totalExp   = (b.totalExp   || 0) + b.monster.exp;
                gold = b.totalGold; exp = b.totalExp; loot = {};
                reward = { gold, exp, kills: b.totalKills, loot };
                user.lastHorde = Date.now();
            }

            user.gold = (user.gold || 0) + gold;
            user.exp  = (user.exp  || 0) + exp;
            if (loot) {
                if (!user.inventory) user.inventory = {};
                Object.entries(loot).forEach(([k, v]) => { user.inventory[k] = (user.inventory[k] || 0) + v; });
            }
            if (!reward) reward = { gold, exp, loot };

            const logLines = [];
            levelUpCheck(user, logLines);
            result.leveledUp = logLines.length > 0;
            result.newLevel = user.level;

            setBattle(db, bt, senderId, null);

        } else {
            return res.status(400).json({ error: 'Event tidak dikenal' });
        }

        recalculateStats(user);
        if (typeof hp === 'number') user.hp = Math.max(0, Math.min(user.maxHp, Math.floor(hp)));
        db.users[senderId] = user;
        await saveRpgDB(db);

        return res.status(200).json({
            ...result,
            reward,
            user: {
                hp: user.hp, maxHp: user.maxHp, mana: user.mana, maxMana: user.maxMana,
                atk: user.atk, def: user.def, gold: user.gold, exp: user.exp, level: user.level,
                inventory: user.inventory, cooldowns: user.cooldowns,
                lastHunt: user.lastHunt, lastDungeon: user.lastDungeon, lastBoss: user.lastBoss, lastHorde: user.lastHorde,
                dungeonFloor: user.dungeonFloor,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
