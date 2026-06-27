/* ══════════════════════════════════════
   MIWA RPG BATTLE — FRONTEND APP
   app.js
══════════════════════════════════════ */

// ─── STATE ───
let currentUser    = null;
let currentBattle  = null;
let currentMode    = null;
let unlockedSkills = [];
let isProcessing   = false;

// ─── DOM SHORTCUTS ───
const $ = id => document.getElementById(id);

// ─── STATUS BAR ───
function setStatus(msg, state = 'idle') {
    $('statusText').textContent = msg;
    const dot = $('statusDot');
    dot.className = 'status-dot';
    if (state === 'active')  dot.classList.add('active');
    if (state === 'error')   dot.classList.add('error');
    if (state === 'warn')    dot.classList.add('warn');
}

// ─── LOAD CHARACTER ───
async function loadCharacter() {
    const raw = $('senderIdInput').value.trim();
    // Normalize: strip @s.whatsapp.net if user pasted it
    const senderId = raw.replace('@s.whatsapp.net', '').replace(/\s/g, '');
    if (!senderId) { showError('ID tidak boleh kosong!'); return; }

    setStatus('Memuat karakter...', 'active');
    $('loginBtn').disabled = true;

    try {
        const res = await fetch(`/api/character?id=${encodeURIComponent(senderId)}`);
        const data = await res.json();
        if (!data.ok) { showError(data.error); $('loginBtn').disabled = false; return; }

        currentUser    = data.user;
        unlockedSkills = data.unlockedSkills || [];

        localStorage.setItem('rpg_sender_id', senderId);

        hideError();
        showDashboard(data);
        setStatus('Karakter dimuat!', 'active');
    } catch (e) {
        showError('Gagal terhubung ke server. Coba lagi.');
        $('loginBtn').disabled = false;
        setStatus('Koneksi gagal', 'error');
    }
}

function showError(msg) {
    const el = $('loginError');
    el.textContent = '❌ ' + msg;
    el.style.display = 'block';
    $('senderIdInput').classList.add('shake');
    setTimeout(() => $('senderIdInput').classList.remove('shake'), 400);
}

function hideError() {
    $('loginError').style.display = 'none';
}

// ─── SHOW DASHBOARD ───
function showDashboard(data) {
    $('loginSection').style.display    = 'none';
    $('dashboardSection').style.display = '';
    $('battleSection').style.display   = 'none';

    const u = data.user;
    const ri = data.roleInfo || {};

    $('charRoleBadge').textContent = ri.emoji || '⚔️';
    $('charName').textContent      = `${ri.name || u.role?.toUpperCase() || '?'} #${u.senderId?.slice(0, 6)}`;
    $('charLevel').textContent     = `Level ${u.level} · ${u.exp} EXP`;

    updateCharStats(u);

    // Skills card
    if (unlockedSkills.length > 0) {
        $('skillsCard').style.display = '';
        renderSkillsList(unlockedSkills, u);
    }

    // Check existing battles
    const battles = data.battles;
    let hasActive = false;
    for (const [mode, b] of Object.entries(battles)) {
        if (b) {
            hasActive = true;
            setStatus(`⚔️ Pertarungan ${mode} aktif! Lanjutkan...`, 'warn');
            // Auto-resume battle
            setTimeout(() => resumeBattle(mode, b, u), 800);
            break;
        }
    }
    if (!hasActive) setStatus('Pilih mode battle untuk mulai!', 'active');
}

function updateCharStats(u) {
    const hpPct   = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
    const manaPct = Math.max(0, Math.min(100, (u.mana / u.maxMana) * 100));

    $('hpBar').style.width   = hpPct + '%';
    $('manaBar').style.width = manaPct + '%';
    $('hpBar').dataset.low   = hpPct < 30 ? 'true' : 'false';
    $('hpVal').textContent   = `${fmt(u.hp)}/${fmt(u.maxHp)}`;
    $('manaVal').textContent = `${fmt(u.mana)}/${fmt(u.maxMana)}`;

    $('statAtk').textContent  = fmt(u.atk);
    $('statDef').textContent  = fmt(u.def);
    $('statSpd').textContent  = (u.speed || 1).toFixed(1);
    $('statCrit').textContent = Math.round((u.critRate || 0) * 100) + '%';
    $('statGold').textContent = fmt(u.gold);
    $('statExp').textContent  = fmt(u.exp);
}

function renderSkillsList(skills, u) {
    const now = Date.now();
    $('skillsList').innerHTML = skills.map(s => {
        const cdEnd = (u.cooldowns?.[s.name] || 0);
        const onCd  = now < cdEnd;
        const cdSec = onCd ? Math.ceil((cdEnd - now) / 1000) : 0;
        return `
        <div class="skill-row">
          <div style="flex:1">
            <div class="skill-name">✨ ${s.name}</div>
            <div class="skill-desc">${s.description || ''}</div>
          </div>
          <div class="skill-mana">💧${s.mana}MP</div>
          ${onCd ? `<div class="skill-cd">⏳${cdSec}s</div>` : `<div class="skill-cd skill-ready">✅</div>`}
        </div>`;
    }).join('');
}

// ─── START BATTLE ───
async function startBattle(mode) {
    if (isProcessing) return;
    isProcessing = true;
    setStatus(`Memulai ${mode} battle...`, 'active');

    // Disable all mode buttons
    document.querySelectorAll('.mode-btn').forEach(b => b.disabled = true);

    try {
        const senderId = currentUser.senderId;
        const res = await fetch('/api/battle-start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId, mode })
        });
        const data = await res.json();
        if (!data.ok) {
            setStatus('❌ ' + data.error, 'error');
            document.querySelectorAll('.mode-btn').forEach(b => b.disabled = false);
            isProcessing = false;
            return;
        }

        currentBattle = data.battle;
        currentMode   = mode;
        showBattle();
        isProcessing = false;
    } catch (e) {
        setStatus('Gagal memulai battle', 'error');
        document.querySelectorAll('.mode-btn').forEach(b => b.disabled = false);
        isProcessing = false;
    }
}

function resumeBattle(mode, battle, user) {
    currentBattle = battle;
    currentMode   = mode;
    if (user) currentUser = { ...currentUser, ...user };
    showBattle();
}

// ─── SHOW BATTLE UI ───
function showBattle() {
    $('loginSection').style.display    = 'none';
    $('dashboardSection').style.display = 'none';
    $('battleSection').style.display   = '';
    $('backBtn').style.display         = 'none';
    $('battleSection').querySelector('.result-overlay')?.remove();

    const b    = currentBattle;
    const u    = currentUser;
    const mode = currentMode;

    const modeLabels = {
        hunt: '🗡️ MONSTER HUNT',
        dungeon: '🏰 DUNGEON',
        beast: '🐉 ANCIENT BEAST',
        horde: '👹 HORDE INVASION',
    };

    $('battleModeTag').textContent = modeLabels[mode] || mode.toUpperCase();
    $('battleTurn').textContent    = `Turn ${b.turn || 1}`;

    // Monster
    $('monsterEmoji').textContent  = b.monster?.emoji || '👹';
    $('monsterName').textContent   = b.monster?.name || '???';
    $('monsterStatus').textContent = b.isBoss ? '⚠️ BOSS' : (b.isBossWave ? '⚠️ BOSS WAVE' : '');

    if (mode === 'beast' && b.maxPhase) {
        $('monsterPhase').style.display = '';
        $('monsterPhase').textContent   = `Phase ${b.phase || 1}/${b.maxPhase}`;
    } else if (mode === 'horde') {
        $('monsterPhase').style.display = '';
        $('monsterPhase').textContent   = `Wave ${b.wave || 1}/${b.maxWave || 10}`;
    } else {
        $('monsterPhase').style.display = 'none';
    }

    updateMonsterHp(b.monsterHp, b.monsterMaxHp);
    updatePlayerStats(u);

    // Player role emoji
    const ROLE_EMOJI = { fighter:'⚔️', mage:'🔮', assassin:'🗡️', defender:'🛡️', archer:'🏹', wraith:'💀', alchemist:'⚗️' };
    $('playerRoleTag').textContent = ROLE_EMOJI[u.role] || '⚔️';

    // Skills in battle
    renderBattleSkills(u);

    // Potion count
    updatePotionCount(u);

    // Clear log
    $('battleLog').innerHTML = `<div class="log-entry log-system">⚔️ ${b.monster?.name || 'Musuh'} muncul! Pilih aksimu...</div>`;

    setStatus(`Battle ${currentMode} aktif!`, 'active');
    enableActions(true);
}

function updateMonsterHp(hp, maxHp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    $('monsterHpBar').style.width = pct + '%';
    $('monsterHpText').textContent = `${fmt(Math.max(0, hp))} / ${fmt(maxHp)} HP`;
}

function updatePlayerStats(u) {
    const hpPct   = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
    const manaPct = Math.max(0, Math.min(100, (u.mana / u.maxMana) * 100));

    $('battleHpBar').style.width   = hpPct + '%';
    $('battleHpBar').dataset.low   = hpPct < 30 ? 'true' : 'false';
    $('battleManaBar').style.width = manaPct + '%';
    $('battleHpText').textContent   = `❤️ ${fmt(u.hp)}/${fmt(u.maxHp)}`;
    $('battleManaText').textContent = `💧 ${fmt(u.mana)}/${fmt(u.maxMana)}`;

    // HP pulse at low HP
    const playerCard = document.querySelector('.player-battle-card');
    if (hpPct < 25) playerCard?.classList.add('hp-low-pulse');
    else playerCard?.classList.remove('hp-low-pulse');
}

function updatePotionCount(u) {
    const count = u.inventory?.potion || 0;
    $('potionCount').textContent = `Potion (${count})`;
    $('potionBtn').disabled = count < 1;
}

function renderBattleSkills(u) {
    if (!unlockedSkills || unlockedSkills.length === 0) {
        $('battleSkillsSection').style.display = 'none';
        return;
    }

    $('battleSkillsSection').style.display = '';
    const now = Date.now();
    $('battleSkillsRow').innerHTML = unlockedSkills.map(s => {
        const cdEnd  = (u.cooldowns?.[s.name] || 0);
        const onCd   = now < cdEnd;
        const cdSec  = onCd ? Math.ceil((cdEnd - now) / 1000) : 0;
        const noMana = (u.mana || 0) < s.mana;
        const dis    = onCd || noMana;
        const cdText = onCd ? `<span class="skill-btn-cd">⏳ ${cdSec}s</span>`
                      : noMana ? `<span class="skill-btn-cd">💧 ${s.mana}MP</span>`
                      : `<span class="skill-btn-ready">✅ READY</span>`;
        return `
        <button class="skill-btn" onclick="doSkill('${s.name}')" ${dis ? 'disabled' : ''}>
          <span class="skill-btn-name">
            ✨ ${s.name}
            <span class="skill-btn-desc">${s.description || ''}</span>
          </span>
          <span class="skill-btn-mana">💧${s.mana}</span>
          ${cdText}
        </button>`;
    }).join('');
}

// ─── DO ACTIONS ───
async function doAction(action, skillName = null) {
    if (isProcessing) return;
    if (!currentBattle || !currentUser) return;

    isProcessing = true;
    enableActions(false);
    setStatus('Menghitung giliran...', 'active');

    try {
        const res = await fetch('/api/battle-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: currentUser.senderId,
                mode: currentMode,
                action,
                skillName,
            })
        });
        const data = await res.json();

        if (!data.ok) {
            addLog('system', '❌ ' + data.error);
            enableActions(true);
            isProcessing = false;
            setStatus('Aksi gagal: ' + data.error, 'error');
            return;
        }

        // Update user state
        currentUser = { ...currentUser, ...data.user };
        if (data.battle) currentBattle = data.battle;

        // Render log
        if (data.log) data.log.forEach(l => addLog(l.type, l.text));

        // Update UI
        updatePlayerStats(currentUser);
        updatePotionCount(currentUser);
        renderBattleSkills(currentUser);

        if (data.battle) {
            updateMonsterHp(data.battle.monsterHp, data.battle.monsterMaxHp);
            $('battleTurn').textContent = `Turn ${data.battle.turn || 1}`;

            // Update phase / wave
            if (currentMode === 'beast' && data.battle.maxPhase) {
                $('monsterPhase').textContent = `Phase ${data.battle.phase || 1}/${data.battle.maxPhase}`;
            }
            if (currentMode === 'horde') {
                $('monsterPhase').textContent = `Wave ${data.battle.wave || 1}/${data.battle.maxWave || 10}`;
                $('monsterEmoji').textContent = data.battle.monster?.emoji || '👹';
                $('monsterName').textContent  = data.battle.monster?.name  || '???';
                $('monsterStatus').textContent = data.battle.isBossWave ? '⚠️ BOSS WAVE' : '';
            }
        }

        // Handle result
        switch (data.turnResult) {
            case 'win':
                showResult('win', data.reward);
                break;
            case 'lose':
                showResult('lose', null);
                break;
            case 'flee':
                showResult('flee', null);
                break;
            case 'horde_complete':
                showResult('horde_complete', data.reward);
                break;
            case 'next_wave':
            case 'next_phase':
                enableActions(true);
                setStatus(`${currentMode} battle berlanjut!`, 'active');
                break;
            default:
                enableActions(true);
                setStatus('Giliranmu!', 'active');
        }

        isProcessing = false;
    } catch (e) {
        addLog('system', '❌ Koneksi error. Coba lagi.');
        enableActions(true);
        isProcessing = false;
        setStatus('Error koneksi', 'error');
    }
}

function doSkill(skillName) {
    doAction('skill', skillName);
}

// ─── BATTLE LOG ───
function addLog(type, text) {
    const log  = $('battleLog');
    const div  = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

// ─── ENABLE/DISABLE ACTIONS ───
function enableActions(enabled) {
    document.querySelectorAll('.action-btn').forEach(b => {
        // Keep potion disabled if 0 potions regardless
        if (b.id === 'potionBtn') {
            b.disabled = !enabled || (currentUser?.inventory?.potion || 0) < 1;
        } else {
            b.disabled = !enabled;
        }
    });
    document.querySelectorAll('.skill-btn').forEach(b => b.disabled = !enabled);
}

// ─── SHOW RESULT ───
function showResult(type, reward) {
    enableActions(false);
    $('backBtn').style.display = '';

    const isWin = type === 'win' || type === 'horde_complete';

    let titleText = '💀 DEFEATED!';
    if (type === 'win') titleText = '🏆 VICTORY!';
    if (type === 'horde_complete') titleText = '🏆 HORDE SURVIVED!';
    if (type === 'flee') titleText = '🏃 ESCAPED!';

    let rewardHTML = '';
    if (reward) {
        rewardHTML += `<div class="result-rewards">`;
        if (reward.gold) rewardHTML += `<div>🪙 +${fmt(reward.gold)} Gold</div>`;
        if (reward.exp)  rewardHTML += `<div>✨ +${fmt(reward.exp)} EXP</div>`;
        if (reward.kills) rewardHTML += `<div>⚔️ ${reward.kills} Monster Killed</div>`;
        rewardHTML += `</div>`;

        if (reward.loot && Object.keys(reward.loot).length > 0) {
            rewardHTML += `<div class="result-loot"><b>📦 Loot Drop:</b><br>`;
            Object.entries(reward.loot).forEach(([k,v]) => {
                rewardHTML += `&nbsp;&nbsp;${v}x ${k.replace(/_/g, ' ')}<br>`;
            });
            rewardHTML += `</div>`;
        }
    }

    const overlay = document.createElement('div');
    overlay.className = `result-overlay ${isWin ? 'result-win' : 'result-lose'}`;
    overlay.innerHTML = `
        <div class="result-title">${titleText}</div>
        ${rewardHTML}
    `;
    $('battleSection').insertBefore(overlay, $('backBtn'));

    currentBattle = null;
    setStatus(isWin ? 'Kamu menang! 🏆' : (type === 'flee' ? 'Berhasil kabur!' : 'Kamu kalah...'), isWin ? 'active' : 'warn');
}

// ─── END BATTLE / BACK ───
async function endBattle() {
    // Refresh character from server then go to dashboard
    try {
        setStatus('Memuat karakter...', 'active');
        const res  = await fetch(`/api/character?id=${encodeURIComponent(currentUser.senderId)}`);
        const data = await res.json();
        if (data.ok) {
            currentUser    = data.user;
            unlockedSkills = data.unlockedSkills || [];
            showDashboard(data);
        } else {
            showDashboard({ user: currentUser, roleInfo: null, unlockedSkills, battles: {} });
        }
    } catch {
        showDashboard({ user: currentUser, roleInfo: null, unlockedSkills, battles: {} });
    }
    currentBattle = null;
    currentMode   = null;
}

// ─── LOGOUT ───
function logout() {
    currentUser    = null;
    currentBattle  = null;
    currentMode    = null;
    unlockedSkills = [];
    localStorage.removeItem('rpg_sender_id');
    $('loginSection').style.display    = '';
    $('dashboardSection').style.display = 'none';
    $('battleSection').style.display   = 'none';
    $('loginBtn').disabled = false;
    $('senderIdInput').value = '';
    setStatus('Masukkan ID WhatsApp untuk memulai...');
}

// ─── HELPERS ───
function fmt(n) {
    return Number(Math.floor(n || 0)).toLocaleString('id-ID');
}

// ─── AUTO-LOGIN (from localStorage) ───
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('rpg_sender_id');
    if (saved) {
        $('senderIdInput').value = saved;
        setTimeout(loadCharacter, 300);
    }
});

// ─── ENTER KEY on input ───
document.addEventListener('DOMContentLoaded', () => {
    $('senderIdInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') loadCharacter();
    });
});

