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


// ─── START BATTLE ───
async function startBattle(mode) {
    if (isProcessing) return;
    isProcessing = true;
    setStatus(`Memulai ${mode} battle...`, 'active');

    // Disable tombol mode BATTLE saja (bukan life-skill) sesaat selagi request
    // jalan, sekedar mencegah double-click — bukan representasi cooldown asli.
    document.querySelectorAll('.mode-btn:not(.lifeskill-btn)').forEach(b => b.disabled = true);

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
            if (data.cooldownLeft) {
                // Masih cooldown — lock ulang tombol ini dengan sisa waktu yang
                // benar, JANGAN dibuka kembali.
                startBattleModeCooldown(mode, data.cooldownLeft);
                // Tombol mode battle lain yang tidak cooldown tetap perlu dibuka.
                syncBattleModeCooldowns(currentUser);
            } else {
                syncBattleModeCooldowns(currentUser);
            }
            isProcessing = false;
            return;
        }

        currentBattle = data.battle;
        currentMode   = mode;
        showBattle();
        syncBattleModeCooldowns(currentUser);
        isProcessing = false;
    } catch (e) {
        setStatus('Gagal memulai battle', 'error');
        syncBattleModeCooldowns(currentUser);
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
                showResult('win', data.reward, { isBoss: data.isBoss });
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
function showResult(type, reward, opts = {}) {
    enableActions(false);
    $('backBtn').style.display = 'none'; // tombol lama disembunyikan, diganti tombol di modal

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

    // Dungeon menang & bukan boss floor -> tawarkan lanjut ke floor berikutnya.
    // Boss floor (atau mode lain) -> cuma tombol kembali ke dashboard.
    const showNextFloor = type === 'win' && currentMode === 'dungeon' && !opts.isBoss;
    const actionsHTML = showNextFloor
        ? `<div class="result-actions">
             <button class="btn-result-secondary" onclick="closeResultModal()">🏠 Dashboard</button>
             <button class="btn-result-primary" onclick="nextDungeonFloor()">⬇️ Next Floor</button>
           </div>`
        : `<div class="result-actions">
             <button class="btn-result-primary" onclick="closeResultModal()" style="flex:1">🏠 Kembali ke Dashboard</button>
           </div>`;

    document.getElementById('resultOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'resultOverlay';
    overlay.className = `result-overlay ${isWin ? 'result-win' : 'result-lose'}`;
    overlay.innerHTML = `
        <div class="result-card">
            <div class="result-title">${titleText}</div>
            ${rewardHTML}
            ${actionsHTML}
        </div>
    `;
    document.body.appendChild(overlay);

    currentBattle = null;
    setStatus(isWin ? 'Kamu menang! 🏆' : (type === 'flee' ? 'Berhasil kabur!' : 'Kamu kalah...'), isWin ? 'active' : 'warn');
}

function closeResultModal() {
    document.getElementById('resultOverlay')?.remove();
    endBattle();
}

// Lanjut langsung ke floor dungeon berikutnya tanpa balik ke dashboard dulu.
async function nextDungeonFloor() {
    document.getElementById('resultOverlay')?.remove();
    await startBattle('dungeon');
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
    if (farmRefreshTimer) { clearInterval(farmRefreshTimer); farmRefreshTimer = null; }
    localStorage.removeItem('rpg_sender_id');
    $('loginSection').style.display    = '';
    $('dashboardSection').style.display = 'none';
    $('battleSection').style.display   = 'none';
    $('farmSection').style.display      = 'none';
    $('invSection').style.display       = 'none';
    $('gachaSection').style.display      = 'none';
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
const CROP_ICONS = {
    wheat: '🌾', carrot: '🥕', potato: '🥔', corn: '🌽', tomato: '🍅',
    pumpkin: '🎃', melon: '🍈', beetroot: '🟣', cocoa: '🍫', coconut: '🥥',
};
function cropIcon(type) { return CROP_ICONS[type] || '🌱'; }

let farmRefreshTimer = null;
let lastFarmData = null;

async function showFarmPage() {
    if (!currentUser) return;
    $('farmSection').style.display = '';
    $('dashboardSection').style.display = 'none';
    $('farmPlotsView').innerHTML = '<p style="text-align:center;opacity:.5;padding:20px 0">Memuat lahan...</p>';
    await loadFarm();
    if (farmRefreshTimer) clearInterval(farmRefreshTimer);
    farmRefreshTimer = setInterval(loadFarm, 5000);
}

function hideFarmPage() {
    $('farmSection').style.display = 'none';
    $('dashboardSection').style.display = '';
    if (farmRefreshTimer) { clearInterval(farmRefreshTimer); farmRefreshTimer = null; }
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
    lastFarmData = farm;

    const readyCount = farm.plots.reduce((acc, p) => acc + p.slots.filter(s => s.ready).length, 0);
    const growingCount = farm.plots.reduce((acc, p) => acc + p.slots.filter(s => !s.ready).length, 0);
    $('farmBannerSub').innerHTML = `🏡 ${farm.farmPlots} Lahan &nbsp;•&nbsp; 🌱 ${growingCount} Tumbuh &nbsp;•&nbsp; ✅ ${readyCount} Siap Panen${farm.hasSpouse ? ' &nbsp;•&nbsp; 💍 Bonus Pasangan Aktif' : ''}`;

    if (farm.farmPlots === 0) {
        $('farmPlotsView').innerHTML = `<div class="farm-empty-state">
            <div class="farm-empty-icon">🏞️</div>
            <div class="farm-empty-title">Belum Punya Lahan</div>
            <div class="farm-empty-desc">Beli lahan di shop bot WhatsApp untuk mulai bertani.</div>
        </div>`;
        return;
    }

    let html = '';
    farm.plots.forEach(p => {
        const slotsHtml = [0, 1, 2].map(idx => {
            const s = p.slots[idx];
            if (!s) {
                return `<div class="farm-tile farm-tile-empty" onclick="openFarmPlantModal()">
                    <div class="farm-tile-icon">➕</div>
                    <div class="farm-tile-label">Tanam</div>
                </div>`;
            }
            const icon = cropIcon(s.type);
            const stageClass = s.ready ? 'farm-tile-ready' : (s.progress >= 50 ? 'farm-tile-growing' : 'farm-tile-sprout');
            const growIcon = s.ready ? icon : (s.progress >= 50 ? '🌿' : '🌱');
            return `<div class="farm-tile ${stageClass}">
                ${s.ready ? '<div class="farm-glow"></div>' : ''}
                <div class="farm-tile-icon">${growIcon}</div>
                <div class="farm-tile-name">${s.type.toUpperCase()} ×${s.amount}</div>
                <div class="farm-tile-progress">
                    <div class="farm-tile-progress-fill" id="farmFill-${p.plot}-${s.slot}" style="width:${s.progress}%"></div>
                </div>
                ${s.ready
                    ? `<button class="farm-tile-harvest" onclick="doHarvest(${p.plot},${s.slot})">🧺 Panen</button>`
                    : `<div class="farm-tile-pct" id="farmPct-${p.plot}-${s.slot}">${s.progress}%</div>`}
            </div>`;
        }).join('');

        html += `<div class="farm-plot-card">
            <div class="farm-plot-label"><span class="farm-plot-tag">Lahan ${p.plot}</span></div>
            <div class="farm-plot-tiles">${slotsHtml}</div>
        </div>`;
    });
    $('farmPlotsView').innerHTML = html;
}

// ── SEED PICKER MODAL ──
let farmSelectedSeed = null;

function openFarmPlantModal() {
    if (!lastFarmData) return;
    farmSelectedSeed = null;
    $('farmPlantQtyRow').style.display = 'none';
    $('farmPlantConfirmBtn').disabled = true;
    $('farmPlantQty').value = 1;

    const owned = lastFarmData.ownedSeeds || {};
    const keys = Object.keys(owned);

    if (keys.length === 0) {
        $('farmSeedGrid').innerHTML = `<div class="farm-empty-state" style="padding:24px 12px">
            <div class="farm-empty-icon">🌱</div>
            <div class="farm-empty-title">Belum Punya Benih</div>
            <div class="farm-empty-desc">Beli benih dulu di Shop sebelum menanam.</div>
        </div>`;
    } else {
        $('farmSeedGrid').innerHTML = keys.map(key => {
            const plant = lastFarmData.plantTable[key];
            const qty = owned[key];
            const timeMin = Math.floor(plant.time / 60000);
            return `<div class="farm-seed-card" id="farmSeedCard-${key}" onclick="selectFarmSeed('${key}')">
                <div class="farm-seed-icon">${cropIcon(key)}</div>
                <div class="farm-seed-name">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                <div class="farm-seed-meta">📦 ${qty} &nbsp;•&nbsp; ⏱️ ${timeMin}m</div>
            </div>`;
        }).join('');
    }

    $('farmPlantModal').style.display = '';
}

function closeFarmPlantModal() {
    $('farmPlantModal').style.display = 'none';
}

function selectFarmSeed(key) {
    farmSelectedSeed = key;
    document.querySelectorAll('.farm-seed-card').forEach(el => el.classList.remove('farm-seed-card-active'));
    $(`farmSeedCard-${key}`)?.classList.add('farm-seed-card-active');

    const maxQty = lastFarmData.ownedSeeds[key] || 1;
    const qtyInput = $('farmPlantQty');
    qtyInput.value = 1;
    qtyInput.max = maxQty;
    $('farmPlantQtyLabel').textContent = `Jumlah (maks ${maxQty}):`;
    $('farmPlantQtyRow').style.display = 'flex';
    $('farmPlantConfirmBtn').disabled = false;
}

function adjustFarmPlantQty(delta) {
    const inp = $('farmPlantQty');
    let v = (parseInt(inp.value) || 1) + delta;
    const max = parseInt(inp.max) || 999;
    if (v < 1) v = 1;
    if (v > max) v = max;
    inp.value = v;
}

function clampFarmPlantQty() {
    const inp = $('farmPlantQty');
    let v = parseInt(inp.value) || 1;
    const max = parseInt(inp.max) || 999;
    if (v < 1) v = 1;
    if (v > max) v = max;
    inp.value = v;
}

async function confirmFarmPlant() {
    if (!farmSelectedSeed) return;
    const amount = parseInt($('farmPlantQty').value) || 1;
    await doPlant(farmSelectedSeed, amount);
    closeFarmPlantModal();
}

async function doPlant(plantType, amount) {
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
let sellQtyState = {};    // { [key]: qty }
let sellSelected = new Set();
let shopCategories = [];
let shopActiveCat = 'all';
let shopBuyTarget = null; // { key, name, price }

async function showSellPage() {
    if (!currentUser) return;
    $('sellSection').style.display = '';
    $('dashboardSection').style.display = 'none';
    $('sellList').innerHTML = '<p style="text-align:center;opacity:.5">Memuat item...</p>';
    sellSelected.clear();
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
        // Default qty tiap item = stok penuh (gampang buat user yang mau jual semua dari satu item)
        sellItems.forEach(i => { if (sellQtyState[i.key] === undefined) sellQtyState[i.key] = i.qty; });
        $('sellGoldVal').textContent = `${fmt(currentUser?.gold || 0)} 🪙`;
        $('sellTotalItems').textContent = `${fmt(sellItems.length)} jenis`;
        renderSellList();
        updateSellActionBar();
    } catch { $('sellList').innerHTML = '<p>❌ Gagal memuat.</p>'; }
}

function sortSellItems(items, mode) {
    const arr = [...items];
    switch (mode) {
        case 'value_asc':  return arr.sort((a, b) => (a.price * a.qty) - (b.price * b.qty));
        case 'qty_desc':   return arr.sort((a, b) => b.qty - a.qty);
        case 'name_asc':   return arr.sort((a, b) => a.name.localeCompare(b.name));
        case 'value_desc':
        default:           return arr.sort((a, b) => (b.price * b.qty) - (a.price * a.qty));
    }
}

function renderSellList() {
    const query = ($('sellSearch')?.value || '').toLowerCase();
    const sortMode = $('sellSort')?.value || 'value_desc';
    const filtered = sortSellItems(
        sellItems.filter(i => i.qty > 0 && i.name.toLowerCase().includes(query)),
        sortMode
    );

    if (filtered.length === 0) {
        $('sellList').innerHTML = '<p style="opacity:.5;text-align:center">Tidak ada item yang bisa dijual.</p>';
        return;
    }

    $('sellList').innerHTML = filtered.map(i => {
        const qty = Math.min(sellQtyState[i.key] ?? i.qty, i.qty);
        const checked = sellSelected.has(i.key);
        return `
        <div class="sell-row${checked ? ' is-selected' : ''}">
            <input type="checkbox" class="sell-row-check" ${checked ? 'checked' : ''} onchange="toggleSellSelect('${i.key}', this.checked)">
            <div class="sell-info">
                <span class="sell-name">${i.name}</span>
                <span class="sell-price">💰 ${fmt(i.price)}/item · 📦 ${fmt(i.qty)}x dimiliki · <span class="sell-row-value">${fmt(i.price * qty)} 🪙</span></span>
            </div>
            <div class="sell-qty-control">
                <button onclick="adjustSellQty('${i.key}', -1)">−</button>
                <input type="number" min="1" max="${i.qty}" value="${qty}" onchange="setSellQty('${i.key}', this.value)">
                <button onclick="adjustSellQty('${i.key}', 1)">+</button>
                <div class="sell-qty-chips">
                    <button class="sell-qty-chip" onclick="setSellQtyPct('${i.key}', 0.5)">50%</button>
                    <button class="sell-qty-chip" onclick="setSellQtyPct('${i.key}', 1)">Max</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function clampQty(key, val) {
    const item = sellItems.find(i => i.key === key);
    if (!item) return 1;
    return Math.max(1, Math.min(item.qty, val));
}

function setSellQty(key, val) {
    sellQtyState[key] = clampQty(key, parseInt(val) || 1);
    renderSellList();
    updateSellActionBar();
}

function adjustSellQty(key, delta) {
    const current = sellQtyState[key] ?? 1;
    sellQtyState[key] = clampQty(key, current + delta);
    renderSellList();
    updateSellActionBar();
}

function setSellQtyPct(key, pct) {
    const item = sellItems.find(i => i.key === key);
    if (!item) return;
    sellQtyState[key] = clampQty(key, Math.max(1, Math.round(item.qty * pct)));
    renderSellList();
    updateSellActionBar();
}

function toggleSellSelect(key, checked) {
    if (checked) sellSelected.add(key); else sellSelected.delete(key);
    renderSellList();
    updateSellActionBar();
}

function toggleSelectAllSell(checked) {
    const visibleKeys = sellItems.filter(i => i.qty > 0).map(i => i.key);
    if (checked) visibleKeys.forEach(k => sellSelected.add(k));
    else sellSelected.clear();
    renderSellList();
    updateSellActionBar();
}

function updateSellActionBar() {
    const bar = $('sellActionBar');
    if (sellSelected.size === 0) {
        bar.style.display = 'none';
        $('sellSelectedCount').textContent = '';
        $('sellSelectAll').checked = false;
        return;
    }
    let total = 0;
    sellSelected.forEach(key => {
        const item = sellItems.find(i => i.key === key);
        if (!item) return;
        const qty = Math.min(sellQtyState[key] ?? item.qty, item.qty);
        total += item.price * qty;
    });
    bar.style.display = 'flex';
    $('sellActionCount').textContent = `${sellSelected.size} item dipilih`;
    $('sellActionTotal').textContent = `+${fmt(total)} 🪙`;
    $('sellSelectedCount').textContent = `${sellSelected.size} dipilih`;
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

// Jual semua item yang dicentang, masing-masing dengan qty yang sudah diset user.
// Dikirim sequential (bukan paralel) supaya update gold tiap step konsisten dan
// tidak ada race condition di server kalau dua request sell jalan bersamaan.
async function doSellSelected() {
    if (sellSelected.size === 0) return;
    const keys = Array.from(sellSelected);
    let totalGold = 0;
    const soldLines = [];

    for (const key of keys) {
        const item = sellItems.find(i => i.key === key);
        if (!item) continue;
        const qty = Math.min(sellQtyState[key] ?? item.qty, item.qty);
        if (qty <= 0) continue;
        try {
            const res  = await fetch('/api/sell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: senderId(), item: key, qty }),
            });
            const data = await res.json();
            if (data.ok) {
                currentUser.gold = data.user.gold;
                currentUser.inventory = data.user.inventory;
                totalGold += data.totalGold;
                soldLines.push(`${qty}x ${item.name}`);
            }
        } catch { /* lanjut ke item berikutnya walau satu gagal */ }
    }

    updateCharStats(currentUser);
    sellSelected.clear();
    showLifeLog(`💰 Jual Pilihan! <b>+${fmt(totalGold)} Gold</b><br><small>${soldLines.join(', ')}</small>`);
    await loadSellItems();
}

// ─── Sync semua cooldown baru saat load dashboard ───
function syncAllCooldowns(user) {
    syncBattleModeCooldowns(user);
    syncGatherCooldowns(user);
    syncExploreCooldown(user);
    syncAdvCooldown(user);
    syncHuntAnimalCooldown(user);
}

// ════════════════════════════════════════
//  BATTLE MODE COOLDOWNS (Hunt/Dungeon/Beast/Horde)
// ════════════════════════════════════════
// Nilai & field disalin PERSIS dari battle-start.js/battle-action.js (yang juga
// disalin dari bot WA), supaya lock di UI selalu sinkron dengan validasi server.
const BATTLE_MODE_INFO = {
    hunt:    { btn: 'btnHunt',    cd: 'cdHunt',    field: 'lastHunt',    cdMs: 90000,  idle: 'Berburu monster acak. Cepat & sering.' },
    dungeon: { btn: 'btnDungeon', cd: 'cdDungeon', field: 'lastDungeon', cdMs: 180000, idle: 'Floor demi floor. Boss setiap 10F.' },
    beast:   { btn: 'btnBeast',   cd: 'cdBeast',   field: 'lastBoss',    cdMs: 300000, idle: 'Boss 3 fase. Reward terbesar.' },
    horde:   { btn: 'btnHorde',   cd: 'cdHorde',   field: 'lastHorde',   cdMs: 600000, idle: '10 gelombang monster berturut.' },
};
const battleModeTimers = {};

function syncBattleModeCooldowns(user) {
    const now = Date.now();
    Object.entries(BATTLE_MODE_INFO).forEach(([mode, info]) => {
        const last = user[info.field] || 0;
        const elapsed = now - last;
        if (last && elapsed < info.cdMs) {
            startBattleModeCooldown(mode, Math.ceil((info.cdMs - elapsed) / 1000));
        } else {
            const btn = $(info.btn);
            const label = $(info.cd);
            if (btn) btn.disabled = false;
            if (label) label.textContent = info.idle;
        }
    });
}

function startBattleModeCooldown(mode, seconds) {
    const info = BATTLE_MODE_INFO[mode];
    const btn = $(info.btn);
    const label = $(info.cd);
    if (!btn || !label) return;
    btn.disabled = true;
    let left = seconds;

    if (battleModeTimers[mode]) clearInterval(battleModeTimers[mode]);
    const render = () => {
        const m = Math.floor(left / 60);
        const s = left % 60;
        label.textContent = `⏳ ${m > 0 ? `${m}m ${s}s` : `${s}s`}`;
    };
    render();
    battleModeTimers[mode] = setInterval(() => {
        left--;
        if (left <= 0) {
            clearInterval(battleModeTimers[mode]);
            btn.disabled = false;
            label.textContent = info.idle;
        } else {
            render();
        }
    }, 1000);
}

// ════════════════════════════════════════
//  SHOP
// ════════════════════════════════════════
async function showShopPage() {
    if (!currentUser) return;
    $('shopSection').style.display = '';
    $('dashboardSection').style.display = 'none';
    $('shopList').innerHTML = '<p style="text-align:center;opacity:.5">Memuat shop...</p>';
    shopActiveCat = 'all';
    await loadShopItems();
}

function hideShopPage() {
    $('shopSection').style.display = 'none';
    $('dashboardSection').style.display = '';
}

async function loadShopItems() {
    try {
        const res  = await fetch(`/api/shop?id=${encodeURIComponent(senderId())}`);
        const data = await res.json();
        if (!data.ok) { $('shopList').innerHTML = `<p>❌ ${data.error}</p>`; return; }
        shopCategories = data.categories;
        $('shopGoldVal').textContent = `${fmt(data.gold)} 🪙`;
        renderShopCategoryTabs();
        renderShopList();
    } catch { $('shopList').innerHTML = '<p>❌ Gagal memuat shop.</p>'; }
}

function renderShopCategoryTabs() {
    const tabs = [{ key: 'all', icon: '🗂️', label: 'Semua' }, ...shopCategories];
    $('shopCategoryTabs').innerHTML = tabs.map(c => `
        <div class="shop-cat-tab${shopActiveCat === c.key ? ' active' : ''}" onclick="setShopCat('${c.key}')">
            ${c.icon} ${c.label}
        </div>`
    ).join('');
}

function setShopCat(key) {
    shopActiveCat = key;
    renderShopCategoryTabs();
    renderShopList();
}

function renderShopList() {
    const query = ($('shopSearch')?.value || '').toLowerCase();
    const cats = shopActiveCat === 'all'
        ? shopCategories
        : shopCategories.filter(c => c.key === shopActiveCat);

    let html = '';
    cats.forEach(cat => {
        const items = cat.items.filter(i => i.name.toLowerCase().includes(query));
        if (items.length === 0) return;
        html += `<div class="shop-cat-heading"><span>${cat.icon} ${cat.label}</span>${cat.limitText ? `<span class="limit-tag">${cat.limitText}</span>` : ''}</div>`;
        html += items.map(i => `
            <div class="shop-row">
                <div class="shop-row-info">
                    <span class="shop-row-name">${i.name}</span>
                    <span class="shop-row-meta">💰 ${fmt(i.price)}/item${i.showValue ? ` · +${fmt(i.value)} ${i.valueLabel}` : ''}${i.owned > 0 ? `<span class="owned-tag">📦 ${fmt(i.owned)}x</span>` : ''}</span>
                </div>
                <button class="btn-shop-buy" onclick='openBuyModal(${JSON.stringify({ key: i.key, name: i.name, price: i.price })})'>Beli</button>
            </div>`
        ).join('');
    });

    $('shopList').innerHTML = html || '<p style="opacity:.5;text-align:center">Item tidak ditemukan.</p>';
}

function openBuyModal(target) {
    shopBuyTarget = target;
    $('shopBuyTitle').textContent = target.name;
    $('shopBuyPrice').textContent = `💰 ${fmt(target.price)} Gold/item`;
    $('shopBuyQty').value = 1;
    updateBuyTotal();
    $('shopBuyModal').style.display = 'flex';
}

function closeBuyModal() {
    $('shopBuyModal').style.display = 'none';
    shopBuyTarget = null;
}

function adjustBuyQty(delta) {
    const input = $('shopBuyQty');
    const val = Math.max(1, (parseInt(input.value) || 1) + delta);
    input.value = val;
    updateBuyTotal();
}

function updateBuyTotal() {
    if (!shopBuyTarget) return;
    const qty = Math.max(1, parseInt($('shopBuyQty').value) || 1);
    $('shopBuyTotal').textContent = `Total: ${fmt(shopBuyTarget.price * qty)} 🪙`;
}

async function confirmBuy() {
    if (!shopBuyTarget) return;
    const qty = Math.max(1, parseInt($('shopBuyQty').value) || 1);
    try {
        const res  = await fetch('/api/shop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), itemKey: shopBuyTarget.key, qty }),
        });
        const data = await res.json();
        if (!data.ok) { alert(`❌ ${data.error}`); return; }

        currentUser = { ...currentUser, ...data.user };
        updateCharStats(currentUser);
        $('shopGoldVal').textContent = `${fmt(currentUser.gold)} 🪙`;
        closeBuyModal();
        await loadShopItems(); // refresh limit harian & owned count
        showLifeLog(`🛒 Berhasil beli <b>${qty}x ${data.bought.name}</b> — -${fmt(data.totalGold)} 🪙`);
    } catch { alert('❌ Gagal terhubung ke server.'); }
}

// ════════════════════════════════════════
//  INVENTORY (Equip / Unequip / Repair)
// ════════════════════════════════════════
let invData = null;
let invTab = 'gears';

async function showInventoryPage() {
    if (!currentUser) return;
    $('invSection').style.display = '';
    $('dashboardSection').style.display = 'none';
    invTab = 'gears';
    switchInvTab('gears');
    $('invGearsView').innerHTML = '<p style="text-align:center;opacity:.5;padding:20px 0">Memuat inventory...</p>';
    await loadInventory();
}

function hideInventoryPage() {
    $('invSection').style.display = 'none';
    $('dashboardSection').style.display = '';
}

function switchInvTab(tab) {
    invTab = tab;
    $('invTabGears').classList.toggle('active', tab === 'gears');
    $('invTabItems').classList.toggle('active', tab === 'items');
    $('invGearsView').style.display = tab === 'gears' ? '' : 'none';
    $('invItemsView').style.display = tab === 'items' ? '' : 'none';
}

async function loadInventory() {
    try {
        const res = await fetch(`/api/equipment?id=${encodeURIComponent(senderId())}`);
        const data = await res.json();
        if (!data.ok) { $('invGearsView').innerHTML = `<div class="error-text">${data.error}</div>`; return; }
        invData = data;
        renderInventory();
    } catch (e) {
        $('invGearsView').innerHTML = `<div class="error-text">Gagal memuat inventory.</div>`;
    }
}

function renderInventory() {
    if (!invData) return;
    $('invGold').textContent = fmt(invData.gold);

    // ── GEARS TAB ──
    if (invData.gears.length === 0) {
        $('invGearsView').innerHTML = '<div class="error-text" style="text-align:center;padding:20px 0">🗃️ Gudang perlengkapan kosong.</div>';
    } else {
        $('invGearsView').innerHTML = invData.gears.map(g => {
            const duraClass = g.durabilityPct <= 0 ? 'dura-broken' : (g.durabilityPct <= 30 ? 'dura-low' : '');
            const equippedBadge = g.equipped ? '<span class="gear-badge-active">✅ DIPAKAI</span>' : '';
            const needsRepair = g.durability < g.maxDurability;
            return `<div class="gear-card glass-card ${g.equipped ? 'gear-card-active' : ''}">
                <div class="gear-card-top">
                    <div class="gear-icon">${g.icon}</div>
                    <div class="gear-info">
                        <div class="gear-name">${g.label}</div>
                        <div class="gear-stat">${g.icon} +${fmt(g.bonusStat)} ${g.statLabel} &nbsp;•&nbsp; Slot: ${g.type.toUpperCase()}</div>
                    </div>
                    ${equippedBadge}
                </div>
                <div class="gear-dura-row">
                    <div class="gear-dura-bar-wrap"><div class="gear-dura-bar ${duraClass}" style="width:${g.durabilityPct}%"></div></div>
                    <span class="gear-dura-text ${duraClass}">${fmt(g.durability)}/${fmt(g.maxDurability)}</span>
                </div>
                <div class="gear-actions">
                    ${g.equipped
                        ? `<button class="btn-gear btn-unequip" onclick="doUnequip('${g.type}')">📤 Unequip</button>`
                        : `<button class="btn-gear btn-equip" onclick="doEquip(${g.idx})">⚔️ Equip</button>`}
                    ${needsRepair ? `<button class="btn-gear btn-repair" onclick="doRepair(${g.idx})">🔨 Repair</button>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // ── ITEMS TAB ──
    if (invData.inventory.length === 0) {
        $('invItemsView').innerHTML = '<div class="error-text" style="text-align:center;padding:20px 0">📦 Tas item kosong.</div>';
    } else {
        $('invItemsView').innerHTML = `<div class="glass-card">` + invData.inventory.map(it => `
            <div class="inv-item-row">
                <span>${it.name}</span>
                <span class="inv-item-qty">×${fmt(it.qty)}</span>
            </div>`).join('') + `</div>`;
    }
}

async function doEquip(idx, force) {
    try {
        const res = await fetch('/api/equipment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), action: 'equip', idx, force: !!force }),
        });
        const data = await res.json();
        if (!data.ok) {
            if (data.needForce && confirm(`${data.error}\n\nPaksa pakai item rusak ini? (Tidak ada bonus stat)`)) {
                return doEquip(idx, true);
            }
            alert(data.error);
            return;
        }
        invData = data;
        renderInventory();
        await refreshCharacterStats();
    } catch (e) { alert('❌ Gagal equip item.'); }
}

async function doUnequip(slot) {
    try {
        const res = await fetch('/api/equipment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), action: 'unequip', slot }),
        });
        const data = await res.json();
        if (!data.ok) { alert(data.error); return; }
        invData = data;
        renderInventory();
        await refreshCharacterStats();
    } catch (e) { alert('❌ Gagal unequip item.'); }
}

async function doRepair(idx) {
    try {
        const res = await fetch('/api/equipment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), action: 'repair', idx }),
        });
        const data = await res.json();
        if (!data.ok) { alert(data.error); return; }
        invData = data;
        renderInventory();
        alert(data.message);
    } catch (e) { alert('❌ Gagal repair item.'); }
}

// Refresh char-card stats (gold/atk/def etc) tanpa reload halaman penuh
async function refreshCharacterStats() {
    try {
        const res = await fetch(`/api/character?id=${encodeURIComponent(senderId())}`);
        const data = await res.json();
        if (data.ok) {
            currentUser = { ...currentUser, ...data.user };
            updateCharStats(data.user);
        }
    } catch (e) { /* abaikan, tidak kritikal */ }
}

// ════════════════════════════════════════
//  GACHA (Treasure Chamber)
// ════════════════════════════════════════
const TIER_COLOR = { common: '#bbbbbb', uncommon: '#5aa9ff', rare: '#5aa9ff', epic: '#b266ff', legendary: '#ff8fd6', mythic: '#ffd166' };
const TIER_EMOJI_FE = { common: '⚪', uncommon: '🔵', rare: '🔵', epic: '🟣', legendary: '🌈', mythic: '⚡' };

let gachaCrates = null;
let gachaSelectedType = null;

async function showGachaPage() {
    if (!currentUser) return;
    $('gachaSection').style.display = '';
    $('dashboardSection').style.display = 'none';
    $('gachaCrateGrid').innerHTML = '<p style="text-align:center;opacity:.5;padding:20px 0">Memuat peti...</p>';
    await loadGachaCrates();
}

function hideGachaPage() {
    $('gachaSection').style.display = 'none';
    $('dashboardSection').style.display = '';
}

async function loadGachaCrates() {
    try {
        const res = await fetch(`/api/gacha?id=${encodeURIComponent(senderId())}`);
        const data = await res.json();
        if (!data.ok) { $('gachaCrateGrid').innerHTML = `<div class="error-text">${data.error}</div>`; return; }
        gachaCrates = data.crates;
        renderGachaCrates();
    } catch (e) {
        $('gachaCrateGrid').innerHTML = `<div class="error-text">Gagal memuat data crate.</div>`;
    }
}

function renderGachaCrates() {
    $('gachaCrateGrid').innerHTML = gachaCrates.map(c => `
        <div class="gacha-crate-card gacha-crate-${c.type}">
            <div class="gacha-crate-icon">${TIER_EMOJI_FE[c.type] || '🎁'}</div>
            <div class="gacha-crate-name">${c.label}</div>
            <div class="gacha-crate-owned">🔑 Punya: <b>${fmt(c.owned)}</b></div>
            <button class="btn-gacha-open" ${c.owned <= 0 ? 'disabled' : ''} onclick="openGachaQtyModal('${c.type}')">
                ${c.owned <= 0 ? '🔒 Tidak Ada Kunci' : '⚜️ Buka Peti'}
            </button>
        </div>
    `).join('');
}

function openGachaQtyModal(type) {
    gachaSelectedType = type;
    const c = gachaCrates.find(x => x.type === type);
    if (!c) return;
    $('gachaQtyTitle').textContent = `${TIER_EMOJI_FE[type] || '🎁'} ${c.label}`;
    $('gachaQtyOwned').textContent = `Punya: ${fmt(c.owned)} kunci`;
    const qtyInput = $('gachaQty');
    qtyInput.value = 1;
    qtyInput.max = Math.min(10, c.owned);
    $('gachaQtyModal').style.display = '';
}

function closeGachaQtyModal() {
    $('gachaQtyModal').style.display = 'none';
}

function adjustGachaQty(delta) {
    const inp = $('gachaQty');
    let v = (parseInt(inp.value) || 1) + delta;
    const max = parseInt(inp.max) || 10;
    if (v < 1) v = 1;
    if (v > max) v = max;
    inp.value = v;
}

function clampGachaQty() {
    const inp = $('gachaQty');
    let v = parseInt(inp.value) || 1;
    const max = parseInt(inp.max) || 10;
    if (v < 1) v = 1;
    if (v > max) v = max;
    inp.value = v;
}

async function confirmGachaOpen() {
    const type = gachaSelectedType;
    const amount = parseInt($('gachaQty').value) || 1;
    closeGachaQtyModal();

    // ── Reveal overlay: tahap segel terbuka (mirip animasi bot WA) ──
    $('gachaRevealResults').style.display = 'none';
    $('gachaRevealStage').style.display = '';
    $('gachaRevealStatus').textContent = `⚜️ Menyelaraskan ${amount}x ${type.toUpperCase()} KEY dengan segel purba...`;
    $('gachaRevealOverlay').style.display = '';

    setTimeout(() => { $('gachaRevealStatus').textContent = '🔮 Rune mulai berpendar...'; }, 1000);
    setTimeout(() => { $('gachaRevealStatus').textContent = '💥 Segel terbuka! Energi keluar...'; }, 2000);

    try {
        const res = await fetch('/api/gacha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: senderId(), type, amount }),
        });
        const data = await res.json();

        await new Promise(r => setTimeout(r, 3000));

        if (!data.ok) {
            closeGachaReveal();
            showLifeLog(`❌ ${data.error}`);
            return;
        }

        renderGachaResults(data);
        await loadGachaCrates();
        await refreshCharacterStats();
    } catch (e) {
        closeGachaReveal();
        showLifeLog('❌ Gagal terhubung ke server.');
    }
}

function renderGachaResults(data) {
    $('gachaRevealStage').style.display = 'none';
    $('gachaResultTitle').textContent = data.jackpot ? '🌟 JACKPOT LUAR BIASA! 🌟' : `💠 ${data.type.toUpperCase()} TREASURE 💠`;

    let html = '';
    data.rolls.forEach((roll, i) => {
        if (data.rolls.length > 1) html += `<div class="gacha-roll-divider">Peti #${i + 1}${roll.jackpot ? ' ✨' : ''}</div>`;
        roll.loot.forEach(item => {
            const color = TIER_COLOR[item.tier] || '#ccc';
            const emoji = TIER_EMOJI_FE[item.tier] || '⚪';
            const badge = item.special ? 'SPECIAL' : item.bonus ? 'BONUS' : item.tier.toUpperCase();
            html += `<div class="gacha-result-row" style="--tier-color:${color}">
                <span class="gacha-result-emoji">${emoji}</span>
                <span class="gacha-result-name">${item.name}</span>
                <span class="gacha-result-badge">${badge}</span>
            </div>`;
        });
    });
    html += `<div class="gacha-result-total">📦 Total ${data.totalAllItems} item masuk ke inventory.</div>`;
    $('gachaResultList').innerHTML = html;
    $('gachaRevealResults').style.display = '';

    showLifeLog(`⚜️ Buka ${data.amount}x ${data.type.toUpperCase()} CRATE → ${data.totalAllItems} item didapat${data.jackpot ? ' 🌟 JACKPOT!' : ''}`);
}

function closeGachaReveal() {
    $('gachaRevealOverlay').style.display = 'none';
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
