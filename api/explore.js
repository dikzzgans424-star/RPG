// api/explore.js — API untuk Hunt Animal, Adventure, dan Explore
const { loadRpgDB, saveUserData, normalizeJid } = require('./_db');
const { recalculateStats, getEquippedItem, decreaseDurability } = require('./_rpg');

function ribu(n) { return Number(Math.floor(n)).toLocaleString('id-ID'); }

const EXPLORE_DATA = {
    huntanimal: { cd: 30000, lastField: 'lastHuntAnimal' },
    adventure: { cd: 60000, lastField: 'lastTreasure' },
    explore: { cd: 120000, lastField: 'lastExplore' }
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { senderId: rawId, type } = req.body;
    const senderId = normalizeJid(rawId);
    if (!senderId || !type || !EXPLORE_DATA[type]) return res.status(400).json({ error: 'Data tidak lengkap' });

    try {
        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan.' });

        const now = Date.now();
        const info = EXPLORE_DATA[type];
        const lastTime = user[info.lastField] || 0;
        const sisaCD = info.cd - (now - lastTime);

        if (sisaCD > 0) {
            return res.status(400).json({ error: `Cooldown. Tunggu ${Math.ceil(sisaCD / 1000)} detik.` });
        }

        let totalExp = 0;
        let totalGold = 0;
        let hpLoss = 0;
        let rewards = [];
        let durabilityLogs = [];

        // 1. HUNT ANIMAL (BERBURU)
        if (type === 'huntanimal') {
            let activeWeaponSlot = ['sword', 'wand', 'dagger', 'scythe', 'bow', 'catalyst'].find(slot => user.equipped[slot]);
            if (!activeWeaponSlot) return res.status(400).json({ error: '❌ Kamu butuh senjata yang dipakai untuk berburu hewan!' });
            
            let eqWeapon = getEquippedItem(user, activeWeaponSlot);
            let weaponLvl = eqWeapon ? (eqWeapon.tier || eqWeapon.level || 0) : 0;
            let bonusMeat = Math.floor(weaponLvl / 2);

            const animals = [
                { name: 'Ayam', meat: 'chicken_meat', qty: 2, exp: 5 }, { name: 'Bebek', meat: 'duck_meat', qty: 2, exp: 6 },
                { name: 'Kelinci', meat: 'rabbit_meat', qty: 1, exp: 8 }, { name: 'Kambing', meat: 'mutton', qty: 3, exp: 15 },
                { name: 'Sapi', meat: 'beef', qty: 5, exp: 25 }, { name: 'Babi Hutan', meat: 'pork', qty: 4, exp: 20 },
                { name: 'Rusa', meat: 'venison', qty: 4, exp: 35 }
            ];

            const animal = animals[Math.floor(Math.random() * animals.length)];
            let finalQty = animal.qty + bonusMeat; 
            totalExp = animal.exp + (weaponLvl * 2);

            user.inventory[animal.meat] = (user.inventory[animal.meat] || 0) + finalQty;
            rewards.push(`+${finalQty}x ${animal.meat.replace('_', ' ').toUpperCase()}`);

            if (Math.random() < 0.3) {
                user.inventory.leather = (user.inventory.leather || 0) + 1;
                rewards.push(`+1x LEATHER (✨ Bonus)`);
            }

            let duraDmg = decreaseDurability(user, activeWeaponSlot, 1);
            if (duraDmg && duraDmg.broke) durabilityLogs.push(duraDmg.msg);
        }

        // 2. ADVENTURE (PETUALANGAN)
        else if (type === 'adventure') {
            if (user.hp < 30) return res.status(400).json({ error: '❌ HP kamu terlalu rendah! Minimal 30 HP.' });
            
            let wType = ['sword', 'wand', 'dagger', 'scythe', 'bow', 'catalyst'].find(s => user.equipped[s]);
            let eqSword = wType ? getEquippedItem(user, wType) : null;
            let swordLvl = eqSword ? (eqSword.tier || 0) : 0;
            let swordBonus = 1 + (swordLvl * 0.1);

            const events = [
                { msg: 'menemukan markas bandit', gold: 500, exp: 99, hp: -20 },
                { msg: 'menjelajahi gua tua', gold: 800, exp: 80, hp: -10 },
                { msg: 'menyelamatkan warga desa dari serigala', gold: 600, exp: 150, hp: -15 },
                { msg: 'menemukan peti harta karun', gold: 2500, exp: 50, hp: -5 },
                { msg: 'tersesat di hutan kabut', gold: 300, exp: 300, hp: -40 },
                { msg: 'menjelajahi reruntuhan berhantu', gold: 1100, exp: 450, hp: -45 }
            ];

            const event = events[Math.floor(Math.random() * events.length)];
            totalGold = Math.floor(event.gold * swordBonus); 
            hpLoss = Math.min(-2, event.hp + (user.def || 0)); // Pengurangan HP (Maksimal -2)
            if (hpLoss > 0) hpLoss = -2; // Pastikan tetap ngurangin darah minimal 2
            totalExp = event.exp;

            user.gold += totalGold;
            user.hp = Math.max(1, user.hp + hpLoss); // Gak bisa mati dari adv, sisa 1
            rewards.push(`Aksi: ${event.msg}`);
            rewards.push(`💔 Kehilangan ${hpLoss} HP`);

            if (wType) {
                let duraDmg = decreaseDurability(user, wType, 1);
                if (duraDmg && duraDmg.broke) durabilityLogs.push(duraDmg.msg);
            }

            if (Math.random() < 0.5) {
                if (user.equipped.shield && Math.random() < 0.5) {
                    let dShield = decreaseDurability(user, 'shield', 1);
                    if (dShield && dShield.broke) durabilityLogs.push(dShield.msg);
                } else {
                    let armorParts = ['helmet', 'chestplate', 'leggings', 'boots'].filter(p => user.equipped[p]);
                    if (armorParts.length > 0) {
                        let randPart = armorParts[Math.floor(Math.random() * armorParts.length)];
                        let aDura = decreaseDurability(user, randPart, 1);
                        if (aDura && aDura.broke) durabilityLogs.push(aDura.msg);
                    }
                }
            }
        }

        // 3. EXPLORE (JELAJAH DUNIA)
        else if (type === 'explore') {
            let levelBonus = Math.floor(user.level * 2);
            const locations = [
                { name: 'Emeralda Village', gold: 500, exp: 100, item: 'Apple', drop: 'wood' },
                { name: 'Slime Marshland', gold: 800, exp: 350, item: 'Slime Ball', drop: 'clay' },
                { name: 'Frozen Tundra', gold: 1500, exp: 800, item: 'Ancient Ice', drop: 'steel' },
                { name: 'Dragon’s Nest', gold: 4000, exp: 3000, item: 'Dragon Scale', drop: 'gold_bar' },
                { name: 'Void Abyss', gold: 10000, exp: 8000, item: 'Void Crystal', drop: 'astral_shard' }
            ];

            const loc = locations[Math.floor(Math.random() * locations.length)];
            let getRare = Math.random() < 0.3; 
            let dropQty = Math.floor(Math.random() * 3) + 1;
            
            totalGold = loc.gold + levelBonus; 
            totalExp = loc.exp + levelBonus;

            user.gold += totalGold;
            user.inventory[loc.drop] = (user.inventory[loc.drop] || 0) + dropQty;
            rewards.push(`✈️ Tiba di: ${loc.name}`);
            rewards.push(`+${dropQty}x ${loc.drop.replace('_', ' ').toUpperCase()}`);

            if (getRare) {
                let rareItemName = loc.item.toLowerCase().replace(/\s/g, '_');
                user.inventory[rareItemName] = (user.inventory[rareItemName] || 0) + 1;
                rewards.push(`+1x ${loc.item.toUpperCase()} (✨ RARE)`);
            }
        }

        user.exp = (user.exp || 0) + totalExp;
        user[info.lastField] = now;
        
        recalculateStats(user);
        await saveUserData(db, senderId, user);

        return res.status(200).json({
            ok: true,
            type,
            totalExp,
            totalGold,
            rewards,
            durabilityLogs,
            user: {
                level: user.level, exp: user.exp, gold: user.gold,
                inventory: user.inventory,
                hp: user.hp, maxHp: user.maxHp, mana: user.mana, maxMana: user.maxMana,
                lastHuntAnimal: user.lastHuntAnimal || 0,
                lastTreasure: user.lastTreasure || 0,
                lastExplore: user.lastExplore || 0
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error saat explore' });
    }
};
