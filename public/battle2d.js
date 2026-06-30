// public/battle2d.js — Real-time 2D side-scrolling battle engine.
// Combat itself (gerak, dash, timing serang) berjalan full di client untuk
// responsivitas. Reward (gold/exp/loot) tetap dihitung server (battle-resolve.js)
// dari data monster yang sudah di-lock saat battle-start — jadi client cuma
// melaporkan HASIL, bukan jumlah reward.

const RT = (() => {
    let canvas, ctx, raf = null, running = false;
    let mode, battle, user, skills;
    let lastTs = 0;

    const ARENA_W = 760, ARENA_H = 280, GROUND_Y = 210;
    const PLAYER_SPEED = 220; // px/s baseline (dikali user.speed)
    const ATTACK_RANGE = 70;
    const ATTACK_COOLDOWN = 480;
    const DASH_COOLDOWN = 1300;
    const DASH_DURATION = 220;
    const DASH_SPEED = 620;
    const MONSTER_ATTACK_RANGE = 78;

    let player, monster, keys, touch;
    let potionsUsedThisBattle = 0;
    let skillCdEnds = {}; // skillName -> timestamp
    let particles = [];
    let floatTexts = [];
    let shakeT = 0;
    let ended = false;

    const ROLE_EMOJI = { fighter:'⚔️', mage:'🔮', assassin:'🗡️', defender:'🛡️', archer:'🏹', wraith:'💀', alchemist:'⚗️' };

    function ribu(n) { return Number(Math.floor(n || 0)).toLocaleString('id-ID'); }

    function init(mountEl, _mode, _battle, _user, _skills) {
        mode = _mode; battle = JSON.parse(JSON.stringify(_battle)); user = { ..._user }; skills = _skills || [];
        ended = false;
        potionsUsedThisBattle = 0;
        skillCdEnds = {};
        particles = []; floatTexts = []; shakeT = 0;

        mountEl.innerHTML = buildHTML();
        canvas = mountEl.querySelector('#rtCanvas');
        ctx = canvas.getContext('2d');

        player = {
            x: 120, hp: user.hp, maxHp: user.maxHp, mana: user.mana, maxMana: user.maxMana,
            facing: 1, attackCdEnd: 0, dashCdEnd: 0, dashing: false, dashEndT: 0,
            invuln: 0, defending: false, hitFlash: 0, atkAnim: 0,
        };
        monster = {
            x: ARENA_W - 160, hp: battle.monsterHp, maxHp: battle.monsterMaxHp,
            atk: battle.monsterAtk, def: battle.monsterDef || 0,
            facing: -1, attackCdEnd: performance.now() + 900, windup: 0, hitFlash: 0,
            emoji: battle.monster?.emoji || '👹', name: battle.monster?.name || 'Monster',
        };

        keys = {};
        touch = { left: false, right: false };
        bindControls(mountEl);
        renderHud();
        running = true;
        lastTs = performance.now();
        raf = requestAnimationFrame(loop);
    }

    function buildHTML() {
        const stageLabel = mode === 'beast'
            ? `Phase ${battle.phase || 1}/${battle.maxPhase || 3}`
            : mode === 'horde' ? `Wave ${battle.wave || 1}/${battle.maxWave || 10}`
            : mode === 'dungeon' ? `Floor ${battle.floor || 1}` : '';
        return `
        <div class="rt-wrap">
            <div class="rt-topbar">
                <div class="rt-stage">${stageLabel}</div>
                <div class="rt-monster-name"><span id="rtMonsterName"></span></div>
            </div>
            <div class="rt-bars">
                <div class="rt-bar-row">
                    <span class="rt-bar-label">${ROLE_EMOJI[user.role] || '⚔️'} You</span>
                    <div class="rt-bar-wrap"><div class="rt-bar rt-hp" id="rtPlayerHp"></div></div>
                    <span class="rt-bar-text" id="rtPlayerHpText"></span>
                </div>
                <div class="rt-bar-row">
                    <span class="rt-bar-label">💧</span>
                    <div class="rt-bar-wrap"><div class="rt-bar rt-mp" id="rtPlayerMp"></div></div>
                    <span class="rt-bar-text" id="rtPlayerMpText"></span>
                </div>
                <div class="rt-bar-row">
                    <span class="rt-bar-label" id="rtMonsterEmoji">👹</span>
                    <div class="rt-bar-wrap"><div class="rt-bar rt-mhp" id="rtMonsterHp"></div></div>
                    <span class="rt-bar-text" id="rtMonsterHpText"></span>
                </div>
            </div>
            <canvas id="rtCanvas" width="${ARENA_W}" height="${ARENA_H}"></canvas>
            <div class="rt-controls">
                <div class="rt-move-pad">
                    <button class="rt-btn rt-move" id="rtLeft">◀</button>
                    <button class="rt-btn rt-move" id="rtRight">▶</button>
                </div>
                <div class="rt-action-pad">
                    <button class="rt-btn rt-defend" id="rtDefend">🛡️</button>
                    <button class="rt-btn rt-dash" id="rtDash">💨</button>
                    <button class="rt-btn rt-potion" id="rtPotion">🧪<span id="rtPotionCount">0</span></button>
                    <button class="rt-btn rt-attack" id="rtAttack">⚔️</button>
                </div>
            </div>
            <div class="rt-skills" id="rtSkills"></div>
            <button class="rt-flee" id="rtFlee">🏃 Kabur</button>
        </div>`;
    }

    function bindControls(root) {
        const left = root.querySelector('#rtLeft');
        const right = root.querySelector('#rtRight');
        const onDown = (el, fn) => { ['mousedown','touchstart'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); fn(true); })); ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); fn(false); })); };
        onDown(left, v => touch.left = v);
        onDown(right, v => touch.right = v);

        root.querySelector('#rtAttack').addEventListener('click', doAttack);
        root.querySelector('#rtDash').addEventListener('click', doDash);
        root.querySelector('#rtPotion').addEventListener('click', doPotion);
        root.querySelector('#rtFlee').addEventListener('click', doFlee);
        const defendBtn = root.querySelector('#rtDefend');
        onDown(defendBtn, v => { player.defending = v; });

        renderSkillButtons(root);

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
    }

    function onKeyDown(e) {
        if (!running) return;
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
        if (e.key === ' ' || e.key === 'j') doAttack();
        if (e.key === 'Shift' || e.key === 'k') doDash();
        if (e.key === 'f') player.defending = true;
        if (e.key === 'p') doPotion();
    }
    function onKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
        if (e.key === 'f') player.defending = false;
    }

    function renderSkillButtons(root) {
        const wrap = root.querySelector('#rtSkills');
        if (!skills.length) { wrap.style.display = 'none'; return; }
        wrap.style.display = '';
        wrap.innerHTML = skills.map((s, i) => `
            <button class="rt-skill-btn" data-i="${i}">
                <span class="rt-skill-name">${s.name}</span>
                <span class="rt-skill-mana">💧${s.mana}</span>
                <span class="rt-skill-cd" data-cd="${i}"></span>
            </button>`).join('');
        wrap.querySelectorAll('.rt-skill-btn').forEach(btn => {
            btn.addEventListener('click', () => doSkill(skills[parseInt(btn.dataset.i)]));
        });
    }

    // ─── ACTIONS ───
    function doAttack() {
        if (ended) return;
        const now = performance.now();
        if (now < player.attackCdEnd) return;
        player.attackCdEnd = now + ATTACK_COOLDOWN;
        player.atkAnim = 1;

        const dist = Math.abs(monster.x - player.x);
        if (dist > ATTACK_RANGE) { return; } // swing miss, masih kena cooldown (timing matters)

        let dmg = Math.floor(user.atk * (0.9 + Math.random() * 0.3));
        const critBonus = (user.role === 'archer' && user.level >= 20) ? 0.10 : 0;
        const isCrit = Math.random() < (user.critRate + critBonus);
        const critMult = (user.role === 'assassin' && user.level >= 5) ? 2.2 : 2.0;
        if (isCrit) dmg = Math.floor(dmg * critMult);
        const mDefReduce = (user.role === 'archer' && user.level >= 5) ? 0.85 : 1.0;
        const finalDmg = Math.max(1, dmg - Math.floor(monster.def * mDefReduce));

        applyDamageToMonster(finalDmg, isCrit, '⚔️');

        if (user.role === 'wraith' && user.level >= 5) {
            const ls = Math.floor(finalDmg * 0.05);
            player.hp = Math.min(player.maxHp, player.hp + ls);
            spawnFloat(player.x, GROUND_Y - 90, `+${ls}`, '#4ade80');
        }
    }

    function doSkill(skill) {
        if (ended) return;
        const now = performance.now();
        const reqLvl = skill.reqLevel || 1;
        if (user.level < reqLvl) return spawnFloat(player.x, GROUND_Y - 100, `Lv${reqLvl} required`, '#f87171');
        if ((skillCdEnds[skill.name] || 0) > now) return;
        if ((player.mana || 0) < skill.mana) return spawnFloat(player.x, GROUND_Y - 100, 'No mana', '#60a5fa');

        player.mana -= skill.mana;
        skillCdEnds[skill.name] = now + (skill.cd || 8000);

        if (skill.heal) {
            const h = Math.floor(player.maxHp * skill.heal);
            player.hp = Math.min(player.maxHp, player.hp + h);
            spawnFloat(player.x, GROUND_Y - 100, `+${ribu(h)} HP`, '#4ade80');
        } else if (skill.buff === 'atk') { user.atk = Math.floor(user.atk * skill.power); spawnFloat(player.x, GROUND_Y - 100, 'ATK UP!', '#facc15'); }
        else if (skill.buff === 'def') { user.def = Math.floor(user.def * skill.power); spawnFloat(player.x, GROUND_Y - 100, 'DEF UP!', '#60a5fa'); }
        else if (skill.buff === 'speed') { user.speedMult = (user.speedMult || 1) * skill.power; spawnFloat(player.x, GROUND_Y - 100, 'SPEED UP!', '#a78bfa'); }
        else if (skill.damage) {
            const dist = Math.abs(monster.x - player.x);
            if (dist <= ATTACK_RANGE * 1.6) {
                let dmg = Math.floor(user.atk * skill.damage);
                if (user.role === 'mage' && user.level >= 20) dmg = Math.floor(dmg * 1.15);
                const finalDmg = Math.max(1, dmg - monster.def);
                applyDamageToMonster(finalDmg, false, '✨');
                if (skill.effect === 'stun') { monster.stunned = performance.now() + 1400; }
            } else {
                spawnFloat(player.x, GROUND_Y - 100, 'Too far!', '#f87171');
            }
        }
        player.atkAnim = 1;
    }

    function doDash() {
        if (ended) return;
        const now = performance.now();
        if (now < player.dashCdEnd) return;
        player.dashCdEnd = now + DASH_COOLDOWN;
        player.dashing = true;
        player.dashEndT = now + DASH_DURATION;
        player.invuln = now + DASH_DURATION + 80;
    }

    function doPotion() {
        if (ended) return;
        const have = (user.inventory?.potion || 0) - potionsUsedThisBattle;
        if (have < 1) return spawnFloat(player.x, GROUND_Y - 100, 'No potion', '#f87171');
        potionsUsedThisBattle++;
        const healBonus = (user.role === 'alchemist' && user.level >= 5) ? 0.25 : 0;
        const heal = Math.floor(200 * (1 + healBonus));
        player.hp = Math.min(player.maxHp, player.hp + heal);
        spawnFloat(player.x, GROUND_Y - 100, `+${heal} HP`, '#4ade80');
        updatePotionBtn();
    }

    function applyDamageToMonster(dmg, isCrit) {
        monster.hp = Math.max(0, monster.hp - dmg);
        monster.hitFlash = 1;
        shakeT = 0.15;
        spawnFloat(monster.x, GROUND_Y - 120, `${isCrit ? 'CRIT! ' : ''}-${ribu(dmg)}`, isCrit ? '#fbbf24' : '#fff');
        if (monster.hp <= 0) onMonsterDown();
    }

    function doFlee() {
        if (ended) return;
        let baseChance, speedMult;
        if (mode === 'hunt') { baseChance = 0.3; speedMult = 0.1; }
        else if (mode === 'beast') { baseChance = 0.2; speedMult = 0.08; }
        else if (mode === 'dungeon') { baseChance = battle.isBoss ? 0.2 : 0.5; speedMult = 0.1; }
        else { baseChance = battle.isBossWave ? 0.2 : 0.5; speedMult = 0.1; }
        const chance = baseChance + ((user.speed - 1) * speedMult);
        if (Math.random() < chance) {
            finish('flee');
        } else {
            spawnFloat(player.x, GROUND_Y - 100, 'Gagal kabur!', '#f87171');
        }
    }

    // ─── LOOP ───
    function loop(ts) {
        if (!running) return;
        const dt = Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;
        update(dt, ts);
        draw();
        raf = requestAnimationFrame(loop);
    }

    function update(dt, ts) {
        if (ended) return;

        // Player movement
        const moveLeft = keys.left || touch.left;
        const moveRight = keys.right || touch.right;
        let spd = PLAYER_SPEED * (user.speed || 1) * (user.speedMult || 1);
        if (player.dashing) {
            spd = DASH_SPEED;
            if (ts > player.dashEndT) player.dashing = false;
        }
        if (!player.defending) {
            if (moveLeft) { player.x -= spd * dt; player.facing = -1; }
            if (moveRight) { player.x += spd * dt; player.facing = 1; }
        }
        player.x = Math.max(20, Math.min(ARENA_W - 20, player.x));

        if (player.atkAnim > 0) player.atkAnim = Math.max(0, player.atkAnim - dt * 4);
        if (player.hitFlash > 0) player.hitFlash = Math.max(0, player.hitFlash - dt * 3);

        // Monster AI: chase + telegraphed attack
        const dist = Math.abs(monster.x - player.x);
        if (monster.hp > 0 && !(monster.stunned > ts)) {
            if (dist > MONSTER_ATTACK_RANGE) {
                const dir = player.x > monster.x ? 1 : -1;
                monster.x += dir * 150 * dt;
                monster.facing = dir;
            } else if (ts > monster.attackCdEnd && monster.windup === 0) {
                monster.windup = ts + 420; // telegraph window — player bisa dodge/defend
            }
            if (monster.windup > 0 && ts >= monster.windup) {
                monster.windup = 0;
                monster.attackCdEnd = ts + 1100 + Math.random() * 500;
                monsterAttackHit(ts);
            }
        }
        if (monster.hitFlash > 0) monster.hitFlash = Math.max(0, monster.hitFlash - dt * 3);

        // Mana regen
        const manaRegen = (user.role === 'mage' && user.level >= 5) ? player.maxMana * 0.02 : player.maxMana * 0.004;
        player.mana = Math.min(player.maxMana, player.mana + manaRegen * dt * 10);

        // particles & floats
        floatTexts.forEach(f => { f.life -= dt; f.y -= 40 * dt; });
        floatTexts = floatTexts.filter(f => f.life > 0);
        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

        renderHud();
        updateSkillCds(ts);

        if (player.hp <= 0 && !ended) finish('lose');
    }

    function monsterAttackHit(ts) {
        const dist = Math.abs(monster.x - player.x);
        if (dist > MONSTER_ATTACK_RANGE + 20) return; // player moved away in time
        if (ts < player.invuln) {
            spawnFloat(player.x, GROUND_Y - 100, 'DODGED!', '#60a5fa');
            return;
        }
        let dmg = Math.max(5, Math.floor(monster.atk - (user.def * 0.4)));
        if (player.defending) dmg = Math.floor(dmg * 0.4);
        player.hp = Math.max(0, player.hp - dmg);
        player.hitFlash = 1;
        shakeT = 0.2;
        spawnFloat(player.x, GROUND_Y - 100, `-${ribu(dmg)}`, '#f87171');

        if (user.role === 'defender' && user.level >= 5) {
            const ref = Math.floor(dmg * 0.1);
            monster.hp = Math.max(0, monster.hp - ref);
            if (monster.hp <= 0) onMonsterDown();
        }
    }

    function onMonsterDown() {
        if (ended) return;
        const isLastStage =
            (mode === 'beast' && (battle.phase || 1) >= (battle.maxPhase || 3)) ||
            (mode === 'horde' && (battle.wave || 1) >= (battle.maxWave || 10)) ||
            (mode === 'hunt' || mode === 'dungeon');
        if (isLastStage) {
            finish('final_win');
        } else {
            finish('stage_clear');
        }
    }

    function spawnFloat(x, y, text, color) {
        floatTexts.push({ x, y, text, color, life: 0.9 });
    }

    function updatePotionBtn() {
        const el = document.getElementById('rtPotionCount');
        if (el) el.textContent = Math.max(0, (user.inventory?.potion || 0) - potionsUsedThisBattle);
    }

    function updateSkillCds(ts) {
        skills.forEach((s, i) => {
            const el = document.querySelector(`.rt-skill-cd[data-cd="${i}"]`);
            if (!el) return;
            const end = skillCdEnds[s.name] || 0;
            if (end > ts) el.textContent = `⏳${Math.ceil((end - ts) / 1000)}s`;
            else el.textContent = '✅';
        });
    }

    function renderHud() {
        const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
        const mpPct = Math.max(0, Math.min(100, (player.mana / player.maxMana) * 100));
        const mhpPct = Math.max(0, Math.min(100, (monster.hp / monster.maxHp) * 100));
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = val + '%'; };
        set('rtPlayerHp', hpPct); set('rtPlayerMp', mpPct); set('rtMonsterHp', mhpPct);
        const t = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        t('rtPlayerHpText', `${ribu(player.hp)}/${ribu(player.maxHp)}`);
        t('rtPlayerMpText', `${ribu(player.mana)}/${ribu(player.maxMana)}`);
        t('rtMonsterHpText', `${ribu(monster.hp)}/${ribu(monster.maxHp)}`);
        t('rtMonsterName', monster.name);
        t('rtMonsterEmoji', monster.emoji);
        updatePotionBtn();
    }

    function draw() {
        const sx = shakeT > 0 ? (Math.random() - 0.5) * 10 * shakeT * 5 : 0;
        ctx.save();
        ctx.translate(sx, 0);
        // bg
        const grad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
        grad.addColorStop(0, '#1a1230'); grad.addColorStop(1, '#0c0818');
        ctx.fillStyle = grad; ctx.fillRect(-20, 0, ARENA_W + 40, ARENA_H);
        // ground
        ctx.fillStyle = '#241a3d'; ctx.fillRect(-20, GROUND_Y, ARENA_W + 40, ARENA_H - GROUND_Y);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        for (let i = -20; i < ARENA_W + 20; i += 40) { ctx.beginPath(); ctx.moveTo(i, GROUND_Y); ctx.lineTo(i - 15, ARENA_H); ctx.stroke(); }

        // monster
        ctx.save();
        ctx.translate(monster.x, GROUND_Y - 50);
        if (monster.windup > 0) { ctx.shadowColor = '#f87171'; ctx.shadowBlur = 25; }
        if (monster.hitFlash > 0) ctx.globalAlpha = 0.5 + 0.5 * (1 - monster.hitFlash);
        ctx.font = '64px serif';
        ctx.textAlign = 'center';
        ctx.scale(monster.facing, 1);
        ctx.fillText(monster.emoji, 0, 0);
        ctx.restore();

        // player
        ctx.save();
        ctx.translate(player.x, GROUND_Y - 45);
        if (player.invuln > performance.now()) ctx.globalAlpha = 0.6;
        if (player.hitFlash > 0) { ctx.globalAlpha = 0.5 + 0.5 * (1 - player.hitFlash); }
        const moving = keys.left || keys.right || touch.left || touch.right;
        const bob = player.dashing ? 0 : Math.sin(performance.now() / 150) * 2 * (moving ? 1 : 0.3);
        ctx.translate(0, bob);
        const scaleAtk = 1 + player.atkAnim * 0.25;
        ctx.scale(player.facing * scaleAtk, scaleAtk);
        ctx.font = '56px serif';
        ctx.textAlign = 'center';
        ctx.fillText(ROLE_EMOJI[user.role] || '🧍', 0, 0);
        ctx.restore();

        // floating texts
        floatTexts.forEach(f => {
            ctx.globalAlpha = Math.min(1, f.life);
            ctx.fillStyle = f.color;
            ctx.font = 'bold 18px Rajdhani, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(f.text, f.x, f.y);
        });
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    async function finish(event) {
        if (ended) return;
        ended = true;
        running = false;
        if (raf) cancelAnimationFrame(raf);

        try {
            const res = await fetch('/api/battle-resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: user.senderId, mode, event,
                    hp: player.hp, mana: player.mana,
                    potionsUsed: potionsUsedThisBattle,
                    skillCooldowns: skillCdEnds,
                }),
            });
            const data = await res.json();
            if (!data.ok) {
                window.removeEventListener('keydown', onKeyDown);
                window.removeEventListener('keyup', onKeyUp);
                window.onRTBattleError && window.onRTBattleError(data.error || 'Battle resolve gagal');
                return;
            }
            if (event === 'stage_clear') {
                battle = data.battle;
                ended = false; running = true;
                monster.hp = battle.monsterHp; monster.maxHp = battle.monsterMaxHp;
                monster.atk = battle.monsterAtk; monster.def = battle.monsterDef || 0;
                monster.emoji = battle.monster?.emoji || monster.emoji;
                monster.name = battle.monster?.name || monster.name;
                monster.x = ARENA_W - 160; monster.windup = 0; monster.stunned = 0;
                monster.attackCdEnd = performance.now() + 900;
                user = { ...user, ...data.user };
                player.maxHp = user.maxHp; player.maxMana = user.maxMana;
                player.hp = Math.min(player.hp, player.maxHp);
                player.mana = Math.min(player.mana, player.maxMana);
                potionsUsedThisBattle = 0;
                const stageEl = document.querySelector('.rt-stage');
                if (stageEl) stageEl.textContent = mode === 'beast' ? `Phase ${battle.phase}/${battle.maxPhase}` : `Wave ${battle.wave}/${battle.maxWave}`;
                renderHud();
                lastTs = performance.now();
                raf = requestAnimationFrame(loop);
                return;
            }
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.onRTBattleEnd && window.onRTBattleEnd(event, data);
        } catch (e) {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.onRTBattleError && window.onRTBattleError('Koneksi error');
        }
    }

    function destroy() {
        running = false; ended = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    }

    return { init, destroy };
})();
