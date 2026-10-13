import assert from 'node:assert/strict';
import { fetchSantriForIdCards, fetchIdCardBranding } from '../src/lib/santriIdCardAdapters.js';

const originalFetch = globalThis.fetch;
const rows = Array.from({ length: 1205 }, (_, index) => ({
  id: String(index), nama_lengkap: `Santri Dummy ${index}`, kategori: 'Anak',
  status: index === 3 ? 'Nonaktif' : index === 4 ? 'active' : 'Aktif',
  deleted_at: index === 5 ? '2026-01-01' : null, created_at: '2026-01-01T00:00:00Z',
}));
const offsets = [];
try {
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/data/query');
    const body = JSON.parse(options.body);
    if (body.table === 'website_content') return Response.json({ data: [{ key: 'logoUrl', content: '/api/files/website-assets/dummy-logo.webp' }] });
    assert.equal(body.table, 'santri');
    assert.deepEqual(body.filters, [{ column: 'deleted_at', op: 'is_null' }]);
    assert.equal(body.limit, 1000);
    assert.equal(body.columns.includes('no_hp_ortu'), false);
    offsets.push(body.offset);
    return Response.json({ data: rows.filter((row) => !row.deleted_at).slice(body.offset, body.offset + body.limit) });
  };
  const data = await fetchSantriForIdCards();
  assert.deepEqual(offsets, [0, 1000]);
  assert.equal(data.length, 1203);
  assert.equal(data.some((row) => ['3', '5'].includes(row.id)), false);
  assert.equal(data.find((row) => row.id === '4').tanggal_pendaftaran, '2026-01-01');
  const branding = await fetchIdCardBranding();
  assert.equal(branding.logoUrl, '/api/files/website-assets/dummy-logo.webp');
  globalThis.fetch = async () => Response.json({ message: 'Akses ditolak.' }, { status: 403 });
  await assert.rejects(fetchSantriForIdCards(), /Akses ditolak/);
  console.log('ID Card adapter tests passed: 1205 dummy rows, pagination, archive/inactive exclusion, CMS logo, access errors.');
} finally { globalThis.fetch = originalFetch; }
