import {
    evaluateAttendanceWindow,
    getJakartaDateString,
    getJakartaTimeString,
    normalizeAttendanceSessionName,
} from '@/utils/AttendanceStatusLogic';
import { queryAll } from '@/lib/dataClient';

export const ATTENDANCE_COLUMNS = [
    'id', 'user_id', 'role', 'attendance_date', 'check_in_time', 'check_in_timestamp',
    'class_id', 'sesi', 'status', 'source', 'correction_reason', 'corrected_by',
    'created_at', 'updated_at', 'created_by', 'updated_by',
];

// Seluruh riwayat kehadiran satu orang. Dulu ini tidak dibatasi jumlahnya sehingga
// terpotong diam-diam di 1000 baris; queryAll menyusuri halamannya sampai habis, yang
// penting karena satu santri bisa punya ratusan baris per tahun.
export const fetchSantriAttendanceHistory = (userId, { extraFilters = [] } = {}) => queryAll({
    table: 'attendance',
    columns: ATTENDANCE_COLUMNS,
    filters: [{ column: 'user_id', op: 'eq', value: userId }, ...extraFilters],
});

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
