import {
    evaluateAttendanceWindow,
    getJakartaDateString,
    getJakartaTimeString,
    normalizeAttendanceSessionName,
} from '@/utils/AttendanceStatusLogic';
import { count, insert, query, queryAll, queryIn, update, upsert } from '@/lib/dataClient';

export const ATTENDANCE_COLUMNS = [
    'id', 'user_id', 'role', 'attendance_date', 'check_in_time', 'check_in_timestamp',
    'class_id', 'sesi', 'status', 'source', 'correction_reason', 'corrected_by',
    'created_at', 'updated_at', 'created_by', 'updated_by',
];

// Seluruh riwayat kehadiran satu orang. Dulu ini tidak dibatasi jumlahnya sehingga
// terpotong diam-diam di 1000 baris; queryAll menyusuri halamannya sampai habis, yang
// penting karena satu santri bisa punya ratusan baris per tahun.
export const fetchSantriAttendanceHistory = (userId, { extraFilters = [], columns = ATTENDANCE_COLUMNS, order = null } = {}) => queryAll({
    table: 'attendance',
    columns,
    filters: [{ column: 'user_id', op: 'eq', value: userId }, ...extraFilters],
    order,
});

export const fetchAttendance = ({ filters = [], columns = ATTENDANCE_COLUMNS, order = null } = {}) => queryAll({
    table: 'attendance',
    columns,
    filters,
    order,
});

// Kehadiran untuk sekumpulan orang sekaligus. Daftar id-nya bisa panjang, sedangkan D1
// hanya menerima 100 parameter terikat per kueri, jadi queryIn yang memecahnya.
export const fetchAttendanceForUsers = ({ userIds, columns = ATTENDANCE_COLUMNS, extraFilters = [] }) => queryIn({
    table: 'attendance',
    columns,
    column: 'user_id',
    values: userIds,
    extraFilters,
});

export const fetchAttendanceForClasses = ({ classIds, columns = ATTENDANCE_COLUMNS, extraFilters = [] }) => queryIn({
    table: 'attendance',
    columns,
    column: 'class_id',
    values: classIds,
    extraFilters,
});

// Tanggal libur dalam satu rentang. Dipulangkan sebagai Set karena seluruh pemanggil
// hanya menanyakan keanggotaan.
export const fetchHolidayDates = async (startDate, endDate) => {
    const { data, error } = await queryAll({
        table: 'academic_calendar',
        columns: ['date'],
        filters: [
            { column: 'date', op: 'gte', value: startDate },
            { column: 'date', op: 'lte', value: endDate },
            // is_holiday bertipe boolean dan tersimpan sebagai 1/0 di D1.
            { column: 'is_holiday', op: 'eq', value: 1 },
        ],
    });
    if (error) return { data: new Set(), error };
    return { data: new Set(data.map((row) => row.date)), error: null };
};

export const saveAttendanceRecord = ({ id = null, values }) => (
    id ? update('attendance', id, values) : insert('attendance', values)
);

// Penggantian jadwal sesi guru disimpan sebagai satu baris website_content berkunci key,
// jadi upsert-nya menabrakkan kolom itu, bukan id.
export const saveGuruSessionOverrides = (content) => upsert(
    'website_content',
    { key: 'guru_session_overrides', content },
    'key',
);

// Satu halaman daftar santri untuk rekap absensi, berikut jumlah seluruh barisnya.
// Penyaringnya dioper apa adanya supaya pemanggil tetap memegang aturannya sendiri.
export const fetchRecapSantriPage = async ({ filters, page, pageSize }) => {
    const [rows, total] = await Promise.all([
        query({
            table: 'santri',
            columns: ['id', 'nama_lengkap', 'sesi_mengaji', 'current_class_id', 'foto_url', 'avatar_path', 'kategori', 'status'],
            filters,
            order: [{ column: 'nama_lengkap', ascending: true }],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        }),
        count({ table: 'santri', filters }),
    ]);
    if (rows.error) return { data: null, count: 0, error: rows.error };
    if (total.error) return { data: null, count: 0, error: total.error };
    return { data: rows.data, count: total.data, error: null };
};

const ACTIVE_STATUS = new Set(['aktif', 'active']);
const EXPLICIT_ABSENT_STATUSES = new Set(['tidak hadir', 'alpha', 'ghaib', 'absen']);

export const normalizeRfidTag = (value) => String(value || '').trim();

export const isActiveSantri = (status) => ACTIVE_STATUS.has(String(status || '').trim().toLowerCase());

export const isExplicitAbsentAttendance = (status) => (
    EXPLICIT_ABSENT_STATUSES.has(String(status || '').trim().toLowerCase())
);

export const getLocalDateString = (date = new Date()) => getJakartaDateString(date);

export const getLocalTimeString = (date = new Date()) => getJakartaTimeString(date);

export const getSantriSession = (santri, fallback = 'Pagi') => (
    santri?.sesi_mengaji || santri?.class?.sesi || fallback
);

export const buildSantriAttendancePayload = ({ santri, timestamp = new Date(), status = null, attendedSession = null }) => {
    const attendanceDate = getLocalDateString(timestamp);
    const sesi = getSantriSession(santri);
    const checkInTimestamp = timestamp.toISOString();
    const windowState = evaluateAttendanceWindow({ timestamp, dateStr: attendanceDate, sesi });

    return {
        user_id: santri.id,
        role: 'santri',
        attendance_date: attendanceDate,
        check_in_time: getLocalTimeString(timestamp),
        check_in_timestamp: checkInTimestamp,
        class_id: santri.current_class_id,
        sesi,
        attended_session: normalizeAttendanceSessionName(attendedSession) || sesi,
        status: status || windowState.status || 'Terlambat',
        source: 'rfid',
    };
};

export const getSantriAttendanceSuccessMessage = ({ assignedSession, attendedSession }) => {
    const registered = normalizeAttendanceSessionName(assignedSession);
    const actual = normalizeAttendanceSessionName(attendedSession) || registered;

    if (registered && actual && registered !== actual) {
        return `Absensi sesi ${actual} berhasil. Kehadiran tercatat untuk sesi ${registered}.`;
    }

    return `Absensi sesi ${actual || registered || 'belajar'} berhasil.`;
};

export const getAttendanceErrorMessage = (error) => {
    const message = String(error?.message || '');
    if (error?.code === '23505' || message.includes('attendance_user_date_sesi_unique')) {
        return 'Santri sudah tercatat hadir pada sesi ini.';
    }
    if (error?.code === '42501' || message.toLowerCase().includes('row-level security')) {
        return 'Anda tidak memiliki akses untuk mencatat absensi santri ini.';
    }
    return message || 'Absensi gagal dicatat.';
};
