// api/_rpg.js — RPG engine: roleData, recalculateStats, useSkill, monsters
// roleData & recalculateStats DISALIN PERSIS dari rpg.js (bot WA) supaya
// stat ATK/DEF/HP/Mana yang dihitung di web selalu konsisten dengan bot.
// Monster pool untuk mode Hunt/Dungeon/Beast/Horde adalah set khusus versi
// web (bot generate monster secara inline per-encounter, jadi tidak ada
// 1 sumber data yang bisa "dicopy" langsung untuk itu).

const roleData = {
    fighter: {
        name: 'Fighter', emoji: '⚔️',
        weapon: ['sword', 'shield'],
        description: 'Petarung seimbang yang menguasai seni bela diri dan persenjataan berat.',
        stats: { hp: 1.2, atk: 1.7, def: 1.0, speed: 1.0, crit: 0.08 },
        passives: {
            5:  { name: 'Combat Flow', description: 'ATK +5% per turn (Max 50%).', stack: 0.05 },
            20: { name: 'Tenacity',    description: 'Saat HP <30%, DEF +25%.', threshold: 0.3, buff: 0.25 }
        },
        skills: {
            5:  { name: 'Heavy Slash',   mana: 40,  damage: 1.5, cd: 10000,  description: 'Tebasan vertikal. (1.5x)' },
            12: { name: 'War Cry',       mana: 60,  buff: 'atk',  power: 1.3, cd: 30000,  description: 'ATK +30% selama battle.' },
            22: { name: 'Double Strike', mana: 100, damage: 2.2, cd: 20000,  description: 'Dua serangan presisi. (2.2x)' },
            30: { name: 'Blade Dance',   mana: 180, damage: 3.0, effect: 'bleed', cd: 45000, description: 'Damage 3.0x + Bleed.' },
            50: { name: 'Dragon Slayer', mana: 350, damage: 5.0, cd: 120000, description: 'Serangan legendaris. (5.0x)' }
        }
    },
    mage: {
        name: 'Mage', emoji: '🔮',
        weapon: ['wand'],
        description: 'Manipulator energi murni yang mampu memanggil kehancuran dari langit.',
        stats: { hp: 0.8, atk: 1.5, def: 0.7, speed: 0.9, crit: 0.10 },
        passives: {
            5:  { name: 'Mana Well',    description: 'Regen 2% Mana per turn.', regen: 0.02 },
            20: { name: 'Arcane Focus', description: 'Skill damage +15%.', skillBoost: 0.15 }
        },
        skills: {
            5:  { name: 'Magic Missile', mana: 50,  damage: 1.8, cd: 10000,  description: '1.8x magic damage.' },
            12: { name: 'Mana Shield',   mana: 90,  buff: 'def', power: 2.0, cd: 40000,  description: 'DEF x2 sementara.' },
            22: { name: 'Fireball',      mana: 150, damage: 2.8, effect: 'burn', cd: 25000, description: '2.8x + Burn.' },
            30: { name: 'Thunder Storm', mana: 250, damage: 3.5, cd: 50000,  description: '3.5x damage.' },
            50: { name: 'Abyssal Nova',  mana: 500, damage: 6.0, cd: 150000, description: 'Kehancuran total. (6.0x)' }
        }
    },
    archer: {
        name: 'Archer', emoji: '🏹',
        weapon: ['bow'],
        description: 'Pemanah jitu yang mengandalkan mata elang dan kecepatan angin.',
        stats: { hp: 1.0, atk: 1.2, def: 0.8, speed: 1.3, crit: 0.18 },
        passives: {
            5:  { name: 'Eagle Eye', description: 'Ignore 15% DEF musuh.', pierce: 0.15 },
            20: { name: 'Focus',     description: 'Crit chance +10%.', critBoost: 0.10 }
        },
        skills: {
            5:  { name: 'Double Shot',    mana: 45,  damage: 1.8, cd: 10000,  description: '1.8x damage.' },
            12: { name: 'Wind Walk',      mana: 70,  buff: 'speed', power: 1.4, cd: 35000, description: 'Speed x1.4 sementara.' },
            22: { name: 'Poison Arrow',   mana: 120, damage: 2.2, effect: 'poison', cd: 25000, description: '2.2x + Poison.' },
            35: { name: 'Rain of Arrows', mana: 220, damage: 3.2, cd: 50000,  description: '3.2x damage.' },
            50: { name: 'Piercing Heaven',mana: 450, damage: 5.5, cd: 150000, description: 'Tembakan pamungkas. (5.5x)' }
        }
    },
    alchemist: {
        name: 'Alchemist', emoji: '⚗️',
        weapon: ['catalyst'],
        description: 'Peneliti zat terlarang yang mampu mengubah ramuan menjadi senjata pemusnah.',
        stats: { hp: 1.1, atk: 1.1, def: 1.0, speed: 1.1, crit: 0.08 },
        passives: {
            5:  { name: 'Potion Master',  description: 'Efek heal Potion +25%.', potionBoost: 0.25 },
            20: { name: 'Catalyst Power', description: 'Durasi status effect +1 turn.' }
        },
        skills: {
            5:  { name: 'Acid Splash',    mana: 40,  damage: 1.5, effect: 'debuff_def', cd: 12000, description: '1.5x + Debuff DEF.' },
            12: { name: 'Healing Mist',   mana: 80,  heal: 0.25, cd: 40000,  description: 'Heal 25% HP.' },
            22: { name: 'Explosive Flask',mana: 140, damage: 2.5, effect: 'burn', cd: 25000, description: '2.5x + Burn.' },
            35: { name: 'Numbing Gas',    mana: 200, damage: 2.0, effect: 'stun', cd: 60000, description: '2.0x + Stun.' },
            50: { name: 'Magnum Opus',    mana: 400, damage: 5.5, cd: 150000, description: 'Reaksi berantai mutlak. (5.5x)' }
        }
    },
    defender: {
        name: 'Tanker', emoji: '🛡️',
        weapon: ['shield', 'sword'],
        description: 'Benteng tak tergoyahkan yang bersumpah untuk melindungi dan bertahan.',
        stats: { hp: 1.8, atk: 0.8, def: 1.8, speed: 0.7, crit: 0.02 },
        passives: {
            5:  { name: 'Spiked Armor', description: 'Pantulkan 10% damage musuh.', reflect: 0.1 },
            20: { name: 'Sturdy Body',  description: 'Damage dari Boss -20%.', bossResist: 0.2 }
        },
        skills: {
            5:  { name: 'Shield Bash',    mana: 30,  damage: 1.0, effect: 'stun', cd: 8000, description: '1.0x + Stun.' },
            12: { name: 'Iron Wall',      mana: 70,  buff: 'def', power: 2.5, cd: 45000, description: 'DEF x2.5 sementara.' },
            22: { name: 'Holy Provoke',   mana: 90,  buff: 'def', power: 1.5, cd: 30000, description: 'DEF x1.5 sementara.' },
            30: { name: 'Earthquake',     mana: 180, damage: 2.0, effect: 'stun', cd: 60000, description: '2.0x + Stun.' },
            50: { name: 'Execution',      mana: 400, damage: 5.5, cd: 200000, description: 'Serangan penghakiman. (5.5x)' }
        }
    },
    assassin: {
        name: 'Assassin', emoji: '🗡️',
        weapon: ['dagger'],
        description: 'Penari bayangan yang menyelesaikan pertempuran sebelum musuh menyadarinya.',
        stats: { hp: 0.9, atk: 1.1, def: 0.8, speed: 1.4, crit: 0.17 },
        passives: {
            5:  { name: 'Lethal Precision', description: 'Crit damage x2.2 (base x2.0).', critDmg: 0.5 },
            20: { name: 'Invisibility',     description: 'Dodge chance +20%.', dodge: 0.2 },
            25: { name: 'Execute',          description: 'DMG +25% saat HP musuh di bawah 50%.', executeBonus: 0.25 }
        },
        skills: {
            5:  { name: 'Quick Stab',     mana: 40,  damage: 1.2, cd: 7000,  description: '1.2x damage.' },
            12: { name: 'Agility Boost',  mana: 80,  buff: 'speed', power: 1.5, cd: 40000, description: 'Speed x1.5 sementara.' },
            22: { name: 'Backstab',       mana: 130, damage: 3.0, effect: 'poison', cd: 25000, description: '3.0x + Poison.' },
            30: { name: 'Phantom Strike', mana: 220, damage: 3.8, cd: 50000,  description: '3.8x damage.' },
            50: { name: 'Execution',      mana: 450, damage: 5.5, cd: 200000, description: 'Eksekusi instan. (5.5x)' }
        }
    },
    wraith: {
        name: 'Wraith', emoji: '💀',
        weapon: ['scythe'],
        description: 'Manifestasi kematian yang melintasi dunia fisik dan astral.',
        stats: { hp: 1.5, atk: 1.8, def: 1.2, speed: 1.0, crit: 0.20 },
        passives: {
            5:  { name: 'Soul Eater',   description: 'Lifesteal 5% per serangan.', lifesteal: 0.05 },
            20: { name: 'Shadow Cloak', description: 'Dodge chance +15%.', dodge: 0.15 }
        },
        skills: {
            5:  { name: 'Soul Reap',      mana: 60,  damage: 2.0, cd: 12000, description: '2.0x damage.' },
            12: { name: 'Shadow Form',    mana: 100, buff: 'speed', power: 2.0, cd: 60000, description: 'Speed x2 sementara.' },
            22: { name: 'Abyssal Chains', mana: 160, damage: 2.5, effect: 'stun', cd: 30000, description: '2.5x + Stun.' },
            30: { name: 'Vampiric Touch', mana: 200, heal: 0.3, cd: 45000, description: 'Heal 30% HP.' },
            50: { name: 'Death Sentence', mana: 350, damage: 4.5, cd: 70000, description: '4.5x damage.' }
        }
    }
};

function getReqExp(lvl) {
    if (lvl < 499) return lvl * 50;
    const penalty = 1 + ((lvl - 498) * 0.05);
    return Math.floor(lvl * 50 * penalty);
}

function recalculateStats(u) {
    if (!u.equipped) u.equipped = {};
    if (!u.ownedGears) u.ownedGears = [];

    const role = roleData[u.role] || { stats: { hp: 1, atk: 1, def: 1, speed: 1.0, crit: 0.02 } };

    u.maxHp   = Math.floor((100 + (u.level * 20)) * role.stats.hp) + (u.bonusMaxHp || 0);
    u.maxMana = Math.floor((50 + (u.level * 5)) * (u.role === 'mage' ? 2 : 1)) + (u.bonusMaxMana || 0);

    let weaponAtk = 0;
    ['sword','wand','dagger','scythe','bow','catalyst'].forEach(slot => {
        if (u.equipped[slot]) {
            const item = u.ownedGears.find(g => g.id === u.equipped[slot]);
            if (item && item.durability > 0) weaponAtk += item.bonusStat;
        }
    });

    let armorDef = 0;
    ['helmet','chestplate','leggings','boots','shield'].forEach(slot => {
        if (u.equipped[slot]) {
            const arm = u.ownedGears.find(g => g.id === u.equipped[slot]);
            if (arm && arm.durability > 0) armorDef += arm.bonusStat;
        }
    });

    const baseAtk = u.baseAtk || 10;
    const baseDef = u.baseDef || 5;
    u.atk      = Math.floor(((baseAtk + (u.level * 2)) * role.stats.atk) + weaponAtk);
    u.def      = Math.floor(((baseDef + (u.level * 1.5)) * role.stats.def) + armorDef);
    u.speed    = role.stats.speed || 1.0;
    u.critRate = role.stats.crit || 0.02;

    if (u.hp > u.maxHp) u.hp = u.maxHp;
    if (u.mana > u.maxMana) u.mana = u.maxMana;
}

// Terapkan buff sementara (dari skill 'buff') di atas hasil recalculateStats.
// Dipanggil SETELAH setiap recalculateStats() supaya buff tidak ke-reset.
function applyBattleBuffs(u, b) {
    if (!b || !b.buffs) return;
    if (b.buffs.atk)   u.atk   = Math.floor(u.atk   * b.buffs.atk);
    if (b.buffs.def)   u.def   = Math.floor(u.def   * b.buffs.def);
    if (b.buffs.speed) u.speed = u.speed * b.buffs.speed;
}

function levelUpCheck(u, logLines) {
    let leveled = false;
    while (u.exp >= getReqExp(u.level)) {
        u.exp -= getReqExp(u.level);
        u.level++;
        leveled = true;
    }
    if (leveled) {
        recalculateStats(u);
        u.hp = u.maxHp;
        u.mana = u.maxMana;
        if (logLines) logLines.push({ type: 'levelup', text: `⭐ LEVEL UP! Sekarang Level ${u.level}!` });
    }
    return leveled;
}

function useSkillRPG(user, skillName) {
    const role = roleData[user.role];
    if (!role) return { success: false, msg: '❌ Role tidak valid.' };

    const skill = Object.values(role.skills).find(
        s => s.name.toLowerCase() === skillName.toLowerCase()
    );
    if (!skill) return { success: false, msg: `❌ Skill "${skillName}" tidak ditemukan.` };

    const reqLvl = Object.keys(role.skills).find(lvl => role.skills[lvl].name === skill.name);
    if (user.level < parseInt(reqLvl)) return { success: false, msg: `❌ Level ${reqLvl} diperlukan.` };

    if ((user.mana || 0) < skill.mana) return { success: false, msg: `❌ Mana tidak cukup! (${user.mana}/${skill.mana})` };

    const now = Date.now();
    if (!user.cooldowns) user.cooldowns = {};
    const cdEnd = user.cooldowns[skill.name] || 0;
    if (now < cdEnd) {
        const sisa = Math.ceil((cdEnd - now) / 1000);
        return { success: false, msg: `⏳ Skill "${skill.name}" masih cooldown ${sisa}s.` };
    }

    user.mana -= skill.mana;
    user.cooldowns[skill.name] = now + (skill.cd || 0);

    return { success: true, skill };
}

function getEquippedItem(u, slotType) {
    const gearId = u.equipped?.[slotType];
    return gearId ? (u.ownedGears || []).find(g => g.id === gearId) : null;
}

function decreaseDurability(u, slotType, amount = 1) {
    const gearId = u.equipped?.[slotType];
    if (!gearId) return { broke: false, msg: '' };
    const gear = (u.ownedGears || []).find(g => g.id === gearId);
    if (!gear) { u.equipped[slotType] = null; return { broke: false, msg: '' }; }

    gear.durability -= amount;
    if (gear.durability > 0 && gear.durability <= 10) {
        return { broke: false, msg: `⚠️ Durabilitas ${gear.name} tersisa ${gear.durability}! Segera repair.` };
    }
    if (gear.durability <= 0) {
        gear.durability = 0;
        u.equipped[slotType] = null;
        return { broke: true, msg: `🛠️ ${gear.name} rusak parah dan terlepas! Gunakan .repair (bot) atau menu Repair untuk perbaiki.` };
    }
    return { broke: false, msg: '' };
}

// ── LIFE SKILL TABLES (disalin dari rpg.js) ──
const ORE_TABLE = [
    { name: 'Batu',       key: 'stone',         min: 5, max: 15, chance: 1.0,  exp: 5,    minLvl: 1 },
    { name: 'Batu Bara',  key: 'coal',          min: 3, max: 8,  chance: 0.6,  exp: 10,   minLvl: 1 },
    { name: 'Tembaga',    key: 'copper',        min: 2, max: 6,  chance: 0.8,  exp: 15,   minLvl: 1 },
    { name: 'Besi',       key: 'iron',          min: 2, max: 5,  chance: 0.7,  exp: 20,   minLvl: 2 },
    { name: 'Perak',      key: 'silver',        min: 1, max: 4,  chance: 0.5,  exp: 35,   minLvl: 2 },
    { name: 'Emas',       key: 'gold_ore',      min: 1, max: 3,  chance: 0.3,  exp: 50,   minLvl: 3 },
    { name: 'Mythril',    key: 'mythril',       min: 1, max: 1,  chance: 0.05, exp: 500,  minLvl: 3 },
    { name: 'Sapphire',   key: 'sapphire',      min: 1, max: 2,  chance: 0.15, exp: 100,  minLvl: 3 },
    { name: 'Ruby',       key: 'ruby',          min: 1, max: 2,  chance: 0.12, exp: 120,  minLvl: 3 },
    { name: 'Emerald',    key: 'emerald',       min: 1, max: 2,  chance: 0.10, exp: 150,  minLvl: 4 },
    { name: 'Berlian',    key: 'diamond',       min: 1, max: 2,  chance: 0.08, exp: 200,  minLvl: 4 },
    { name: 'Obsidian',   key: 'obsidian_ore',  min: 1, max: 1,  chance: 0.02, exp: 1000, minLvl: 5 },
];

const WOOD_TABLE = [
    { name: 'Kayu',          key: 'wood',         min: 10, max: 20, chance: 1.0,  exp: 5  },
    { name: 'Daun',          key: 'leaf',         min: 5,  max: 12, chance: 0.8,  exp: 2  },
    { name: 'Apel',          key: 'apple',        min: 1,  max: 3,  chance: 0.45, exp: 10 },
    { name: 'Mangga',        key: 'mango',        min: 1,  max: 2,  chance: 0.25, exp: 20 },
    { name: 'Blueberry',     key: 'blueberry',    min: 2,  max: 5,  chance: 0.3,  exp: 15 },
    { name: 'Sarang Burung', key: 'nest',         min: 1,  max: 1,  chance: 0.1,  exp: 50 },
    { name: 'Getah Maple',   key: 'maple_syrup',  min: 1,  max: 2,  chance: 0.15, exp: 40 },
];

const FISH_TABLE = [
    { name: 'Lele',      key: 'lele',      chance: 0.60, exp: 10,   minRod: 1  },
    { name: 'Nila',      key: 'nila',      chance: 0.50, exp: 15,   minRod: 1  },
    { name: 'Mujair',    key: 'mujair',    chance: 0.40, exp: 20,   minRod: 1  },
    { name: 'Gurame',    key: 'gurame',    chance: 0.30, exp: 30,   minRod: 2  },
    { name: 'Salmon',    key: 'salmon',    chance: 0.15, exp: 50,   minRod: 3  },
    { name: 'Tuna',      key: 'tuna',      chance: 0.10, exp: 80,   minRod: 4  },
    { name: 'Hiu',       key: 'hiu',       chance: 0.05, exp: 200,  minRod: 5  },
    { name: 'Paus',      key: 'paus',      chance: 0.02, exp: 500,  minRod: 7  },
    { name: 'Leviathan', key: 'leviathan', chance: 0.005,exp: 2000, minRod: 10 },
];

const PLANT_TABLE = {
    wheat:     { seed: 'wheat_seeds',     hasil: 'wheat',     exp: 30,  base: 5,  time: 60000   },
    carrot:    { seed: 'carrot_seeds',    hasil: 'carrot',    exp: 40,  base: 6,  time: 120000  },
    potato:    { seed: 'potato_seeds',    hasil: 'potato',    exp: 50,  base: 6,  time: 180000  },
    corn:      { seed: 'corn_seeds',      hasil: 'corn',      exp: 65,  base: 8,  time: 300000  },
    tomato:    { seed: 'tomato_seeds',    hasil: 'tomato',    exp: 73,  base: 10, time: 600000  },
    pumpkin:   { seed: 'pumpkin_seeds',   hasil: 'pumpkin',   exp: 99,  base: 12, time: 900000  },
    melon:     { seed: 'melon_seeds',     hasil: 'melon',     exp: 120, base: 15, time: 1200000 },
    beetroot:  { seed: 'beetroot_seeds',  hasil: 'beetroot',  exp: 150, base: 18, time: 1800000 },
    cocoa:     { seed: 'cocoa_beans',     hasil: 'chocolate', exp: 190, base: 20, time: 3600000 },
    coconut:   { seed: 'coconut_seeds',   hasil: 'coconut',   exp: 200, base: 1,  time: 7200000 },
};

const GATHER_COOLDOWN = { mine: 60000, chop: 45000, fish: 30000 };


const HUNT_MONSTERS = [
    { name: 'Goblin Liar',     emoji: '👺', hp: 300,  atk: 40,  def: 10, exp: 120, gold: 80  },
    { name: 'Skeleton Archer', emoji: '🦴', hp: 280,  atk: 55,  def: 5,  exp: 130, gold: 90  },
    { name: 'Forest Troll',    emoji: '👹', hp: 500,  atk: 70,  def: 25, exp: 200, gold: 150 },
    { name: 'Dark Wolf',       emoji: '🐺', hp: 350,  atk: 65,  def: 15, exp: 160, gold: 120 },
    { name: 'Stone Golem',     emoji: '🗿', hp: 700,  atk: 50,  def: 50, exp: 250, gold: 200 },
    { name: 'Vampire Bat',     emoji: '🦇', hp: 240,  atk: 60,  def: 8,  exp: 140, gold: 100 },
    { name: 'Plague Rat',      emoji: '🐀', hp: 180,  atk: 45,  def: 5,  exp: 100, gold: 70  },
    { name: 'Cursed Scarecrow',emoji: '🎃', hp: 420,  atk: 58,  def: 18, exp: 180, gold: 130 },
];

const DUNGEON_MONSTERS = [
    { name: 'Dungeon Slime',   emoji: '🟢', hp: 400,  atk: 45,  def: 15, exp: 150, gold: 100 },
    { name: 'Bone Knight',     emoji: '⚔️', hp: 600,  atk: 80,  def: 40, exp: 250, gold: 180 },
    { name: 'Shadow Demon',    emoji: '😈', hp: 550,  atk: 90,  def: 20, exp: 280, gold: 200 },
    { name: 'Iron Golem',      emoji: '🤖', hp: 900,  atk: 65,  def: 70, exp: 350, gold: 250 },
    { name: 'Dungeon Warden',  emoji: '🏰', hp: 750,  atk: 100, def: 50, exp: 320, gold: 230 },
];

const BOSS_MONSTERS = [
    { name: 'Dragon King',     emoji: '🐉', hp: 5000, atk: 200, def: 100, exp: 2000, gold: 1500, isBoss: true },
    { name: 'Lich Lord',       emoji: '💀', hp: 4500, atk: 220, def: 80,  exp: 1800, gold: 1400, isBoss: true },
    { name: 'Behemoth',        emoji: '🦣', hp: 6000, atk: 180, def: 150, exp: 2200, gold: 1800, isBoss: true },
    { name: 'Void Titan',      emoji: '🌑', hp: 7000, atk: 250, def: 120, exp: 2500, gold: 2000, isBoss: true },
    { name: 'Arch Demon',      emoji: '👿', hp: 5500, atk: 240, def: 90,  exp: 2100, gold: 1700, isBoss: true },
];

const LOOT_TABLE = {
    common: ['potion','iron_ore','wood','stone','herb'],
    uncommon: ['magic_dust','beast_hide','crystal_shard','key_common'],
    rare: ['ancient_relic','dragon_scale','key_uncommon','elixir_of_rebirth'],
};

function getRandomLoot(isBoss, floor = 1) {
    const drops = {};
    const count = isBoss ? 3 : Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < count; i++) {
        const rng = Math.random();
        let pool;
        if (isBoss || rng < 0.15) pool = LOOT_TABLE.rare;
        else if (rng < 0.40) pool = LOOT_TABLE.uncommon;
        else pool = LOOT_TABLE.common;
        const item = pool[Math.floor(Math.random() * pool.length)];
        drops[item] = (drops[item] || 0) + 1;
    }
    if (Math.random() < 0.15) drops['potion'] = (drops['potion'] || 0) + 1;
    return drops;
}

// ─── EXPLORE ───────────────────────────────────────────────────────────────
const EXPLORE_COOLDOWN = 120000; // 2 menit (sama dengan bot)
const EXPLORE_LOCATIONS = [
    { name: 'Emeralda Village',           gold: 500,   exp: 100,   item: 'Apple',           drop: 'wood'          },
    { name: 'Whispering Woods',           gold: 650,   exp: 220,   item: 'Blueberries',     drop: 'leaf'          },
    { name: 'Goblin Iron Mine',           gold: 750,   exp: 300,   item: 'Stone',           drop: 'iron'          },
    { name: 'Slime Marshland',            gold: 800,   exp: 350,   item: 'Slime Ball',      drop: 'clay'          },
    { name: 'Kingdom of Astralia',        gold: 1200,  exp: 600,   item: 'Wine',            drop: 'silver'        },
    { name: 'Frozen Tundra of Niflheim',  gold: 1500,  exp: 800,   item: 'Ancient Ice',     drop: 'steel'         },
    { name: 'Burning Ember Peaks',        gold: 1800,  exp: 1000,  item: 'Sulfur',          drop: 'coal'          },
    { name: 'Sunken Ruins of Atlantis',   gold: 2200,  exp: 1300,  item: 'Jade',            drop: 'gold_ore'      },
    { name: 'Great Sage Library',         gold: 2500,  exp: 1800,  item: 'Papyrus',         drop: 'mana_crystal'  },
    { name: "Dragon's Nest Crater",       gold: 4000,  exp: 3000,  item: 'Dragon Scale',    drop: 'gold_bar'      },
    { name: 'Cursed Shadow Valley',       gold: 4500,  exp: 3500,  item: 'Dark Matter',     drop: 'obsidian_ore'  },
    { name: 'Holy Sanctuary of Eden',     gold: 5000,  exp: 4000,  item: 'Golden Feather',  drop: 'mythril'       },
    { name: 'Valley of the Immortals',    gold: 6000,  exp: 5500,  item: 'Ginseng',         drop: 'diamond'       },
    { name: 'Void Abyss Dimension',       gold: 10000, exp: 8000,  item: 'Void Crystal',    drop: 'astral_shard'  },
    { name: 'Chrono Rift Sanctuary',      gold: 15000, exp: 12000, item: 'Chrono Dust',     drop: 'infinity_stone'},
    { name: 'Heavenly Realm Gate',        gold: 25000, exp: 20000, item: 'Celestial Tear',  drop: 'god_soul'      },
    { name: 'Hell Gate Pandemonium',      gold: 30000, exp: 25000, item: 'Demon Lord Horn', drop: 'abyss_heart'   },
    { name: 'The Origin Tree Root',       gold: 50000, exp: 45000, item: 'World Tree Root', drop: 'genesis_seed'  },
    { name: 'The Omi Workshop',           gold: 75000, exp: 60000, item: 'Titan Blood',     drop: 'omni_core'     },
];

// ─── ADVENTURE ─────────────────────────────────────────────────────────────
const ADVENTURE_COOLDOWN = 60000; // 1 menit (sama dengan bot)
const ADVENTURE_EVENTS = [
    { msg: 'menemukan markas bandit',                                       gold: 500,  exp: 99,  hp: -20 },
    { msg: 'menjelajahi gua tua',                                           gold: 800,  exp: 80,  hp: -10 },
    { msg: 'menemukan reruntuhan kuno',                                     gold: 1200, exp: 90,  hp: -25 },
    { msg: 'memasuki dungeon kecil',                                        gold: 900,  exp: 200, hp: -35 },
    { msg: 'membantu warga desa dari serangan serigala',                    gold: 600,  exp: 150, hp: -15 },
    { msg: 'menemukan peti harta karun karam di tepi sungai',               gold: 2500, exp: 50,  hp: -5  },
    { msg: 'tersesat di hutan kabut dan diserang tanaman merambat',         gold: 300,  exp: 300, hp: -40 },
    { msg: 'menemukan kuil tersembunyi yang dijaga oleh golem',             gold: 1800, exp: 500, hp: -50 },
    { msg: 'mencuri simpanan makanan ogre yang sedang tidur',               gold: 1500, exp: 120, hp: -10 },
    { msg: 'menyelamatkan pedagang yang kereta kudanya terbalik',           gold: 2000, exp: 250, hp: -20 },
    { msg: 'menjelajahi reruntuhan kastil yang berhantu',                   gold: 1100, exp: 450, hp: -45 },
    { msg: 'menemukan air terjun ajaib yang menyegarkan (sedikit luka)',   gold: 400,  exp: 100, hp: -2  },
];

// ─── HUNT ANIMAL ───────────────────────────────────────────────────────────
const HUNT_ANIMAL_COOLDOWN = 30000; // 30 detik (sama dengan bot)
const HUNT_ANIMALS = [
    { name: 'Ayam',      meat: 'chicken_meat',   qty: 2,  exp: 5   },
    { name: 'Bebek',     meat: 'duck_meat',       qty: 2,  exp: 6   },
    { name: 'Kelinci',   meat: 'rabbit_meat',     qty: 1,  exp: 8   },
    { name: 'Kambing',   meat: 'mutton',           qty: 3,  exp: 15  },
    { name: 'Sapi',      meat: 'beef',             qty: 5,  exp: 25  },
    { name: 'Babi Hutan',meat: 'pork',             qty: 4,  exp: 20  },
    { name: 'Rusa',      meat: 'venison',          qty: 4,  exp: 35  },
    { name: 'Kuda Liar', meat: 'horse_meat',       qty: 7,  exp: 45  },
    { name: 'Gajah',     meat: 'elephant_meat',    qty: 15, exp: 100 },
    { name: 'Jerapah',   meat: 'giraffe_meat',     qty: 10, exp: 80  },
];

// ─── SELL PRICES (disalin persis dari bot) ─────────────────────────────────
const SELL_PRICES = {
    // 🪨 MINING & MINERALS
    stone: 5, iron: 20, copper: 15, silver: 40, gold_ore: 80,
    steel: 150, coal: 15, stick: 3, string: 8, clay: 10,
    obsidian_ore: 500, gunpowder: 60, bone: 20, slime_ball: 30,
    sapphire: 150, ruby: 180, emerald: 220, diamond: 800,
    mythril: 2500, jade: 300, gold_bar: 4000, ancient_coin: 1500,
    // 🎣 FISHING
    lele: 15, nila: 20, mujair: 25, gurame: 45, patin: 45,
    bandeng: 35, tongkol: 60, salmon: 100, tuna: 120,
    hiu: 600, paus: 1500, leviathan: 7000, trash: 2,
    // 🌾 FARMING
    wheat: 15, carrot: 25, potato: 28, corn: 40, tomato: 45,
    pumpkin: 80, melon: 110, beetroot: 130, chocolate: 250,
    coconut: 500, pizza_slice: 35, turkish_delight: 80,
    // 🌳 FORAGING & FRUITS
    wood: 6, leaf: 3, cherry: 10, blueberry: 9, blueberries: 15,
    apple: 12, orange: 18, mango: 30, guava: 25, nest: 60,
    ginseng: 400, maple_syrup: 120,
    // 🥩 HUNTING & RAW MEAT
    chicken_meat: 18, duck_meat: 22, rabbit_meat: 25, mutton: 30,
    beef: 55, pork: 40, venison: 80, horse_meat: 90, camel_meat: 100,
    turkey_meat: 45, poultry: 15, elephant_meat: 300, giraffe_meat: 250,
    leather: 60, kangaroo_pouch: 250,
    // 🍳 COOKED FOOD
    steak: 120, fish_soup: 80, bread: 40, roasted_chicken: 90, fruit_salad: 60,
    // 🦠 LOW-TIER MONSTER LOOT
    goblin_ear: 15, wolf_fang: 20, spider_web: 12, bat_wing: 18,
    orc_skin: 30, harpy_feather: 35, zombie_flesh: 10, skull: 25,
    rat_tail: 8, snake_scale: 22,
    // 👹 MID-TIER MONSTER LOOT
    troll_blood: 80, minotaur_horn: 150, griffin_claw: 180, basilisk_scale: 200,
    chimera_tail: 190, gargoyle_stone: 120, vampire_fang: 160, werewolf_pelt: 140, golem_core: 350,
    // 🧪 ALCHEMY & HERBS
    red_mushroom: 20, glowing_mushroom: 45, venom_sac: 50,
    moonflower: 120, mandrake_root: 150, fairy_dust: 80, elf_tear: 250,
    // 🔮 ELEMENTAL CORES
    fire_core: 400, ice_core: 400, thunder_core: 400, wind_core: 400,
    earth_core: 400, shadow_core: 500, light_core: 500, magic_scroll: 300,
    // ⚙️ SCRAP & JUNK
    broken_sword: 8, rusted_armor: 12, torn_cloth: 4, scrap_metal: 7,
    glass_shard: 5, empty_bottle: 3,
    // 🎭 MISC & EXPLORATION
    batik: 200, katana_fragment: 800, tech_parts: 700, vodka: 120,
    wine: 220, golden_feather: 1200, sombrero: 90, papyrus: 150,
    oil_barrel: 900, ancient_ice: 1800, mana_crystal: 2500,
    // 👑 BOSS DROPS & SUPER RARE
    dragon_scale: 4000, dark_matter: 5000, unicorn_horn: 6500,
    void_crystal: 8000, astral_shard: 10000, chrono_dust: 13000,
    infinity_stone: 18000, god_soul: 25000, omni_core: 20000,
    genesis_seed: 18000, abyss_heart: 30000,
    the_creator_spark: 75000, excalibur_fragment: 120000,
    dragon_heart: 180000, phoenix_ashes: 150000,
    demon_lord_horn: 200000, celestial_tear: 250000,
    dark_orbit_core: 220000, world_tree_root: 210000,
    nebulium_ingot: 300000, titan_blood: 240000, pandora_box: 400000,
};

// Item yang tidak boleh dijual
const SELL_PROTECTED = ['item_box', 'spatial_ring', 'divine_eye', 'elixir_of_rebirth', 'chronos_hourglass'];

module.exports = {
    roleData, recalculateStats, applyBattleBuffs, useSkillRPG, getReqExp, levelUpCheck,
    getEquippedItem, decreaseDurability,
    ORE_TABLE, WOOD_TABLE, FISH_TABLE, PLANT_TABLE, GATHER_COOLDOWN,
    HUNT_MONSTERS, DUNGEON_MONSTERS, BOSS_MONSTERS, getRandomLoot,
    EXPLORE_LOCATIONS, EXPLORE_COOLDOWN,
    ADVENTURE_EVENTS, ADVENTURE_COOLDOWN,
    HUNT_ANIMALS, HUNT_ANIMAL_COOLDOWN,
    SELL_PRICES, SELL_PROTECTED,
};
