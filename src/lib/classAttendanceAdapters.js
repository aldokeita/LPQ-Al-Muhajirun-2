import { query } from '@/lib/dataClient';

const isActiveSantriStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return !normalized || normalized === 'aktif' || normalized === 'active';
};
const sortRoster = (left, right) => {
  const leftOrder = Number.isFinite(left.order_in_class) ? left.order_in_class : Number.MAX_SAFE_INTEGER;
  const rightOrder = Number.isFinite(right.order_in_class) ? right.order_in_class : Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  const byName = String(left.nama_lengkap || '').localeCompare(String(right.nama_lengkap || ''), 'id');
  if (byName !== 0) return byName;
  return String(left.id).localeCompare(String(right.id));
};

export const fetchClassAttendanceSource = async ({ year }) => {
  const calendarStart = `${year}-01-01`;
  const calendarEnd = `${year}-12-31`;

  // Guru dulu diambil lewat join bersarang. Endpoint data tidak melayani join, jadi
  // tabelnya ditarik terpisah lalu dijahit di sini. Hasilnya sama: bila pemohon tidak
  // berhak membaca tabel guru, namanya kosong — persis seperti yang dilakukan RLS.
  const [classResult, santriResult, membershipResult, calendarResult, guruResult] = await Promise.all([
    query({
      table: 'classes',
      columns: ['id', 'nama_kelas', 'id_guru', 'sesi', 'kategori', 'sort_order', 'is_active'],
      filters: [
        { column: 'is_active', op: 'eq', value: 1 },
        { column: 'deleted_at', op: 'is_null' },
      ],
      order: [{ column: 'sort_order', ascending: true, nullsFirst: false }],
      limit: 1000,
    }),
    query({
      table: 'santri',
      columns: ['id', 'nama_lengkap', 'no_hp_ortu', 'jilid', 'current_class_id', 'order_in_class', 'status', 'deleted_at'],
      filters: [{ column: 'deleted_at', op: 'is_null' }],
      order: [{ column: 'order_in_class', ascending: true, nullsFirst: false }],
      limit: 1000,
    }),
    query({
      table: 'class_memberships',
      columns: ['santri_id', 'class_id', 'order_in_class'],
      filters: [{ column: 'status', op: 'eq', value: 'active' }],
      limit: 1000,
    }),
    query({
      table: 'academic_calendar',
      columns: ['date', 'is_holiday'],
      filters: [
        { column: 'date', op: 'gte', value: calendarStart },
        { column: 'date', op: 'lte', value: calendarEnd },
        { column: 'is_holiday', op: 'eq', value: 1 },
      ],
      limit: 1000,
    }),
    query({ table: 'guru', columns: ['id', 'nama'], limit: 1000 }),
  ]);

  const firstError = [
    classResult.error,
    santriResult.error,
    membershipResult.error,
    calendarResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message || 'Gagal memuat sumber data absensi kelas.');
  }

  // Tabel guru boleh gagal tanpa menggagalkan seluruh lembar absensi: peringatan
  // "Guru belum ditentukan" di bawah sudah menangani nama yang kosong.
  const guruById = new Map((guruResult.error ? [] : guruResult.data).map((item) => [item.id, item]));

  const membershipsBySantri = new Map(
    (membershipResult.data || []).map((membership) => [membership.santri_id, membership]),
  );
  const classMap = new Map((classResult.data || []).map((classItem) => [classItem.id, {
    ...classItem,
    guru: guruById.get(classItem.id_guru) ?? null,
    roster: [],
    warnings: [],
  }]));

  (santriResult.data || [])
    .filter((santri) => isActiveSantriStatus(santri.status))
    .forEach((santri) => {
      const membership = membershipsBySantri.get(santri.id);
      const resolvedClassId = santri.current_class_id || membership?.class_id || null;
      const targetClass = classMap.get(resolvedClassId);

      if (!targetClass) return;

      const hasMembershipMismatch = Boolean(
        santri.current_class_id
        && membership?.class_id
        && santri.current_class_id !== membership.class_id,
      );

      targetClass.roster.push({
        ...santri,
        order_in_class: santri.order_in_class ?? membership?.order_in_class ?? null,
        hasMembershipMismatch,
      });
    });

  const classes = Array.from(classMap.values()).map((classItem) => {
    const roster = [...classItem.roster].sort(sortRoster);
    const missingFieldCount = roster.filter((santri) => !santri.jilid || !santri.no_hp_ortu).length;
    const mismatchCount = roster.filter((santri) => santri.hasMembershipMismatch).length;
    const warnings = [];

    if (!classItem.guru?.nama) warnings.push('Guru belum ditentukan');
    if (missingFieldCount > 0) warnings.push(`${missingFieldCount} data santri belum lengkap`);
    if (mismatchCount > 0) warnings.push(`${mismatchCount} membership perlu diperiksa`);

    return { ...classItem, roster, warnings, missingFieldCount, mismatchCount };
  });

  return {
    classes,
    holidays: new Set((calendarResult.data || []).map((entry) => entry.date)),
    fetchedAt: new Date(),
  };
};
