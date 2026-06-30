# Miwa RPG — Versi Netlify

Source code ini sudah dikonversi dari Vercel Serverless Functions ke **Netlify Functions**,
tanpa mengubah logic game sama sekali (file di `netlify/functions/_impl/` adalah salinan
persis dari `api/*.js` versi Vercel).

## Struktur

```
netlify.toml                  <- config Netlify (redirect /api/* -> functions)
package.json                  <- dependency (mongodb)
public/                       <- frontend (index.html, app.js, style.css, battle2d.js) — TIDAK DIUBAH
netlify/functions/
  _adapter.js                 <- shim supaya handler gaya (req,res) bisa jalan di Netlify
  _impl/                      <- logic asli (copy dari api/*.js Vercel, tidak diubah)
  character.js, gather.js, dst <- wrapper tipis per endpoint
```

Karena ada redirect `/api/*` → `/.netlify/functions/:splat` di `netlify.toml`,
frontend (`public/app.js`) **tidak perlu diubah** — tetap fetch ke `/api/character`,
`/api/gather`, dll seperti biasa.

## Cara Deploy

### Opsi A — lewat Netlify Dashboard (drag & drop / Git)
1. Buat site baru di https://app.netlify.com
2. Kalau dari Git: connect repo ini, build command kosongkan (tidak perlu build step),
   publish directory otomatis terbaca dari `netlify.toml` (`public`).
3. Kalau drag & drop: zip folder ini lalu upload langsung di dashboard Netlify
   (menu "Deploys" → "Drag and drop your site folder here").

### Opsi B — lewat Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## WAJIB: Set Environment Variable

Sama seperti di Vercel, set environment variable berikut di:
**Site settings → Environment variables**

```
MONGO_URI = <connection string MongoDB kamu, sama persis dengan yang dipakai bot WA>
```

Tanpa env var ini, semua endpoint akan gagal connect ke database.

## Catatan

- `node_bundler = "esbuild"` di `netlify.toml` dipakai supaya dependency `mongodb`
  otomatis ikut ter-bundle ke tiap function.
- Semua 14 endpoint (character, battle-start, battle-action, battle-resolve, adventure,
  equipment, explore, farm, gacha, gather, hunt-animal, sell, shop, stats) sudah dikonversi.
- Kalau nanti nambah endpoint baru, taruh logic-nya di `netlify/functions/_impl/namafile.js`
  (format `module.exports = async (req, res) => {...}` seperti biasa), lalu buat wrapper
  baru di `netlify/functions/namafile.js`:
  ```js
  const { wrap } = require('./_adapter');
  const handler = require('./_impl/namafile.js');
  module.exports.handler = wrap(handler);
  ```
