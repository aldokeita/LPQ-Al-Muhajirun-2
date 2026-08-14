# Session — Tahfizh PTPT: Juz 1-30 checklist + per-Juz & per-Surah scoring

## Status
DONE (fase 1) — implementasi backend + frontend selesai, build lolos, 3 migration sudah
di-push ke production DB, 3 commit sudah di-push ke branch, Vercel Preview ready.
Menunggu review user di preview sebelum merge ke master.

## Objektif
1. Ganti target tahfizh PTPT satu-nilai (`santri.jilid`) dengan checklist **Juz 1-30**
   (`santri.juz_hafalan text[]`) + skor per Juz oleh guru (`santri_juz_scores`).
2. **Per-Surah scoring** (1-4) di dalam tiap Juz (`santri_surah_scores`) + UI
   Collapsible (Hide/Show) per Juz agar tampilan skoring tidak penuh.
3. Normalisasi `jilid` santri PTPT menjadi label `'PTPT'` (bukan 'Khatam'/'Juz X').

## Lokasi kerja
- Worktree: `D:\Project\LPQ-Al-Muhajirun-2-worktrees\daily-payment-recap`
- Branch: `codex/feat-daily-payment-recap` (HEAD `29e53c4`)
- Supabase production ref: `csvjeetirzdgebeoglqe` (schema additive, backfill aman)
- Vercel Preview: `https://lpq-al-muhajirun-koytfa12l-aldo-joanis-projects.vercel.app`
- DB password dipakai via `$env:SUPABASE_DB_PASSWORD` (sesi-only, tidak disimpan)

## Keputusan desain (dikonfirmasi user)
- Skor tetap 1-4; Juz DAN setiap surah di dalamnya dapat discore oleh guru.
- Penyimpanan array `santri.juz_hafalan text[]`; semua 30 Juz ikut checklist.
- **Juz 26-30 disertakan** dalam checklist.
- Santri PTPT tidak memakai status jilid TPQ: `jilid` dinormalisasi ke `'PTPT'`.
- Santri PTPT dengan `jilid` lama `'Khatam'` → `juz_hafalan` DIBIARKAN KOSONG
  (39 santri); admin/guru mencentang manual dari awal. Tidak ada yang dianggap khatam.
- **Wajib** perubahan masuk Vercel Preview dulu (push branch), jangan langsung production.

## Migration (semua SUDAH di-push ke production)
1. `20260805000100_santri_juz_hafalan.sql`
   - `santri.juz_hafalan text[] not null default '{}'` + backfill dari `jilid` ('Juz N')
   - tabel `santri_juz_scores(santri_id, juz_number, score, ...)`
     + unique(santri_id, juz_number), check score 1-4 & juz 1-30
   - RLS: admin all; santri select own; guru write/update via `guru_has_santri_access`
2. `20260805000200_ptpt_jilid_label.sql`
   - UPDATE `jilid='PTPT'` utk semua santri `kategori='PTPT'` (41 santri)
3. `20260805000300_santri_surah_scores.sql`
   - tabel `santri_surah_scores(santri_id, juz_number, surah_name, score, ...)`
     + unique(santri_id, juz_number, surah_name), check juz 1-30 & score 1-4
   - RLS identik pola `santri_juz_scores` (4 policy)
   - index `santri_surah_scores_santri_idx`

## File yang diubah (fase 1 & 2)
1. `src/lib/quranJuzData.js` (baru)
   - `ALL_JUZ` (30 label), `JUZ_SURAH_MAP` {1..30: [surah]},
   - `parseJuzNumber`, `getSurahNamesForJuz`, `normalizeJuzHafalan`, `juzNumbersToLabels`
2. `src/lib/academicAdapters.js`
   - `fetchSantriJuzScores`, `buildJuzScoreMap`, `upsertSantriJuzScore`
   - `fetchSantriSurahScores`, `buildSurahScoreMap`, `upsertSantriSurahScore`
   - `fetchClassesWithActiveSantriForTeacher` ikut select `juz_hafalan`
3. `src/lib/dataMasterAdapters.js`
   - `pickSantriProfileFields` tambah `juz_hafalan` (array, default [])
4. `src/components/dashboard/admin/SantriManagement.jsx`
   - filter PTPT pakai `query.contains('juz_hafalan', [...])`
   - form PTPT: grid checkbox 1-30 + preview surah; validasi >=1 juz
   - badge tabel PTPT ringkasan juz; bulk import isi juz_hafalan dari kolom 'Jilid'
5. `src/components/dashboard/SantriDashboard.jsx`
   - `PTPTJuzSection`: Collapsible per-Juz (Hide/Show) + badge skor per-surah (read-only)
   - state `juzScores` + `surahScores`; fetch di `initializeData`
6. `src/components/dashboard/GuruDashboard.jsx`
   - modal Skor Hafalan PTPT: Collapsible per-Juz, selector skor Juz + selector
     per-surah (1-4), counter `x/y surah skor 4`, Juz pertama terbuka otomatis
   - `handleJuzScoreChange` + `handleSurahScoreChange` (optimistic update, rollback on error)
   - state `juzScoreProgress` + `surahScoreProgress` + `expandedJuz`

## Commit history (branch ini)
- `18cca72` feat: add class attendance live editor (sebelum sesi ini)
- `8e6eb0d` feat: replace PTPT target tahfizh with Juz 1-30 checklist and per-juz scoring
- `7b939f0` chore: normalize PTPT jilid label to 'PTPT' via migration
- `29e53c4` feat: add per-surah hafalan scoring with collapsible juz sections

## Fitur tab Pengeluaran (record pengeluaran harian + bukti) — IN PROGRESS
Status: implementasi selesai + build lolos, BELUM commit/push. Ruang lingkup:
1. `src/lib/financeAdapters.js`
   - `fetchExpensesByPeriod` terima param opsional `date` (filter per-tanggal spesifik,
     exact-day; tanpa date tetap periode year/month)
   - `fetchDailyExpenseSummary({year, month})` — rekap total pengeluaran per hari
     (group by tanggal, sort terbaru)
   - `normalizeExpensePayload` + select create/update sekarang sertakan `bukti_url`
2. `src/components/dashboard/admin/ExpenseManagement.jsx`
   - filter bar tambah Input type=date (`filter.date`) + tombol Bersihkan Tanggal;
     ganti year/month me-reset date
   - panel "Rekap Pengeluaran Harian" (tabel per tanggal: total + jumlah kategori),
     dengan baris Total Periode
   - form Tambah/Edit: input file bukti (JPG/PNG/WebP/PDF) via `uploadWebsiteAsset`
     ke folder `expenses`, pratinjau link + tombol hapus bukti; kolom "Bukti" di tabel
     (link "Lihat bukti" ke `bukti_url`)
   - TIDAK ada migration baru (buffer `website-assets` + kolom `bukti_url` sudah ada)
- Verifikasi: build lolos, diff check bersih, no-secret scan bersih.

### Lanjutan (belum commit): Aksi pada Rekap Pengeluaran Harian
Ruang lingkup (sesuai permintaan user):
1. `src/lib/expenseReportAdapters.js` (BARU) — mengikuti pola `dailyPaymentReportAdapters.js`:
   - `buildDailyExpenseRows`, `getDayTotal`, `dayLabel` (format id-ID)
   - `printDailyExpenseHtml` — jendela cetak (window.print, untuk cetak ke PDF)
   - `downloadDailyExpensePdf` — jsPDF + autotable, filename `pengeluaran-harian-<date>.pdf`
   - `downloadDailyExpenseExcel` — XLSX (baris Total di akhir), `pengeluaran-harian-<date>.xlsx`
2. `src/components/dashboard/admin/ExpenseManagement.jsx`
   - Kolom "Aksi" di tabel Rekap Pengeluaran Harian: tombol **Detail** (buka modal),
     **PDF**, **Excel**, dan **Cetak** (Printer) per baris tanggal
   - Modal **Detail Pengeluaran Harian**: semua transaksi hari tsb (kategori, keterangan,
     jumlah, bukti) + total transaksi + tombol export PDF/Excel/Cetak
   - Handlers: `handleOpenDetail`, `handleExportDayPdf`, `handleExportDayExcel`, `handlePrintDay`, `getDayExpenses`
   - State baru: `isDetailOpen`, `detailDate`
- Verifikasi: build lolos, diff check bersih, no-secret scan bersih.
- Belum commit/push (menunggu approval user).

## Berikutnya
- Commit + push fitur Aksi Rekap Harian (Detail modal + export PDF/Excel/Cetak)
  + update `sessions.md` (sekalian, approval user).
- Review user di Vercel Preview (login manual oleh user).
- Setelah disetujui: merge ke **master** hanya dengan persetujuan user.
- Potensi lanjutan (BELUM dikerjakan): bersihkan tampilan `jilid` utk santri PTPT di
  komponen shared (`TvDisplayPage`, `SearchResultItem`, `SantriDetailModal`,
  `QuizHafalanPage`, dll.) yang masih membaca `jilid`.

## Catatan lintas-sesi
- Explore subagent HANG (tidak keluar output, >11 menit) — 3 sudah dibatalkan.
  Jangan spawn subagent; eksplorasi manual `rg`/`read`.
- Supabase login non-TTY; gunakan `$env:SUPABASE_DB_PASSWORD` + `supabase db push`
  (atau psql `C:\Program Files\PostgreSQL\18\bin\psql.exe` utk verifikasi query).
- `supabase migration list` 403 (login role) — tidak memblokir operasi schema via password.
- RULE: SELALU perbarui `sessions.md` setelah setiap perubahan.
