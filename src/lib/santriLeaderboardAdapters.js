// Papan peringkat poin seluruh santri.
//
// Tidak membaca tabel santri lewat /api/data/query, melainkan lewat RPC tersendiri.
// Kebijakan tabel santri mengunci guru pada santri di kelasnya sendiri — kalau
// dibaca dari sana, papan peringkat guru hanya berisi kelasnya dan bukan peringkat
// sekolah. Melonggarkan kebijakan itu bukan pilihan, karena ikut membuka nomor HP
// wali, alamat, NIK, dan KK. RPC-nya hanya memulangkan kolom yang dipakai papan
// peringkat.
//
// Halamannya diambil satu per satu di server, bukan dengan menarik seluruh santri
// lalu memotongnya di peramban.

import { rpc } from '@/lib/dataClient';

export const LEADERBOARD_PAGE_SIZE = 10;

export const fetchSantriLeaderboardPage = async ({ page = 1, pageSize = LEADERBOARD_PAGE_SIZE } = {}) => {
  const halaman = Math.max(1, Number(page) || 1);
  const ukuran = Math.max(1, Number(pageSize) || LEADERBOARD_PAGE_SIZE);

  const { data, error } = await rpc('get_santri_leaderboard', {
    p_page: halaman,
    p_page_size: ukuran,
  });

  if (error) throw error;

  return {
    rows: data?.rows || [],
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? halaman),
    pageSize: Number(data?.pageSize ?? ukuran),
    totalPages: Math.max(1, Number(data?.totalPages ?? 1)),
    // Peringkat dihitung dari offset supaya nomornya berlanjut antar halaman.
    startRank: Number(data?.startRank ?? (halaman - 1) * ukuran + 1),
  };
};
