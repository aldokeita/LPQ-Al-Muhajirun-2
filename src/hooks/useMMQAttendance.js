
import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export const useMMQAttendance = () => {
    const fetchMMQSchedule = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('mmq_schedule').select('*').order('day_of_week');
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error fetching MMQ schedule:', err);
            return [];
        }
    }, []);

    const fetchMMQAttendance = useCallback(async ({ date }) => {
        try {
            const { data, error } = await supabase
                .from('mmq_attendance')
                .select('*, guru:guru_id(id, nama, foto_url, no_hp), schedule:mmq_session_id(*)')
                .eq('attendance_date', date);
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error fetching MMQ attendance:', err);
            return [];
        }
    }, []);

    const saveMMQAttendance = useCallback(async (payload) => {
        try {
            const { guru_id, attendance_date, mmq_session_id } = payload;
            
            // 1. Check if a record already exists for this guru and date
            let query = supabase.from('mmq_attendance')
                .select('*')
                .eq('guru_id', guru_id)
                .eq('attendance_date', attendance_date);
                
            if (mmq_session_id) {
                query = query.eq('mmq_session_id', mmq_session_id);
            }
            
            const { data: existingRecords, error: selectError } = await query;
            
            if (selectError) throw selectError;
            
            if (existingRecords && existingRecords.length > 0) {
                // 2. If exists: UPDATE (Using ID to avoid ON CONFLICT errors)
                const existingId = existingRecords[0].id;
                const updatePayload = { ...payload };
                delete updatePayload.id; // Prevent updating primary key
                delete updatePayload.guru; // Remove nested relations
                delete updatePayload.schedule;
                
                const { data, error } = await supabase
                    .from('mmq_attendance')
                    .update(updatePayload)
                    .eq('id', existingId)
                    .select();
                    
                if (error) throw error;
                return { success: true, data };
            } else {
                // 3. If not exists: INSERT
                const insertPayload = { ...payload };
                delete insertPayload.id; // Let DB generate ID
                delete insertPayload.guru;
                delete insertPayload.schedule;
                
                const { data, error } = await supabase
                    .from('mmq_attendance')
                    .insert([insertPayload])
                    .select();
                    
                if (error) throw error;
                return { success: true, data };
            }
        } catch (err) {
            console.error('Error saving MMQ attendance:', err);
            return { success: false, error: err.message };
        }
    }, []);

    const deleteMMQAttendance = useCallback(async (id) => {
        try {
            const { error } = await supabase.from('mmq_attendance').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error('Error deleting MMQ attendance:', err);
            return { success: false, error: err.message };
        }
    }, []);

    const updateMMQSchedule = useCallback(async (payload) => {
        try {
            if (payload.id) {
                const { data, error } = await supabase.from('mmq_schedule').update(payload).eq('id', payload.id).select();
                if (error) throw error;
                return { success: true, data };
            } else {
                const { data, error } = await supabase.from('mmq_schedule').insert([payload]).select();
                if (error) throw error;
                return { success: true, data };
            }
        } catch (err) {
            console.error('Error updating MMQ schedule:', err);
            return { success: false, error: err.message };
        }
    }, []);

    const deleteMMQSchedule = useCallback(async (id) => {
        try {
            const { error } = await supabase.from('mmq_schedule').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error('Error deleting MMQ schedule:', err);
            return { success: false, error: err.message };
        }
    }, []);

    return {
        fetchMMQSchedule,
        fetchMMQAttendance,
        saveMMQAttendance,
        deleteMMQAttendance,
        updateMMQSchedule,
        deleteMMQSchedule
    };
};
