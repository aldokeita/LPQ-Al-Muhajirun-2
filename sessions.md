# Session — Migrasi penuh ke Cloudflare (Workers + D1 + R2)

Diperbarui 21 September 2026. Isi sebelumnya (checklist Juz PTPT, skor per-surah,
rekap pengeluaran harian) sudah lama masuk master dan dibuang dari catatan ini —
begitu pula seluruh alur Supabase/Vercel, karena keduanya tidak dipakai lagi.

## Status

**SELESAI dan hidup di produksi.** Supabase sudah tidak dipanggil dari mana pun.
`master` = `13e0152`, sinkron dengan remote. Versi Worker aktif
`175f5e5a-cd51-4e7c-bd7f-2768ab0e96b5`.

Tiga hostname melayani build yang sama:

- `lpqalmuhajirun.id`
- `www.lpqalmuhajirun.id`
- `lpq-al-muhajirun.almuhajirundatabase.workers.dev`

`GET /api/health` memulangkan status D1 dan apakah `SESSION_SECRET` terpasang,
tanpa membocorkan nilainya.

## Arsitektur sekarang

Satu Worker melayani hasil build Vite **dan** API pada origin yang sama, jadi
tidak ada CORS. Konfigurasinya di `wrangler.jsonc`.

- **Data**: D1 `lpq-al-muhajirun`, 38 tabel. Kebijakan RLS Postgres diterjemahkan
  menjadi otorisasi sisi Worker di `worker/auth/policies.js`, dijadikan klausa
  `WHERE` oleh `worker/data/query.js`.
- **Berkas**: R2 `lpq-al-muhajirun-files`, disajikan `worker/routes/files.js` pada
  alamat tetap `/api/files/<prefix>/<path>` dengan awalan `avatars`,
  `website-assets`, `music-files`. Alamat tetap ini menggantikan URL bertanda
  tangan yang berputar — rotasi itu salah satu penyebab egress yang dulu
  membuat Supabase tersuspensi.
- **Sesi**: cookie HttpOnly/Secure/SameSite=Lax berisi token HMAC-SHA256; peran
  dibaca ulang dari `user_profiles` tiap permintaan, tidak disimpan di token.
- **Uang**: disimpan sebagai INTEGER sen, ditampilkan sebagai rupiah. Konversinya
  berlaku pada penulisan **dan** pada filter.

## Batas paket gratis yang harus dihormati

Aldo memutuskan tetap di Workers Free (20 September 2026) setelah saya jelaskan
paket berbayar. **Jangan dibuka lagi.** Kode sudah disesuaikan:

- 10 ms CPU per permintaan → PBKDF2 diturunkan ke 30.000 iterasi (~4 ms)
- 50 query D1 per pemanggilan → penulisan banyak baris dipecah per 15 baris
- 100 parameter terikat per query → `MAX_IN_VALUES = 80`
- 100.000 permintaan/hari, 5 GB egress tidak ter-cache per bulan

## Alur kerja

```
npx wrangler dev --port 8788 --local     # wajib hidup untuk test:adapter
npm run test:worker                       # seluruh suite worker
npm run test:adapter                      # suite adapter frontend (butuh dev server)
npm run check:parity                      # bandingkan D1 lokal dengan dump Supabase
npm run build                             # build Vite
npm run cf:deploy                         # build + deploy ke produksi
node node_modules/wrangler/bin/wrangler.js versions upload   # preview tanpa produksi
```

`check:parity -- --perbaiki` mengembalikan baris yang menyimpang ke nilai dump.
Jalankan setelah menguji lewat peramban; pengujian menulis ke D1 lokal sungguhan.

**Setelah `cf:deploy`, server dev lokal wajib dijalankan ulang** — build menulis
ulang `dist` di bawahnya dan manifes asetnya jadi basi, semua aset 404.

## Yang mudah salah (sudah pernah menggigit)

- **Route, bukan `custom_domain`.** Cloudflare menolak menulis catatan DNS-nya
  sendiri selama hostname sudah punya catatan (kode 100117), dan catatan lama
  peninggalan Vercel masih ada. Route menumpang catatan terproksi yang ada.
- **`workers_dev` harus ditulis tegas.** Menambahkan `routes` membuat wrangler
  mematikan workers.dev diam-diam. Pernah membuat URL itu mati dua menit.
- **D1 lokal pernah kehilangan seluruh 28 pemicu** padahal tabel dan indeksnya
  lengkap, sehingga pengujian berjalan tanpa penjaga yang ada di produksi.
  `check:parity` sekarang ikut memeriksa jumlah pemicu.
- **Verifikasi adapter lewat SQL langsung ke D1**, jangan lewat adapter itu
  sendiri — begitulah bug pemotongan baris diam-diam dulu ketahuan.
- **Kalau sesuatu tampak seperti keputusan aturan akses, periksa dump dulu.**
  Terjemahan pertama melewatkan cabang "baris ini milik saya" di belasan tabel;
  itu cabang yang hilang, bukan pilihan desain.
- **Guru hanya boleh membaca santri di kelasnya.** Papan peringkat lintas kelas
  karena itu memakai RPC `get_santri_leaderboard` yang hanya memulangkan kolom
  peringkat — melonggarkan kebijakan tabel `santri` akan ikut membuka nomor HP
  wali, alamat, NIK, dan KK.

## Yang masih terbuka

1. **27 September 2026 — pulihkan foto avatar.** Kuota egress Supabase pulih
   sendiri di awal siklus tagihan; tidak perlu bayar apa pun. Avatar totalnya
   hanya ~33 MB. Urutannya:
   ```
   node scripts/backup-supabase-storage.mjs --bucket avatars --out _private_reference/storage-final
   node scripts/restore-storage-to-r2.mjs
   node scripts/rewrite-storage-urls.mjs --apply
   ```
   Sampai itu, `/api/files/avatars/...` memang 404 dan kartu menampilkan inisial.

2. **Laporan belum terpecahkan:** papan peringkat pernah menampilkan "tidak
   memiliki izin" saat berpindah halaman. Tidak bisa direproduksi — admin lolos
   lima halaman, guru empat. Pesannya sudah dipecah menjadi tiga sebab yang
   berbeda supaya laporan berikutnya menunjuk tepat. Tunggu kalimat barunya.

3. **Belum teruji dengan jam sungguhan:** absensi guru dan poin santri ±1 baru
   diuji dengan jam yang dipalsukan. Senin 21 September adalah hari kerja pertama
   dengan semuanya hidup.

4. Tiga skrip diagnostik yatim — `diagnosticSantriDataFlow.js`,
   `verify_mmq_policies.js`, `verifyDataSources.js` — tidak diimpor siapa pun.
   Aldo minta dibiarkan.

## Aturan kerja yang masih berlaku

- Setiap perubahan harus tetap berperilaku seperti backend lama. Kalau perilaku
  lama ternyata salah atau mati, katakan — jangan diam-diam diperbaiki di tengah
  pemindahan.
- Preview dulu, baru produksi. Sekarang lewat `wrangler versions upload`, bukan
  Vercel.
- Merge ke `master` hanya dengan persetujuan Aldo.

## Branch

`master` dan `feat/tier-emblem-profile-card` sama-sama di `13e0152`; branch itu
sudah ter-merge dan bisa dihapus. `chore/supabase-backup-tooling` tertinggal 28
commit dan sudah seluruhnya tercakup master — juga bisa dihapus.
