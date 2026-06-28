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

    // Safety net: tombol mode battle harus selalu enabled saat di lobby,
    // kalau tidak ada battle aktif lain yang sedang di-resume.
    document.querySelectorAll('.mode-btn').forEach(b => b.disabled = false);

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

    // Sinkronkan cooldown life-skill dari server (supaya tidak hilang saat refresh)
    syncAllCooldowns(u);
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
        document.querySelectorAll('.mode-btn').forEach(b => b.disabled = false);
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
let battleCdTimer = null;

function showBattle() {
    if (battleCdTimer) { clearInterval(battleCdTimer); battleCdTimer = null; }
    $('loginSection').style.display    = 'none';
    $('dashboardSection').style.display = 'none';
    $('battleSection').style.display   = '';
    $('backBtn').style.display         = 'none';
    $('battleSection').querySelector('.result-overlay')?.remove();
    // Reset semua tombol action agar tidak stuck disabled dari battle sebelumnya
    document.querySelectorAll('.action-btn').forEach(b => b.disabled = false);

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

    // ─── Live CD countdown untuk skill di battle ───
    battleCdTimer = setInterval(() => {
        if (!currentUser || !currentBattle) return;
        const now2 = Date.now();
        document.querySelectorAll('#battleSkillsRow .skill-btn').forEach(btn => {
            const cdSpan = btn.querySelector('.skill-btn-cd');
            if (!cdSpan) return;
            const match = cdSpan.textContent.match(/(\d+)s/);
            if (!match) return;
            const skillNameEl = btn.querySelector('.skill-btn-name');
            if (!skillNameEl) return;
            const sName = skillNameEl.childNodes[0]?.textContent?.replace('✨ ', '').trim();
            if (!sName) return;
            const cdEnd = currentUser.cooldowns?.[sName] || 0;
            const remaining = Math.ceil((cdEnd - now2) / 1000);
            if (remaining <= 0) {
                // CD habis — re-render skills
                renderBattleSkills(currentUser);
                if (!isProcessing) enableActions(true);
            } else {
                cdSpan.textContent = `⏳ ${remaining}s`;
            }
        });
    }, 1000);
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
        } else if (data.finalMonsterHp !== undefined && data.finalMonsterMaxHp) {
            // Battle sudah selesai (win/lose/flee/horde_complete) — backend tidak
            // mengirim battle state lagi, tapi server tetap kirim HP final yang
            // benar (0 saat menang) supaya bar tidak nyangkut di angka sebelumnya.
            updateMonsterHp(data.finalMonsterHp, data.finalMonsterMaxHp);
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
    isProcessing = false;  // Reset agar battle berikutnya bisa dimulai
    if (battleCdTimer) { clearInterval(battleCdTimer); battleCdTimer = null; }
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

// ════════════════════════════════════════
//  LIFE SKILLS — Mining / Woodcut / Fishing
// ════════════════════════════════════════
const GATHER_LABEL = {
    mine: { icon: '⛏️', iconClass: 'act-mine', actionEmoji: '🪨', title: 'Mining', color: '#8d6e63', color2: '#bca08f', cd: 60,
        steps: ['Mencari urat batu...', 'Menambang dengan pickaxe...', 'Mengumpulkan hasil...'] },
    chop: { icon: '🪓', iconClass: 'act-chop', actionEmoji: '🌳', title: 'Woodcut', color: '#4a8f4f', color2: '#7fc384', cd: 45,
        steps: ['Mendekati pohon...', 'Menebang dengan kapak...', 'Mengumpulkan kayu...'] },
    fish: { icon: '🎣', iconClass: 'act-fish', actionEmoji: '🐟', title: 'Fishing', color: '#2f8fc2', color2: '#6fc3ef', cd: 30,
        steps: ['Melempar kail...', 'Menunggu sambaran...', 'Menarik hasil tangkapan!'] },
};
// Tombol mine/chop/fish HARUS dianggap terkunci sampai cooldown-nya berhasil
// disinkronkan dari server (lihat syncGatherCooldowns). Tanpa flag ini, ada celah
// waktu di mana tombol sempat ke-render "bisa dipencet" sebelum sync jalan.
let gatherBusy = { mine: true, chop: true, fish: true };
const gatherTimers = {};
const GATHER_LAST_FIELD = { mine: 'lastMining', chop: 'lastWood', fish: 'lastFish' };
const GATHER_BTN_ID   = { mine: 'btnMine', chop: 'btnChop', fish: 'btnFish' };
const GATHER_LABEL_ID = { mine: 'cdMine', chop: 'cdChop', fish: 'cdFish' };
const GATHER_IDLE_TEXT = { mine: 'Butuh Pickaxe', chop: 'Butuh Axe', fish: 'Butuh Fishing Rod' };

function senderId() { return currentUser?.senderId; }

// Dipanggil setiap kali karakter di-load (termasuk setelah refresh) supaya
// cooldown mine/chop/fish tetap akurat berdasarkan timestamp dari server,
// bukan cuma timer JS yang ke-reset waktu page reload. Sebelum fungsi ini
// jalan, tombol selalu dianggap locked (lihat default gatherBusy di atas)
// supaya tidak ada window di mana tombol bisa dipencet padahal masih CD.
function syncGatherCooldowns(u) {
    const now = Date.now();
    Object.entries(GATHER_LABEL).forEach(([type, info]) => {
        const last = u[GATHER_LAST_FIELD[type]] || 0;
        const cdMs = info.cd * 1000;
        const elapsed = now - last;
        if (last && elapsed < cdMs) {
            const secondsLeft = Math.ceil((cdMs - elapsed) / 1000);
            startGatherCooldown(type, secondsLeft);
        } else {
            gatherBusy[type] = false;
            const btn = $(GATHER_BTN_ID[type]);
            const label = $(GATHER_LABEL_ID[type]);
            if (btn) btn.disabled = false;
            if (label) label.textContent = GATHER_IDLE_TEXT[type];
        }
    });
}

const REWARD_EMOJI = {
    stone: '🪨', coal: '⚫', copper: '🟠', iron: '⛓️', silver: '⚪', gold_ore: '🟡',
    mythril: '💠', sapphire: '🔷', ruby: '🔺', emerald: '🟢', diamond: '💎', obsidian_ore: '⬛',
    wood: '🪵', leaf: '🍃', apple: '🍎', mango: '🥭', blueberry: '🫐', nest: '🪺', maple_syrup: '🍯',
    lele: '🐟', nila: '🐟', mujair: '🐟', gurame: '🐠', salmon: '🐟', tuna: '🐟',
    hiu: '🦈', paus: '🐳', leviathan: '🐉', trash: '🗑️',
};

async function doGather(type) {
    if (!currentUser) return;
    if (gatherBusy[type]) return;
    const info = GATHER_LABEL[type];
    const btn  = $(GATHER_BTN_ID[type]);
    btn.disabled = true;
    gatherBusy[type] = true; // lock optimis selagi request berjalan, sebelum CD asli diset

    const overlay = showActivityAnim({
        icon: info.icon, iconClass: info.iconClass, title: info.title,
        color: info.color, color2: info.color2, duration: 2.2,
        steps: info.steps,
    });

    try {
        const res = await fetch('/api/gather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), type }),
        });
        const data = await res.json();

        await new Promise(r => setTimeout(r, 2200));

        if (!data.ok) {
            closeActivityAnim(overlay);
            showLifeLog(`❌ ${data.error}`);
            if (data.cooldownLeft) {
                startGatherCooldown(type, data.cooldownLeft);
            } else {
                gatherBusy[type] = false;
                btn.disabled = false;
            }
            return;
        }

        if (data.empty) {
            if (data.user) currentUser = { ...currentUser, ...data.user };
            showActivityResult(overlay, {
                isRare: false,
                rows: [{ label: `${info.icon} ${info.title}`, val: 'Tidak ada hasil' }],
            });
            showLifeLog(`${info.icon} ${data.message}`);
        } else {
            currentUser = { ...currentUser, ...data.user };
            updateCharStats(currentUser);
            $('charLevel').textContent = `Level ${currentUser.level} · ${currentUser.exp} EXP`;

            const lvlUp = data.levelUpLog?.length ? `🎉 LEVEL UP! → Lv${currentUser.level}` : null;
            showActivityResult(overlay, {
                isRare: data.rewards.length > 1,
                rows: [
                    ...data.rewards.map(r => ({
                        label: `${REWARD_EMOJI[r.key] || info.actionEmoji} ${r.name}`,
                        val: `+${r.amount}x`,
                        float: REWARD_EMOJI[r.key] || info.actionEmoji,
                    })),
                    { label: '✨ EXP', val: `+${data.expText}`, cls: 'green', float: '✨' },
                ],
                levelUp: lvlUp,
            });

            const lines = data.rewards.map(r => `+${r.amount}x ${r.name}`).join(', ');
            let html = `${info.icon} <b>${info.title}</b> — ${lines}<br>✨ Exp ${data.expText}`;
            if (data.durability?.msg) html += `<br><span class="warn-text">${data.durability.msg}</span>`;
            if (data.levelUpLog?.length) html += `<br>⭐ ${data.levelUpLog.map(l => l.text).join(' ')}`;
            showLifeLog(html);
        }

        // Cooldown SELALU dipasang dari nilai yang dikirim server, supaya tombol
        // langsung terkunci sesaat hasil keluar (tidak ada celah bisa dobel-klik).
        startGatherCooldown(type, Math.floor((data.cooldown || info.cd * 1000) / 1000));
    } catch (e) {
        closeActivityAnim(overlay);
        showLifeLog('❌ Gagal terhubung ke server.');
        gatherBusy[type] = false;
        btn.disabled = false;
    }
}

function startGatherCooldown(type, seconds) {
    gatherBusy[type] = true;
    const btn = $(GATHER_BTN_ID[type]);
    const label = $(GATHER_LABEL_ID[type]);
    btn.disabled = true;
    let left = seconds;

    if (gatherTimers[type]) clearInterval(gatherTimers[type]);
    label.textContent = `⏳ ${left}s`;
    gatherTimers[type] = setInterval(() => {
        left--;
        if (left <= 0) {
            clearInterval(gatherTimers[type]);
            gatherBusy[type] = false;
            btn.disabled = false;
            label.textContent = GATHER_IDLE_TEXT[type];
        } else {
            label.textContent = `⏳ ${left}s`;
        }
    }, 1000);
}

function showLifeLog(html) {
    const box = $('lifeLog');
    box.style.display = '';
    box.innerHTML = `<div class="log-entry log-system">${html}</div>` + box.innerHTML;
}

// ════════════════════════════════════════
//  FARMING
// ════════════════════════════════════════
function toggleFarmPanel() {
    const panel = $('farmPanel');
    const willShow = panel.style.display === 'none';
    panel.style.display = willShow ? '' : 'none';
    if (willShow) loadFarm();
}

async function loadFarm() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/farm?id=${encodeURIComponent(senderId())}`);
        const data = await res.json();
        if (!data.ok) { $('farmPlotsView').innerHTML = `<div class="error-text">${data.error}</div>`; return; }
        renderFarm(data.farm);
    } catch (e) {
        $('farmPlotsView').innerHTML = `<div class="error-text">Gagal memuat lahan.</div>`;
    }
}

function renderFarm(farm) {
    const select = $('plantSelect');
    if (select.options.length === 0) {
        Object.entries(farm.plantTable).forEach(([key, p]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${key} (${Math.floor(p.time / 60000)}m)`;
            select.appendChild(opt);
        });
    }

    if (farm.farmPlots === 0) {
        $('farmPlotsView').innerHTML = `<div class="error-text">Belum punya lahan. Beli di shop bot WA dulu.</div>`;
        return;
    }

    let html = '';
    farm.plots.forEach(p => {
        html += `<div class="farm-plot"><b>Lahan ${p.plot}</b>`;
        if (p.slots.length === 0) html += `<div class="farm-slot-empty">📭 Siap ditanami</div>`;
        p.slots.forEach(s => {
            html += `<div class="farm-slot">
                <span>${s.type.toUpperCase()} x${s.amount}</span>
                <div class="farm-progress"><div class="farm-progress-fill" style="width:${s.progress}%"></div></div>
                ${s.ready
                    ? `<button class="btn-small" onclick="doHarvest(${p.plot},${s.slot})">🧺 Panen</button>`
                    : `<span class="farm-pct">${s.progress}%</span>`}
            </div>`;
        });
        html += `</div>`;
    });
    $('farmPlotsView').innerHTML = html;
}

async function doPlant() {
    const plantType = $('plantSelect').value;
    const amount = parseInt($('plantAmount').value) || 1;
    try {
        const res = await fetch('/api/farm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), action: 'plant', plantType, amount }),
        });
        const data = await res.json();
        if (!data.ok) { showLifeLog(`❌ ${data.error}`); return; }
        showLifeLog(`🌱 Ditanam: ${amount}x ${plantType} di Lahan ${data.plot} (siap dalam ${data.durationMin} menit)`);
        renderFarm(data.farm);
    } catch (e) { showLifeLog('❌ Gagal menanam.'); }
}

async function doHarvest(plot, slot) {
    try {
        const res = await fetch('/api/farm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), action: 'harvest', plot, slot }),
        });
        const data = await res.json();
        if (!data.ok) { showLifeLog(`❌ ${data.error}`); return; }
        const lines = Object.entries(data.harvested).map(([k, v]) => `+${v}x ${k}`).join(', ');
        showLifeLog(`🧺 Panen: ${lines} (✨ +${data.totalExp} EXP)`);
        renderFarm(data.farm);
    } catch (e) { showLifeLog('❌ Gagal memanen.'); }
}

async function doHarvestAll() {
    try {
        const res = await fetch('/api/farm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), action: 'harvestAll' }),
        });
        const data = await res.json();
        if (!data.ok) { showLifeLog(`❌ ${data.error}`); return; }
        const lines = Object.entries(data.harvested).map(([k, v]) => `+${v}x ${k}`).join(', ');
        showLifeLog(`🧺 Panen Raya: ${lines} (✨ +${data.totalExp} EXP, ${data.count} slot)`);
        renderFarm(data.farm);
    } catch (e) { showLifeLog('❌ Gagal memanen.'); }
}

// ════════════════════════════════════════
//  ACTIVITY ANIMATION ENGINE
// ════════════════════════════════════════

function showActivityAnim({ icon, iconClass, title, color, color2, steps, duration }) {
    // Remove old overlay if any
    document.getElementById('actOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'actOverlay';
    overlay.innerHTML = `
        <div class="act-panel" style="--act-color:${color};--act-color2:${color2||color};--act-duration:${duration||2.4}s">
            <div class="act-icon-wrap"><span class="act-icon${iconClass ? ' ' + iconClass : ''}">${icon}</span></div>
            <div class="act-title">${title}</div>
            <div class="act-progress-wrap"><div class="act-progress-bar"></div></div>
            <div class="act-steps" id="actSteps"></div>
        </div>`;
    document.body.appendChild(overlay);

    // Animate steps
    const stepsEl = document.getElementById('actSteps');
    const stepDelay = (duration * 1000) / (steps.length + 1);
    steps.forEach((text, i) => {
        const div = document.createElement('div');
        div.className = 'act-step';
        div.style.animationDelay = `${stepDelay * i}ms`;
        div.innerHTML = `<div class="act-step-dot"></div><span>${text}</span>`;
        stepsEl.appendChild(div);

        setTimeout(() => {
            div.classList.add('active');
            // Mark previous as done
            if (i > 0) stepsEl.children[i-1].classList.remove('active');
            if (i > 0) stepsEl.children[i-1].classList.add('done');
        }, stepDelay * i);
    });
    // Mark last step done at end
    setTimeout(() => {
        const last = stepsEl.lastElementChild;
        if (last) { last.classList.remove('active'); last.classList.add('done'); }
    }, stepDelay * steps.length);

    return overlay;
}

function showActivityResult(overlay, { isRare, rows, levelUp }) {
    const panel = overlay.querySelector('.act-panel');

    // Build result HTML
    const resultEl = document.createElement('div');
    resultEl.className = `act-result${isRare ? ' rare' : ''}`;
    resultEl.innerHTML = `<div class="act-result-title">✦ HASIL ✦</div>` +
        rows.map(r => `<div class="act-result-row"><span>${r.label}</span><span class="val ${r.cls||''}">${r.val}</span></div>`).join('');
    if (levelUp) {
        const lvlEl = document.createElement('div');
        lvlEl.className = 'act-levelup';
        lvlEl.textContent = levelUp;
        resultEl.appendChild(lvlEl);
    }
    panel.appendChild(resultEl);

    // Sparkles if rare
    if (isRare) {
        ['✨','⭐','💫','🌟'].forEach((s, i) => {
            const sp = document.createElement('div');
            sp.className = 'act-sparkle';
            sp.textContent = s;
            sp.style.cssText = `left:${15+i*22}%;top:${20+Math.sin(i)*30}%;animation-delay:${i*0.15}s`;
            resultEl.appendChild(sp);
        });
    }

    // Float-up reward emojis
    const floatEmojis = rows.filter(r => r.float).map(r => r.float);
    floatEmojis.forEach((em, i) => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'act-float';
            el.textContent = em;
            el.style.cssText = `left:${30 + i*18}vw; top:65vh;`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }, i * 120);
    });

    // Close on tap after showing result
    overlay.addEventListener('click', () => closeActivityAnim(overlay), { once: true });
}

function closeActivityAnim(overlay) {
    if (!overlay) return;
    overlay.classList.add('closing');
    setTimeout(() => overlay?.remove(), 320);
}

// ════════════════════════════════════════
//  EXPLORE
// ════════════════════════════════════════
let exploreCoolTimer = null;
const EXPLORE_CD_MS = 120000;

function syncExploreCooldown(user) {
    const last = user.lastExplore || 0;
    const sisa = EXPLORE_CD_MS - (Date.now() - last);
    const btn  = $('btnExplore');
    if (!btn) return;
    clearInterval(exploreCoolTimer);
    if (sisa <= 0) {
        btn.disabled = false;
        btn.innerHTML = '<div class="mode-icon">🌍</div><div class="mode-name">Explore</div><div class="mode-desc">CD: 2 menit</div>';
        return;
    }
    btn.disabled = true;
    const tick = () => {
        const s = Math.ceil((EXPLORE_CD_MS - (Date.now() - last)) / 1000);
        if (s <= 0) { clearInterval(exploreCoolTimer); btn.disabled = false; btn.innerHTML = '<div class="mode-icon">🌍</div><div class="mode-name">Explore</div><div class="mode-desc">CD: 2 menit</div>'; }
        else btn.innerHTML = `<div class="mode-icon">⏳</div><div class="mode-name">Explore</div><div class="mode-desc">CD: ${s}s</div>`;
    };
    tick();
    exploreCoolTimer = setInterval(tick, 1000);
}

async function doExplore() {
    if (!currentUser) return;
    const btn = $('btnExplore');
    btn.disabled = true;

    const overlay = showActivityAnim({
        icon: '🌍', title: 'Menjelajahi Dunia',
        color: '#38a89d', color2: '#5ecdc2', duration: 2.6,
        steps: ['Memasuki wilayah baru...', 'Menjelajahi area...', 'Menemukan sesuatu...']
    });

    try {
        const res  = await fetch('/api/explore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId() }),
        });
        const data = await res.json();

        await new Promise(r => setTimeout(r, 2600)); // tunggu animasi selesai

        if (!data.ok) {
            closeActivityAnim(overlay);
            showLifeLog(`❌ ${data.error}`);
            if (data.cooldownLeft) {
                currentUser.lastExplore = Date.now() - (EXPLORE_CD_MS - data.cooldownLeft * 1000);
                syncExploreCooldown(currentUser);
            } else btn.disabled = false;
            return;
        }
        currentUser = { ...currentUser, ...data.user };
        updateCharStats(currentUser);
        $('charLevel').textContent = `Level ${currentUser.level} · ${currentUser.exp} EXP`;

        const lvlUp = data.levelUpLog?.length ? `🎉 LEVEL UP! → Lv${currentUser.level}` : null;
        showActivityResult(overlay, {
            isRare: !!data.rare,
            rows: [
                { label: `📍 ${data.location}`, val: '', cls: '' },
                { label: '💰 Gold', val: `+${fmt(data.gold)}`, cls: '', float: '💰' },
                { label: '✨ EXP',  val: `+${fmt(data.exp)}`,  cls: 'green', float: '✨' },
                { label: '📦 Item', val: `${data.drop.qty}x ${data.drop.key}` },
                ...(data.rare ? [{ label: '⭐ RARE', val: data.rare.name, cls: 'purple', float: '⭐' }] : [])
            ],
            levelUp: lvlUp
        });

        let log = `🌍 <b>${data.location}</b><br>💰 +${fmt(data.gold)} Gold | ✨ +${fmt(data.exp)} EXP<br>📦 ${data.drop.qty}x ${data.drop.key}`;
        if (data.rare) log += `<br>✨ <b>RARE!</b> 1x ${data.rare.name}`;
        if (data.levelUpLog?.length) log += `<br>` + data.levelUpLog.map(l => `🎉 ${l.text || l}`).join('<br>');
        showLifeLog(log);

        syncExploreCooldown(currentUser);
    } catch (e) {
        closeActivityAnim(overlay);
        showLifeLog('❌ Koneksi gagal.');
        btn.disabled = false;
    }
}

// ════════════════════════════════════════
//  ADVENTURE
// ════════════════════════════════════════
let advCoolTimer = null;
const ADV_CD_MS = 60000;

function syncAdvCooldown(user) {
    const last = user.lastTreasure || 0;
    const sisa = ADV_CD_MS - (Date.now() - last);
    const btn  = $('btnAdv');
    if (!btn) return;
    clearInterval(advCoolTimer);
    if (sisa <= 0) { btn.disabled = false; btn.innerHTML = '<div class="mode-icon">🏞️</div><div class="mode-name">Adventure</div><div class="mode-desc">CD: 1 menit</div>'; return; }
    btn.disabled = true;
    const tick = () => {
        const s = Math.ceil((ADV_CD_MS - (Date.now() - last)) / 1000);
        if (s <= 0) { clearInterval(advCoolTimer); btn.disabled = false; btn.innerHTML = '<div class="mode-icon">🏞️</div><div class="mode-name">Adventure</div><div class="mode-desc">CD: 1 menit</div>'; }
        else btn.innerHTML = `<div class="mode-icon">⏳</div><div class="mode-name">Adventure</div><div class="mode-desc">CD: ${s}s</div>`;
    };
    tick();
    advCoolTimer = setInterval(tick, 1000);
}

async function doAdventure() {
    if (!currentUser) return;
    const btn = $('btnAdv');
    btn.disabled = true;

    const overlay = showActivityAnim({
        icon: '🏞️', title: 'Berpetualang',
        color: '#c9963c', color2: '#e8c06a', duration: 2.2,
        steps: ['Berangkat menuju hutan...', 'Menghadapi rintangan...', 'Menyelesaikan petualangan!']
    });

    try {
        const res  = await fetch('/api/adventure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId() }),
        });
        const data = await res.json();

        await new Promise(r => setTimeout(r, 2200));

        if (!data.ok) {
            closeActivityAnim(overlay);
            showLifeLog(`❌ ${data.error}`);
            if (data.cooldownLeft) {
                currentUser.lastTreasure = Date.now() - (ADV_CD_MS - data.cooldownLeft * 1000);
                syncAdvCooldown(currentUser);
            } else btn.disabled = false;
            return;
        }
        currentUser = { ...currentUser, ...data.user };
        updateCharStats(currentUser);
        $('charLevel').textContent = `Level ${currentUser.level} · ${currentUser.exp} EXP`;

        const lvlUp = data.levelUpLog?.length ? `🎉 LEVEL UP! → Lv${currentUser.level}` : null;
        showActivityResult(overlay, {
            isRare: false,
            rows: [
                { label: `🐾 ${data.event || 'Petualangan'}`, val: '' },
                { label: '💰 Gold', val: `+${fmt(data.gold)}`, float: '💰' },
                { label: '✨ EXP',  val: `+${fmt(data.exp)}`,  cls: 'green', float: '✨' },
                { label: '💔 HP',   val: `-${data.hpLoss}` },
            ],
            levelUp: lvlUp
        });

        let log = `🐾 Kamu <b>${data.event}</b><br>💰 +${fmt(data.gold)} Gold | ✨ +${fmt(data.exp)} EXP | 💔 ${data.hpLoss} HP`;
        if (data.durabilityLogs?.length) log += '<br>' + data.durabilityLogs.join('<br>');
        if (data.levelUpLog?.length) log += '<br>' + data.levelUpLog.map(l => `🎉 ${l.text || l}`).join('<br>');
        showLifeLog(log);

        syncAdvCooldown(currentUser);
    } catch (e) {
        closeActivityAnim(overlay);
        showLifeLog('❌ Koneksi gagal.');
        btn.disabled = false;
    }
}

// ════════════════════════════════════════
//  HUNT ANIMAL
// ════════════════════════════════════════
let huntAnimalCoolTimer = null;
const HUNT_ANIMAL_CD_MS = 30000;

function syncHuntAnimalCooldown(user) {
    const last = user.lastHuntAnimal || 0;
    const sisa = HUNT_ANIMAL_CD_MS - (Date.now() - last);
    const btn  = $('btnHuntAnimal');
    if (!btn) return;
    clearInterval(huntAnimalCoolTimer);
    if (sisa <= 0) { btn.disabled = false; btn.innerHTML = '<div class="mode-icon">🏹</div><div class="mode-name">Berburu</div><div class="mode-desc">CD: 30 detik</div>'; return; }
    btn.disabled = true;
    const tick = () => {
        const s = Math.ceil((HUNT_ANIMAL_CD_MS - (Date.now() - last)) / 1000);
        if (s <= 0) { clearInterval(huntAnimalCoolTimer); btn.disabled = false; btn.innerHTML = '<div class="mode-icon">🏹</div><div class="mode-name">Berburu</div><div class="mode-desc">CD: 30 detik</div>'; }
        else btn.innerHTML = `<div class="mode-icon">⏳</div><div class="mode-name">Berburu</div><div class="mode-desc">CD: ${s}s</div>`;
    };
    tick();
    huntAnimalCoolTimer = setInterval(tick, 1000);
}

async function doHuntAnimal() {
    if (!currentUser) return;
    const btn = $('btnHuntAnimal');
    btn.disabled = true;

    const overlay = showActivityAnim({
        icon: '🏹', title: 'Berburu Hewan',
        color: '#b83232', color2: '#e04444', duration: 2.0,
        steps: ['Masuk ke hutan...', 'Melacak target...', 'Membidik & menembak!']
    });

    try {
        const res  = await fetch('/api/hunt-animal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId() }),
        });
        const data = await res.json();

        await new Promise(r => setTimeout(r, 2000));

        if (!data.ok) {
            closeActivityAnim(overlay);
            showLifeLog(`❌ ${data.error}`);
            if (data.cooldownLeft) {
                currentUser.lastHuntAnimal = Date.now() - (HUNT_ANIMAL_CD_MS - data.cooldownLeft * 1000);
                syncHuntAnimalCooldown(currentUser);
            } else btn.disabled = false;
            return;
        }
        currentUser = { ...currentUser, ...data.user };
        updateCharStats(currentUser);
        $('charLevel').textContent = `Level ${currentUser.level} · ${currentUser.exp} EXP`;

        const lvlUp = data.levelUpLog?.length ? `🎉 LEVEL UP! → Lv${currentUser.level}` : null;
        showActivityResult(overlay, {
            isRare: !!data.leather,
            rows: [
                { label: `🎯 ${data.animal || 'Hewan'}`, val: '' },
                { label: '📦 Daging', val: `${data.qty}x ${data.meat?.replace(/_/g,' ')}`, float: '🥩' },
                ...(data.leather ? [{ label: '🦴 Leather', val: '1x Leather', cls: 'purple', float: '⭐' }] : []),
                { label: '✨ EXP',   val: `+${fmt(data.exp)}`, cls: 'green', float: '✨' },
            ],
            levelUp: lvlUp
        });

        let log = `🎯 Target: <b>${data.animal}</b><br>📦 ${data.qty}x ${data.meat.replace(/_/g,' ')}`;
        if (data.leather) log += ` + 1x Leather ✨`;
        log += `<br>✨ +${fmt(data.exp)} EXP`;
        if (data.durabilityLogs?.length) log += '<br>' + data.durabilityLogs.join('<br>');
        if (data.levelUpLog?.length) log += '<br>' + data.levelUpLog.map(l => `🎉 ${l.text || l}`).join('<br>');
        showLifeLog(log);

        syncHuntAnimalCooldown(currentUser);
    } catch (e) {
        closeActivityAnim(overlay);
        showLifeLog('❌ Koneksi gagal.');
        btn.disabled = false;
    }
}

// ════════════════════════════════════════
//  STATS (PROFIL LENGKAP)
// ════════════════════════════════════════
async function showStatsPage() {
    if (!currentUser) return;
    $('statsSection').style.display = '';
    $('dashboardSection').style.display = 'none';
    $('statsContent').innerHTML = '<p style="text-align:center;opacity:.5">Memuat profil...</p>';

    try {
        const res  = await fetch(`/api/stats?id=${encodeURIComponent(senderId())}`);
        const data = await res.json();
        if (!data.ok) { $('statsContent').innerHTML = `<p>❌ ${data.error}</p>`; return; }

        const p  = data.profile;
        const s  = data.stats;
        const reqExp = p.reqExp;
        const barW   = p.percentExp;
        const eqHtml = data.equipment.map(e => `
            <div class="stat-eq-row">
                <span>${e.icon} <b>${e.slot.toUpperCase()}</b></span>
                <span>${e.name}${e.tier ? ` [T${e.tier}]` : ''}${e.dura !== null ? ` (${e.dura}${e.maxDura ? `/${e.maxDura}` : ''} dura)` : ''}</span>
            </div>`).join('') || '<p style="opacity:.5">Belum ada equipment</p>';

        const passiveHtml = data.passives.map(pa =>
            `<div class="stat-passive">🔰 <b>Lv${pa.lvl} ${pa.name}</b> — ${pa.description}</div>`
        ).join('') || '<p style="opacity:.5">Belum ada passive aktif</p>';

        $('statsContent').innerHTML = `
            <div class="stat-header">
                <div class="stat-role-badge">${p.roleEmoji}</div>
                <div>
                    <div class="stat-role-name">${(p.role||'?').toUpperCase()}</div>
                    <div class="stat-rank">${p.rank}</div>
                </div>
            </div>
            <div class="stat-row"><span>Level</span><b>${p.level}</b></div>
            <div class="stat-expbar-wrap">
                <div class="stat-expbar" style="width:${barW}%"></div>
            </div>
            <div class="stat-row"><span>EXP</span><b>${fmt(p.exp)} / ${fmt(reqExp)}</b></div>
            <div class="stat-row"><span>💰 Gold</span><b>${fmt(p.gold)}</b></div>
            <div class="stat-row"><span>💍 Pasangan</span><b>${p.spouse ? p.spouse.split('@')[0] : 'Single'}</b></div>
            <div class="stat-row"><span>📍 Dungeon Floor</span><b>Lantai ${s.dungeonFloor}</b></div>
            <hr class="stat-divider">
            <div class="stat-section-title">📊 CORE ATTRIBUTES</div>
            <div class="stat-row"><span>❤️ HP</span><b>${fmt(s.hp)} / ${fmt(s.maxHp)}</b></div>
            <div class="stat-row"><span>💧 MP</span><b>${fmt(s.mana)} / ${fmt(s.maxMana)}</b></div>
            <div class="stat-row"><span>⚔️ ATK</span><b>${fmt(s.atk)}</b></div>
            <div class="stat-row"><span>🛡️ DEF</span><b>${fmt(s.def)}</b></div>
            <div class="stat-row"><span>💨 SPD</span><b>${(s.speed||1).toFixed(1)}</b></div>
            <div class="stat-row"><span>💥 CRIT</span><b>${Math.round((s.critRate||0)*100)}%</b></div>
            <hr class="stat-divider">
            <div class="stat-section-title">🧰 EQUIPMENT</div>
            ${eqHtml}
            <hr class="stat-divider">
            <div class="stat-section-title">🔰 PASSIVE AKTIF</div>
            ${passiveHtml}
        `;
    } catch (e) {
        $('statsContent').innerHTML = `<p>❌ Gagal memuat profil.</p>`;
    }
}

function hideStatsPage() {
    $('statsSection').style.display = 'none';
    $('dashboardSection').style.display = '';
}

// ════════════════════════════════════════
//  SELL
// ════════════════════════════════════════
let sellItems = [];

async function showSellPage() {
    if (!currentUser) return;
    $('sellSection').style.display = '';
    $('dashboardSection').style.display = 'none';
    $('sellList').innerHTML = '<p style="text-align:center;opacity:.5">Memuat item...</p>';
    await loadSellItems();
}

function hideSellPage() {
    $('sellSection').style.display = 'none';
    $('dashboardSection').style.display = '';
}

async function loadSellItems() {
    try {
        const res  = await fetch(`/api/sell?id=${encodeURIComponent(senderId())}`);
        const data = await res.json();
        if (!data.ok) { $('sellList').innerHTML = `<p>❌ ${data.error}</p>`; return; }
        sellItems = data.items;
        renderSellList();
    } catch { $('sellList').innerHTML = '<p>❌ Gagal memuat.</p>'; }
}

function renderSellList() {
    const query = ($('sellSearch')?.value || '').toLowerCase();
    const filtered = sellItems.filter(i => i.qty > 0 && i.name.toLowerCase().includes(query));
    if (filtered.length === 0) {
        $('sellList').innerHTML = '<p style="opacity:.5;text-align:center">Tidak ada item yang bisa dijual.</p>';
        return;
    }
    $('sellList').innerHTML = filtered.map(i => `
        <div class="sell-row">
            <div class="sell-info">
                <span class="sell-name">${i.name}</span>
                <span class="sell-price">💰 ${fmt(i.price)}/item | 📦 ${fmt(i.qty)}x</span>
            </div>
            <div class="sell-actions">
                <button class="btn-sell-one" onclick="doSell('${i.key}',1)">Jual 1</button>
                <button class="btn-sell-all" onclick="doSell('${i.key}','all')">Jual Semua</button>
            </div>
        </div>`
    ).join('');
}

async function doSell(item, qty) {
    try {
        const res  = await fetch('/api/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), item, qty }),
        });
        const data = await res.json();
        if (!data.ok) { showLifeLog(`❌ ${data.error}`); return; }
        currentUser.gold = data.user.gold;
        currentUser.inventory = data.user.inventory;
        updateCharStats(currentUser);
        showLifeLog(`💰 Terjual! <b>${data.totalGoldText}</b>`);
        await loadSellItems();
    } catch { showLifeLog('❌ Gagal menjual.'); }
}

async function doSellAll() {
    try {
        const res  = await fetch('/api/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), item: 'all', qty: 'all' }),
        });
        const data = await res.json();
        if (!data.ok) { showLifeLog(`❌ ${data.error}`); return; }
        currentUser.gold = data.user.gold;
        currentUser.inventory = data.user.inventory;
        updateCharStats(currentUser);
        const lines = Object.entries(data.soldItems).map(([k,v]) => `${v}x ${k}`).join(', ');
        showLifeLog(`💰 Jual Semua! <b>${data.totalGoldText}</b><br><small>${lines}</small>`);
        await loadSellItems();
    } catch { showLifeLog('❌ Gagal menjual.'); }
}

// ─── Sync semua cooldown baru saat load dashboard ───
function syncAllCooldowns(user) {
    syncGatherCooldowns(user);
    syncExploreCooldown(user);
    syncAdvCooldown(user);
    syncHuntAnimalCooldown(user);
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
