// Pencatatan percobaan login.
//
// Dulu modul ini memanggil Edge Function record-login-attempt tersendiri. Sekarang
// endpoint login Worker sudah mencatat setiap percobaan — berhasil maupun gagal —
// lengkap dengan IP, user agent, dan jenis perangkat yang dikirim bersama permintaan
// login. Memanggil endpoint kedua hanya akan menghasilkan catatan ganda.
//
// Fungsi ini dipertahankan agar LoginPage tidak perlu diubah, dan tetap memulangkan
// true seperti sebelumnya. Jenis perangkat dikirim lewat authClient saat login.

export const LOGIN_SECURITY_CONSENT_KEY = 'lpq_login_security_notice_v1';

export const recordLoginAttempt = async () => true;
