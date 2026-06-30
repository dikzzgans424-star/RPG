// api/sell.js — POST /api/sell
// Body: { senderId, item, qty }  — qty bisa 'all' atau angka
// Logika persis sama dengan bot WA (termasuk proteksi item mythic).
const { loadRpgDB, saveRpgDB, normalizeJid } = require('./_db');
const { recalculateStats, SELL_PRICES, SELL_PROTECTED } = require('./_rpg');

function ribu(n) { return Number(Math.floor(n)).toLocaleString('id-ID'); }

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET → kembalikan daftar harga + stok
    if (req.method === 'GET') {
        const rawId = req.query?.id;
        if (!rawId) return res.status(400).json({ error: 'id wajib' });
        const senderId = normalizeJid(rawId);
        try {
            const db   = await loadRpgDB();
            const user = db.users?.[senderId];
            if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
            const list = Object.entries(SELL_PRICES).map(([key, price]) => ({
                key,
                name:  key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                price,
                qty:   user.inventory?.[key] || 0,
            })).filter(i => i.qty > 0); // hanya tampilkan item yang punya stok
            return res.status(200).json({ ok: true, items: list });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST/GET only' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { senderId: rawId, item, qty } = body;
    if (!rawId) return res.status(400).json({ error: 'senderId wajib' });
    const senderId = normalizeJid(rawId);

    try {
        const db   = await loadRpgDB();
        const user = db.users?.[senderId];
        if (!user) return res.status(404).json({ error: 'Karakter tidak ditemukan' });
        if (!user.inventory) user.inventory = {};
        recalculateStats(user);

        // Proteksi item mythic (persis bot)
        if (SELL_PROTECTED.includes(item)) {
            return res.status(400).json({ error: '✨ Item ini tidak bisa dijual! (Item Mythic yang sudah menyatu dengan jiwa)' });
        }

        let totalGold = 0;
        const soldItems = {};

        if (item === 'all') {
            // Jual semua item sellable (persis bot)
            for (const key in user.inventory) {
                if (SELL_PROTECTED.includes(key)) continue;
                if (SELL_PRICES[key] && user.inventory[key] > 0) {
                    soldItems[key] = user.inventory[key];
                    totalGold += SELL_PRICES[key] * user.inventory[key];
                    user.inventory[key] = 0;
                }
            }
            if (totalGold === 0) return res.status(400).json({ error: '❌ Tidak ada item yang bisa dijual.' });
        } else {
            // Jual item spesifik
            if (!item) return res.status(400).json({ error: '❌ Item tidak ditentukan' });
            if (!SELL_PRICES[item]) return res.status(400).json({ error: `❌ Item "${item}" tidak bisa dijual.` });

            const stok = user.inventory[item] || 0;
            const jumlah = qty === 'all' ? stok : Math.max(0, parseInt(qty) || 1);

            if (isNaN(jumlah) || jumlah <= 0) return res.status(400).json({ error: '❌ Jumlah tidak valid.' });
            if (stok < jumlah) return res.status(400).json({ error: `❌ Stok tidak cukup. Kamu punya ${stok}x ${item}.` });

            soldItems[item] = jumlah;
            totalGold = SELL_PRICES[item] * jumlah;
            user.inventory[item] = stok - jumlah;
        }

        user.gold += totalGold;

        db.users[senderId] = user;
        await saveRpgDB(db);

        return res.status(200).json({
            ok: true,
            soldItems,
            totalGold,
            totalGoldText: `+${ribu(totalGold)} Gold`,
            user: {
                gold: user.gold,
                inventory: user.inventory,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
