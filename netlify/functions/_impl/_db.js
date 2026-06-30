// api/_db.js — shared MongoDB client (cached across serverless calls)
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = 'miwa_rpg';
const COL_NAME  = 'rpgdb';
const DOC_ID    = 'main';

let _client = null;

async function getClient() {
    if (!_client) {
        _client = new MongoClient(MONGO_URI);
        await _client.connect();
    }
    return _client;
}

async function getCollection() {
    const client = await getClient();
    return client.db(DB_NAME).collection(COL_NAME);
}

// Bot WA menyimpan key user/battle sebagai JID LENGKAP, contoh:
// "6285810287828@s.whatsapp.net" — bukan cuma nomornya doang.
// Semua endpoint web HARUS pakai JID ini juga waktu baca/tulis ke DB,
// supaya datanya konsisten dengan bot.
function normalizeJid(id) {
    if (!id) return id;
    let clean = String(id).trim().replace(/[^0-9@.a-zA-Z]/g, '');
    if (clean.includes('@')) return clean; // sudah JID lengkap (s.whatsapp.net / lid / g.us)
    return `${clean}@s.whatsapp.net`;
}

async function loadRpgDB() {
    const col = await getCollection();
    const doc = await col.findOne({ _id: DOC_ID });
    return doc || { users: {}, market: [], guilds: {} };
}

// PENTING: jangan pakai $set dengan dot-path string berisi senderId
// (contoh: `users.${senderId}`). Sender ID berformat JID mengandung titik
// (mis. "6285810287828@s.whatsapp.net"), dan MongoDB akan salah artikan
// titik itu sebagai NESTED PATH, bukan bagian dari nama key — alhasil data
// kesimpan ke tempat lain dan tidak pernah ketemu lagi.
// Bot WA sendiri selalu save SELURUH dokumen via `$set: dataToSave` (lihat
// fungsi saveRpgDB di rpg.js) — jadi web app pakai pola yang sama di sini.
async function saveRpgDB(db) {
    const col = await getCollection();
    const { _id, ...dataToSave } = db;
    await col.updateOne(
        { _id: DOC_ID },
        { $set: dataToSave },
        { upsert: true }
    );
}

// Helper lama, sekarang jadi pembungkus tipis di atas saveRpgDB supaya
// tidak ada lagi yang nulis dot-path manual.
async function saveUserData(db, senderId, userData) {
    if (!db.users) db.users = {};
    db.users[senderId] = userData;
    await saveRpgDB(db);
}

async function saveBattleState(db, battleType, senderId, battleData) {
    if (!db[battleType]) db[battleType] = {};
    if (battleData === null) {
        delete db[battleType][senderId];
    } else {
        db[battleType][senderId] = battleData;
    }
    await saveRpgDB(db);
}

module.exports = { loadRpgDB, saveRpgDB, saveUserData, saveBattleState, normalizeJid };
