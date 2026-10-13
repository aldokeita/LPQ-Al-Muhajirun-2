import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildIdCardPrintHtml,
  chunkIdCardRecords,
  escapeIdCardHtml,
  getIdCardPaperConfig,
  ID_CARD_HEIGHT_MM,
  ID_CARD_WIDTH_MM,
  normalizeIdCardDesign,
  waitForIdCardAssets,
} from '../src/lib/santriIdCardPrint.js';
import { filterIdCardSantri, toggleFilteredIdCardSelection } from '../src/lib/santriIdCardSelection.js';

const [component, dashboard, adapter] = await Promise.all([
  readFile(new URL('../src/components/dashboard/admin/SantriIdCardManagement.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/AdminDashboard.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/santriIdCardAdapters.js', import.meta.url), 'utf8'),
]);

assert.equal(getIdCardPaperConfig('A4').widthMm, 210);
assert.equal(getIdCardPaperConfig('F4').heightMm, 330.2);
assert.equal(getIdCardPaperConfig('A4').cardsPerPage, 9);
assert.equal(ID_CARD_WIDTH_MM, 53.8);
assert.equal(ID_CARD_HEIGHT_MM, 86);
assert.deepEqual(chunkIdCardRecords(Array.from({ length: 10 }, (_, id) => ({ id }))).map((page) => page.length), [9, 1]);
assert.equal(escapeIdCardHtml('<Nama & "Khusus">'), '&lt;Nama &amp; &quot;Khusus&quot;&gt;');

const html = buildIdCardPrintHtml({
  cards: [{
    id: 'santri-1',
    nama_lengkap: 'Aisyah <Utama>',
    nomor_induk_qiroati: 'NIQ-001',
    foto_url: '',
    jilid: 'Jilid 2A',
    sesi_label: 'Pagi',
  }],
  logoUrl: '',
  paperSize: 'A4',
  qrDataUrls: { 'santri-1': 'data:image/png;base64,QR' },
});
assert.match(html, /@page \{ size: 210mm 297mm; margin: 0; \}/);
assert.match(html, /kartu-murid-abstrak-5\.jpeg/);
assert.match(html, /--id-card-width: 53\.8mm/);
assert.match(html, /--id-card-height: 86mm/);
assert.match(html, /photo-frame[^}]*transform: translate\(0mm, -2mm\)/);
assert.match(html, /page-break-inside: avoid/);
assert.match(html, /Aisyah &lt;Utama&gt;/);
assert.match(html, /NIQ-001/);
assert.match(html, /data:image\/png;base64,QR/);
assert.match(html, /id-card__photo-fallback/);
assert.doesNotMatch(html, /id-card::after/);
assert.match(html, /id-card__background/);
assert.match(html, /id-card__photo-frame[^}]*border: 0\.5mm solid/);
assert.match(html, /id-card__header[^}]*justify-content: flex-start/);
assert.match(html, /id-card__name[^}]*transform: translateY\(0mm\)/);
assert.doesNotMatch(html, /Aisyah <Utama>/);
assert.doesNotMatch(html, /Nomor Induk Qiroati|Kartu Santri|Jilid 2A|Pagi/);

const f4Html = buildIdCardPrintHtml({ cards: Array.from({ length: 10 }, (_, id) => ({ id, nama_lengkap: `Santri ${id}` })), paperSize: 'F4' });
assert.match(f4Html, /@page \{ size: 215\.9mm 330\.2mm; margin: 0; \}/);
assert.equal((f4Html.match(/class="id-card"/g) || []).length, 10);

assert.match(component, /role !== 'admin'/);
assert.match(component, /Pilih semua hasil/);
assert.match(component, /Deselect all/);
assert.match(component, /aria-label=\{`Cetak \$\{selectedSantri\.length\} ID Card`\}/);
assert.match(component, /isGeneratingQr \? 'Menyiapkan QR…' : 'Cetak'/);
assert.doesNotMatch(component, /jenisKelamin|Filter jenis kelamin|Semua gender/);
assert.match(component, /Urutan tanggal masuk/);
assert.match(component, /value="newest"/);
assert.match(component, /value="oldest"/);
assert.match(component, /santri-id-card__preview-heading/);
assert.match(component, /isSelectionOpen/);
assert.match(component, /santri-id-card__selection-dialog/);
const selectionModal = component.slice(component.indexOf('<Dialog open={isSelectionOpen}'));
assert.match(selectionModal, /aria-label="Cari santri dalam modal seleksi"/);
assert.match(selectionModal, /type="search"/);
assert.match(selectionModal, /value=\{filters\.search\}/);
assert.match(selectionModal, /search: event\.target\.value/);
assert.match(selectionModal, /filteredSantri\.map/);
assert.match(component, /ID_CARD_PAPER_OPTIONS/);
assert.match(dashboard, /value: 'id-card', label: 'ID Card Santri'/);
assert.match(dashboard, /TabsContent value="id-card"/);
assert.match(adapter, /column: 'deleted_at', op: 'is_null'/);
assert.match(adapter, /queryAll/);
assert.match(adapter, /tanggal_pendaftaran/);
assert.doesNotMatch(adapter, /\.(insert|update|upsert|delete)\s*\(/);
assert.doesNotMatch(component + adapter, /al.?fath|fetchClassAttendanceAppearance|customSupabaseClient/i);
assert.match(component, /lpq_al_muhajirun_santri_id_card_design/);

const rows = [
  { id: 'a', nama_lengkap: 'Santri Dummy Pertama', nama_panggilan: 'Ani', nomor_induk_qiroati: '001', kategori: 'Anak', sesi_mengaji: '0', tanggal_pendaftaran: '2026-01-01' },
  { id: 'b', nama_lengkap: 'Santri Dummy Kedua', nama_panggilan: 'Budi', nomor_induk_qiroati: '002', kategori: 'PTPT', sesi_mengaji: 'Sore', tanggal_pendaftaran: '2026-02-01' },
];
const filters = { search: '', kategori: 'all', sesi: 'all', tanggalMasuk: 'newest' };
assert.deepEqual(filterIdCardSantri(rows, { ...filters, search: '  ANI  ' }).map((row) => row.id), ['a']);
assert.deepEqual(filterIdCardSantri(rows, { ...filters, search: '002' }).map((row) => row.id), ['b']);
assert.deepEqual(filterIdCardSantri(rows, { ...filters, search: 'pertama' }).map((row) => row.id), ['a']);
assert.equal(filterIdCardSantri(rows, { ...filters, search: 'tidak ada' }).length, 0);
assert.deepEqual(filterIdCardSantri(rows, { ...filters, sesi: 'Pagi' }).map((row) => row.id), ['a']);
assert.deepEqual(filterIdCardSantri(rows, { ...filters, kategori: 'PTPT' }).map((row) => row.id), ['b']);
assert.deepEqual(filterIdCardSantri(rows, filters).map((row) => row.id), ['b', 'a']);
assert.deepEqual(filterIdCardSantri(rows, { ...filters, tanggalMasuk: 'oldest' }).map((row) => row.id), ['a', 'b']);
let selected = toggleFilteredIdCardSelection(new Set(), [rows[0]]);
selected = toggleFilteredIdCardSelection(selected, [rows[1]]);
assert.deepEqual([...selected], ['a', 'b']);
selected = toggleFilteredIdCardSelection(selected, [rows[1]]);
assert.deepEqual([...selected], ['a']);
assert.equal(toggleFilteredIdCardSelection(selected, [rows[0]]).size, 0);

for (const count of [1, 9, 10, 28]) {
  for (const paperSize of ['A4', 'F4']) {
    const rendered = buildIdCardPrintHtml({ cards: Array.from({ length: count }, (_, id) => ({ id, nama_panggilan: 'Dummy', nomor_induk_qiroati: String(id) })), paperSize });
    assert.equal((rendered.match(/class="id-card-sheet"/g) || []).length, Math.ceil(count / 9));
    assert.equal((rendered.match(/class="id-card"/g) || []).length, count);
  }
}
const sanitized = normalizeIdCardDesign({ nameFontFamily: '</style><script>alert(1)</script>', nameColor: 'red;}', photoSizeMm: 36 });
assert.equal(sanitized.photoSizeMm, 36);
assert.equal(sanitized.nameColor, '#92400e');
assert.doesNotMatch(buildIdCardPrintHtml({ designConfig: sanitized }), /<script>/);
await waitForIdCardAssets({ readyState: 'complete', images: [{ complete: true, naturalWidth: 100 }], fonts: { ready: Promise.resolve() } });
await assert.rejects(waitForIdCardAssets({ readyState: 'complete', images: [{ complete: true, naturalWidth: 0 }] }), /gambar/);
await assert.rejects(waitForIdCardAssets({ readyState: 'complete', images: [], fonts: { ready: new Promise(() => {}) } }, 10), /belum siap/);

console.log('santri ID card selection and print contract tests passed');
