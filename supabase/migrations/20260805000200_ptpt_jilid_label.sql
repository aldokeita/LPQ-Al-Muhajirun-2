-- Logical migration: 20260805000200_ptpt_jilid_label
-- Purpose: PTPT santri no longer carry a TPQ-style jilid status. The juz_hafalan
-- column (Juz 1-30 checklist) is now the source of truth for tahfizh progress, so
-- jilid for PTPT santri is normalized to a constant label 'PTPT' (replacing legacy
-- values such as 'Khatam' or 'Juz X').

update public.santri
set jilid = 'PTPT'
where kategori = 'PTPT'
  and coalesce(btrim(jilid), '') <> 'PTPT';

notify pgrst, 'reload schema';
