import {
    buildSessionStartTimestamp,
    determineAttendanceStatus,
    getJakartaDateString,
    getJakartaTimeString,
} from '@/utils/AttendanceStatusLogic';

const ACTIVE_STATUS = new Set(['aktif', 'active']);

export const normalizeRfidTag = (value) => String(value || '').trim();

export const isActiveSantri = (status) => ACTIVE_STATUS.has(String(status || '').trim().toLowerCase());

export const getLocalDateString = (date = new Date()) => getJakartaDateString(date);

export const getLocalTimeString = (date = new Date()) => getJakartaTimeString(date);

export const getSantriSession = (santri, fallback = 'Pagi') => (
    santri?.sesi_mengaji || santri?.class?.sesi || fallback
);

export const buildSantriAttendancePayload = ({ santri, timestamp = new Date(), status = null }) => {
    const attendanceDate = getLocalDateString(timestamp);
    const sesi = getSantriSession(santri);
    const sessionStart = buildSessionStartTimestamp(attendanceDate, sesi);
    const checkInTimestamp = timestamp.toISOString();

    return {
        user_id: santri.id,
        role: 'santri',
        attendance_date: attendanceDate,
        check_in_time: getLocalTimeString(timestamp),
        check_in_timestamp: checkInTimestamp,
        class_id: santri.current_class_id,
        sesi,
        status: status || determineAttendanceStatus(checkInTimestamp, sessionStart),
        source: 'rfid',
    };
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
