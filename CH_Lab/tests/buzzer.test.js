import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const token = id => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
const host = token(99);
const call = async (name, values) => (await db.query(
  `select public.${name}(${values.map((_, index) => `$${index + 1}`).join(',')}) as state`, values,
)).rows[0].state;
const join = (id, name = '') => call('vnr202_join', [token(id), 'group', id, name, '']);
const state = (id = 99) => call('vnr202_state', [token(id)]);
const act = async (action, id = 99, expected = null) => {
  const current = await state(id);
  return call('vnr202_action', [token(id), action, current.round, expected ?? current.activeGroup]);
};

before(async () => {
  await db.exec('create role anon; create role authenticated;');
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'));
  }
});
beforeEach(async () => {
  await db.exec(`update vnr202_private.game set phase='lobby', question_index=0, round=0,
    queue='{}', attempted='{}', correct_group=null, host_token_hash=null, host_last_seen=null,
    host_key_hash=encode(sha256(convert_to('test-host-access','UTF8')),'hex');
    update vnr202_private.groups set score=0, token_hash=null, last_seen=null, name='Nhóm ' || id;`);
  await db.exec('set role anon;');
  await call('vnr202_join', [host, 'host', null, 'Nhóm 2 dẫn chương trình', 'test-host-access']);
});
after(async () => { await db.close(); });

// Return to the migration owner before the next test resets its private fixtures.
test.afterEach(async () => { await db.exec('reset role;'); });

test('only groups 1, 3, 4, 5, 6, 7 can join', async () => {
  assert.deepEqual((await state()).groups.map(group => group.id), [1, 3, 4, 5, 6, 7]);
  for (const id of [1, 3, 4, 5, 6, 7]) assert.equal((await join(id)).groupId, id);
  await assert.rejects(join(2), /nhóm/i);
});

test('late buzzes keep joining behind the active group in FIFO order', async () => {
  for (const id of [4, 1, 7]) await join(id);
  await act('start');
  for (const id of [4, 1, 7]) await act('buzz', id);
  const current = await state();
  assert.deepEqual(current.queue, [4, 1, 7]);
  assert.equal(current.activeGroup, 4);
  assert.equal((await state(1)).position, 2);
});

test('repeated buzzes never duplicate a group or move its position', async () => {
  await join(4); await join(1); await act('start');
  await act('buzz', 4); await act('buzz', 1); await act('buzz', 4);
  assert.deepEqual((await state()).queue, [4, 1]);
});

test('wrong automatically promotes the next group and blocks another try this question', async () => {
  await join(4); await join(1); await act('start');
  await act('buzz', 4); await act('buzz', 1);
  const current = await act('wrong');
  assert.equal(current.activeGroup, 1);
  assert.deepEqual(current.queue, [1]);
  assert.deepEqual(current.attempted, [4]);
  assert.equal((await state(4)).canBuzz, false);
  await act('buzz', 4);
  assert.deepEqual((await state()).queue, [1]);
});

test('an empty queue stays open for a group that has not answered', async () => {
  await join(4); await join(7); await act('start');
  await act('buzz', 4); await act('wrong');
  assert.equal((await state()).phase, 'open');
  assert.equal((await state()).activeGroup, null);
  await act('buzz', 7);
  assert.equal((await state()).activeGroup, 7);
});

test('every question is one point, with no double award from repeated grading', async () => {
  await join(7); await act('start');
  for (let index = 0; index < 15; index++) {
    const current = await act('buzz', 7);
    await call('vnr202_action', [host, 'correct', current.round, 7]);
    const scored = await call('vnr202_action', [host, 'correct', current.round, 7]);
    assert.equal(scored.groups.find(group => group.id === 7).score, index + 1);
    assert.equal(scored.phase, 'revealed');
    assert.equal((await state(7)).canBuzz, false);
    await act('next');
  }
  assert.equal((await state()).phase, 'done');
});

test('a repeated wrong command cannot skip the next queued group', async () => {
  for (const id of [4, 1, 7]) await join(id);
  await act('start');
  for (const id of [4, 1, 7]) await act('buzz', id);
  const previous = await state();
  await call('vnr202_action', [host, 'wrong', previous.round, 4]);
  const current = await call('vnr202_action', [host, 'wrong', previous.round, 4]);
  assert.deepEqual(current.queue, [1, 7]);
});

test('new questions clear attempts and reject commands sent for an older question', async () => {
  await join(4); await act('start');
  const previous = await act('buzz', 4);
  await act('wrong'); await act('reveal'); await act('next');
  const current = await call('vnr202_action', [token(4), 'buzz', previous.round, null]);
  assert.deepEqual(current.queue, []);
  assert.deepEqual(current.attempted, []);
  assert.equal(current.canBuzz, true);
  assert.equal(current.index, 1);
});

test('group sessions cannot control the game or read questions and private answers', async () => {
  await join(4); await act('start');
  for (const action of ['start', 'next', 'correct', 'wrong', 'reveal', 'reset']) {
    await assert.rejects(act(action, 4), /người dẫn/i);
  }
  assert.equal((await state(4)).question, null);
  assert.equal((await state()).question.answer, undefined);
  await assert.rejects(db.query('select * from vnr202_private.questions'), /permission denied/);
  await assert.rejects(db.query('update public.vnr202_events set version=999'), /permission denied/);
});

test('host access needs the secret and fresh group claims cannot be taken over', async () => {
  await assert.rejects(call('vnr202_join', [token(88), 'host', null, '', 'wrong']), /mã/i);
  await assert.rejects(call('vnr202_join', ['', 'group', 4, '', '']), /phiên/i);
  await join(4);
  await assert.rejects(call('vnr202_join', [token(88), 'group', 4, '', '']), /đã có/i);
  await act('start'); await act('buzz', 4);
  assert.equal((await join(4)).activeGroup, 4);
});

test('revealing and restarting clear the queue while restart resets all scores', async () => {
  await join(4); await act('start'); await act('buzz', 4); await act('correct');
  await act('next'); await act('buzz', 4); await act('reveal');
  assert.equal((await state()).phase, 'revealed');
  await act('reset');
  const current = await state();
  assert.equal(current.phase, 'lobby');
  assert.deepEqual(current.queue, []);
  assert.deepEqual(current.groups.map(group => group.score), [0, 0, 0, 0, 0, 0]);
});

test('taking over an expired device keeps its score and queue but rejects the old token', async () => {
  await join(4); await act('start'); await act('buzz', 4); await act('correct');
  await act('next'); await act('buzz', 4);
  await db.exec("reset role; update vnr202_private.groups set last_seen=clock_timestamp()-interval '31 seconds' where id=4; set role anon;");
  const current = await call('vnr202_join', [token(88), 'group', 4, '', '']);
  assert.deepEqual(current.queue, [4]);
  assert.equal(current.groups.find(group => group.id === 4).score, 1);
  await assert.rejects(state(4), /Phiên đã hết/);
  await assert.rejects(call('vnr202_action', [token(4), 'buzz', current.round, null]), /Phiên đã hết/);
});

test('anonymous callers cannot read private sessions, scores or helper functions', async () => {
  for (const table of ['game', 'groups', 'questions']) {
    await assert.rejects(db.query(`select * from vnr202_private.${table}`), /permission denied/);
  }
  await assert.rejects(db.query("select vnr202_private.snapshot('anything')"), /permission denied/);
});
