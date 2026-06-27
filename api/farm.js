// api/farm.js — farming system (plant & harvest), kompatibel dengan struktur
// farmPlots / farmData yang sama dipakai bot WA (rpg.js) supaya data nyambung.
// GET  /api/farm?id=SENDER_ID                       -> lihat status lahan
// POST /api/farm  { senderId, action:'plant', plantType, amount }
// POST /api/farm  { senderId, action:'harvest', plot, slot }   (slot opsional = all di plot itu)
// POST /api/farm  { senderId, action:'harvestAll' }
const { loadRpgDB, saveUserData, normalizeJid } = require('./_db');
const { recalculateStats, getEquippedItem, decreaseDurability, PLANT_TABLE } = require('./_rpg');

function ribu(n) { return Number(Math.floor(n)).toLocaleString('id-ID'); }

function buildFarmView(user, now) {
    const hasSpouse = !!user.spouse;
    const plots = [];
    for (let i = 1; i <= (user.farmPlots || 0); i++) {
        const data = user.farmData?.[i] || [];
        plots.push({
            plot: i,
            slots: data.map((p, idx) => {
                const total = p.harvestTime - p.startTime;
                const elapsed = now - p.startTime;
                const pct = Math.max(0, Math.min(100, Math.floor((elapsed / total) * 100)));
                return {
                    slot: idx + 1,
                    type: p.type,
                    amount: p.amount,
                    progress: pct,
                    ready: now >= p.harvestTime,
                    harvestTime: p.harvestTime,
                };
            }),
        });
    }
    return { farmPlots: user.farmPlots || 0, hasSpouse, plots, plantTable: PLANT_TABLE };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const { id: rawId } = req.query;
            if (!rawId) return res.status(400).json({ error: 'Parameter ?id= diperlukan' });
            const id = normalizeJid(rawId);
            const db = await loadRpgDB();
            const user = db.users?.[id];
            if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
            return res.status(200).json({ ok: true, farm: buildFarmView(user, Date.now()) });
        }

        if (req.method !== 'POST') return res.status(405).json({ error: 'GET/POST only' });

        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
        const { senderId: rawSenderId, action } = body;
        if (!rawSenderId || !action) return res.status(400).json({ error: 'senderId & action wajib' });
        const senderId = normalizeJid(rawSenderId);

        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        recalculateStats(user);
        if (!user.inventory) user.inventory = {};
        if (!user.farmData) user.farmData = {};
        if (typeof user.farmPlots === 'undefined') user.farmPlots = 0;

        const now = Date.now();
        const hasSpouse = !!user.spouse;
        const maxSeedsPerPlot = hasSpouse ? 8 : 4;
        const bonusPanen = hasSpouse ? 1.03 : 1.0;
        const timeMod = hasSpouse ? 0.8 : 1.0;

        const eqHoe = getEquippedItem(user, 'hoe');
        if (!eqHoe) return res.status(400).json({ error: '❌ Lahan terlalu keras! Equip/craft Hoe (Cangkul) dulu di bot WA.' });
        const hoePower = eqHoe.bonusStat || 1;
        let extraHarvest = Math.floor(Math.cbrt(hoePower));
        if (extraHarvest > 250) extraHarvest = 250;

        if (user.farmPlots <= 0) return res.status(400).json({ error: '❌ Kamu belum punya Lahan! Beli di shop (bot WA).' });

        if (action === 'plant') {
            const { plantType, amount } = body;
            const plant = PLANT_TABLE[plantType];
            if (!plant) return res.status(400).json({ error: `❌ Jenis tanaman tidak ada. List: ${Object.keys(PLANT_TABLE).join(', ')}` });
            const amt = parseInt(amount);
            if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Jumlah seed tidak valid' });
            if (amt > maxSeedsPerPlot) return res.status(400).json({ error: `❌ Maksimal ${maxSeedsPerPlot} seeds per slot!` });

            let targetPlot = 0;
            for (let i = 1; i <= user.farmPlots; i++) {
                if (!user.farmData[i]) user.farmData[i] = [];
                if (user.farmData[i].length < 3) { targetPlot = i; break; }
            }
            if (targetPlot === 0) return res.status(400).json({ error: '❌ Semua lahan penuh! Panen dulu.' });

            const seedsOwned = user.inventory[plant.seed] || 0;
            if (seedsOwned < amt) return res.status(400).json({ error: `❌ Bibit ${plant.seed} tidak cukup! (punya ${seedsOwned})` });

            const plantTime = Math.floor(plant.time * timeMod);
            user.inventory[plant.seed] -= amt;
            if (user.inventory[plant.seed] <= 0) delete user.inventory[plant.seed];
            user.farmData[targetPlot].push({ type: plantType, amount: amt, startTime: now, harvestTime: now + plantTime });

            const durInfo = decreaseDurability(user, 'hoe', 1);
            await saveUserData(db, senderId, user);
            return res.status(200).json({
                ok: true, plot: targetPlot, plantType, amount: amt,
                durationMin: Math.floor(plantTime / 60000), durability: durInfo,
                farm: buildFarmView(user, now),
            });
        }

        if (action === 'harvest' || action === 'harvestAll') {
            let totalExp = 0;
            const totalHasil = {};
            let count = 0;

            const harvestOne = (plotNo, idx) => {
                const item = user.farmData[plotNo][idx];
                const plant = PLANT_TABLE[item.type];
                const hasil = Math.floor((Math.floor(Math.random() * 5) + plant.base + extraHarvest) * bonusPanen) * item.amount;
                const exp = (plant.exp + 5) * item.amount;
                user.inventory[plant.hasil] = (user.inventory[plant.hasil] || 0) + hasil;
                totalExp += exp;
                totalHasil[plant.hasil] = (totalHasil[plant.hasil] || 0) + hasil;
                count++;
            };

            if (action === 'harvestAll') {
                for (let i = 1; i <= user.farmPlots; i++) {
                    if (!user.farmData[i]) continue;
                    for (let j = user.farmData[i].length - 1; j >= 0; j--) {
                        if (now >= user.farmData[i][j].harvestTime) {
                            harvestOne(i, j);
                            user.farmData[i].splice(j, 1);
                        }
                    }
                }
                if (count === 0) return res.status(400).json({ error: '❌ Belum ada tanaman yang matang.' });
                const durInfo = decreaseDurability(user, 'hoe', 2);
                user.exp = (user.exp || 0) + totalExp;
                user.farmerCount = (user.farmerCount || 0) + count;
                await saveUserData(db, senderId, user);
                return res.status(200).json({ ok: true, harvested: totalHasil, totalExp, count, durability: durInfo, farm: buildFarmView(user, now) });
            } else {
                const { plot, slot } = body;
                const plotNo = parseInt(plot);
                const idx = parseInt(slot) - 1;
                const item = user.farmData[plotNo]?.[idx];
                if (!item) return res.status(400).json({ error: '❌ Slot tersebut kosong.' });
                if (now < item.harvestTime) return res.status(400).json({ error: '⏳ Belum matang.' });

                harvestOne(plotNo, idx);
                user.farmData[plotNo].splice(idx, 1);
                const durInfo = decreaseDurability(user, 'hoe', 1);
                user.exp = (user.exp || 0) + totalExp;
                user.farmerCount = (user.farmerCount || 0) + 1;
                await saveUserData(db, senderId, user);
                return res.status(200).json({ ok: true, harvested: totalHasil, totalExp, count: 1, durability: durInfo, farm: buildFarmView(user, now) });
            }
        }

        return res.status(400).json({ error: 'Action tidak dikenal (plant/harvest/harvestAll)' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
