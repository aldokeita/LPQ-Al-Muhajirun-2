import assert from 'node:assert/strict';
import {
  buildClassAttendanceHtml,
  createClassAttendancePages,
  getClassAttendanceDateSlots,
} from '../src/lib/classAttendanceSheet.js';
import {
  DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG,
  getClassAttendanceMonthHeaderLabel,
  normalizeClassAttendancePrintConfig,
} from '../src/lib/classAttendancePrintConfig.js';

const juneSlots = getClassAttendanceDateSlots({ year: 2026, monthIndex: 5 });
assert.equal(juneSlots.length, 22);
assert.equal(juneSlots[0].day, 1);

const juneWithHoliday = getClassAttendanceDateSlots({
  year: 2026,
  monthIndex: 5,
  holidays: new Set(['2026-06-01']),
});
assert.equal(juneWithHoliday.length, 21);
assert.equal(juneWithHoliday[0].day, 2);
assert.equal(juneWithHoliday.some((slot) => slot.day === 1), false);

const roster = Array.from({ length: 21 }, (_, index) => ({
  id: index,
  jilid: '1A',
  nama_lengkap: `Santri ${index + 1}`,
  no_hp_ortu: '081234567890',
}));
assert.deepEqual(createClassAttendancePages(roster).map((page) => page.rows.length), [20, 15]);

const html = buildClassAttendanceHtml({
  classData: {
    nama_kelas: 'Kelas Utama',
    sesi: 'Pagi',
    guru: { nama: 'Ustadzah Nabila' },
    roster,
  },
  dateSlots: juneWithHoliday,
  generatedAt: new Date('2026-06-01T08:00:00+07:00'),
  lpqLogoDataUrl: 'data:image/webp;base64,AAAA',
  monthIndex: 5,
  printConfig: { content: { institutionName: 'LPQ AL-MUHAJIRUN' } },
  year: 2026,
});
assert.match(html, /@page \{ size: A4 landscape;/);
assert.match(html, /colspan="21"/);
assert.match(html, /Nabila/i);
assert.doesNotMatch(html, /Ustadzah Nabila/);
assert.doesNotMatch(html, /Halaman 1\/1/);
assert.doesNotMatch(html, /https?:\/\//);

const normalized = normalizeClassAttendancePrintConfig({
  content: { address: '  ' },
  typography: { titleSize: 200 },
  branding: { accentColor: 'not-a-color' },
});
assert.equal(normalized.content.address, DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG.content.address);
assert.equal(normalized.typography.titleSize, 30);
assert.equal(normalized.branding.accentColor, DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG.branding.accentColor);

const configuredMonth = normalizeClassAttendancePrintConfig({
  content: { monthColumn: 'September' },
});
assert.equal(getClassAttendanceMonthHeaderLabel(configuredMonth, 'Agustus 2026'), 'September');
assert.equal(
  getClassAttendanceMonthHeaderLabel(normalizeClassAttendancePrintConfig(), 'Agustus 2026'),
  'Agustus 2026',
);

const configuredMonthHtml = buildClassAttendanceHtml({
  classData: {
    nama_kelas: 'Kelas Utama',
    sesi: 'Pagi',
    guru: { nama: 'Ustadzah Nabila' },
    roster,
  },
  dateSlots: getClassAttendanceDateSlots({ year: 2026, monthIndex: 7 }),
  generatedAt: new Date('2026-08-01T08:00:00+07:00'),
  monthIndex: 7,
  printConfig: { content: { monthColumn: 'September' } },
  year: 2026,
});
assert.match(configuredMonthHtml, /September/);
assert.doesNotMatch(configuredMonthHtml, /Agustus 2026/);
console.log('Class attendance sheet tests passed.');
