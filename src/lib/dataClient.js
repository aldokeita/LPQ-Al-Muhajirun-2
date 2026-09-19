// Klien data untuk API Worker.
//
// Bentuk kembaliannya sengaja mengikuti konvensi Supabase, yaitu { data, error } dan bukan
// melempar galat. Delapan puluh berkas di aplikasi ini sudah menangani bentuk itu; mengubah
// konvensinya berarti menulis ulang penanganan galat di semua tempat, bukan sekadar
// mengganti pemanggilannya.
//
// Sesi dibawa lewat cookie HttpOnly, jadi tidak ada token yang perlu disisipkan di sini.

const request = async (path, body) => {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    const error = new Error(`Gagal menghubungi server: ${networkError.message}`);
    error.code = 'network_error';
    return { data: null, error };
  }

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
    return { data: null, error };
  }

  return { data: payload?.data ?? null, error: null };
};

// Filter ditulis sebagai daftar agar operator yang diizinkan terlihat jelas di sisi server.
// Bentuk ringkasnya: { status: 'Aktif' } menjadi satu filter eq.
const buildFilters = (filters) => {
  if (!filters) return [];
  if (Array.isArray(filters)) return filters;
  return Object.entries(filters).map(([column, value]) => ({ column, op: 'eq', value }));
};

export const query = async ({ table, columns = null, filters = null, order = null, limit = null, offset = null }) => {
  const { data, error } = await request('/api/data/query', {
    table,
    columns,
    filters: buildFilters(filters),
    order,
    limit,
    offset,
  });
  // Pembacaan selalu memulangkan array supaya pemanggil tidak perlu memeriksa null.
  return { data: error ? null : (data ?? []), error };
};

// Pembacaan satu baris: server tetap membatasi jumlahnya, di sini hanya diambil yang pertama.
export const queryOne = async (options) => {
  const { data, error } = await query({ ...options, limit: 1 });
  if (error) return { data: null, error };
  return { data: data.length > 0 ? data[0] : null, error: null };
};

export const insert = (table, values) => request('/api/data/insert', { table, values });

export const update = (table, id, values) => request('/api/data/update', { table, id, values });

export const remove = (table, id) => request('/api/data/delete', { table, id });

// Nama RPC sama dengan nama function lama, jadi pemanggilan lama bisa dipetakan langsung.
export const rpc = (name, params = {}) => request(`/api/rpc/${name}`, params);
