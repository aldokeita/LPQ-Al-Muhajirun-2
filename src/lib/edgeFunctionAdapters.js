// Pemanggilan fungsi backend, dulu lewat Edge Function Supabase.
//
// Nama fungsinya dipertahankan agar pemanggil tidak perlu berubah, tetapi tujuannya kini
// route Worker. Sesi dibawa cookie HttpOnly, jadi tidak ada token yang perlu dibaca dan
// disisipkan sendiri seperti sebelumnya.
//
// Fungsi yang belum dipindahkan sengaja ditolak dengan pesan yang terang, bukan dibiarkan
// diam-diam memanggil Supabase — memanggil dua backend sekaligus akan menghasilkan data
// yang tidak sinkron.

const ROUTES = {
  'reset-user-password': '/api/reset-user-password',
  'manage-user': '/api/manage-user',
};

const parseSafeResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
};

const getRemoteMessage = (body, fallback) => {
  const error = body?.error || body;
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ') || fallback;
};

export const invokeAuthenticatedEdgeFunction = async (functionName, body) => {
  if (!/^[a-z0-9-]+$/.test(functionName)) throw new Error('Nama fungsi tidak valid.');

  const route = ROUTES[functionName];
  if (!route) {
    throw new Error(`Fungsi "${functionName}" belum tersedia di backend baru.`);
  }

  let response;
  try {
    response = await fetch(route, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (requestError) {
    throw new Error(`Gagal menghubungi server. Periksa koneksi (${requestError?.message || 'network error'}).`);
  }

  const responseBody = await parseSafeResponse(response);
  if (!response.ok || responseBody?.ok === false) {
    throw new Error(getRemoteMessage(responseBody, `Permintaan gagal dengan status HTTP ${response.status}.`));
  }
  return responseBody;
};
