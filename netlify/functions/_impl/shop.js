// api/shop.js — GET/POST /api/shop
// GET  /api/shop?id=SENDER_ID                 -> daftar item shop + sisa limit harian
// POST /api/shop  { senderId, itemKey, qty }   -> beli item (qty bisa angka, default 1)
// Logika harga, kategori, dan limit harian disalin PERSIS dari case 'shop' di bot WA
// (rpg.js), supaya hasil beli/limit selalu konsisten antara WA dan web.
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const {
    recalculateStats, SHOP_ITEMS, SHOP_CATEGORIES, SHOP_DAILY_LIMITS,
    getShopLimitKey, getMaxLahan,
} = require('./_rpg');

function ribu(n) { return Number(Math.floor(n || 0)).toLocaleString('id-ID'); }

// Reset/baca shopLimit harian, sama persis dengan pola bot:
// userRpg.shopLimit = { date, <key>: count, ... } — direset tiap hari berganti.
function getShopLimitState(user) {
    const today = new Date().toLocaleDateString();
    if (!user.shopLimit || user.shopLimit.date !== today) {
        user.shopLimit = { date: today };
    }
    return user.shopLimit;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ─── GET → daftar shop, dikelompokkan per kategori, + sisa limit harian ───
    if (req.method === 'GET') {
        const rawId = req.query?.id;
        if (!rawId) return res.status(400).json({ error: 'id wajib' });
        const senderId = normalizeJid(rawId);

        try {
            const db = await loadRpgDB();
            const user = db.users?.[senderId];
            if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });

            const limitState = getShopLimitState(user);
            await saveRpgDB(db); // persist kemungkinan reset tanggal limit

            const categories = Object.entries(SHOP_CATEGORIES).map(([catKey, catInfo]) => {
                const items = Object.entries(SHOP_ITEMS)
                    .filter(([, item]) => item.effect === catKey)
                    .map(([key, item]) => {
                        const noValue = ['key', 'seed', 'land', 'special'].includes(catKey)
                            || (catKey === 'fairy' && key === 'fairy_coin');
                        const valueLabel = catKey === 'material' || catKey === 'rare_mat'
                            ? 'Material'
                            : (catKey === 'fairy' ? 'EXP' : catKey.toUpperCase());
                        return {
                            key,
                            name: item.name,
                            price: item.price,
                            effect: item.effect,
                            value: item.value,
                            valueLabel,
                            showValue: !noValue,
                            owned: user.inventory?.[key] || 0,
                        };
                    });
                if (items.length === 0) return null;

                const limitKeyForCat = catKey === 'fairy' ? null : getShopLimitKey(items[0]?.key, items[0] || {});
                return {
                    key: catKey,
                    icon: catInfo.icon,
                    label: catInfo.label,
                    limitText: catInfo.limitText || null,
                    items,
                };
            }).filter(Boolean);

            return res.status(200).json({
                ok: true,
                categories,
                farmPlots: user.farmPlots || 0,
                maxFarmPlots: getMaxLahan(user.level || 1),
                gold: user.gold || 0,
                shopLimit: limitState,
                dailyLimits: SHOP_DAILY_LIMITS,
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET/POST only' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { senderId: rawId, itemKey: rawItemKey, qty } = body;

    if (!rawId) return res.status(400).json({ error: 'senderId wajib' });
    const senderId = normalizeJid(rawId);
    const itemKey = (rawItemKey || '').toLowerCase();
    const jumlah = parseInt(qty) || 1;

    if (jumlah <= 0) return res.status(400).json({ error: '❌ Jumlah pembelian tidak valid!' });

    try {
        const db = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        recalculateStats(user);
        if (!user.inventory) user.inventory = {};

        const item = SHOP_ITEMS[itemKey];
        if (!item) return res.status(400).json({ error: '⚠️ Item tidak ada di shop!' });

        const totalHarga = item.price * jumlah;
        if ((user.gold || 0) < totalHarga) return res.status(400).json({ error: '💰 Gold tidak cukup!' });

        // ─── SISTEM LIMIT HARIAN (persis bot) ───
        const limitState = getShopLimitState(user);
        const limitKey = getShopLimitKey(itemKey, item);
        if (limitKey) {
            const max = SHOP_DAILY_LIMITS[limitKey];
            const current = limitState[limitKey] || 0;
            if (current + jumlah > max) {
                return res.status(400).json({
                    error: `❌ Gagal! Limit harian untuk kategori ini adalah ${max}x. Sisa limitmu: ${Math.max(0, max - current)}x`,
                    limitKey, limitMax: max, limitRemaining: Math.max(0, max - current),
                });
            }
            limitState[limitKey] = current + jumlah;
        }

        // ─── KASUS KHUSUS: farm_plot (lahan) ───
        if (item.effect === 'land') {
            const maxLahan = getMaxLahan(user.level || 1);
            const currentLahan = user.farmPlots || 0;
            if (currentLahan + jumlah > maxLahan) {
                return res.status(400).json({ error: `❌ Lahan maksimal ${maxLahan}!` });
            }
            user.gold -= totalHarga;
            user.farmPlots = currentLahan + jumlah;
            db.users[senderId] = user;
            await saveRpgDB(db);
            return res.status(200).json({
                ok: true,
                bought: { key: itemKey, name: item.name, qty: jumlah },
                totalGold: totalHarga,
                farmPlots: user.farmPlots,
                maxFarmPlots: maxLahan,
                user: { gold: user.gold, inventory: user.inventory, farmPlots: user.farmPlots },
            });
        }

        // ─── PEMBELIAN ITEM BIASA (masuk inventory) ───
        user.gold -= totalHarga;
        user.inventory[itemKey] = (user.inventory[itemKey] || 0) + jumlah;

        db.users[senderId] = user;
        await saveRpgDB(db);

        return res.status(200).json({
            ok: true,
            bought: { key: itemKey, name: item.name, qty: jumlah },
            totalGold: totalHarga,
            totalGoldText: `-${ribu(totalHarga)} Gold`,
            user: { gold: user.gold, inventory: user.inventory },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
