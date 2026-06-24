import { supabase } from '@/lib/customSupabaseClient';

export const progressStatusToComplete = (status) => status === 'lulus';

export const completeToProgressStatus = (complete) => (complete ? 'lulus' : 'proses');

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
    if (message.includes('murojaah_submissions_status_check')) {
        return 'Status murojaah tidak valid.';
    }
    return message || 'Operasi akademik gagal.';
};

export const fetchCalendarEvents = async ({ startDate, endDate }) => {
    const { data, error } = await supabase
        .from('academic_calendar')
        .select('id,date,title,description,is_holiday,is_public,event_type')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

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

    const query = existingId
        ? supabase.from('academic_calendar').update(payload).eq('id', existingId)
        : supabase.from('academic_calendar').insert({ ...payload, created_by: userId || null });

    const { error } = await query;
    if (error) throw error;
};

export const deleteCalendarEvent = async (id) => {
    const { error } = await supabase.from('academic_calendar').delete().eq('id', id);
    if (error) throw error;
};

export const fetchHafalanItems = async (category = null) => {
    let query = supabase
        .from('hafalan_items')
        .select('id,category,jilid,item_name,item_order,is_active')
        .eq('is_active', true)
        .order('item_order', { ascending: true })
        .order('item_name', { ascending: true });

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const createHafalanItem = async ({ category, itemName, jilid, itemOrder }) => {
    const { error } = await supabase.from('hafalan_items').insert({
        category,
        item_name: String(itemName || '').trim(),
        jilid: String(jilid || ''),
        item_order: itemOrder,
        is_active: true
    });
    if (error) throw error;
};

export const updateHafalanItem = async (id, updates) => {
    const { error } = await supabase
        .from('hafalan_items')
        .update({
            ...updates,
            jilid: updates.jilid === undefined ? undefined : String(updates.jilid)
        })
        .eq('id', id);
    if (error) throw error;
};

export const deactivateHafalanItem = async (id) => {
    const { error } = await supabase.from('hafalan_items').update({ is_active: false }).eq('id', id);
    if (error) throw error;
};

export const fetchClassesWithActiveSantriForTeacher = async (guruId) => {
    const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id,nama_kelas,id_guru,sesi,kategori,sort_order')
        .eq('id_guru', guruId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (classError) throw classError;
    if (!classes?.length) return [];

    const classIds = classes.map((item) => item.id);
    const { data: memberships, error: membershipError } = await supabase
        .from('class_memberships')
        .select('class_id,order_in_class,santri:santri_id(id,nama_lengkap,nomor_induk_qiroati,jilid,status,current_class_id,sesi_mengaji,foto_url,avatar_path,tanggal_lahir,created_at)')
        .in('class_id', classIds)
        .eq('status', 'active')
        .order('order_in_class', { ascending: true });

    if (membershipError) throw membershipError;

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

export const fetchHafalanProgress = async (santriIds = null) => {
    let query = supabase
        .from('hafalan_progress')
        .select('id,santri_id,item_id,category,item_name,status,nilai,catatan,assessed_by,assessed_at,created_at,updated_at');

    if (Array.isArray(santriIds) && santriIds.length > 0) {
        query = query.in('santri_id', santriIds);
    }

    const { data, error } = await query;
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

export const upsertHafalanProgress = async ({ santriId, item, complete, userId }) => {
    const itemId = item?.id || null;
    let query = supabase
        .from('hafalan_progress')
        .select('id')
        .eq('santri_id', santriId);

    if (itemId) {
        query = query.eq('item_id', itemId);
    } else {
        query = query.eq('category', item.category).eq('item_name', item.item_name);
    }

    const { data: existing, error: existingError } = await query.maybeSingle();
    if (existingError) throw existingError;

    const payload = {
        santri_id: santriId,
        item_id: itemId,
        category: item.category,
        item_name: item.item_name,
        status: completeToProgressStatus(complete),
        assessed_by: userId || null,
        assessed_at: new Date().toISOString(),
        updated_by: userId || null
    };

    const result = existing?.id
        ? await supabase.from('hafalan_progress').update(payload).eq('id', existing.id)
        : await supabase.from('hafalan_progress').insert({ ...payload, created_by: userId || null });

    if (result.error) throw result.error;
};

export const fetchMurojaahSubmissions = async () => {
    const { data, error } = await supabase
        .from('murojaah_submissions')
        .select('id,santri_id,target_guru_id,type,content,recording_path,status,feedback,submitted_at,reviewed_at,created_at,santri:santri_id(nama_lengkap,current_class_id)')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createMurojaahSubmission = async ({ santriId, type, content, userId }) => {
    const { error } = await supabase.from('murojaah_submissions').insert({
        santri_id: santriId,
        type,
        content,
        recording_path: null,
        status: 'menunggu',
        created_by: userId || null
    });
    if (error) throw error;
};

export const updateMurojaahReview = async ({ id, status = 'diterima', feedback, userId }) => {
    const { error } = await supabase
        .from('murojaah_submissions')
        .update({
            status,
            feedback: String(feedback || '').trim() || null,
            target_guru_id: userId || null,
            reviewed_at: new Date().toISOString(),
            updated_by: userId || null
        })
        .eq('id', id);
    if (error) throw error;
};

export const fetchSantriNotes = async (santriId) => {
    const { data, error } = await supabase
        .from('santri_notes')
        .select('id,santri_id,guru_id,note,visibility,created_at,updated_at,guru:guru_id(nama)')
        .eq('santri_id', santriId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const saveSantriNote = async ({ noteId, santriId, note, userId }) => {
    const payload = {
        note: String(note || '').trim(),
        visibility: 'internal',
        updated_by: userId || null
    };

    const result = noteId
        ? await supabase.from('santri_notes').update(payload).eq('id', noteId)
        : await supabase.from('santri_notes').insert({
            ...payload,
            santri_id: santriId,
            guru_id: userId || null,
            created_by: userId || null
        });

    if (result.error) throw result.error;
};
