# 20 - Phase 2 Decisions Needed

Dokumen ini hanya berisi keputusan yang masih perlu jawaban sebelum implementasi backend/migration dimulai. Banyak keputusan inti sudah dipilih:

- login santri memakai Edge Function + Supabase Auth resmi;
- pentashih memakai assignment kelas/MMQ;
- kelas memakai model gabungan `santri.current_class_id` dan `class_memberships`.

## 1. Cara Memberikan Password Awal Santri

### Konteks

Password lama tidak boleh dimigrasikan. Setiap santri perlu password baru di Supabase Auth.

### Pilihan

1. **Password sementara dibuat admin**
   Admin membuat password awal dan menyerahkannya ke wali/santri.

2. **Reset link lewat email**
   Sistem mengirim link reset password ke email santri/wali jika email valid tersedia.

3. **Password awal massal lalu wajib ganti**
   Semua akun diberi pola password sementara, lalu user wajib mengganti.

### Rekomendasi Codex

Pilihan 1 untuk launch awal, karena tidak semua santri/wali mungkin punya email valid.

### Dampak

- Pilihan 1 mudah dijalankan, tetapi admin harus menjaga distribusi password.
- Pilihan 2 lebih rapi, tetapi butuh email valid dan konfigurasi SMTP.
- Pilihan 3 cepat, tetapi paling berisiko jika pola password mudah ditebak.

## 2. Apakah Santri Boleh Mengubah Foto Profil Sendiri

### Konteks

Frontend lama memiliki upload foto santri. Ini bisa menjadi risiko jika tidak dikontrol.

### Pilihan

1. **Admin/guru saja yang mengubah foto**
2. **Santri boleh upload sendiri dengan moderasi**
3. **Santri boleh upload langsung tanpa moderasi**

### Rekomendasi Codex

Pilihan 1 untuk launch awal.

### Dampak

- Pilihan 1 paling aman dan sederhana.
- Pilihan 2 lebih fleksibel tetapi butuh alur moderasi.
- Pilihan 3 tidak disarankan untuk lembaga pendidikan anak.

## 3. Apakah Guru Boleh Melihat Status Pembayaran Santri Kelasnya

### Konteks

Guru hanya boleh mengelola kelasnya. Data pembayaran termasuk data sensitif.

### Pilihan

1. **Tidak boleh melihat pembayaran**
2. **Boleh melihat status lunas/belum saja**
3. **Boleh melihat detail pembayaran lengkap kelasnya**

### Rekomendasi Codex

Pilihan 2 jika operasional guru membutuhkan informasi tunggakan; jika tidak, pilih 1.

### Dampak

- Pilihan 1 paling aman.
- Pilihan 2 membantu operasional tanpa membuka detail transaksi.
- Pilihan 3 lebih sensitif dan perlu alasan operasional kuat.

## 4. Masa Retensi Data Soft Delete

### Konteks

Data santri, guru, pembayaran, dan absensi sebaiknya tidak langsung hard delete.

### Pilihan

1. **Soft delete permanen sampai admin teknis membersihkan**
2. **Soft delete dengan retensi 1 tahun**
3. **Hard delete untuk data non-keuangan**

### Rekomendasi Codex

Pilihan 1 untuk awal, lalu buat kebijakan arsip setelah sistem stabil.

### Dampak

- Pilihan 1 aman untuk audit, tetapi data menumpuk.
- Pilihan 2 lebih rapi, tetapi butuh proses arsip.
- Pilihan 3 tidak disarankan untuk data pendidikan/keuangan.

## 5. Format Nomor Induk Qiroati

### Konteks

Nomor Induk Qiroati menjadi alias login santri. Formatnya harus konsisten agar mapping aman.

### Pilihan

1. **Angka saja**
2. **Teks bebas dengan normalisasi spasi/huruf besar**
3. **Format resmi lembaga yang ditentukan sebelum migrasi**

### Rekomendasi Codex

Pilihan 3.

### Dampak

- Pilihan 1 sederhana tetapi mungkin tidak cocok dengan data lama.
- Pilihan 2 fleksibel tetapi rawan duplikat format.
- Pilihan 3 paling rapi untuk jangka panjang, tetapi perlu keputusan lembaga.

## 6. Apakah `feedbacks` Lama Dimigrasikan

### Konteks

Feedback dari pengunjung bisa berisi pesan lama yang mungkin tidak relevan.

### Pilihan

1. **Tidak migrasikan feedback lama**
2. **Migrasikan hanya feedback yang belum ditangani**
3. **Migrasikan semua feedback**

### Rekomendasi Codex

Pilihan 1, kecuali ada pesan aktif yang masih perlu ditindaklanjuti.

### Dampak

- Pilihan 1 paling bersih.
- Pilihan 2 menjaga tugas aktif.
- Pilihan 3 membawa data lama yang mungkin tidak perlu.

## 7. Email Domain Internal untuk Akun Santri

### Konteks

Santri login dengan Nomor Induk Qiroati, tetapi Supabase Auth tetap membutuhkan identifier internal seperti email.

### Pilihan

1. **Gunakan domain internal teknis**
   Contoh konsep: `santri+uuid@auth.lpqalmuhajirun.local`

2. **Gunakan domain produksi**
   Contoh konsep: `santri+uuid@lpqalmuhajirun.id`

3. **Gunakan email wali jika valid**

### Rekomendasi Codex

Pilihan 1 untuk akun login internal, karena tidak membingungkan wali/santri dan tidak bergantung pada email valid.

### Dampak

- Pilihan 1 paling stabil untuk login nomor induk.
- Pilihan 2 terlihat resmi tetapi bisa membingungkan jika email tidak benar-benar ada.
- Pilihan 3 bagus untuk reset email, tetapi data email wali mungkin tidak selalu tersedia.
