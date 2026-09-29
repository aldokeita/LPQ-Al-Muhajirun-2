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

1. ~~Pulihkan berkas dari Supabase.~~ **SELESAI 29 September 2026.** Seluruh 412
   avatar (32,9 MB → 6,7 MB) dan 17 aset situs ada di R2 produksi. Sembilan baris
   `website_content` sudah dialihkan dari URL Supabase ke `/api/files/...`, dan
   tidak ada URL Supabase tersisa di basis data.

   **Ada dua unduhan, dan yang pertama proyek yang keliru.** Simpan keduanya, tetapi
   yang sah adalah `csvjeetirzdgebeoglqe` — itu ref yang dirujuk URL di basis data.
   Unduhan `wqnyoesvwnqfjqsbzmsi` berisi avatar sekolah yang sama (cocok lewat id)
   tetapi tata letaknya berbeda, hanya 379 dari 412, dan **nol** dari aset situs
   yang dirujuk.

   Dua tata letak yang berbeda itu sebabnya `scripts/stage-supabase-avatars.mjs`
   ada. `csvjeetirzdgebeoglqe` menyimpan `<jenis>/<id>/profile.webp`, persis seperti
   `avatar_path`; `wqnyoesvwnqfjqsbzmsi` menyimpan `santri/<id>.jpeg`,
   `guru/<id>/<timestamp>.jpg`, dan `santri-profile/<id>-<timestamp>.JPEG`. Menyalin
   path-untuk-path dari yang kedua menaruh berkas di alamat yang tidak pernah
   diminta siapa pun — laporan hijau, kartu tetap kosong. Skripnya mencocokkan lewat
   id pemilik, jadi kedua tata letak sama-sama jalan:
   ```
   node scripts/stage-supabase-avatars.mjs --from "<unduhan>/<ref>" --dry-run
   node scripts/stage-supabase-avatars.mjs --from "<unduhan>/<ref>"
   node scripts/restore-storage-to-r2.mjs --from _private_reference/storage-final
   node scripts/rewrite-storage-urls.mjs --apply --supabase-url https://csvjeetirzdgebeoglqe.supabase.co
   ```

   Gambar yang sudah WebP dan sudah ≤512 px disalin apa adanya; yang lebih besar
   dikecilkan. Dari 412 avatar, 366 melebihi 512 px dan satu di antaranya 6000 px.

   15 berkas dari proyek keliru yang sempat ikut terunggah sudah dihapus dari R2
   pada 29 September, sesudah dipastikan nol yang dirujuk basis data dan nol yang
   bentrok dengan 17 aset sah. Sumbernya tetap ada di folder unduhan Aldo.

2. **Laporan belum terpecahkan:** papan peringkat pernah menampilkan "tidak
   memiliki izin" saat berpindah halaman. Tidak bisa direproduksi — admin lolos
   lima halaman, guru empat. Pesannya sudah dipecah menjadi tiga sebab yang
   berbeda supaya laporan berikutnya menunjuk tepat. Tunggu kalimat barunya.

3. ~~Belum teruji dengan jam sungguhan.~~ **TERBUKTI 29 September 2026**, dari data
   produksi 21–29 September: 116 absensi guru (97 Hadir, 19 Terlambat) dan 1.077
   absensi santri (680 Hadir, 397 Terlambat), dengan 293 santri berpoin. Jadi
   perbaikan crash absensi guru, aturan jendela sesi, dan poin ±1 semuanya bekerja
   di lapangan, bukan hanya dengan jam yang dipalsukan.

4. Tiga skrip diagnostik yatim — `diagnosticSantriDataFlow.js`,
   `verify_mmq_policies.js`, `verifyDataSources.js` — tidak diimpor siapa pun.
   Aldo minta dibiarkan.

## Backup

Sejak pindah dari Supabase tidak ada lagi yang mengambil salinan otomatis, dan D1
tidak punya pemulihan titik waktu di paket gratis. Sejak 29 September 2026
`.github/workflows/backup-d1.yml` berjalan setiap hari pukul 18.00 UTC (01.00 WIB)
dan menjalankan `scripts/backup-d1-to-r2.mjs`:

- ekspor penuh D1 produksi (~8 MB, 37 tabel, 16 ribu INSERT, sekitar 6 detik)
- ditolak kalau hasilnya kurang dari 30 tabel atau 1.000 INSERT — ekspor yang
  "berhasil" tetapi kosong lebih berbahaya daripada gagal terang-terangan
- dikompresi menjadi sekitar 1,1 MB, diunggah ke `backups/d1/<stempel>.sql.gz`
- ditarik kembali, dibandingkan bita per bita, lalu **benar-benar dipulihkan** ke
  SQLite sementara di memori. Backup yang belum pernah terbukti bisa dimuat bukan
  backup.

Awalan `backups/` sengaja tidak ada di daftar `worker/routes/files.js`, jadi berkas
ini tidak bisa diambil siapa pun lewat HTTP — hanya lewat kredensial R2. Sudah
diperiksa: ketiga metode menjawab 404. Aturan lifecycle R2 membuang objek di bawah
`backups/` sesudah 365 hari.

Dijalankan GitHub, bukan Worker: ekspornya memuat berkas belasan megabita sementara
anggaran CPU paket gratis dihitung per permintaan, dan menaruhnya di luar Worker
berarti backup tetap jalan walau aplikasinya sedang bermasalah.

**Dua secret di repo** (Settings > Secrets and variables > Actions):
`CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`.

Tokennya harus punya **D1 Edit**, bukan D1 Read. Ekspor D1 adalah `POST` ke
`/accounts/<id>/d1/database/<id>/export` yang membuat tugas di sisi server, jadi
Read ditolak — dan Cloudflare menolaknya dengan galat `10000 Authentication error`
yang bunyinya sama persis dengan token tidak sah, sehingga mudah disalahartikan
sebagai token kedaluwarsa. Pembedanya: kalau `wrangler whoami` di awal log lolos,
tokennya sah dan yang kurang izinnya. Untuk unggahannya butuh **Workers R2 Storage
Edit**. Mengubah izin token tidak mengubah nilainya, jadi secret di GitHub tidak
perlu disentuh setelahnya.

Memeriksa backup lama kapan saja, tanpa menyentuh apa pun yang hidup:
```
node scripts/verify-d1-backup.mjs --key backups/d1/<nama>.sql.gz
```

Memulihkan sungguhan:
`wrangler d1 execute lpq-al-muhajirun --remote --file <dump.sql>`.

Terbukti jalan 29 September 2026: jalan terjadwal pertama menghasilkan
`backups/d1/d1-2026-09-29-12-42.sql.gz`, dan isinya dipulihkan ke SQLite sementara
— 37 tabel, 28 pemicu, 574 santri, 811 pembayaran, 9.499 absensi.

## Aturan kerja yang masih berlaku

- Setiap perubahan harus tetap berperilaku seperti backend lama. Kalau perilaku
  lama ternyata salah atau mati, katakan — jangan diam-diam diperbaiki di tengah
  pemindahan.
- Preview dulu, baru produksi. Sekarang lewat `wrangler versions upload`, bukan
  Vercel.
- Merge ke `master` hanya dengan persetujuan Aldo.

## Branch

Semua pekerjaan ada di `master`. Cabang yang sudah ter-merge dihapus pada
29 Sep 2026. Cabang lama selain itu (`feat/dynamic-character-categories`,
`feat/public-content-hub`, `codex/whatsapp-jilid-config`,
`claude/zealous-villani-ed6942`) belum diperiksa dan dibiarkan apa adanya.
