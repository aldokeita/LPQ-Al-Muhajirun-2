# Hasil Persiapan Deployment Frontend Staging Vercel

Tanggal: 2026-06-25

## Ringkasan

Frontend LPQ Al-Muhajirun sudah dipreflight untuk deployment staging Vercel, tetapi deployment belum dijalankan karena repository lokal belum memiliki remote GitHub.

Backend staging tetap tidak disentuh.

Target backend staging:

- Project Ref: `csvj...glqe`
- URL: `https://csvjeetirzdgebeoglqe.supabase.co`
- Status backend: E2E API/RLS/Storage lulus `25/25`

## Preflight Repository

Hasil pemeriksaan:

- `git status --short`: bersih sebelum perubahan konfigurasi Vercel;
- commit terakhir benar: `71f0ba5 test: validate Supabase staging environment`;
- branch saat ini: `master`;
- `git remote -v`: kosong, belum ada remote GitHub;
- `npm run build`: lulus dan menghasilkan output `dist/`;
- `.env.staging.local`: ignored Git;
- `dist/`: ignored Git.

Karena remote GitHub belum ada, proses push dan deployment Vercel otomatis dihentikan sesuai instruksi.

## Audit Vite dan Vercel

Konfigurasi proyek:

- Framework: Vite + React;
- Build command: `npm run build`;
- Output directory: `dist`;
- Router: `BrowserRouter` dari `react-router-dom`;
- route SPA penting:
  - `/login`;
  - `/dashboard`;
  - `/berita`;
  - `/pengumuman`;
  - `/profil`.

Karena aplikasi memakai `BrowserRouter`, direct-open atau refresh route di Vercel membutuhkan SPA fallback.

File konfigurasi yang ditambahkan:

- `vercel.json`

Isi konfigurasi:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Konfigurasi ini mencegah route seperti `/dashboard`, `/login`, `/berita`, `/pengumuman`, dan `/profil` menjadi 404 saat dibuka langsung di Vercel.

## Environment Variable Vercel

Environment variable staging yang harus dipasang di Vercel:

```text
VITE_SUPABASE_URL=https://csvjeetirzdgebeoglqe.supabase.co
VITE_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY_STAGING>
VITE_ENABLE_EDGE_FUNCTIONS=true
VITE_ENABLE_DEFERRED_FEATURES=false
```

Catatan keamanan:

- gunakan publishable key staging, bukan secret key;
- jangan memasukkan service-role key ke Vercel frontend;
- jangan memasukkan database password;
- jangan memasukkan access token Supabase;
- nilai publishable key tidak dicetak penuh di laporan ini.

## Remote dan Branch

Branch lokal:

- `master`

Remote Git:

- belum ada remote GitHub.

Karena remote kosong, belum ada push dan belum ada project Vercel yang dibuat.

Langkah manual yang diperlukan:

1. Buat atau pilih repository GitHub yang benar untuk proyek ini.
2. Tambahkan remote GitHub ke repository lokal.
3. Verifikasi `git remote -v` mengarah ke repository yang benar.
4. Commit konfigurasi Vercel jika belum dikomit.
5. Push branch ke GitHub.
6. Import repository tersebut ke Vercel sebagai project staging.

## Pengaturan Vercel Dashboard

Jika deploy dilakukan lewat Vercel Dashboard:

- Project name: `lpq-al-muhajirun-staging`;
- Framework Preset: Vite;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- Environment: masukkan empat variable staging di atas.

Jangan memakai nama project atau domain production.

## Supabase Auth URL Configuration

Setelah URL Vercel staging tersedia, tambahkan URL tersebut ke:

Supabase Staging -> Authentication -> URL Configuration

Atur:

- Site URL: URL frontend staging;
- Redirect URLs:
  - URL frontend staging;
  - URL frontend staging dengan wildcard route bila diperlukan;
  - `http://localhost:3000` tetap dipertahankan untuk development lokal.

Contoh URL staging yang diharapkan:

```text
https://lpq-al-muhajirun-staging.vercel.app
```

## Smoke Test Online

Smoke test frontend online belum dijalankan karena deployment belum tersedia.

Checklist smoke test setelah URL staging tersedia:

- halaman home terbuka;
- login admin;
- login guru;
- login pentashih;
- login santri;
- refresh mempertahankan session;
- direct-open `/dashboard`;
- berita dan pengumuman tampil;
- Data Master terbuka;
- Absensi RFID berjalan;
- pembayaran berjalan;
- pengeluaran berjalan;
- avatar tampil;
- logout berhasil;
- fitur deferred tetap nonaktif.

Network request yang diharapkan hanya menuju:

- domain Vercel staging;
- `https://csvjeetirzdgebeoglqe.supabase.co`.

Tidak boleh ada request ke localhost atau project Supabase lain.

## Hasil Saat Ini

Status:

- build frontend lokal lulus;
- SPA fallback untuk Vercel sudah disiapkan;
- backend staging tidak disentuh;
- production tidak disentuh;
- database lama tidak disentuh;
- frontend belum dideploy;
- URL frontend staging belum tersedia.

Blocker:

- repository belum memiliki remote GitHub, sehingga push dan import Vercel belum bisa dilakukan dengan aman.

Rekomendasi langkah berikutnya:

1. Tambahkan remote GitHub yang benar.
2. Commit `vercel.json` dan laporan ini bila sudah direview.
3. Push branch ke GitHub.
4. Import ke Vercel sebagai project staging.
5. Pasang environment variable staging.
6. Jalankan smoke test online.
