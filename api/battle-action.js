// api/battle-action.js — POST /api/battle-action
// Body: { senderId, mode, action: 'attack'|'defend'|'dodge'|'potion'|'flee'|'skill', skillName? }
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const {
    recalculateStats, applyBattleBuffs, useSkillRPG, levelUpCheck,
    getRandomLoot, DUNGEON_MONSTERS, BOSS_MONSTERS
} = require('./_rpg');

const BATTLE_TYPE_MAP = {
    hunt: 'huntBattle',
    dungeon: 'dungeonBattles',
    beast: 'beastBattle',
    horde: 'hordeBattle',
};

// Helper: mutasi db di-memori tanpa langsung save ke MongoDB.
// Panggil saveRpgDB(db) SEKALI di akhir handler supaya tidak ada double-write.
function setBattle(db, bt, senderId, data) {
    if (!db[bt]) db[bt] = {};
    if (data === null) delete db[bt][senderId];
    else db[bt][senderId] = data;
}
function setUser(db, senderId, userData) {
    if (!db.users) db.users = {};
    db.users[senderId] = userData;
}

function ribu(n) { return Number(Math.floor(n)).toLocaleString('id-ID'); }

// Selalu panggil ini setelah recalculateStats(user) di tengah battle,
// supaya buff sementara (War Cry, Mana Shield, dst) tidak hilang.
function refreshStats(user, b) {
    recalculateStats(user);
    applyBattleBuffs(user, b);
}

function applyMonsterTurn(b, user, logLines) {
    if (b.monsterHp <= 0) return;

    // Time Stop
    if (b.timeStop > 0) {
        b.timeStop--;
        logLines.push({ type: 'system', text: `⏳ Waktu terhenti! (sisa ${b.timeStop} turn)` });
        return;
    }

    // Mage passive: Mana Well (regen tiap giliran, termasuk saat musuh stun)
    if (user.role === 'mage' && user.level >= 5) {
        const regen = Math.floor(user.maxMana * 0.02);
        user.mana = Math.min(user.maxMana, user.mana + regen);
        logLines.push({ type: 'mana', text: `💧 Mana Well: +${regen} MP` });
    }

    // Stun
    if (b.monsterStunned) {
        logLines.push({ type: 'system', text: `😵 Musuh STUNNED — tidak bisa menyerang!` });
        b.monsterStunned = false;
        return;
    }

    // Dodge calculation (Assassin: Invisibility lvl20, Wraith: Shadow Cloak lvl20)
    const dodgeBonus =
        (user.role === 'assassin' && user.level >= 20) ? 0.2 :
        (user.role === 'wraith'   && user.level >= 20) ? 0.15 : 0;
    const totalDodge = Math.min(0.85, ((user.speed - 1) * 0.2) + dodgeBonus + (b.dodgeState ? 0.5 : 0));
    if (Math.random() < totalDodge) {
        logLines.push({ type: 'dodge', text: `💨 MISS! Kamu berhasil menghindar!` });
        return;
    }

    let mDmg = Math.max(5, Math.floor(b.monsterAtk - (user.def * 0.4)));
    if (b.defendState) mDmg = Math.floor(mDmg * 0.4);

    // Fighter passive: Tenacity (DEF dihitung sebelumnya, tapi efeknya kita terapkan
    // langsung ke damage yang masuk supaya konsisten meski HP berubah tiap turn)
    if (user.role === 'fighter' && user.level >= 20 && (user.hp / user.maxHp) < 0.3) {
        mDmg = Math.floor(mDmg / 1.25);
    }

    // Defender passive: Sturdy Body — damage dari boss -20%
    if (user.role === 'defender' && user.level >= 20 && b.isBoss) {
        mDmg = Math.floor(mDmg * 0.8);
    }

    user.hp -= mDmg;
    logLines.push({ type: 'monster-attack', text: `👺 Musuh menyerang! -${ribu(mDmg)} HP` });

    // Defender: Spiked Armor reflect
    if (user.role === 'defender' && user.level >= 5) {
        const ref = Math.floor(mDmg * 0.1);
        b.monsterHp -= ref;
        logLines.push({ type: 'reflect', text: `💥 Spiked Armor: ${ribu(ref)} damage balik!` });
    }
}

function applyAilment(b, logLines) {
    if (!b.monsterAilment || b.monsterAilment.turns <= 0) return;
    const ailDmg = Math.floor(b.monsterMaxHp * (b.isBoss ? 0.025 : 0.05));
    b.monsterHp -= ailDmg;
    b.monsterAilment.turns--;
    const emoji = { burn: '🔥', poison: '☠️', bleed: '🩸' }[b.monsterAilment.type] || '✨';
    logLines.push({ type: 'ailment', text: `${emoji} [${b.monsterAilment.type.toUpperCase()}] -${ribu(ailDmg)} HP!` });
    if (b.monsterAilment.turns <= 0) b.monsterAilment = null;
}

function doPlayerAttack(b, user, isSkill = false, skillData = null, logLines = [], currentMode = 'hunt') {
    let dmg = Math.floor(user.atk * (isSkill && skillData?.damage ? skillData.damage : (0.9 + Math.random() * 0.3)));

    // Crit chance — Archer: Focus +10% lvl20
    const critBonus = (user.role === 'archer' && user.level >= 20) ? 0.10 : 0;
    let isCrit = Math.random() < (user.critRate + critBonus);
    // Crit damage — Assassin: Lethal Precision lvl5 → x2.2 (bot pakai 2.2, bukan 2.5)
    const critMult = (user.role === 'assassin' && user.level >= 5) ? 2.2 : 2.0;
    if (isCrit) dmg = Math.floor(dmg * critMult);

    // Fighter passive: Combat Flow
    if (user.role === 'fighter' && user.level >= 5) {
        b.combatFlow = Math.min(0.5, (b.combatFlow || 0) + 0.05);
        dmg = Math.floor(dmg * (1 + b.combatFlow));
    }

    // Assassin passive: Execute lvl25 — DMG +25% saat monster HP < 50%
    if (user.role === 'assassin' && user.level >= 25 && b.monsterHp / b.monsterMaxHp < 0.5) {
        dmg = Math.floor(dmg * 1.25);
    }

    // Mage passive: Arcane Focus on skills
    if (isSkill && user.role === 'mage' && user.level >= 20) dmg = Math.floor(dmg * 1.15);

    // Archer passive: Eagle Eye — ignore 15% monster def
    const mDefReduce = (user.role === 'archer' && user.level >= 5) ? 0.85 : 1.0;
    // DEF musuh: untuk dungeon pakai formula floor-based sama dengan bot (20 + floor*20)
    // untuk mode lain pakai def dari data monster
    let rawMonsterDef = b.monsterDef || 0;
    if (currentMode === 'dungeon') {
        rawMonsterDef = Math.floor(20 + ((b.floor || 1) * 20));
    }
    const mDef = Math.floor(rawMonsterDef * mDefReduce);
    const finalDmg = Math.max(1, dmg - mDef);

    b.monsterHp -= finalDmg;

    let txt = `${isCrit ? '💥 CRITICAL! ' : '⚔️ '}`;
    if (isSkill && skillData) txt = `✨ ${skillData.name.toUpperCase()}! `;
    txt += `-${ribu(finalDmg)} HP`;

    // Wraith passive: Soul Eater lifesteal
    if (user.role === 'wraith' && user.level >= 5) {
        const ls = Math.floor(finalDmg * 0.05);
        user.hp = Math.min(user.maxHp, user.hp + ls);
        txt += ` (❤️ +${ls})`;
    }

    logLines.push({ type: isSkill ? 'skill' : (isCrit ? 'crit' : 'attack'), text: txt });
    return finalDmg;
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

    const { senderId: rawSenderId, mode, action, skillName } = body;
    if (!rawSenderId || !mode || !action) return res.status(400).json({ error: 'senderId, mode, action wajib' });
    const senderId = normalizeJid(rawSenderId);

    const bt = BATTLE_TYPE_MAP[mode];
    if (!bt) return res.status(400).json({ error: 'Mode tidak valid' });

    try {
        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });

        const b = db[bt]?.[senderId];
        if (!b) return res.status(400).json({ error: 'Tidak ada battle aktif. Mulai dulu!' });
        if (!b.buffs) b.buffs = { atk: 1, def: 1, speed: 1 };

        refreshStats(user, b);

        const logLines = [];
        let turnResult = 'ongoing'; // 'win' | 'lose' | 'flee' | 'ongoing' | 'next_wave' | 'next_phase'
        let reward = null;
        let fleeSuccess = false;

        b.defendState = false;
        b.dodgeState  = false;

        // ─── PLAYER ACTION ───
        if (action === 'attack') {
            doPlayerAttack(b, user, false, null, logLines, mode);

            // Speed-based extra attack chance
            if (user.speed > 1.0 && Math.random() < (user.speed - 1) * 0.5) {
                logLines.push({ type: 'system', text: '⚡ Extra Attack!' });
                doPlayerAttack(b, user, false, null, logLines, mode);
            }

        } else if (action === 'defend') {
            b.defendState = true;
            logLines.push({ type: 'defend', text: '🛡️ Kamu bersiap bertahan! (Damage -60%)' });

        } else if (action === 'dodge') {
            b.dodgeState = true;
            logLines.push({ type: 'dodge', text: '👣 Kamu bersiap menghindar!' });

        } else if (action === 'potion') {
            if (!user.inventory?.potion || user.inventory.potion < 1) {
                return res.status(400).json({ error: '❌ Potion habis!' });
            }
            user.inventory.potion--;
            // Alchemist passive: Potion Master +25% heal
            const healBonus = (user.role === 'alchemist' && user.level >= 5) ? 0.25 : 0;
            const heal = Math.floor(200 * (1 + healBonus));
            user.hp = Math.min(user.maxHp, user.hp + heal);
            logLines.push({ type: 'heal', text: `🧪 Minum Potion! +${heal} HP` });

        } else if (action === 'skill') {
            if (!skillName) return res.status(400).json({ error: 'skillName diperlukan' });
            const result = useSkillRPG(user, skillName);
            if (!result.success) return res.status(400).json({ error: result.msg });

            const skill = result.skill;

            if (skill.heal) {
                const h = Math.floor(user.maxHp * skill.heal);
                user.hp = Math.min(user.maxHp, user.hp + h);
                logLines.push({ type: 'skill', text: `✨ ${skill.name.toUpperCase()}! ❤️ +${ribu(h)} HP` });
            } else if (skill.buff === 'atk') {
                b.buffs.atk = (b.buffs.atk || 1) * skill.power;
                refreshStats(user, b);
                logLines.push({ type: 'skill', text: `✨ ${skill.name.toUpperCase()}! ATK +${Math.floor((skill.power - 1) * 100)}% (sisa battle)` });
            } else if (skill.buff === 'def') {
                b.buffs.def = (b.buffs.def || 1) * skill.power;
                refreshStats(user, b);
                logLines.push({ type: 'skill', text: `✨ ${skill.name.toUpperCase()}! DEF x${skill.power} (sisa battle)` });
            } else if (skill.buff === 'speed') {
                b.buffs.speed = (b.buffs.speed || 1) * skill.power;
                refreshStats(user, b);
                logLines.push({ type: 'skill', text: `✨ ${skill.name.toUpperCase()}! Speed x${skill.power} (sisa battle)` });
            } else {
                doPlayerAttack(b, user, true, skill, logLines, mode);
            }

            // Status effects
            if (skill.effect === 'stun') {
                b.monsterStunned = true;
                logLines.push({ type: 'status', text: '⛓️ Musuh terkena STUN!' });
            } else if (skill.effect === 'debuff_def') {
                b.monsterDef = Math.floor((b.monsterDef || 0) * 0.7);
                logLines.push({ type: 'status', text: '🧪 DEF musuh berkurang 30%!' });
            } else if (['burn','bleed','poison'].includes(skill.effect)) {
                const tCount = (user.role === 'alchemist' && user.level >= 20) ? 4 : 3;
                b.monsterAilment = { type: skill.effect, turns: tCount };
                const emoji = { burn: '🔥', poison: '☠️', bleed: '🩸' }[skill.effect];
                logLines.push({ type: 'status', text: `${emoji} Musuh terkena ${skill.effect.toUpperCase()} (${tCount} turn)!` });
            }

        } else if (action === 'flee') {
            // Flee chance sesuai bot: non-boss 50%, boss 20%
            const baseChance = b.isBoss ? 0.2 : 0.5;
            const escapeChance = baseChance + ((user.speed - 1) * 0.1);
            if (Math.random() < escapeChance) {
                fleeSuccess = true;
                turnResult = 'flee';
                logLines.push({ type: 'flee', text: '🏃 Berhasil kabur!' });
                setBattle(db, bt, senderId, null);
            } else {
                logLines.push({ type: 'flee', text: '👟 Gagal kabur! Musuh menghalangi!' });
            }
        } else {
            return res.status(400).json({ error: 'Action tidak dikenal' });
        }

        // ─── MONSTER TURN (kalau tidak kabur & monster masih hidup) ───
        if (turnResult !== 'flee' && b.monsterHp > 0) {
            applyAilment(b, logLines);
            applyMonsterTurn(b, user, logLines);
        }

        b.turn = (b.turn || 1) + 1;

        // ─── CHECK WIN/LOSE ───
        if (turnResult !== 'flee') {
            if (b.monsterHp <= 0) {
                turnResult = 'win';
                // Horde: next wave
                if (mode === 'horde') {
                    b.totalKills  = (b.totalKills  || 0) + 1;
                    b.totalGold   = (b.totalGold   || 0) + b.monster.gold;
                    b.totalExp    = (b.totalExp    || 0) + b.monster.exp;
                    user.gold += b.monster.gold;
                    user.exp  += b.monster.exp;

                    if (b.wave < b.maxWave) {
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
                        b.monsterStunned = false;
                        b.monsterAilment = null;
                        turnResult = 'next_wave';
                        logLines.push({ type: 'wave', text: `🌊 Wave ${b.wave}/${b.maxWave} dimulai! ${isBossWave ? '👹 BOSS WAVE!' : ''}` });
                        setBattle(db, bt, senderId, b);
                    } else {
                        // Horde selesai
                        turnResult = 'horde_complete';
                        reward = { gold: b.totalGold, exp: b.totalExp, kills: b.totalKills, loot: {} };
                        setBattle(db, bt, senderId, null);
                        logLines.push({ type: 'win', text: `🏆 HORDE SURVIVED! ${b.totalKills} monster dikalahkan!` });
                    }
                } else {
                    // Normal win
                    let gold, exp, loot;
                    if (mode === 'dungeon') {
                        gold = Math.floor(1000 + ((b.floor || 1) * 100));
                        exp  = Math.floor(500 + ((b.floor || 1) * 50));
                        loot = getRandomLoot(b.isBoss, b.floor);
                        user.dungeonFloor = (user.dungeonFloor || 1) + 1;
                        if (b.isBoss) logLines.push({ type: 'win', text: `🏆 BOSS DEFEATED! Floor ${b.floor} clear!` });
                        else logLines.push({ type: 'win', text: `✨ VICTORY Floor ${b.floor}!` });
                    } else if (mode === 'beast') {
                        // Beast phases
                        if (b.phase < b.maxPhase) {
                            b.phase++;
                            const newHp = Math.floor(b.monsterMaxHp / b.maxPhase);
                            b.monsterHp = newHp;
                            b.monsterAtk = Math.floor(b.monsterAtk * 1.2);
                            b.monsterStunned = false;
                            b.monsterAilment = null;
                            turnResult = 'next_phase';
                            logLines.push({ type: 'phase', text: `⚡ PHASE ${b.phase}/${b.maxPhase}! Ancient Beast berubah wujud!` });
                            setBattle(db, bt, senderId, b);
                        } else {
                            gold = Math.floor(b.monster.gold * 3);
                            exp  = Math.floor(b.monster.exp * 3);
                            loot = getRandomLoot(true);
                            logLines.push({ type: 'win', text: `🏆 ANCIENT BEAST DEFEATED!` });
                        }
                    } else {
                        gold = b.monster.gold;
                        exp  = b.monster.exp;
                        loot = getRandomLoot(false);
                        logLines.push({ type: 'win', text: `✨ MONSTER DEFEATED!` });
                    }

                    if (gold !== undefined) {
                        user.gold = (user.gold || 0) + gold;
                        user.exp  = (user.exp  || 0) + exp;
                        if (loot) {
                            if (!user.inventory) user.inventory = {};
                            Object.entries(loot).forEach(([k,v]) => { user.inventory[k] = (user.inventory[k] || 0) + v; });
                        }
                        reward = { gold, exp, loot };

                        if (turnResult !== 'next_phase') {
                            setBattle(db, bt, senderId, null);
                        }
                    }
                }

                // Level up check (pakai rumus EXP yang sama dengan bot WA: lvl*50, dengan penalty di atas lvl 498)
                levelUpCheck(user, logLines);

            } else if (user.hp <= 0) {
                user.hp = 20;
                turnResult = 'lose';
                logLines.push({ type: 'lose', text: `💀 DEFEATED! Kamu pingsan...` });
                setBattle(db, bt, senderId, null);
            } else {
                if (turnResult !== 'next_wave' && turnResult !== 'next_phase') {
                    setBattle(db, bt, senderId, b);
                }
            }
        }

        // Recalc final stats (tetap pertahankan buff aktif) sebelum disimpan
        refreshStats(user, b);
        // Simpan user + battle state dalam SATU write ke MongoDB supaya tidak race condition
        setUser(db, senderId, user);
        await saveRpgDB(db);

        return res.status(200).json({
            ok: true,
            turnResult,
            fleeSuccess,
            log: logLines,
            reward,
            battle: (turnResult === 'ongoing' || turnResult === 'next_wave' || turnResult === 'next_phase') ? b : null,
            user: {
                hp: user.hp, maxHp: user.maxHp,
                mana: user.mana, maxMana: user.maxMana,
                atk: user.atk, def: user.def,
                gold: user.gold, exp: user.exp,
                level: user.level,
                inventory: user.inventory,
                cooldowns: user.cooldowns,
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
