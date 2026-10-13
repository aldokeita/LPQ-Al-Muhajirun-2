import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { removeSantriFromClass } from '../worker/rpc/class-transfer.js';
import { mapClassForLegacyUi } from '../src/lib/dataMasterAdapters.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync('migrations-d1/0001_initial_schema.sql', 'utf8'));
sqlite.exec(`
  insert into users (id) values ('admin'), ('student');
  insert into classes (id, nama_kelas, sesi, kategori) values ('class', 'Kelas Dummy', 'Pagi', 'Anak');
  insert into santri (id, nama_lengkap, nomor_induk_qiroati, kategori, current_class_id, sesi_mengaji, order_in_class)
    values ('student', 'Santri Dummy', 'TEST-UNASSIGN', 'Anak', 'class', 'Pagi', 1);
  insert into class_memberships (id, santri_id, class_id, start_date, order_in_class)
    values ('membership', 'student', 'class', '2020-01-01', 1);
`);
const statement = (sql, params = []) => ({
  sql, params,
  bind(...values) { return statement(sql, values); },
  first: async () => sqlite.prepare(sql).get(...params) ?? null,
  run: async () => sqlite.prepare(sql).run(...params),
});
const db = {
  prepare: statement,
  batch: async (statements) => {
    sqlite.exec('begin');
    try {
      for (const item of statements) sqlite.prepare(item.sql).run(...item.params);
      sqlite.exec('commit');
    } catch (error) {
      sqlite.exec('rollback');
      throw error;
    }
  },
};
const admin = { userId: 'admin', role: 'admin' };
await assert.rejects(removeSantriFromClass(db, { userId: null }, { santriId: 'student' }), { status: 401 });
for (const role of ['guru', 'santri', 'pentashih']) {
  await assert.rejects(removeSantriFromClass(db, { userId: 'admin', role }, { santriId: 'student' }), { status: 403 });
}
await assert.rejects(removeSantriFromClass(db, admin, { santriId: 'missing' }), { status: 404 });
sqlite.exec("update santri set status = 'Nonaktif' where id = 'student'");
await assert.rejects(removeSantriFromClass(db, admin, { santriId: 'student' }), /tidak aktif/);
sqlite.exec("update santri set status = 'Aktif' where id = 'student'");

// A failed history insert must roll back both membership and profile changes.
sqlite.exec("create trigger fail_mutation before insert on class_mutations begin select raise(abort, 'test rollback'); end");
await assert.rejects(removeSantriFromClass(db, admin, { santriId: 'student' }), /test rollback/);
assert.equal(sqlite.prepare("select status from class_memberships where id = 'membership'").get().status, 'active');
assert.equal(sqlite.prepare("select current_class_id from santri where id = 'student'").get().current_class_id, 'class');
sqlite.exec('drop trigger fail_mutation');

const result = await removeSantriFromClass(db, admin, { santriId: 'student' });
assert.equal(result.changed, true);
assert.equal(result.active_memberships, 0);
const student = sqlite.prepare("select current_class_id, sesi_mengaji, order_in_class from santri where id = 'student'").get();
assert.deepEqual({ ...student }, { current_class_id: null, sesi_mengaji: 'Pagi', order_in_class: null });
assert.equal(sqlite.prepare("select status from class_memberships where id = 'membership'").get().status, 'moved');
const mutation = sqlite.prepare('select from_class_id, to_class_id, created_by from class_mutations').get();
assert.deepEqual({ ...mutation }, { from_class_id: 'class', to_class_id: null, created_by: 'admin' });
assert.equal((await removeSantriFromClass(db, admin, { santriId: 'student' })).changed, false);
assert.equal(sqlite.prepare('select count(*) as total from class_mutations').get().total, 1);

for (const value of [0, false, '0']) assert.equal(mapClassForLegacyUi({ is_active: value }).is_active, false);
for (const value of [1, true, '1']) assert.equal(mapClassForLegacyUi({ is_active: value }).is_active, true);
sqlite.close();
console.log('Class unassignment tests passed: permissions, atomic rollback, membership, history, idempotency, inactive classes.');
