# 51 — Pemetaan Skema Postgres ke Cloudflare D1

Dokumen ini memetakan backend Supabase yang berjalan sekarang ke Cloudflare D1 + Workers.
Seluruh angka di sini diturunkan dari dump produksi `backup-2026-09-19-143019`, bukan dari
pembacaan migration, sehingga mencerminkan keadaan database yang sebenarnya.

## 1. Inventaris sumber

| Objek | Jumlah | Catatan |
|---|---|---|
| Tabel | 36 | 409 kolom |
| Baris data | 13.979 | terbesar: `attendance` 8.302 |
| Policy RLS | 92 | tersebar di 34 tabel |
| Function | 27 | 23 di antaranya `SECURITY DEFINER` |
| Trigger | 27 | |
| Index | 85 | |
| View | 1 | |
| Enum | 3 | `app_role`, `account_status`, `payment_visibility_status` |
| Akun `auth.users` | 602 | |
| Objek Storage | 429 | 44,7 MB dalam 4 bucket |

Dua tabel tidak memiliki policy sama sekali: `auth_login_aliases` dan `auth_rate_limits`.
Keduanya hanya diakses lewat function `SECURITY DEFINER`, jadi tidak pernah disentuh klien
secara langsung. Di arsitektur Worker, keduanya menjadi tabel internal yang tidak punya
endpoint publik.

## 2. Pemetaan tipe kolom

D1 adalah SQLite, yang hanya mengenal lima tipe penyimpanan. Pemetaan berikut berlaku untuk
seluruh 409 kolom.

| Postgres | Jumlah | D1 | Alasan |
|---|---|---|---|
| `text` | 127 | `TEXT` | langsung |
| `uuid` | 126 | `TEXT` | simpan sebagai string kanonik huruf kecil |
| `timestamp with time zone` | 84 | `TEXT` | ISO-8601 UTC berakhiran `Z` |
| `boolean` | 21 | `INTEGER` | 0 dan 1 |
| `date` | 16 | `TEXT` | `YYYY-MM-DD` |
| `integer`, `smallint` | 20 | `INTEGER` | langsung |
| `jsonb` | 3 | `TEXT` | SQLite punya `json_extract` untuk query |
| `time without time zone` | 3 | `TEXT` | `HH:MM:SS` |
| `numeric(12,2)` | 3 | `INTEGER` | **disimpan dalam satuan sen** |
| `app_role`, `account_status` | 4 | `TEXT` + `CHECK` | enum ditegakkan lewat constraint |

Ketiga enum dan nilainya: `app_role` (`admin`, `guru`, `santri`, `pentashih`), `account_status`
(`active`, `inactive`, `suspended`), dan `payment_visibility_status` (`Lunas`, `Belum Lunas`).
Yang terakhir tidak dipakai kolom mana pun — hanya dipakai sebagai tipe kembalian, jadi cukup
menjadi nilai literal di Worker. Empat kolom yang memakai enum: `attendance.role`,
`user_profiles.role`, `guru.status`, dan `user_profiles.status`.
| `text[]` | 2 | `TEXT` | array JSON |

Tiga keputusan yang perlu disepakati sebelum implementasi:

**Uang jangan pernah jadi `REAL`.** Ketiga kolom `numeric(12,2)` ada di `payments` dan
`expenses`. SQLite tidak punya tipe desimal presisi, dan floating point akan menimbulkan
selisih rupiah yang muncul belakangan di rekap keuangan. Simpan sebagai `INTEGER` dalam sen
dan konversi di satu tempat saja.

**Timestamp sebagai teks ISO-8601 UTC.** Selama seluruhnya dinormalkan ke UTC dengan akhiran
`Z`, perbandingan leksikografis SQLite sama dengan perbandingan kronologis, sehingga
`ORDER BY` dan `BETWEEN` tetap benar tanpa fungsi tambahan. Ini mensyaratkan penulisan yang
disiplin di satu lapisan. Perhatikan `attendance_date` dan `getLocalDateString()` di frontend:
tanggal absensi bersifat lokal WIB, bukan UTC, dan perbedaan ini harus dipertahankan.

**UUID dibuat di Worker.** SQLite tidak punya `gen_random_uuid()`. Ada 126 kolom UUID dan
sebagian besar memakai default tersebut. Penggantinya `crypto.randomUUID()` di Worker, yang
berarti setiap penulisan baris baru wajib melewati lapisan aplikasi — tidak boleh ada jalur
yang menulis langsung ke D1 tanpa melewatinya.

## 3. Yang tidak ada padanannya di D1

| Fitur Postgres | Status di D1 | Pengganti |
|---|---|---|
| Row Level Security | **tidak ada** | otorisasi di Worker (bagian 4) |
| plpgsql | tidak ada | logika di Worker + transaksi D1 |
| `SECURITY DEFINER` | tidak ada | endpoint Worker dengan hak internal |
| Sequence | tidak ada | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| Enum | tidak ada | `TEXT` + `CHECK` |
| Array | tidak ada | kolom JSON |
| Trigger | **ada** | `set_updated_at` dan `sync_hafalan_status_from_score` bisa tetap jadi trigger SQL |
| View | **ada** | satu view bisa dipertahankan apa adanya |
| Index parsial | **ada** | 85 index sebagian besar terbawa langsung |

## 4. Model otorisasi

Ini bagian terpenting dan sekaligus kabar paling baik dari analisis ini. Ke-92 policy itu
tampak banyak, tetapi seluruhnya hanya memanggil **sepuluh predikat**:

| Predikat | Dipakai | Arti |
|---|---|---|
| `is_admin` | 114× | peran pengguna adalah admin |
| `guru_has_santri_access` | 36× | guru mengajar kelas si santri |
| `pentashih_has_santri_access` | 10× | pentashih ditugaskan ke kelas si santri |
| `guru_has_class_access` | 4× | guru memegang kelas tersebut |
| `pentashih_has_class_access` | 4× | pentashih ditugaskan ke kelas tersebut |
| `pentashih_has_mmq_access` | 3× | pentashih berhak atas data MMQ |
| `is_guru` | 3× | peran guru |
| `is_pentashih` | 1× | peran pentashih |
| `is_santri` | 1× | peran santri |
| `user_owns_santri_record` | 1× | baris milik santri yang sedang login |

Artinya kita tidak perlu menerjemahkan 92 aturan satu per satu menjadi 92 potong kode.
Cukup implementasikan sepuluh predikat ini sekali, lalu susun tabel kebijakan yang memetakan
`(tabel, perintah) → predikat`, dan jalankan lewat satu lapisan yang dilewati semua query.

Bentuknya kira-kira:

```js
const policies = {
  santri: {
    select: [isAdmin, guruHasSantriAccess, pentashihHasSantriAccess],
    write:  [isAdmin],
  },
  // ...
};
```

Dengan pendekatan ini, penambahan tabel baru berarti menambah satu entri, bukan menulis ulang
logika. Yang kritis: **setiap** akses D1 harus melewati lapisan ini. Satu query yang menembus
langsung sama dengan satu policy yang hilang, dan tidak ada jaring pengaman di level database
seperti RLS dulu.

### Distribusi policy per perintah

| Perintah | Jumlah |
|---|---|
| `SELECT` | 36 |
| `ALL` | 31 |
| `INSERT` | 12 |
| `UPDATE` | 10 |
| `DELETE` | 3 |

86 policy ditujukan ke `authenticated`, 5 ke `anon`, dan 1 ke keduanya. Yang untuk `anon`
adalah konten publik: `academic_calendar`, `announcements`, `news`, `website_content`,
`music_files`, dan `feedbacks` (khusus insert). Endpoint publik Worker hanya perlu melayani
enam tabel ini.

## 5. Pemetaan 27 function

| Kelompok | Jumlah | Tujuan di arsitektur baru |
|---|---|---|
| Predikat otorisasi | 10 | lapisan otorisasi Worker (bagian 4) |
| Trigger | 2 | tetap jadi trigger SQL di D1 |
| Helper Storage | 2 | **dihapus** — digantikan penamaan objek R2 |
| RPC bisnis | 6 | endpoint Worker dengan transaksi |
| Auth internal | 3 | `consume_auth_rate_limit`, `record_login_attempt`, `current_user_role` |
| Lain-lain | 4 | `move_character_*`, `get_classmates_today_attendance`, `get_guru_transfer_class_options` |

Enam RPC yang benar-benar dipanggil dari kode frontend:

`change_santri_category`, `change_santri_jilid`, `get_guru_transfer_class_options`,
`increment_santri_points`, `move_santri_to_class`, `transfer_santri_to_class_by_guru`.

Semuanya mengubah beberapa tabel sekaligus dan karenanya harus dibungkus transaksi. D1
mendukung batch statement dalam satu transaksi implisit; logika percabangannya pindah ke
JavaScript.

### Dua temuan sampingan

`get_diagnostic_rls_policies` dipanggil di `src/utils/diagnosticSantriDataFlow.js:32`, tetapi
function itu **tidak ada di database** — query ke `pg_proc` mengembalikan nol baris. Alat
diagnostik itu selama ini diam-diam gagal karena hasil `error` tidak diperiksa. Tidak perlu
diport; sebaiknya dihapus atau diperbaiki terpisah.

`signin_with_username` disebut berkali-kali di berkas laporan `.md` di dalam `src/`, tetapi
juga tidak ada di database dan tidak dipanggil kode mana pun. Dokumen-dokumen itu
menggambarkan arsitektur lama. Login yang sebenarnya berjalan lewat Edge Function
`signin-with-nomor-induk`.

## 6. Autentikasi — bagian tersulit

602 akun berada di `auth.users`, lengkap dengan hash password. Supabase memakai bcrypt.
Ini persoalan tersendiri karena Workers tidak punya implementasi bcrypt bawaan, dan bcrypt
sengaja lambat sehingga memakan CPU time yang dibatasi per request.

Tiga pilihan, masing-masing dengan konsekuensi nyata:

1. **Verifikasi bcrypt di Worker** lewat pustaka WASM. Hash lama tetap berlaku, pengguna tidak
   merasakan apa-apa. Biaya: CPU time per login dan satu dependensi WASM.
2. **Rehash saat login berikutnya.** Simpan hash bcrypt lama, verifikasi sekali dengan WASM,
   lalu tulis ulang sebagai PBKDF2 yang didukung native oleh WebCrypto. Setelah semua pengguna
   login sekali, ketergantungan bcrypt hilang.
3. **Reset massal 602 password.** Paling bersih secara teknis, paling buruk secara operasional
   untuk lembaga dengan ratusan wali santri.

Rekomendasi: pilihan 2. Ia menghindari reset massal sekaligus tidak mengunci kita pada bcrypt
selamanya.

Selain itu ada lima Edge Function yang harus ditulis ulang sebagai Worker route:
`signin-with-nomor-induk`, `manage-user`, `reset-user-password`, `record-login-attempt`, dan
`generate-signed-upload-url`. Yang terakhir berubah bentuk sepenuhnya karena R2 memakai
mekanisme presigned URL yang berbeda.

## 7. Storage ke R2

| Bucket | Objek | Ukuran | Tujuan |
|---|---|---|---|
| `avatars` | 412 | 32,9 MB | R2, privat, diakses lewat Worker |
| `website-assets` | 17 | 11,8 MB | R2, publik, cache panjang |
| `murojaah-recordings` | 0 | — | buat saja, masih kosong |
| `music-files` | 0 | — | buat saja, masih kosong |

Metadata objek sudah ikut terbackup di `06-data-storage.sql`, sehingga daftar lengkap path dan
ukurannya sudah di tangan meskipun filenya sendiri belum bisa diunduh selama project masih
dibatasi 402.

Perlu diingat bahwa `avatars` berisi foto anak-anak. Bucket ini harus tetap privat, diakses
lewat Worker yang memeriksa otorisasi, bukan dijadikan publik demi kemudahan caching.

## 8. Urutan kerja yang disarankan

1. Terjemahkan 36 `CREATE TABLE` beserta 85 index ke SQL D1, termasuk keputusan tipe di bagian 2.
2. Bangun lapisan otorisasi berisi sepuluh predikat dan tabel kebijakan per tabel.
3. Tulis skrip konversi data: `04-data-public.sql` (format `COPY`) menjadi `INSERT` D1,
   dengan konversi boolean, timestamp, dan uang.
4. Pindahkan enam RPC menjadi endpoint Worker bertransaksi.
5. Bangun autentikasi beserta jalur rehash.
6. Pindahkan file ke R2 setelah spend cap dilepas.
7. Verifikasi paritas: bandingkan jumlah baris per tabel dengan angka di bagian 1, dan uji
   setiap kombinasi peran terhadap tabel kebijakan.

## 9. Status pelaksanaan

Langkah 1 dan 3 dari urutan di atas sudah selesai dan terverifikasi.

| Berkas | Isi |
|---|---|
| `scripts/generate-d1-schema.mjs` | penerjemah skema |
| `migrations-d1/0001_initial_schema.sql` | 36 tabel + `users`, 84 index, 79 CHECK, 97 FK |
| `scripts/convert-d1-data.mjs` | pengubah data `COPY` menjadi `INSERT` |

Keduanya diuji dengan mengeksekusi hasilnya di SQLite asli lewat `node:sqlite`, bukan sekadar
dibaca:

- Skema dimuat bersih; 409 kolom dicocokkan satu per satu dengan sumber Postgres, nol selisih.
- Data 14.581 baris dimuat dalam 259 ms dengan `PRAGMA foreign_keys = ON`, nol pelanggaran.
- Hitungan baris ke-28 tabel berisi cocok persis dengan dump Postgres.
- Total `payments` sama sampai rupiah terakhir: 82.581.000 di kedua sisi.
- Seluruh timestamp lolos pemeriksaan format ISO-8601, nol yang menyimpang.
- `juz_hafalan` terbaca sebagai array JSON dan bisa difilter lewat `json_each`.

CHECK diuji dengan data buruk dan benar-benar menolak, termasuk terjemahan `!~ '\s'` yang
dicocokkan terhadap keenam karakter spasi putih yang dicakup Postgres.

Hasil konversi data ditulis ke `_private_reference/` karena memuat 602 akun beserta hash
password dan data pribadi santri.

## 10. Audit satuan uang

Tiga kolom menyimpan uang: `payments.jumlah`, `expenses.jumlah`, dan
`santri.default_spp_amount`. D1 menyimpannya sebagai `INTEGER` dalam satuan sen,
sementara seluruh aplikasi dan antarmukanya bekerja dengan rupiah desimal.

Penelusuran menemukan **26 berkas** yang menyentuh nilai uang. Menyerahkan konversinya
kepada masing-masing berkas berarti dua puluh enam kesempatan untuk lupa, dan lupa di sini
tidak memunculkan galat apa pun — hanya angka seratus kali lipat atau seperseratusnya yang
baru ketahuan saat ada yang menyadari rekap keuangannya janggal.

Karena itu konversinya dipindahkan ke lapisan data, memakai daftar kolom yang dihasilkan
dari skema:

- Dibaca: sen diubah menjadi rupiah desimal sebelum dipulangkan.
- Ditulis: rupiah desimal dibulatkan menjadi sen bulat.
- Nilai kosong tetap kosong, bukan menjadi nol rupiah.
- Nilai yang bukan angka ditolak dengan pesan yang jelas.

Konsekuensinya: **tidak ada modul yang boleh melakukan konversi sendiri.** Konversi manual
yang sempat ada di `financeAdapters` sudah dicabut, karena membiarkannya akan membuat
nilainya terkonversi dua kali.

Berkas yang menjumlahkan banyak nilai sebaiknya tetap menjumlahkan dalam sen lalu
membaginya sekali di akhir, agar pembulatan tidak menumpuk.

## 11. Risiko yang perlu diawasi

**Hilangnya jaring pengaman database.** RLS menjaga data walaupun ada bug di frontend. Setelah
pindah, satu query yang lupa melewati lapisan otorisasi langsung membocorkan data santri.
Mitigasi: satu-satunya jalur ke D1 adalah lapisan tersebut, ditegakkan lewat review dan uji.

**Batas ukuran D1.** Database saat ini hanya 3,6 MB, jauh di bawah batas D1, jadi ini bukan
masalah sekarang. Tapi `attendance` bertambah sekitar 163 baris per hari, sekitar 60 ribu baris
per tahun. Perlu rencana arsip sebelum menjadi persoalan.

**Pola akses yang boros.** Sudah diperbaiki untuk layar TV, tetapi prinsipnya berlaku umum:
di D1 biayanya berubah menjadi pembacaan baris. Setiap query tanpa batas akan terasa lagi,
dalam bentuk tagihan yang berbeda.
