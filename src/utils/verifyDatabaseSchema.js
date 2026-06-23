
import { supabase } from '@/lib/customSupabaseClient';

export const verifyDatabaseSchema = async () => {
  const report = {
    status: 'success',
    tables: {},
    errors: []
  };

  const requiredTables = [
    'payments', 'classes', 'academic_calendar', 'mmq_schedule', 
    'attendance', 'santri', 'guru', 'hafalan_progress', 
    'murojaah_submissions', 'media_player_settings'
  ];

  for (const table of requiredTables) {
    try {
      // Attempt a basic select to verify table existence and read access
      const { data, error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        // If it's an RLS error, the table exists but access is denied
        if (error.code === '42P01') {
          report.status = 'error';
          report.errors.push(`Table missing: ${table}`);
          report.tables[table] = 'missing';
        } else {
          report.tables[table] = 'rls_restricted_or_error';
          report.errors.push(`RLS or Access Error on ${table}: ${error.message}`);
        }
      } else {
        report.tables[table] = 'ok';
      }
    } catch (err) {
      report.status = 'error';
      report.errors.push(`Critical error checking ${table}: ${err.message}`);
    }
  }

  // Specifically check attendance for check_in_timestamp
  try {
    const { data, error } = await supabase.from('attendance').select('check_in_timestamp').limit(1);
    if (error && error.code === '42703') { // Column does not exist
        report.status = 'error';
        report.errors.push(`Column missing: check_in_timestamp in attendance table`);
    }
  } catch (err) {
      report.errors.push(`Error checking columns in attendance: ${err.message}`);
  }

  if (report.errors.length > 0) {
      report.status = 'error';
  }

  return report;
};
