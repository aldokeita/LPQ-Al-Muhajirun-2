// Klien autentikasi untuk API Worker.
//
// Sesi disimpan dalam cookie HttpOnly, jadi tidak ada token yang bisa dibaca atau
// disimpan JavaScript. Karena itu setiap permintaan memakai credentials: 'include'
// dan tidak ada yang perlu dititipkan di localStorage.
//
// Belum dipasang menggantikan SupabaseAuthContext: 203 pemanggilan data di aplikasi
// masih bergantung pada sesi Supabase untuk RLS, sehingga menukar autentikasi lebih
// dulu akan membuat seluruh query kehilangan sesi. Lihat docs/51-d1-schema-mapping.md.

const request = async (path, { method = 'GET', body = null } = {}) => {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message ?? 'Permintaan gagal.');
    error.code = payload?.error ?? 'request_failed';
    error.status = response.status;
    if (payload?.blocked_until) error.blockedUntil = payload.blocked_until;
    throw error;
  }

  return payload;
};

// Jenis perangkat hanya diketahui di sisi klien dan ikut dikirim agar tercatat di
// login_logs, menggantikan panggilan terpisah ke Edge Function record-login-attempt.
const deviceHint = () => {
  if (typeof navigator === 'undefined') return null;
  return /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
};

export const loginSantri = ({ identifier, nomorInduk }) =>
  request('/api/auth/login/santri', {
    method: 'POST',
    body: { identifier, nomor_induk: nomorInduk, device: deviceHint() },
  });

export const loginStaff = ({ email, password }) =>
  request('/api/auth/login/staff', { method: 'POST', body: { email, password, device: deviceHint() } });

export const logout = () => request('/api/auth/logout', { method: 'POST' });

// Memulangkan { user: null } dan bukan melempar galat saat belum login, karena
// "belum login" adalah keadaan biasa, bukan kegagalan.
export const getSession = async () => {
  try {
    return await request('/api/auth/session');
  } catch {
    return { user: null };
  }
};

// Staf memakai email, santri memakai nama panggilan atau nomor induk. Bentuk masukan
// tidak bisa dibedakan dengan pasti, jadi keberadaan tanda @ dipakai sebagai penentu —
// sama seperti yang dilakukan alur login lama.
export const login = ({ username, password }) => {
  const identifier = String(username ?? '').trim();
  const secret = String(password ?? '').trim();
  if (identifier.includes('@')) return loginStaff({ email: identifier, password: secret });
  return loginSantri({ identifier, nomorInduk: secret });
};
