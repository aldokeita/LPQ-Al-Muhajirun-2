import {
  attachRelated, insert, query, queryIn, queryOne, removeWhere, update, updateWhere,
} from '@/lib/dataClient';

// Pola yang berulang di modul ini: cari baris yang sudah ada berdasarkan kunci gabungan,
// lalu perbarui atau tambahkan. Dijadikan satu tempat agar kelima pemakaiannya tidak
// berbeda perlakuan.
//
// keyColumns dipakai untuk tabel berkunci gabungan yang tidak punya kolom id, seperti
// santri_character_strengths; barisnya dipilih lewat kuncinya sendiri.
const updateOrInsert = async ({ table, filters, values, keyColumns = null }) => {
  const columns = keyColumns ?? ['id'];
  const { data: existing, error: findError } = await queryOne({ table, columns, filters });
  if (findError) throw findError;

  if (!existing) {
    const { error: insertError } = await insert(table, values);
    if (insertError) throw insertError;
    return;
  }

  const { error } = keyColumns
    ? await updateWhere(table, Object.fromEntries(keyColumns.map((c) => [c, existing[c]])), values)
    : await update(table, existing.id, values);
  if (error) throw error;
};

export const progressStatusToComplete = (status) => status === 'lulus';

export const completeToProgressStatus = (complete) => (complete ? 'lulus' : 'proses');

export const DEVELOPMENT_SCORE_OPTIONS = [
    { score: 1, code: 'BB', label: 'Belum Berkembang', tone: 'slate' },
    { score: 2, code: 'MB', label: 'Mulai Berkembang', tone: 'amber' },
    { score: 3, code: 'BSH', label: 'Berkembang Sesuai Harapan', tone: 'sky' },
    { score: 4, code: 'SB', label: 'Sangat Berkembang', tone: 'emerald' }
];

export const CHARACTER_STRENGTH_OPTIONS = [
    'Disiplin',
    'Jujur',
    'Mandiri',
    'Percaya Diri',
    'Bertanggung Jawab',
    'Sopan Santun',
    'Peduli',
    'Rajin Beribadah',
    'Semangat Belajar',
    "Gemar Membaca Al-Qur'an"
];

export const VIOLATION_LEVELS = {
    Ringan: {
        examples: 'Terlambat, lupa membawa buku, tidak memakai ID Card, atau bercanda saat belajar',
        followUp: 'Nasihat dan pengingat dari guru'
    },
    Sedang: {
        examples: 'Mengganggu teman berulang kali, tidak sopan kepada guru, atau tidak mengerjakan hafalan berulang',
        followUp: 'Pembinaan, pencatatan, dan pemberitahuan kepada orang tua'
    },
    Berat: {
        examples: 'Berkelahi, merusak fasilitas, membawa barang berbahaya, atau tindakan yang membahayakan',
        followUp: 'Pertemuan dengan orang tua, pembinaan intensif, dan keputusan kepala LPQ'
    }
};

export const getDevelopmentScoreMeta = (score) => (
    DEVELOPMENT_SCORE_OPTIONS.find((item) => item.score === Number(score))
    || DEVELOPMENT_SCORE_OPTIONS[0]
);

export const groupHafalanItemsByJilid = (items = []) => {
    const groups = Object.fromEntries([1, 2, 3, 4, 5, 6].map((jilid) => [jilid, []]));

    items.forEach((item) => {
        const normalizedJilid = String(item?.jilid || '1')
            .replace(/^jilid\s*/i, '')
            .trim();
        if (groups[normalizedJilid]) groups[normalizedJilid].push(item);
    });

    return groups;
};

export const PTPT_TAHFIZH_TARGETS = ['Juz 1', 'Juz 2', 'Juz 28', 'Juz 29', 'Juz 30'];

export const getHafalanProgramScope = (santriOrCategory) => {
    const category = typeof santriOrCategory === 'string'
        ? santriOrCategory
        : santriOrCategory?.kategori;
    return String(category || '').toUpperCase() === 'PTPT' ? 'PTPT' : 'TPQ';
};

export const groupHafalanItemsByTarget = (items = [], targets = PTPT_TAHFIZH_TARGETS) => (
    Object.fromEntries(targets.map((target) => [
        target,
        items.filter((item) => String(item?.jilid || '').trim() === target)
    ]))
);

export const getAcademicErrorMessage = (error) => {
    const message = String(error?.message || error || '');
    if (message.includes('row-level security') || error?.code === '42501') {
        return 'Anda tidak memiliki akses untuk data akademik ini.';
    }
    if (message.includes('academic_calendar_title_not_blank')) {
        return 'Judul kalender wajib diisi.';
    }
    if (message.includes('hafalan_items_name_not_blank')) {
        return 'Nama item hafalan wajib diisi.';
    }
    if (message.includes('hafalan_progress_status_check')) {
        return 'Status hafalan tidak valid.';
    }
    if (message.includes('score_check')) {
        return 'Skor perkembangan harus berada pada nilai 1 sampai 4.';
    }
    if (message.includes('santri_behavior_records_level_check')) {
        return 'Tingkat pelanggaran tidak valid.';
    }
    if (message.includes('murojaah_submissions_status_check')) {
        return 'Status murojaah tidak valid.';
    }
    return message || 'Operasi akademik gagal.';
};

export const fetchCalendarEvents = async ({ startDate, endDate }) => {
    const { data, error } = await query({
        table: 'academic_calendar',
        columns: ['id', 'date', 'title', 'description', 'is_holiday', 'is_public', 'event_type'],
        filters: [
            { column: 'date', op: 'gte', value: startDate },
            { column: 'date', op: 'lte', value: endDate },
        ],
        order: [{ column: 'date', ascending: true }],
        limit: 1000,
    });

    if (error) throw error;
    return data || [];
};

export const saveCalendarEvent = async ({ existingId, selectedDate, description, isHoliday, userId }) => {
    const cleanDescription = String(description || '').trim();
    const title = cleanDescription || (isHoliday ? 'Hari Libur' : 'Hari Masuk');
    const payload = {
        date: selectedDate,
        title,
        description: cleanDescription || null,
        is_holiday: Boolean(isHoliday),
        is_public: true,
        event_type: isHoliday ? 'holiday' : 'school_day',
        updated_by: userId || null
    };

    // created_by dan updated_by ditetapkan server dari sesi; nilai dari sini diabaikan.
    const { error } = existingId
        ? await update('academic_calendar', existingId, payload)
        : await insert('academic_calendar', payload);
    if (error) throw error;
};

export const deleteCalendarEvent = async (id) => {
    const { error } = await removeWhere('academic_calendar', { id });
    if (error) throw error;
};

export const fetchHafalanItems = async (category = null, programScope = null) => {
    const filters = [{ column: 'is_active', op: 'eq', value: 1 }];
    if (category) filters.push({ column: 'category', op: 'eq', value: category });
    if (programScope) filters.push({ column: 'program_scope', op: 'eq', value: programScope });

    const { data, error } = await query({
        table: 'hafalan_items',
        columns: ['id', 'program_scope', 'category', 'jilid', 'item_name', 'item_order', 'is_active'],
        filters,
        order: [{ column: 'item_order', ascending: true }, { column: 'item_name', ascending: true }],
        limit: 1000,
    });
    if (error) throw error;
    return data || [];
};

export const createHafalanItem = async ({ category, itemName, jilid, itemOrder, programScope = 'TPQ' }) => {
    const { error } = await insert('hafalan_items', {
        program_scope: programScope,
        category,
        item_name: String(itemName || '').trim(),
        jilid: String(jilid || ''),
        item_order: itemOrder,
        is_active: 1
    });
    if (error) throw error;
};

export const updateHafalanItem = async (id, updates) => {
    const values = { ...updates };
    // Kolom yang tidak dikirim tidak boleh ikut terhapus, jadi undefined dibuang.
    if (values.jilid === undefined) delete values.jilid;
    else values.jilid = String(values.jilid);
    for (const key of Object.keys(values)) {
        if (values[key] === undefined) delete values[key];
    }

    const { error } = await update('hafalan_items', id, values);
    if (error) throw error;
};

export const deactivateHafalanItem = async (id) => {
    const { error } = await update('hafalan_items', id, { is_active: 0 });
    if (error) throw error;
};

const SANTRI_ROSTER_COLUMNS = [
    'id', 'nama_lengkap', 'nama_panggilan', 'nama_ibu', 'nama_ayah', 'nomor_induk_qiroati',
    'kategori', 'jilid', 'juz_hafalan', 'status', 'current_class_id', 'sesi_mengaji',
    'foto_url', 'avatar_path', 'tanggal_lahir', 'no_hp_ortu', 'created_at',
];

export const fetchClassesWithActiveSantriForTeacher = async (guruId) => {
    const { data: classes, error: classError } = await query({
        table: 'classes',
        columns: ['id', 'nama_kelas', 'id_guru', 'sesi', 'kategori', 'sort_order'],
        filters: [
            { column: 'id_guru', op: 'eq', value: guruId },
            { column: 'is_active', op: 'eq', value: 1 },
            { column: 'deleted_at', op: 'is_null' },
        ],
        order: [{ column: 'sort_order', ascending: true }],
        limit: 1000,
    });

    if (classError) throw classError;
    if (!classes?.length) return [];

    const classIds = classes.map((item) => item.id);
    const { data: rows, error: membershipError } = await query({
        table: 'class_memberships',
        columns: ['class_id', 'order_in_class', 'santri_id'],
        filters: [
            { column: 'class_id', op: 'in', value: classIds },
            { column: 'status', op: 'eq', value: 'active' },
        ],
        order: [{ column: 'order_in_class', ascending: true }],
        limit: 1000,
    });

    if (membershipError) throw membershipError;

    // Data santri dulu ikut lewat join bersarang; kini dijahit terpisah.
    const memberships = await attachRelated(rows || [], {
        foreignKey: 'santri_id', table: 'santri', columns: SANTRI_ROSTER_COLUMNS, as: 'santri',
    });

    return classes.map((kelas) => ({
        ...kelas,
        santri: (memberships || [])
            .filter((membership) => membership.class_id === kelas.id && membership.santri)
            .map((membership) => ({
                ...membership.santri,
                id_kelas: kelas.id,
                class: kelas,
                order_in_class: membership.order_in_class
            }))
    }));
};

const HAFALAN_PROGRESS_COLUMNS = [
    'id', 'santri_id', 'item_id', 'category', 'item_name', 'status', 'score', 'nilai',
    'catatan', 'assessed_by', 'assessed_at', 'created_at', 'updated_at',
];

export const fetchHafalanProgress = async (santriIds = null) => {
    // Daftar santri bisa sepanjang beberapa kelas sekaligus, jadi dibaca berpotongan.
    const { data, error } = Array.isArray(santriIds) && santriIds.length > 0
        ? await queryIn({
            table: 'hafalan_progress', columns: HAFALAN_PROGRESS_COLUMNS,
            column: 'santri_id', values: santriIds,
        })
        : await query({ table: 'hafalan_progress', columns: HAFALAN_PROGRESS_COLUMNS, limit: 1000 });

    if (error) throw error;
    return data || [];
};

export const buildProgressMap = (progressRows) => {
    const map = {};
    (progressRows || []).forEach((row) => {
        const key = row.item_id
            ? `${row.santri_id}-${row.item_id}`
            : `${row.santri_id}-${row.category}-${row.item_name}`;
        map[key] = progressStatusToComplete(row.status);
    });
    return map;
};

export const buildHafalanScoreMap = (progressRows) => {
    const map = {};
    (progressRows || []).forEach((row) => {
        const key = row.item_id
            ? `${row.santri_id}-${row.item_id}`
            : `${row.santri_id}-${row.category}-${row.item_name}`;
        map[key] = Number(row.score || (row.status === 'lulus' ? 4 : 1));
    });
    return map;
};

export const upsertHafalanProgress = async ({ santriId, item, score, userId }) => {
    const itemId = item?.id || null;
    const normalizedScore = Number(score);
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 4) {
        throw new Error('Skor hafalan harus berupa angka 1 sampai 4.');
    }
    const filters = [{ column: 'santri_id', op: 'eq', value: santriId }];
    if (itemId) {
        filters.push({ column: 'item_id', op: 'eq', value: itemId });
    } else {
        filters.push({ column: 'category', op: 'eq', value: item.category });
        filters.push({ column: 'item_name', op: 'eq', value: item.item_name });
    }

    // Status ditetapkan trigger dari nilainya, tetapi tetap dikirim agar barisnya benar
    // sejak awal dan tidak bergantung pada urutan trigger.
    const payload = {
        santri_id: santriId,
        item_id: itemId,
        category: item.category,
        item_name: item.item_name,
        score: normalizedScore,
        status: normalizedScore === 4 ? 'lulus' : 'proses',
        assessed_by: userId || null,
        assessed_at: new Date().toISOString(),
    };

    await updateOrInsert({ table: 'hafalan_progress', filters, values: payload });
};

export const fetchCharacterAssessmentItems = async () => {
    const { data, error } = await query({
        table: 'character_assessment_items',
        columns: ['id', 'item_order', 'item_name', 'is_active'],
        filters: [{ column: 'is_active', op: 'eq', value: 1 }],
        order: [{ column: 'item_order', ascending: true }],
        limit: 1000,
    });
    if (error) throw error;
    return data || [];
};

export const fetchSantriCharacterScores = async (santriId) => {
    const { data, error } = await query({
        table: 'santri_character_scores',
        columns: ['id', 'santri_id', 'item_id', 'score', 'assessed_by', 'assessed_at', 'updated_at'],
        filters: [{ column: 'santri_id', op: 'eq', value: santriId }],
        limit: 1000,
    });
    if (error) throw error;
    return data || [];
};

export const upsertSantriCharacterScore = async ({ santriId, itemId, score, userId }) => {
    const normalizedScore = Number(score);
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 4) {
        throw new Error('Skor karakter harus berupa angka 1 sampai 4.');
    }
    await updateOrInsert({
        table: 'santri_character_scores',
        filters: [
            { column: 'santri_id', op: 'eq', value: santriId },
            { column: 'item_id', op: 'eq', value: itemId },
        ],
        values: {
            santri_id: santriId,
            item_id: itemId,
            score: normalizedScore,
            assessed_by: userId || null,
            assessed_at: new Date().toISOString(),
        },
    });
};

export const fetchSantriCharacterStrengths = async (santriId) => {
    const { data, error } = await query({
        table: 'santri_character_strengths',
        columns: ['santri_id', 'strength_key', 'selected_by', 'selected_at'],
        filters: [{ column: 'santri_id', op: 'eq', value: santriId }],
        order: [{ column: 'selected_at', ascending: true }],
        limit: 1000,
    });
    if (error) throw error;
    return data || [];
};

export const setSantriCharacterStrength = async ({ santriId, strengthKey, selected, userId }) => {
    const filters = [
        { column: 'santri_id', op: 'eq', value: santriId },
        { column: 'strength_key', op: 'eq', value: strengthKey },
    ];

    // Tabel ini berkunci gabungan (santri_id, strength_key) dan tidak punya kolom id,
    // jadi barisnya dipilih lewat kedua kolom itu.
    const keyColumns = ['santri_id', 'strength_key'];

    if (selected) {
        await updateOrInsert({
            table: 'santri_character_strengths',
            filters,
            keyColumns,
            values: {
                santri_id: santriId,
                strength_key: strengthKey,
                selected_by: userId || null,
                selected_at: new Date().toISOString(),
            },
        });
        return;
    }

    const { data: existing, error: findError } = await queryOne({
        table: 'santri_character_strengths', columns: keyColumns, filters,
    });
    if (findError) throw findError;
    if (!existing) return;

    const { error } = await removeWhere('santri_character_strengths', {
        santri_id: santriId, strength_key: strengthKey,
    });
    if (error) throw error;
};

export const fetchSantriBehaviorRecords = async (santriId) => {
    const { data, error } = await query({
        table: 'santri_behavior_records',
        columns: ['id', 'santri_id', 'guru_id', 'incident_date', 'level', 'behavior', 'follow_up', 'teacher_note', 'created_at', 'updated_at'],
        filters: [{ column: 'santri_id', op: 'eq', value: santriId }],
        order: [{ column: 'incident_date', ascending: false }, { column: 'created_at', ascending: false }],
        limit: 1000,
    });
    if (error) throw error;
    return attachRelated(data || [], { foreignKey: 'guru_id', table: 'guru', columns: ['id', 'nama'], as: 'guru' });
};

export const saveSantriBehaviorRecord = async ({ recordId, santriId, incidentDate, level, behavior, followUp, teacherNote, userId }) => {
    const payload = {
        incident_date: incidentDate,
        level,
        behavior: String(behavior || '').trim(),
        follow_up: String(followUp || '').trim(),
        teacher_note: String(teacherNote || '').trim() || null,
        updated_by: userId || null
    };
    if (!payload.behavior || !payload.follow_up) {
        throw new Error('Bentuk perilaku dan tindak lanjut wajib diisi.');
    }

    const { error } = recordId
        ? await update('santri_behavior_records', recordId, payload)
        : await insert('santri_behavior_records', {
            ...payload,
            santri_id: santriId,
            guru_id: userId || null,
        });
    if (error) throw error;
};

export const fetchMurojaahSubmissions = async () => {
    const { data, error } = await query({
        table: 'murojaah_submissions',
        columns: ['id', 'santri_id', 'target_guru_id', 'type', 'content', 'recording_path', 'status', 'feedback', 'submitted_at', 'reviewed_at', 'created_at'],
        order: [{ column: 'created_at', ascending: false }],
        limit: 1000,
    });
    if (error) throw error;
    return attachRelated(data || [], {
        foreignKey: 'santri_id', table: 'santri', columns: ['id', 'nama_lengkap', 'current_class_id'], as: 'santri',
    });
};

export const createMurojaahSubmission = async ({ santriId, type, content }) => {
    const { error } = await insert('murojaah_submissions', {
        santri_id: santriId,
        type,
        content,
        recording_path: null,
        status: 'menunggu',
    });
    if (error) throw error;
};

export const updateMurojaahReview = async ({ id, status = 'diterima', feedback, userId }) => {
    const { error } = await update('murojaah_submissions', id, {
        status,
        feedback: String(feedback || '').trim() || null,
        target_guru_id: userId || null,
        reviewed_at: new Date().toISOString(),
    });
    if (error) throw error;
};

const JUZ_SCORE_COLUMNS = ['id', 'santri_id', 'juz_number', 'score', 'assessed_by', 'assessed_at', 'updated_at'];

export const fetchSantriJuzScores = async (santriIds = null) => {
    const { data, error } = Array.isArray(santriIds) && santriIds.length > 0
        ? await queryIn({ table: 'santri_juz_scores', columns: JUZ_SCORE_COLUMNS, column: 'santri_id', values: santriIds })
        : await query({ table: 'santri_juz_scores', columns: JUZ_SCORE_COLUMNS, limit: 1000 });
    if (error) throw error;
    return data || [];
};

export const buildJuzScoreMap = (scoreRows, santriId) => {
    const map = {};
    (scoreRows || []).forEach((row) => {
        if (!santriId || row.santri_id === santriId) {
            const key = santriId ? row.juz_number : `${row.santri_id}-${row.juz_number}`;
            map[key] = Number(row.score);
        }
    });
    return map;
};

export const upsertSantriJuzScore = async ({ santriId, juzNumber, score, userId }) => {
    const normalizedJuz = Number(juzNumber);
    const normalizedScore = Number(score);
    if (!Number.isInteger(normalizedJuz) || normalizedJuz < 1 || normalizedJuz > 30) {
        throw new Error('Juz hafalan harus berada pada rentang 1 sampai 30.');
    }
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 4) {
        throw new Error('Skor juz hafalan harus berupa angka 1 sampai 4.');
    }

    await updateOrInsert({
        table: 'santri_juz_scores',
        filters: [
            { column: 'santri_id', op: 'eq', value: santriId },
            { column: 'juz_number', op: 'eq', value: normalizedJuz },
        ],
        values: {
            santri_id: santriId,
            juz_number: normalizedJuz,
            score: normalizedScore,
            assessed_by: userId || null,
            assessed_at: new Date().toISOString(),
        },
    });
};

const SURAH_SCORE_COLUMNS = ['id', 'santri_id', 'juz_number', 'surah_name', 'score', 'assessed_by', 'assessed_at', 'updated_at'];

export const fetchSantriSurahScores = async (santriIds = null) => {
    const { data, error } = Array.isArray(santriIds) && santriIds.length > 0
        ? await queryIn({ table: 'santri_surah_scores', columns: SURAH_SCORE_COLUMNS, column: 'santri_id', values: santriIds })
        : await query({ table: 'santri_surah_scores', columns: SURAH_SCORE_COLUMNS, limit: 1000 });
    if (error) throw error;
    return data || [];
};

export const buildSurahScoreMap = (scoreRows, santriId) => {
    const map = {};
    (scoreRows || []).forEach((row) => {
        if (!santriId || row.santri_id === santriId) {
            const key = santriId
                ? `${row.juz_number}:${row.surah_name}`
                : `${row.santri_id}-${row.juz_number}:${row.surah_name}`;
            map[key] = Number(row.score);
        }
    });
    return map;
};

export const upsertSantriSurahScore = async ({ santriId, juzNumber, surahName, score, userId }) => {
    const normalizedJuz = Number(juzNumber);
    const normalizedScore = Number(score);
    const normalizedSurah = String(surahName || '').trim();
    if (!Number.isInteger(normalizedJuz) || normalizedJuz < 1 || normalizedJuz > 30) {
        throw new Error('Juz hafalan harus berada pada rentang 1 sampai 30.');
    }
    if (!normalizedSurah) {
        throw new Error('Nama surah tidak boleh kosong.');
    }
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 4) {
        throw new Error('Skor surah hafalan harus berupa angka 1 sampai 4.');
    }

    await updateOrInsert({
        table: 'santri_surah_scores',
        filters: [
            { column: 'santri_id', op: 'eq', value: santriId },
            { column: 'juz_number', op: 'eq', value: normalizedJuz },
            { column: 'surah_name', op: 'eq', value: normalizedSurah },
        ],
        values: {
            santri_id: santriId,
            juz_number: normalizedJuz,
            surah_name: normalizedSurah,
            score: normalizedScore,
            assessed_by: userId || null,
            assessed_at: new Date().toISOString(),
        },
    });
};

export const fetchSantriNotes = async (santriId) => {
    const { data, error } = await query({
        table: 'santri_notes',
        columns: ['id', 'santri_id', 'guru_id', 'note', 'visibility', 'created_at', 'updated_at'],
        filters: [{ column: 'santri_id', op: 'eq', value: santriId }],
        order: [{ column: 'created_at', ascending: false }],
        limit: 1000,
    });

    if (error) throw error;
    return attachRelated(data || [], { foreignKey: 'guru_id', table: 'guru', columns: ['id', 'nama'], as: 'guru' });
};

export const saveSantriNote = async ({ noteId, santriId, note, userId }) => {
    const payload = {
        note: String(note || '').trim(),
        visibility: 'internal',
    };

    const { error } = noteId
        ? await update('santri_notes', noteId, payload)
        : await insert('santri_notes', {
            ...payload,
            santri_id: santriId,
            guru_id: userId || null,
        });

    if (error) throw error;
};
