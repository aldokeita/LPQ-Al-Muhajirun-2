-- Normalize legacy Jilid 6 labels and seed the editable WhatsApp group links.
-- This is intentionally non-destructive: historical rows remain in place and
-- only their labels are normalized to the canonical "Jilid 6" value.

update public.santri
set jilid = 'Jilid 6'
where jilid in ('Jilid 6A', 'Jilid 6B');

update public.jilid_history
set
  from_jilid = case
    when from_jilid in ('Jilid 6A', 'Jilid 6B') then 'Jilid 6'
    else from_jilid
  end,
  to_jilid = case
    when to_jilid in ('Jilid 6A', 'Jilid 6B') then 'Jilid 6'
    else to_jilid
  end
where from_jilid in ('Jilid 6A', 'Jilid 6B')
   or to_jilid in ('Jilid 6A', 'Jilid 6B');

insert into public.website_content (key, content, is_public)
values (
  'whatsapp_jilid_links',
  '{
    "Jilid 1": "https://chat.whatsapp.com/FQoYZPCm2LiKRFH7s83fT9?s=sw&p=a&mlu=4",
    "Jilid 2": "https://chat.whatsapp.com/DKW3RQtEWZv7CPsO33xpbx?s=sw&p=a&mlu=4",
    "Jilid 3": "https://chat.whatsapp.com/HuV6EmHHQZ21sbowRUAKc0?s=sw&p=a&mlu=4",
    "Jilid 4": "https://chat.whatsapp.com/J47itywMMroE1mIamgYwvH?s=sw&p=a&mlu=4",
    "Jilid 5": "https://chat.whatsapp.com/H3On7pjZ5CDIeAu0h6NDwu?s=sw&p=a&mlu=4",
    "Juz 27": "https://chat.whatsapp.com/CeRanixsDnN8dQWV1xn8Uu?s=sw&p=a&mlu=4",
    "Jilid 6": "https://chat.whatsapp.com/DlabfPOQ34f5kKui1PvIia?s=sw&p=a&mlu=4",
    "Al-Qur''an": "https://chat.whatsapp.com/JHWGRVb7QiD6OZf9SLLUyD?s=sw&p=a&mlu=4",
    "Ghorib Tajwid": "https://chat.whatsapp.com/DqdsqpMc6U3F9qkrM2ttgW?s=sw&p=a&mlu=4",
    "Santri PTPT": "https://chat.whatsapp.com/C1CAnHhGPVeLpmpxiLChd7?s=sw&p=a&mlu=4"
  }'::jsonb,
  false
)
