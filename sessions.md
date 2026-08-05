# Session — Tahfizh PTPT: Juz 1-30 checklist (preview deployment)

## Status
IN PROGRESS — implementasi backend + frontend selesai, belum divalidasi/commit/push.

## Objektif
Ganti target tahfizh PTPT satu-nilai (`santri.jilid`) dengan checklist **Juz 1-30**
(yang disimpan di `santri.juz_hafalan text[]`) + skor per Juz oleh guru pengampu
(tabel baru `santri_juz_scores`).

## Lokasi kerja
- Worktree: `D:\Project\LPQ-Al-Muhajirun-2-worktrees\daily-payment-recap`
- Branch: `codex/feat-daily-payment-recap` @ `18cca72` (socket clean awal)
- Supabase production ref: `csvjeetirzdgebeoglqe` (schema additive, backfill aman)

## Keputusan desain (dikonfirmasi user)
- Skor tetap per Juz (1-4); di dalam Juz ditampilkan nama surah utk referensi guru.
- Penyimpanan array `santri.juz_hafalan text[]`.
- Semua 30 Juz ikut checklist; Juz 26-30 disertakan.
- **Wajib** perubahan masuk Vercel Preview dulu (push branch), jangan langsung production.

## File yang diubah
1. `supabase/migrations/20260805000100_santri_juz_hafalan.sql` (baru)
   - `alter table santri add column juz_hafalan text[] not null default '{}'`
   - backfill dari `jilid` utk santri PTPT berformat 'Juz N'
   - tabel `santri_juz_scores(santri_id, juz_number, score, assessed_by, assessed_at, ...)`
     + unique(santri_id, juz_number), check score 1-4 & juz 1-30
   - RLS: admin all; santri select own; guru write/update via `guru_has_santri_access`
   - pola meniru RLS `hafalan_progress` (20260624001600_rls_policies.sql)
   - `notify pgrst, 'reload schema'`
2. `src/lib/quranJuzData.js` (baru)
   - `ALL_JUZ` = 30 label "Juz N"
   - `JUZ_SURAH_MAP` {1..30: [surah]}
   - `parseJuzNumber`, `getSurahNamesForJuz`, `normalizeJuzHafalan`, `juzNumbersToLabels`
3. `src/lib/academicAdapters.js`
   - `PTPT_TAHFIZH_TARGETS` tetap (untuk hafalan_items PTPT lama)
   - tambah `fetchSantriJuzScores`, `buildJuzScoreMap`, `upsertSantriJuzScore`
   - `fetchClassesWithActiveSantriForTeacher` sekarang ikut select `juz_hafalan`
4. `src/lib/dataMasterAdapters.js`
   - `pickSantriProfileFields` tambah `juz_hafalan` (array, default [])
5. `src/components/dashboard/admin/SantriManagement.jsx`
   - import `ALL_JUZ/getSurahNamesForJuz/normalizeJuzHafalan`
   - `ptptTargetOptions = ALL_JUZ`
   - `SANTRI_BASE_SELECT` + `juz_hafalan`
   - filter PTPT pakai `query.contains('juz_hafalan', [...])`
   - formData init/reset `juz_hafalan` (PTPT: ['Juz 30'])
   - validasi: PTPT wajib >=1 juz; TPQ tetap wajib `jilid`
   - `toggleJuzHafalan`, normalisasi juz saat submit
   - form PTPT: grid checkbox 1-30 + preview surah
   - badge tabel PTPT tampilkan ringkasan juz
   - bulk import PTPT isi juz_hafalan dari kolom 'Jilid'
6. `src/components/dashboard/SantriDashboard.jsx`
   - import `buildJuzScoreMap/fetchSantriJuzScores` + quranJuzData
   - state `juzScores`; fetch di `initializeData`
   - komponen `PTPTJuzSection` (render juz tercentang + surah + skor per juz)
7. `src/components/dashboard/GuruDashboard.jsx`
   - import `fetchSantriJuzScores/buildJuzScoreMap/upsertSantriJuzScore` + quran helper
   - state `juzScoreProgress`; fetch di `fetchGuruData`
   - `handleJuzScoreChange` (optimistic update ke `santri_juz_scores`)
   - modal hafalan: utk PTPT render per-juz (surah + DevelopmentScoreSelector 1-4),
     utk TPQ mtetapkan HafalanDisplay lama
   - import `DevelopmentScoreSelector`

## Berikutnya
- `npm run build` (wajib lolos) + `git diff --check` + no-secret scan
- commit conventional (`feat: tahfizh ptpt juz 1-30 ...`)
- push branch → buat Vercel Preview → review dulu sebelum export ke production
- deployment Juz skor melalui `santri_juz_scores`; pastikan dev client tidak
  perlu RLS changes tambahan (pola sudah mirip hafalan_progress)

## Catatan lintas-sesi
- Explore subagent HANG (tidak keluar output, >11 menit) — 3 sudah dibatalkan.
  Jangan spawn subagent; eksplorasi manual `rg`/`read`.
- Supabase login hanya bisa dari terminal user (non-TTY).
  sudah