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

1. ~~Pulihkan foto avatar.~~ **SELESAI 29 September 2026.** 379 dari 412 avatar
   sudah ada di R2 produksi, 86 MB menjadi 6,5 MB WebP. Tidak ada baris basis data
   yang diubah.

   Yang perlu diingat kalau ini diulang: path di Storage Supabase **tidak** sama
   dengan `avatar_path` di basis data. Storage berisi `santri/<id>.jpeg`,
   `guru/<id>/<timestamp>.jpg`, `santri-profile/<id>-<timestamp>.JPEG`, dan satu
   berkas datar; basis data meminta `<jenis>/<id>/profile.webp`. Menyalin
   path-untuk-path menaruh berkas di alamat yang tidak pernah diminta siapa pun.
   `scripts/stage-supabase-avatars.mjs` mencocokkannya lewat id pemilik lalu
   menulis ke alamat yang diminta:
   ```
   node scripts/stage-supabase-avatars.mjs --from "<unduhan>/<ref>" --dry-run
   node scripts/stage-supabase-avatars.mjs --from "<unduhan>/<ref>"
   node scripts/restore-storage-to-r2.mjs --from _private_reference/storage-final
   ```

   **Masih tersisa: 11 aset situs belum pulih.** Unduhan 29 September berasal dari
   proyek Supabase `wqnyoesvwnqfjqsbzmsi`, sedangkan URL di `website_content`
   menunjuk `csvjeetirzdgebeoglqe`. Avatar cocok lewat id, tetapi logo, empat slide
   hero, foto galeri, latar CTA, brosur, logo Qiroati, dan latar hijaiyah tidak ada
   di unduhan itu. **Jangan jalankan `rewrite-storage-urls.mjs --apply` dulu** —
   mengalihkan URL sekarang hanya menukar alamat Supabase yang mati dengan alamat
   R2 yang juga kosong, sekaligus menghilangkan alamat aslinya. Ekspor dulu bucket
   `website-assets` dari proyek `csvjeetirzdgebeoglqe`.

   **33 baris menunjuk foto yang tidak pernah ada di Storage.** Sudah dipastikan
   dengan mencari id-nya di seluruh unduhan. Mereka tetap menampilkan inisial dan
   tetap memicu satu 404 tiap kartu tampil; `avatar_path`-nya layak dikosongkan,
   tapi itu perubahan basis data produksi dan menunggu keputusan Aldo.

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
