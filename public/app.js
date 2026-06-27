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
let skillTimer     = null; // Variabel baru untuk timer cooldown real-time

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

    // ════════════════════════════════════════
    // FIX: SEMBUNYIKAN SKILL DARI DASHBOARD
    // ════════════════════════════════════════
    if ($('skillsCard')) {
        $('skillsCard').style.display = 'none';
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
    
    if (!hasActive) {
        setStatus('Pilih mode battle untuk mulai!', 'active');
        document.querySelectorAll('.mode-btn').forEach(b => b.disabled = false); 
        isProcessing = false;
    }

    // Sinkronkan cooldown life-skill dari server
    syncGatherCooldowns(u);
    syncExploreCooldowns(u); // <--- TAMBAHKAN BARIS INI
}

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
    isProcessing = false;
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
    
        // ════════════════════════════════════════
    // FIX: TAMBAHKAN INFO FLOOR SAAT DUNGEON
    // ════════════════════════════════════════
    if (mode === 'dungeon') {
        $('battleModeTag').textContent = `🏰 DUNGEON (Floor ${u.dungeonFloor || 1})`;
    } else {
        $('battleModeTag').textContent = modeLabels[mode] || mode.toUpperCase();
    }


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

    // Skills in battle (sudah dimodifikasi untuk Real-Time)
    renderBattleSkills(u);
    startSkillCooldownTimer(); // Panggil fungsi real-time loop!

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

// ─── FUNGSI RENDER SKILL DENGAN DATA ATRIBUT (UNTUK REALTIME) ───
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
                      
        // Penambahan atribut data-cdend dan data-mana untuk sistem realtime timer
        return `
        <button class="skill-btn" data-cdend="${cdEnd}" data-mana="${s.mana}" onclick="doSkill('${s.name}')" ${dis ? 'disabled' : ''}>
          <span class="skill-btn-name">
            ✨ ${s.name}
            <span class="skill-btn-desc">${s.description || ''}</span>
          </span>
          <span class="skill-btn-mana">💧${s.mana}</span>
          <div class="skill-status-wrapper">${cdText}</div>
        </button>`;
    }).join('');
}

// ─── FUNGSI LOOP REALTIME COOLDOWN ───
function startSkillCooldownTimer() {
    if (skillTimer) clearInterval(skillTimer);

    skillTimer = setInterval(() => {
        // Hentikan proses jika sedang tidak di layar battle
        if ($('battleSection').style.display === 'none') {
            clearInterval(skillTimer);
            return;
        }

        const now = Date.now();
        const skillBtns = document.querySelectorAll('.skill-btn');
        const u = currentUser;

        skillBtns.forEach(btn => {
            let cdEnd = parseInt(btn.getAttribute('data-cdend')) || 0;
            let manaReq = parseInt(btn.getAttribute('data-mana')) || 0;
            let statusWrapper = btn.querySelector('.skill-status-wrapper');

            let onCd = now < cdEnd;
            let noMana = (u && u.mana < manaReq);

            if (onCd) {
                let cdSec = Math.ceil((cdEnd - now) / 1000);
                if (statusWrapper) statusWrapper.innerHTML = `<span class="skill-btn-cd">⏳ ${cdSec}s</span>`;
                btn.disabled = true;
            } else if (noMana) {
                if (statusWrapper) statusWrapper.innerHTML = `<span class="skill-btn-cd">💧 ${manaReq}MP</span>`;
                // Kunci tombol kecuali sedang tidak processing API
                if (!isProcessing) btn.disabled = true; 
            } else {
                if (statusWrapper) statusWrapper.innerHTML = `<span class="skill-btn-ready">✅ READY</span>`;
                // Nyalakan kembali tombol hanya jika tidak sedang menunggu balasan API
                if (!isProcessing) btn.disabled = false;
            }
        });
    }, 1000);
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
        // ════════════════════════════════════════
        // FIX BUG: Paksa bar HP jadi 0 jika 1-hit kill
        // ════════════════════════════════════════
        else if (data.turnResult === 'win' || data.turnResult === 'horde_complete') {
            // Ambil Max HP dari data turn sebelumnya sebelum di-null-kan oleh server
            let maxHpVisual = currentBattle ? currentBattle.monsterMaxHp : 100;
            updateMonsterHp(0, maxHpVisual);
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
    // HANYA disabled tombol skill jika CD tidak sedang running. Jika enabled dipanggil = false (tombol mati), matikan semua. 
    // Tapi jika dipanggil = true (tombol nyala), biarkan interval timer yang nyalain sendiri berdasarkan cooldown.
    if (!enabled) {
        document.querySelectorAll('.skill-btn').forEach(b => b.disabled = true);
    }
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
    
    // ===============================================
    // PERBAIKAN BUG MACET SAAT KEMBALI KE LOBBY
    // ===============================================
    currentBattle = null;
    currentMode   = null;
    isProcessing  = false; // Membuka gembok tindakan
    
    // Pastikan timer dihentikan agar tidak bocor dan berjalan di latar belakang
    if (skillTimer) clearInterval(skillTimer);
    
    // Buka kembali interaksi semua tombol di dashboard (lobby)
    document.querySelectorAll('.mode-btn').forEach(b => b.disabled = false);
    enableActions(true);
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
    
    if (skillTimer) clearInterval(skillTimer);
    isProcessing = false;
    
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
    mine: { icon: '⛏️', actionIcon: '🪨', title: 'Mining', cd: 60, caption: 'Menambang batu...' },
    chop: { icon: '🪓', actionIcon: '🌳', title: 'Woodcut', cd: 45, caption: 'Menebang kayu...' },
    fish: { icon: '🎣', actionIcon: '🐟', title: 'Fishing', cd: 30, caption: 'Menunggu kail disambar...' },
};
let gatherBusy = {};
const gatherTimers = {};
const GATHER_LAST_FIELD = { mine: 'lastMining', chop: 'lastWood', fish: 'lastFish' };

function senderId() { return currentUser?.senderId; }

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
            const btn = $(type === 'mine' ? 'btnMine' : type === 'chop' ? 'btnChop' : 'btnFish');
            const label = $(type === 'mine' ? 'cdMine' : type === 'chop' ? 'cdChop' : 'cdFish');
            if (btn) btn.disabled = false;
            if (label) label.textContent = type === 'mine' ? 'Butuh Pickaxe' : type === 'chop' ? 'Butuh Axe' : 'Butuh Fishing Rod';
        }
    });
}

function showGatherOverlay(type) {
    const info = GATHER_LABEL[type];
    const stage = document.querySelector('.gather-stage');
    stage.classList.remove('result-pop');
    $('gatherBg').className = `gather-bg bg-${type}`;
    $('gatherIcon').className = `gather-icon anim-${type}`;
    $('gatherIcon').textContent = info.icon;
    $('gatherActionIcon').className = `gather-action-icon anim-${type}`;
    $('gatherActionIcon').textContent = info.actionIcon;
    $('gatherCaption').textContent = info.caption;
    const oldResult = document.querySelector('.gather-result-text');
    if (oldResult) oldResult.remove();
    $('gatherOverlay').style.display = 'flex';
}

function hideGatherOverlay() {
    $('gatherOverlay').style.display = 'none';
}

async function doGather(type) {
    if (!currentUser) return;
    if (gatherBusy[type]) return;
    const btn = $(type === 'mine' ? 'btnMine' : type === 'chop' ? 'btnChop' : 'btnFish');
    btn.disabled = true;

    showGatherOverlay(type);
    const info = GATHER_LABEL[type];
    const animDelay = new Promise(r => setTimeout(r, 1400));

    try {
        const fetchPromise = fetch('/api/gather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), type }),
        }).then(r => r.json());

        const [, data] = await Promise.all([animDelay, fetchPromise]);

        if (type === 'fish') {
            $('gatherActionIcon').classList.add('fish-bite');
            await new Promise(r => setTimeout(r, 500));
        }

        const stage = document.querySelector('.gather-stage');
        stage.classList.add('result-pop');

        if (!data.ok) {
            $('gatherIcon').textContent = '❌';
            $('gatherCaption').textContent = data.error;
            $('gatherActionIcon').style.display = 'none';
            await new Promise(r => setTimeout(r, 1300));
            hideGatherOverlay();
            $('gatherActionIcon').style.display = '';
            showLifeLog(`❌ ${data.error}`);
            if (data.cooldownLeft) startGatherCooldown(type, data.cooldownLeft);
            else btn.disabled = false;
            return;
        }

        if (data.empty) {
            $('gatherIcon').textContent = '😔';
            $('gatherActionIcon').style.display = 'none';
            $('gatherCaption').textContent = 'Tidak ada hasil...';
            showLifeLog(`${info.icon} ${data.message}`);
        } else {
            const topReward = data.rewards[0];
            $('gatherIcon').textContent = info.icon;
            $('gatherActionIcon').style.display = '';
            $('gatherActionIcon').classList.remove('fish-bite');
            $('gatherActionIcon').textContent = REWARD_EMOJI[topReward.key] || info.actionIcon;
            $('gatherCaption').textContent = `+${topReward.amount}x ${topReward.name}${data.rewards.length > 1 ? ` (+${data.rewards.length - 1} lainnya)` : ''}`;

            const resultEl = document.createElement('div');
            resultEl.className = 'gather-result-text';
            resultEl.textContent = `✨ +${data.expText} EXP`;
            document.querySelector('.gather-stage').appendChild(resultEl);

            const lines = data.rewards.map(r => `+${r.amount}x ${r.name}`).join(', ');
            let html = `${info.icon} <b>${info.title}</b> — ${lines}<br>✨ Exp ${data.expText}`;
            if (data.durability?.msg) html += `<br><span class="warn-text">${data.durability.msg}</span>`;
            if (data.levelUpLog?.length) html += `<br>⭐ ${data.levelUpLog.map(l => l.text).join(' ')}`;
            showLifeLog(html);
            currentUser = { ...currentUser, ...data.user };
            updateCharStats(currentUser);
            $('charLevel').textContent = `Level ${currentUser.level} · ${currentUser.exp} EXP`;
            syncGatherCooldowns(currentUser);
        }

        await new Promise(r => setTimeout(r, 1600));
        hideGatherOverlay();
        $('gatherActionIcon').style.display = '';

        startGatherCooldown(type, Math.floor((data.cooldown || info.cd * 1000) / 1000));
    } catch (e) {
        hideGatherOverlay();
        showLifeLog('❌ Gagal terhubung ke server.');
        btn.disabled = false;
    }
}

const REWARD_EMOJI = {
    stone: '🪨', coal: '⚫', copper: '🟠', iron: '⛓️', silver: '⚪', gold_ore: '🟡',
    mythril: '💠', sapphire: '🔷', ruby: '🔺', emerald: '🟢', diamond: '💎', obsidian_ore: '⬛',
    wood: '🪵', leaf: '🍃', apple: '🍎', mango: '🥭', blueberry: '🫐', nest: '🪺', maple_syrup: '🍯',
    lele: '🐟', nila: '🐟', mujair: '🐟', gurame: '🐠', salmon: '🐟', tuna: '🐟',
    hiu: '🦈', paus: '🐳', leviathan: '🐉', trash: '🗑️',
};

function startGatherCooldown(type, seconds) {
    gatherBusy[type] = true;
    const btn = $(type === 'mine' ? 'btnMine' : type === 'chop' ? 'btnChop' : 'btnFish');
    const label = $(type === 'mine' ? 'cdMine' : type === 'chop' ? 'cdChop' : 'cdFish');
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
            label.textContent = GATHER_LABEL[type].title === 'Mining' ? 'Butuh Pickaxe' :
                GATHER_LABEL[type].title === 'Woodcut' ? 'Butuh Axe' : 'Butuh Fishing Rod';
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
//  EXPLORATION — Hunt Animal / Adventure / Explore
// ════════════════════════════════════════
const EXPLORE_LABEL = {
    huntanimal: { title: 'Hunting Animal', cd: 30 },
    adventure: { title: 'Adventure', cd: 60 },
    explore: { title: 'Exploring World', cd: 120 },
};
let exploreBusy = {};
const exploreTimers = {};
const EXPLORE_LAST_FIELD = { huntanimal: 'lastHuntAnimal', adventure: 'lastTreasure', explore: 'lastExplore' };

// Panggil fungsi ini di dalam showDashboard() dan doExplore()
function syncExploreCooldowns(u) {
    const now = Date.now();
    Object.entries(EXPLORE_LABEL).forEach(([type, info]) => {
        const last = u[EXPLORE_LAST_FIELD[type]] || 0;
        const cdMs = info.cd * 1000;
        const elapsed = now - last;
        if (last && elapsed < cdMs) {
            const secondsLeft = Math.ceil((cdMs - elapsed) / 1000);
            startExploreCooldown(type, secondsLeft);
        } else {
            exploreBusy[type] = false;
            const btn = $(type === 'huntanimal' ? 'btnHuntAnim' : type === 'adventure' ? 'btnAdv' : 'btnExp');
            const label = $(type === 'huntanimal' ? 'cdHuntAnim' : type === 'adventure' ? 'cdAdv' : 'cdExp');
            if (btn) btn.disabled = false;
            if (label) label.textContent = 'Siap';
        }
    });
}

function startExploreCooldown(type, seconds) {
    exploreBusy[type] = true;
    const btn = $(type === 'huntanimal' ? 'btnHuntAnim' : type === 'adventure' ? 'btnAdv' : 'btnExp');
    const label = $(type === 'huntanimal' ? 'cdHuntAnim' : type === 'adventure' ? 'cdAdv' : 'cdExp');
    if (btn) btn.disabled = true;
    let left = seconds;

    if (exploreTimers[type]) clearInterval(exploreTimers[type]);
    if (label) label.textContent = `⏳ ${left}s`;
    
    exploreTimers[type] = setInterval(() => {
        left--;
        if (left <= 0) {
            clearInterval(exploreTimers[type]);
            exploreBusy[type] = false;
            if (btn) btn.disabled = false;
            if (label) label.textContent = 'Siap';
        } else {
            if (label) label.textContent = `⏳ ${left}s`;
        }
    }, 1000);
}

// ════════════════════════════════════════
// FUNGSI DO EXPLORE DENGAN ANIMASI
// ════════════════════════════════════════
async function doExplore(type) {
    if (!currentUser) return;
    if (exploreBusy[type]) return;
    
    const btn = $(type === 'huntanimal' ? 'btnHuntAnim' : type === 'adventure' ? 'btnAdv' : 'btnExp');
    btn.disabled = true;
    
    // 1. Tampilkan Overlay Animasi
    showExploreOverlay(type);
    const info = EXPLORE_LABEL[type];
    const animDelay = new Promise(r => setTimeout(r, 1400)); // Simulasi waktu perjalanan/perburuan

    try {
        // Jalankan fetch concurrently dengan delay animasi visual
        const fetchPromise = fetch('/api/explore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: currentUser.senderId, type }),
        }).then(r => r.json());

        const [, data] = await Promise.all([animDelay, fetchPromise]);

        // 2. Beri efek "Result Pop" ke overlay
        const stage = document.querySelector('.gather-stage.explore-stage');
        stage.classList.add('result-pop');

        if (!data.ok) {
            $('exploreIcon').textContent = '❌';
            $('exploreCaption').textContent = data.error;
            $('exploreActionIcon').style.display = 'none';
            await new Promise(r => setTimeout(r, 1300));
            hideExploreOverlay();
            showLifeLog(`❌ ${data.error}`);
            btn.disabled = false;
            return;
        }

        // 3. Tampilkan Hasil ke Overlay
        let primaryRewardHtml = '';
        let primaryRewardIcon = '';

        if (type === 'huntanimal' && data.rewards.length > 0) {
            let meatReward = data.rewards.find(r => r.includes('MEAT'));
            if (meatReward) {
                primaryRewardHtml = meatReward;
                primaryRewardIcon = REWARD_EMOJI[meatReward.split('x ')[1].toLowerCase().replace(/\s/g, '_')] || EXPLORE_ICON[type];
            }
        } else if (type === 'explore' && data.rewards.length > 0) {
            primaryRewardHtml = data.rewards[0]; // Drop material
            primaryRewardIcon = REWARD_EMOJI[primaryRewardHtml.split('x ')[1].toLowerCase().replace(/\s/g, '_')] || EXPLORE_ICON[type];
        } else if (type === 'adventure') {
             primaryRewardHtml = `Gold +${fmt(data.totalGold)}`;
             primaryRewardIcon = '💰';
        }

        $('exploreIcon').textContent = EXPLORE_ICON[type];
        $('exploreActionIcon').textContent = primaryRewardIcon;
        $('exploreCaption').textContent = primaryRewardHtml;
        $('exploreActionIcon').style.display = '';

        const resultEl = document.createElement('div');
        resultEl.className = 'gather-result-text';
        if (data.totalExp > 0) resultEl.innerHTML += `✨ +${fmt(data.totalExp)} EXP<br>`;
        if (type === 'adventure' && data.totalGold > 0) resultEl.innerHTML += `💰 +${fmt(data.totalGold)} Gold<br>`;
        document.querySelector('.gather-stage.explore-stage').appendChild(resultEl);

        // 4. Update Stats User dan Cooldown
        currentUser = { ...currentUser, ...data.user };
        updateCharStats(currentUser);
        $('charLevel').textContent = `Level ${currentUser.level} · ${currentUser.exp} EXP`;

        // Tampilkan hasil lengkap ke LifeLog juga
        let logHtml = `🧭 <b>${EXPLORE_LABEL[type].title} Selesai!</b><br>`;
        data.rewards.forEach(r => logHtml += `• ${r}<br>`);
        if (data.totalExp > 0) logHtml += `✨ Exp: +${fmt(data.totalExp)}<br>`;
        if (data.totalGold > 0) logHtml += `💰 Gold: +${fmt(data.totalGold)}<br>`;
        if (data.durabilityLogs && data.durabilityLogs.length > 0) {
            data.durabilityLogs.forEach(msg => logHtml += `<span class="warn-text">${msg}</span><br>`);
        }
        showLifeLog(logHtml);

        startExploreCooldown(type, EXPLORE_LABEL[type].cd);

        // 5. Tunggu sebentar agar hasil bisa dibaca sebelum overlay hilang
        await new Promise(r => setTimeout(r, 1600));
        hideExploreOverlay();

    } catch (e) {
        hideExploreOverlay();
        showLifeLog('❌ Gagal terhubung ke server.');
        btn.disabled = false;
    }
}

// ─── HELPER FUNGSI FUNGSI OVERLAY EXPLORE ───
const EXPLORE_ICON = { huntanimal: '🏹', adventure: '🏕️', explore: '🌍' };

function showExploreOverlay(type) {
    const info = GATHER_LABEL[type === 'huntanimal' ? 'chop' : 'mine']; // Pinjam caption default biar ga ribet
    const stage = document.querySelector('.gather-stage.explore-stage');
    stage.classList.remove('result-pop');
    
    // Set tema overlay
    $('exploreBg').className = `gather-bg bg-explore bg-${type}`;
    $('exploreIcon').textContent = EXPLORE_ICON[type];
    $('exploreIcon').className = `gather-icon anim-explore ${type === 'huntanimal' ? 'huntanimal-fire' : type === 'adventure' ? 'adventure-walk' : 'explore-spin'}`;
    $('exploreActionIcon').style.display = 'none'; // Sembunyikan icon aksi dulu
    
    // Set caption sesuai tipe
    let captionText = 'Tiba di lokasi acak...';
    if (type === 'huntanimal') captionText = 'Membidik hewan buruan...';
    if (type === 'adventure') captionText = 'Menjelajahi lokasi tak dikenal...';
    $('exploreCaption').textContent = captionText;

    // Bersihkan hasil lama
    const oldResult = document.querySelector('.gather-result-text');
    if (oldResult) oldResult.remove();
    
    $('exploreOverlay').style.display = 'flex';
}

function hideExploreOverlay() {
    $('exploreOverlay').style.display = 'none';
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
