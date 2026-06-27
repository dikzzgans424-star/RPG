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

async function saveUserData(senderId, userData) {
    const col = await getCollection();
    await col.updateOne(
        { _id: DOC_ID },
        { $set: { [`users.${senderId}`]: userData } },
        { upsert: true }
    );
}

async function saveBattleState(battleType, senderId, battleData) {
    const col = await getCollection();
    if (battleData === null) {
        await col.updateOne(
            { _id: DOC_ID },
            { $unset: { [`${battleType}.${senderId}`]: '' } }
        );
    } else {
        await col.updateOne(
            { _id: DOC_ID },
            { $set: { [`${battleType}.${senderId}`]: battleData } },
            { upsert: true }
        );
    }
}

module.exports = { loadRpgDB, saveUserData, saveBattleState, normalizeJid };
