# 🗡️ Miwa RPG Battle Web

Web battle turn-based yang terintegrasi langsung dengan database MongoDB bot WhatsApp RPG kamu.

## Struktur Project

```
rpg-battle/
├── api/
│   ├── _db.js           # MongoDB client (shared)
│   ├── _rpg.js          # RPG engine (roleData, stats, monsters)
│   ├── character.js     # GET /api/character?id=SENDER_ID
│   ├── battle-start.js  # POST /api/battle-start
│   └── battle-action.js # POST /api/battle-action
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── vercel.json
├── package.json
└── .env.example
```

## Deploy ke Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy
```bash
cd rpg-battle
vercel
```

### 4. Set Environment Variable
Di Vercel dashboard → Project → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `MONGO_URI` | `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?appName=Cluster0` |

> ⚠️ Gunakan URI MongoDB yang sama persis dengan yang ada di `rpg.js` bot kamu.

### 5. Redeploy setelah set env var
```bash
vercel --prod
```

## Cara Pakai

1. Buka URL Vercel yang diberikan
2. Masukkan ID WhatsApp kamu (format: `628xxxxxxxxxx`)
3. Data karakter otomatis diambil dari database bot
4. Pilih mode battle:
   - 🗡️ **Hunt** — Berburu monster random
   - 🏰 **Dungeon** — Floor demi floor, boss setiap 10 floor
   - 🐉 **Ancient Beast** — Boss 3 fase, reward terbesar
   - 👹 **Horde Invasion** — 10 gelombang monster
5. Battle dengan actions: Serang, Defend, Dodge, Potion, Kabur, atau Skills
6. Hasil battle (EXP, Gold, Loot) langsung tersimpan ke MongoDB

## Notes

- Data karakter real-time dari database yang sama dengan bot WA
- Semua stats, skills, passives 100% sama dengan `rpg.js`
- Battle state tersimpan di MongoDB — bisa dilanjut kapan saja
- Jika ada battle aktif di bot WA, tidak bisa mulai battle baru di web (dan sebaliknya)
