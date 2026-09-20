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

// Menghitung baris tanpa menariknya. Hitungannya melewati otorisasi yang sama dengan
// pembacaan, jadi angka yang dipulangkan hanya mencakup baris yang boleh dilihat.
export const count = async ({ table, filters = null }) => {
  const { data, error } = await request('/api/data/count', { table, filters: buildFilters(filters) });
  return { data: error ? null : (data ?? 0), error };
};

// Pembacaan satu baris: server tetap membatasi jumlahnya, di sini hanya diambil yang pertama.
export const queryOne = async (options) => {
  const { data, error } = await query({ ...options, limit: 1 });
  if (error) return { data: null, error };
  return { data: data.length > 0 ? data[0] : null, error: null };
};

export const insert = (table, values) => request('/api/data/insert', { table, values });

// Baris dipilih dengan id, atau dengan objek kunci untuk tabel berkunci gabungan yang
// tidak punya kolom id, misalnya santri_character_strengths.
export const update = (table, id, values) => request('/api/data/update', { table, id, values });

export const updateWhere = (table, where, values) => request('/api/data/update', { table, where, values });

export const remove = (table, id) => request('/api/data/delete', { table, id });

export const removeWhere = (table, where) => request('/api/data/delete', { table, where });

// Beberapa baris sekaligus, dalam satu transaksi. Dipakai di tempat yang dulu mengirim
// larik ke insert() atau memakai delete().in('id', ids): kegagalan di tengah tidak boleh
// meninggalkan sebagian baris tertulis. Batasnya BATCH_ROWS baris per permintaan, sama
// dengan batas yang ditegakkan server.
const BATCH_ROWS = 100;

export const insertMany = async (table, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return { data: { ids: [] }, error: null };
  const ids = [];
  for (let index = 0; index < rows.length; index += BATCH_ROWS) {
    const { data, error } = await request('/api/data/insert-many', {
      table,
      values: rows.slice(index, index + BATCH_ROWS),
    });
    if (error) return { data: null, error };
    ids.push(...(data?.ids ?? []));
  }
  return { data: { ids }, error: null };
};

export const removeMany = async (table, ids) => {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return { data: { deleted: [] }, error: null };
  const deleted = [];
  for (let index = 0; index < unique.length; index += BATCH_ROWS) {
    const { data, error } = await request('/api/data/delete-many', {
      table,
      ids: unique.slice(index, index + BATCH_ROWS),
    });
    if (error) return { data: null, error };
    deleted.push(...(data?.deleted ?? []));
  }
  return { data: { deleted }, error: null };
};

// conflictColumn menentukan baris mana yang dianggap sudah ada. website_content memakai
// "key", sedangkan tabel konten lain memakai "id".
export const upsert = (table, values, conflictColumn = 'id') =>
  request('/api/data/upsert', { table, values, conflictColumn });

// D1 hanya menerima 100 parameter terikat per query, jadi daftar id panjang dipecah.
const IN_CHUNK = 80;
const MAX_ROWS = 1000;

// Menarik seluruh baris yang boleh dilihat, berapa pun jumlahnya. Server membatasi satu
// permintaan pada MAX_ROWS baris, sama seperti batas 1000 baris PostgREST dulu, jadi
// tabel yang tumbuh melewati angka itu akan terpotong tanpa pemberitahuan. Di sini
// halamannya diambil berurutan sampai habis.
export const queryAll = async (options) => {
  const collected = [];
  for (let offset = 0; ; offset += MAX_ROWS) {
    const { data, error } = await query({ ...options, limit: MAX_ROWS, offset });
    if (error) return { data: null, error };
    collected.push(...(data ?? []));
    if ((data?.length ?? 0) < MAX_ROWS) break;
  }
  return { data: collected, error: null };
};

// Membaca dengan filter "in" berisi daftar panjang; hasil tiap potongan disatukan kembali.
export const queryIn = async ({ table, columns, column, values, extraFilters = [], order = null }) => {
  const unique = [...new Set((values || []).filter(Boolean))];
  if (unique.length === 0) return { data: [], error: null };

  const collected = [];
  for (let index = 0; index < unique.length; index += IN_CHUNK) {
    const chunk = unique.slice(index, index + IN_CHUNK);
    const { data, error } = await query({
      table,
      columns,
      filters: [...extraFilters, { column, op: 'in', value: chunk }],
      order,
      limit: MAX_ROWS,
    });
    if (error) return { data: null, error };
    collected.push(...(data ?? []));
  }
  return { data: collected, error: null };
};

// Menjahit relasi yang dulu ditulis sebagai join bersarang Supabase, misalnya
// guru:guru_id(id, nama). Endpoint data tidak melayani join, jadi tabel terkait ditarik
// terpisah lalu dipasangkan di sini.
//
// Daftar id panjang dipecah memakai IN_CHUNK, sama seperti queryIn.
export const attachRelated = async (rows, { foreignKey, table, columns, as, keyColumn = 'id' }) => {
  const ids = [...new Set(rows.map((row) => row[foreignKey]).filter(Boolean))];
  if (ids.length === 0) return rows.map((row) => ({ ...row, [as]: null }));

  const byKey = new Map();
  for (let index = 0; index < ids.length; index += IN_CHUNK) {
    const chunk = ids.slice(index, index + IN_CHUNK);
    const { data, error } = await query({
      table,
      columns,
      filters: [{ column: keyColumn, op: 'in', value: chunk }],
      limit: chunk.length,
    });
    // Relasi yang tidak boleh dibaca dipulangkan sebagai null, sama seperti join
    // bersarang di bawah RLS. Galat lain tetap dilempar agar tidak tertelan diam-diam.
    if (error) {
      if (error.code === 'forbidden') return rows.map((row) => ({ ...row, [as]: null }));
      throw error;
    }
    for (const item of data ?? []) byKey.set(item[keyColumn], item);
  }

  return rows.map((row) => ({ ...row, [as]: byKey.get(row[foreignKey]) ?? null }));
};

// Menjahit relasi satu-ke-banyak, yang dulu ditulis sebagai embed terbalik seperti
// classes.select('*, santri(...)'). Anak-anaknya ditarik sekali lalu dikelompokkan,
// bukan satu query per induk.
export const attachChildren = async (rows, { parentKey = 'id', table, columns, foreignKey, as }) => {
  const ids = [...new Set(rows.map((row) => row[parentKey]).filter(Boolean))];
  if (ids.length === 0) return rows.map((row) => ({ ...row, [as]: [] }));

  const { data, error } = await queryIn({ table, columns, column: foreignKey, values: ids });
  // Relasi yang tidak boleh dibaca menjadi daftar kosong, sama seperti embed di bawah RLS.
  if (error) {
    if (error.code === 'forbidden') return rows.map((row) => ({ ...row, [as]: [] }));
    throw error;
  }

  const grouped = new Map();
  for (const item of data ?? []) {
    const key = item[foreignKey];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  return rows.map((row) => ({ ...row, [as]: grouped.get(row[parentKey]) ?? [] }));
};

// Nama RPC sama dengan nama function lama, jadi pemanggilan lama bisa dipetakan langsung.
export const rpc = (name, params = {}) => request(`/api/rpc/${name}`, params);

// Pengelolaan akun memakai amplop { ok, data, error } seperti Edge Function lama,
// sehingga pemanggil yang sudah memeriksa data.ok tidak perlu diubah.
export const manageUser = async (body) => {
  let response;
  try {
    response = await fetch('/api/manage-user', {
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

  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.error?.message ?? 'Operasi akun gagal.');
    error.code = payload?.error?.code ?? 'manage_user_failed';
    error.status = response.status;
    return { data: null, error };
  }

  return { data: payload, error: null };
};
