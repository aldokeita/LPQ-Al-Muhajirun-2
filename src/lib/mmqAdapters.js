import { attachRelated, insert, query, remove, update } from '@/lib/dataClient';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';

const ALLOWED_ATTENDANCE_STATUSES = new Set(['Hadir', 'Terlambat', 'Tidak Hadir', 'Alpha', 'Izin', 'Sakit']);

const toDbTime = (value) => {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
};

export const getMmqErrorMessage = (error) => {
  if (!error) return 'Terjadi kesalahan pada fitur MMQ.';
  const message = error.message || '';

  if (error.code === '23505' || message.toLowerCase().includes('duplicate')) {
    return 'Kehadiran MMQ untuk guru, jadwal, dan tanggal tersebut sudah tercatat.';
  }

  if (error.code === '42501' || message.toLowerCase().includes('row-level security')) {
    return 'Akses MMQ tidak diizinkan untuk akun ini.';
  }

  if (message.includes('mmq_attendance_status_check')) {
    return 'Status kehadiran MMQ tidak sesuai aturan database.';
  }

  return message || 'Terjadi kesalahan pada fitur MMQ.';
};

const sanitizeSchedulePayload = (payload) => ({
  day_of_week: Number(payload.day_of_week),
  start_time: toDbTime(payload.start_time),
  end_time: toDbTime(payload.end_time),
  location: payload.location || null,
  is_active: payload.is_active ?? true,
});

const sanitizeAttendancePayload = (payload) => {
  const status = ALLOWED_ATTENDANCE_STATUSES.has(payload.status) ? payload.status : 'Hadir';

  return {
    schedule_id: payload.schedule_id,
    guru_id: payload.guru_id,
    attendance_date: payload.attendance_date,
    check_in_timestamp: payload.check_in_timestamp || null,
    status,
    notes: payload.notes || null,
  };
};

export const fetchMmqSchedules = async () => {
  const { data, error } = await query({
    table: 'mmq_schedule',
    columns: ['id', 'day_of_week', 'start_time', 'end_time', 'location', 'is_active'],
    order: [{ column: 'day_of_week', ascending: true }, { column: 'start_time', ascending: true }],
    limit: 1000,
  });

  if (error) throw error;
  return data || [];
};

export const saveMmqSchedule = async (payload) => {
  const schedulePayload = sanitizeSchedulePayload(payload);
  const { data, error } = payload.id
    ? await update('mmq_schedule', payload.id, schedulePayload)
    : await insert('mmq_schedule', schedulePayload);
  if (error) throw error;
  return { ...schedulePayload, id: payload.id ?? data?.id ?? null };
};

export const deleteMmqSchedule = async (id) => {
  const { error } = await remove('mmq_schedule', id);
  if (error) throw error;
};

export const fetchMmqAttendance = async ({ date } = {}) => {
  const filters = date ? [{ column: 'attendance_date', op: 'eq', value: date }] : [];
  const { data, error } = await query({
    table: 'mmq_attendance',
    columns: ['id', 'schedule_id', 'guru_id', 'attendance_date', 'check_in_timestamp', 'status', 'notes'],
    filters,
    order: [
      { column: 'attendance_date', ascending: false },
      { column: 'check_in_timestamp', ascending: false, nullsFirst: false },
    ],
    limit: 1000,
  });
  if (error) throw error;

  // Dulu guru dan jadwal ikut lewat join bersarang; keduanya kini dijahit terpisah.
  let records = await attachRelated(data || [], {
    foreignKey: 'guru_id', table: 'guru', columns: ['id', 'nama', 'foto_url', 'no_hp'], as: 'guru',
  });
  records = await attachRelated(records, {
    foreignKey: 'schedule_id',
    table: 'mmq_schedule',
    columns: ['id', 'day_of_week', 'start_time', 'end_time', 'location'],
    as: 'schedule',
  });

  return Promise.all(records.map(async (record) => ({
    ...record,
    guru: await resolveAvatarRecord(record.guru, { ownerType: 'guru' }),
  })));
};

export const saveMmqAttendance = async (payload) => {
  const attendancePayload = sanitizeAttendancePayload(payload);
  const { data, error } = payload.id
    ? await update('mmq_attendance', payload.id, attendancePayload)
    : await insert('mmq_attendance', attendancePayload);
  if (error) throw error;
  return { ...attendancePayload, id: payload.id ?? data?.id ?? null };
};

export const createMmqAttendance = async (payload) => {
  const attendancePayload = sanitizeAttendancePayload(payload);
  const { data, error } = await insert('mmq_attendance', attendancePayload);
  if (error) throw error;
  return { ...attendancePayload, id: data?.id ?? null };
};

export const deleteMmqAttendance = async (id) => {
  const { error } = await remove('mmq_attendance', id);
  if (error) throw error;
};

export const fetchMmqNotulensi = async () => {
  const { data, error } = await query({
    table: 'mmq_notulensi',
    columns: ['id', 'schedule_id', 'tanggal', 'judul', 'isi', 'notulen_id'],
    order: [{ column: 'tanggal', ascending: false }, { column: 'created_at', ascending: false }],
    limit: 1000,
  });
  if (error) throw error;

  const withNotulen = await attachRelated(data || [], {
    foreignKey: 'notulen_id', table: 'guru', columns: ['id', 'nama'], as: 'notulen',
  });
  return attachRelated(withNotulen, {
    foreignKey: 'schedule_id',
    table: 'mmq_schedule',
    columns: ['id', 'day_of_week', 'start_time', 'end_time', 'location'],
    as: 'schedule',
  });
};

export const createMmqNotulensi = async ({ schedule_id, tanggal, judul, isi, notulen_id }) => {
  const payload = { schedule_id, tanggal, judul, isi, notulen_id };
  const { data, error } = await insert('mmq_notulensi', payload);
  if (error) throw error;
  return { ...payload, id: data?.id ?? null };
};

export const updateMmqNotulensi = async (id, payload) => {
  const values = {
    judul: payload.judul,
    isi: payload.isi,
    tanggal: payload.tanggal,
    schedule_id: payload.schedule_id,
  };
  const { error } = await update('mmq_notulensi', id, values);
  if (error) throw error;
  return { ...values, id };
};

export const deleteMmqNotulensi = async (id) => {
  const { error } = await remove('mmq_notulensi', id);
  if (error) throw error;
};

export const fetchGuruForMmq = async () => {
  const { data, error } = await query({
    table: 'guru',
    columns: ['id', 'nama', 'email', 'no_hp', 'foto_url', 'rfid_tag', 'is_notulen'],
    order: [{ column: 'nama', ascending: true }],
    limit: 1000,
  });
  if (error) throw error;
  return resolveAvatarRecords(data, { ownerType: 'guru' });
};

export const findGuruByRfid = async (rfidTag) => {
  const { data, error } = await query({
    table: 'guru',
    columns: ['id', 'nama', 'foto_url', 'rfid_tag', 'is_notulen'],
    filters: [{ column: 'rfid_tag', op: 'eq', value: rfidTag }],
    limit: 1,
  });
  if (error) throw error;
  return resolveAvatarRecord(data?.[0] ?? null, { ownerType: 'guru' });
};

export const pickScheduleForToday = (schedules, date = new Date()) => {
  const activeSchedules = (schedules || []).filter((schedule) => schedule.is_active);
  if (activeSchedules.length === 0) return null;

  const todaySchedule = activeSchedules.find((schedule) => Number(schedule.day_of_week) === date.getDay());
  return todaySchedule || activeSchedules[0];
};
