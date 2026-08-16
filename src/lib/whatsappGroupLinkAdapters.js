import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

export const WHATSAPP_GROUP_LINKS_KEY = 'whatsapp_jilid_links';

export const WHATSAPP_GROUP_LINK_FIELDS = Object.freeze([
  { key: 'Jilid 1', label: 'Jilid 1', aliases: ['Jilid 1A', 'Jilid 1B', 'Jilid 1C'], defaultUrl: 'https://chat.whatsapp.com/FQoYZPCm2LiKRFH7s83fT9?s=sw&p=a&mlu=4' },
  { key: 'Jilid 2', label: 'Jilid 2', aliases: ['Jilid 2A', 'Jilid 2B'], defaultUrl: 'https://chat.whatsapp.com/DKW3RQtEWZv7CPsO33xpbx?s=sw&p=a&mlu=4' },
  { key: 'Jilid 3', label: 'Jilid 3', aliases: ['Jilid 3A', 'Jilid 3B'], defaultUrl: 'https://chat.whatsapp.com/HuV6EmHHQZ21sbowRUAKc0?s=sw&p=a&mlu=4' },
  { key: 'Jilid 4', label: 'Jilid 4', aliases: ['Jilid 4A', 'Jilid 4B'], defaultUrl: 'https://chat.whatsapp.com/J47itywMMroE1mIamgYwvH?s=sw&p=a&mlu=4' },
  { key: 'Jilid 5', label: 'Jilid 5', aliases: ['Jilid 5A', 'Jilid 5B'], defaultUrl: 'https://chat.whatsapp.com/H3On7pjZ5CDIeAu0h6NDwu?s=sw&p=a&mlu=4' },
  { key: 'Juz 27', label: 'Juz 27', aliases: ['Jilid Juz 27'], defaultUrl: 'https://chat.whatsapp.com/CeRanixsDnN8dQWV1xn8Uu?s=sw&p=a&mlu=4' },
  { key: 'Jilid 6', label: 'Jilid 6', aliases: [], defaultUrl: 'https://chat.whatsapp.com/DlabfPOQ34f5kKui1PvIia?s=sw&p=a&mlu=4' },
  { key: "Al-Qur'an", label: 'Al-Qur’an', aliases: ['Al-Qur’an'], defaultUrl: 'https://chat.whatsapp.com/JHWGRVb7QiD6OZf9SLLUyD?s=sw&p=a&mlu=4' },
  { key: 'Ghorib Tajwid', label: 'Ghorib Tajwid', aliases: ['Gharib', 'Tajwid'], defaultUrl: 'https://chat.whatsapp.com/DqdsqpMc6U3F9qkrM2ttgW?s=sw&p=a&mlu=4' },
  { key: 'Santri PTPT', label: 'Santri PTPT', aliases: ['PTPT'], defaultUrl: 'https://chat.whatsapp.com/C1CAnHhGPVeLpmpxiLChd7?s=sw&p=a&mlu=4' },
]);

export const DEFAULT_WHATSAPP_GROUP_LINKS = Object.freeze(
  Object.fromEntries(WHATSAPP_GROUP_LINK_FIELDS.map((field) => [field.key, field.defaultUrl]))
);

export const isValidWhatsAppGroupUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'chat.whatsapp.com' && url.pathname.length > 1;
  } catch {
    return false;
  }
};

export const validateWhatsAppGroupLinks = (links) => {
  const normalized = {};
  for (const field of WHATSAPP_GROUP_LINK_FIELDS) {
    const value = String(links?.[field.key] || '').trim();
    if (!isValidWhatsAppGroupUrl(value)) {
      throw new Error(`${field.label} harus berupa link grup WhatsApp https://chat.whatsapp.com/... yang valid.`);
    }
    normalized[field.key] = value;
  }
  return normalized;
};

export const normalizeWhatsAppGroupLinks = (content) => {
  let parsed = content;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return Object.fromEntries(WHATSAPP_GROUP_LINK_FIELDS.map((field) => {
    const candidate = [field.key, ...field.aliases]
      .map((key) => value[key])
      .find((item) => isValidWhatsAppGroupUrl(item));
    return [field.key, candidate || field.defaultUrl];
  }));
};

export const fetchWhatsAppGroupLinks = async () => {
  try {
    const content = await fetchWebsiteContentMap({ keys: [WHATSAPP_GROUP_LINKS_KEY], publicOnly: false });
    return normalizeWhatsAppGroupLinks(content[WHATSAPP_GROUP_LINKS_KEY]);
  } catch {
    return { ...DEFAULT_WHATSAPP_GROUP_LINKS };
  }
};

export const saveWhatsAppGroupLinks = async (links) => {
  const normalized = validateWhatsAppGroupLinks(links);
  const saved = await saveWebsiteContentItem({
    key: WHATSAPP_GROUP_LINKS_KEY,
    content: normalized,
    isPublic: false,
  });
  return normalizeWhatsAppGroupLinks(saved?.content);
};

const normalizeTargetLabel = (value) => {
  const target = String(value || '').trim();
  if (/^jilid\s*6(?:[ab])?$/i.test(target)) return 'Jilid 6';
  if (/juz\s*27/i.test(target)) return 'Juz 27';
  if (/ptpt|santri\s+ptpt/i.test(target)) return 'Santri PTPT';
  if (/al[-\s]?qur/i.test(target)) return "Al-Qur'an";
  if (/gh[ao]rib|tajwid/i.test(target)) return 'Ghorib Tajwid';
  const numberMatch = target.match(/jilid\s*(\d+)/i);
  return numberMatch ? `Jilid ${numberMatch[1]}` : target;
};

export const getWhatsAppGroupLink = (target, links = DEFAULT_WHATSAPP_GROUP_LINKS) => {
  const canonical = normalizeTargetLabel(target);
  const field = WHATSAPP_GROUP_LINK_FIELDS.find((item) => item.key === canonical);
  return field ? String(links?.[field.key] || field.defaultUrl) : '[Link Grup Belum Tersedia]';
};
