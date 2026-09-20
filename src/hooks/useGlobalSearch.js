import { useState, useEffect, useCallback } from 'react';
import { attachRelated, query, queryIn } from '@/lib/dataClient';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

// Pencarian global di seluruh dashboard admin.
//
// Dulu pembayaran dicari lewat join dalam: payments dengan santri!inner(...) lalu disaring
// pada santri.nama_lengkap. Endpoint data tidak menyaring berdasarkan tabel yang
// direlasikan, jadi urutannya dibalik — santri yang cocok dicari lebih dulu, lalu
// pembayaran miliknya diambil. Hasilnya sama, dan tidak ada lagi pembayaran yang tersaring
// oleh kolom yang tidak ikut terbaca.
//
// Nilai pencarian dibungkus % di sini dan bukan lagi oleh utilitas PostgREST: tidak ada
// pohon logika yang perlu dirakit menjadi teks, jadi tidak ada pula yang bisa rusak karena
// koma atau tanda kutip di dalam kata kunci.
const wildcard = (value) => `%${String(value ?? '').replace(/"/g, '').trim()}%`;

const SANTRI_COLUMNS = ['id', 'nama_lengkap', 'nomor_induk_qiroati', 'foto_url', 'avatar_path', 'status', 'jilid'];
const PAYMENT_COLUMNS = ['id', 'santri_id', 'jumlah', 'bulan', 'tahun', 'metode_pembayaran', 'tanggal_pembayaran'];

export const useGlobalSearch = (query_, delay = 300) => {
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim() === '') {
      setResults({});
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const rawTerm = searchQuery.trim();
    const term = wildcard(rawTerm);
    const isNumeric = !Number.isNaN(parseInt(rawTerm, 10));
    const numValue = isNumeric ? parseInt(rawTerm, 10) : 0;

    try {
      // Satu pencarian yang gagal tidak boleh mengosongkan seluruh hasil, sama seperti
      // sebelumnya: yang berhasil tetap ditampilkan.
      const safe = async (promise) => {
        try {
          return await promise;
        } catch (err) {
          console.error('Global search partial failure:', err);
          return { data: [], error: err };
        }
      };

      const [santriRes, guruRes, classesRes, payLocalRes] = await Promise.all([
        safe(query({
          table: 'santri',
          columns: SANTRI_COLUMNS,
          filters: [
            { column: 'deleted_at', op: 'is_null' },
            { or: [
              { column: 'nama_lengkap', op: 'ilike', value: term },
              { column: 'nomor_induk_qiroati', op: 'ilike', value: term },
            ] },
          ],
          limit: 5,
        })),
        safe(query({
          table: 'guru',
          columns: ['id', 'nama', 'jabatan', 'foto_url', 'status_guru'],
          filters: [
            { column: 'deleted_at', op: 'is_null' },
            { column: 'nama', op: 'ilike', value: term },
          ],
          limit: 5,
        })),
        safe(query({
          table: 'classes',
          columns: ['id', 'nama_kelas', 'sesi', 'id_guru'],
          filters: [
            { column: 'deleted_at', op: 'is_null' },
            { column: 'nama_kelas', op: 'ilike', value: term },
          ],
          limit: 5,
        })),
        safe(query({
          table: 'payments',
          columns: PAYMENT_COLUMNS,
          filters: [
            { column: 'deleted_at', op: 'is_null' },
            { or: [
              { column: 'metode_pembayaran', op: 'ilike', value: term },
              // bulan, tahun, dan jumlah bertipe angka, jadi hanya dicocokkan ketika kata
              // kuncinya memang angka. Nilai jumlah dikirim dalam rupiah; lapisan data
              // yang mengubahnya ke sen.
              ...(isNumeric ? [
                { column: 'bulan', op: 'eq', value: numValue },
                { column: 'tahun', op: 'eq', value: numValue },
                { column: 'jumlah', op: 'eq', value: numValue },
              ] : []),
            ] },
          ],
          limit: 10,
        })),
      ]);

      // Pembayaran milik santri yang namanya cocok, menggantikan join dalam yang lama.
      const matchedSantriIds = (santriRes.data ?? []).map((item) => item.id);
      const paySantriRes = matchedSantriIds.length > 0
        ? await safe(queryIn({
          table: 'payments',
          columns: PAYMENT_COLUMNS,
          column: 'santri_id',
          values: matchedSantriIds,
          extraFilters: [{ column: 'deleted_at', op: 'is_null' }],
        }))
        : { data: [], error: null };

      const activeErrors = [santriRes.error, guruRes.error, classesRes.error, paySantriRes.error, payLocalRes.error].filter(Boolean);
      if (activeErrors.length > 0) {
        console.warn('Global search encountered partial errors:', activeErrors);
        if (!santriRes.data && !guruRes.data && !classesRes.data && !paySantriRes.data && !payLocalRes.data) {
          throw new Error('Terjadi kesalahan pada server saat mencari data. Silakan coba lagi.');
        }
      }

      const resolvedSantriResults = await resolveAvatarRecords(santriRes.data || [], {
        ownerType: 'santri',
      });
      const newResults = {};

      if (resolvedSantriResults.length > 0) newResults.santri = resolvedSantriResults;
      if (guruRes.data?.length > 0) newResults.guru = guruRes.data;
      if (classesRes.data?.length > 0) {
        // guru:id_guru(nama) dulu ikut lewat join bersarang.
        newResults.kelas = await attachRelated(classesRes.data, {
          foreignKey: 'id_guru', table: 'guru', columns: ['id', 'nama'], as: 'guru',
        });
      }

      const allPayments = [...(paySantriRes.data || []), ...(payLocalRes.data || [])];
      const uniquePayments = Array.from(new Map(allPayments.map((item) => [item.id, item])).values());
      // Nama santri dulu ikut dalam hasil join; sekarang dijahit supaya tampilannya sama.
      const paymentsWithSantri = await attachRelated(uniquePayments, {
        foreignKey: 'santri_id', table: 'santri', columns: ['id', 'nama_lengkap'], as: 'santri',
      });

      const validPayments = paymentsWithSantri.filter((p) => p.santri && p.santri.nama_lengkap);
      if (validPayments.length > 0) {
        newResults.pembayaran = validPayments.slice(0, 5);
      }

      setResults(newResults);
    } catch (err) {
      console.error('Global search exception:', err);
      setError('Gagal mengambil data pencarian. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query_);
    }, delay);

    return () => clearTimeout(timer);
  }, [query_, performSearch, delay]);

  return { results, isLoading, error, performSearch };
};
