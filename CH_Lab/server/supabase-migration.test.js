import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { TEACHER_NAME } from '../src/classroom-config.js';
import { perfectExamAnswers } from './exam-questions.js';

const migration = await readFile(new URL('../supabase/migrations/20261001_online_classroom.sql', import.meta.url), 'utf8');
const roomSelectionMigration = await readFile(new URL('../supabase/migrations/20261005_room_selection.sql', import.meta.url), 'utf8');
const examQuestionsMigration = await readFile(new URL('../supabase/migrations/20261005_exam_questions_10.sql', import.meta.url), 'utf8');
const avatarProfilesMigration = await readFile(new URL('../supabase/migrations/20261006_avatar_profiles.sql', import.meta.url), 'utf8');
const aiClassroomMigration = await readFile(new URL('../supabase/migrations/20261006_ai_classroom_content.sql', import.meta.url), 'utf8');
const hcmShowcaseMigration = await readFile(new URL('../supabase/migrations/20261006_z_hcm202_showcase_content.sql', import.meta.url), 'utf8');
const spawnRecoveryMigration = await readFile(new URL('../supabase/migrations/20261006_zz_spawn_seat_recovery.sql', import.meta.url), 'utf8');
const vnrExamMigration = await readFile(new URL('../supabase/migrations/20261030_vnr202_di_cu_exam.sql', import.meta.url), 'utf8');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

test('migration: phân 10 người/phòng và dùng một lượt kiểm tra cho mọi phòng', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      create schema realtime;
      create table realtime.messages(extension text);
      create function realtime.topic() returns text language sql stable as $$ select 'hcm-global'::text $$;
    `);
    await db.exec(migration);
    await db.exec(roomSelectionMigration);
    await db.exec(examQuestionsMigration);
    await db.exec(avatarProfilesMigration);
    await db.exec(aiClassroomMigration);
    await db.exec(hcmShowcaseMigration);
    await db.exec(spawnRecoveryMigration);
    await db.exec(vnrExamMigration);
    const call = async (number, query) => {
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id(number)]);
      return (await db.query(query)).rows[0];
    };
    for (let number = 1; number <= 12; number++) {
      await db.query('insert into auth.users(id) values ($1)', [id(number)]);
    }
    await db.exec('set role authenticated;');
    const teacher = (await call(1, `select public.hcm_join('${TEACHER_NAME}') as state`)).state;
    assert.equal(teacher.me.role, 'teacher');
    assert.equal(teacher.me.roomNo, 1);

    let tenthStudent;
    for (let number = 2; number <= 11; number++) {
      const state = (await call(number, `select public.hcm_join('Sinh viên ${number}') as state`)).state;
      if (number <= 10) assert.equal(state.me.roomNo, 1);
      else tenthStudent = state;
    }
    assert.equal(tenthStudent.me.roomNo, 2);
    assert.deepEqual(tenthStudent.counts, { online: 11, seated: 0, rooms: 2, roomOccupancy: 1, roomCapacity: 10 });
    assert.equal((await call(11, "select hcm_private.hcm_channel_access('hcm-room-2') as allowed")).allowed, true);
    assert.equal((await call(11, "select hcm_private.hcm_channel_access('hcm-room-1') as allowed")).allowed, false);
    await assert.rejects(call(12, "select public.hcm_join_room('Phòng đầy', 1)"), /đủ 10 người/);
    const selectedRoom = (await call(12, "select public.hcm_join_room('Chọn phòng 8', 8) as state")).state;
    assert.equal(selectedRoom.me.roomNo, 8);
    assert.equal(selectedRoom.counts.roomOccupancy, 1);
    const movedRoom = (await call(12, "select public.hcm_join_room('Đổi phòng 9', 9) as state")).state;
    assert.equal(movedRoom.me.roomNo, 9);
    assert.equal(movedRoom.me.seatId, null);
    const femaleProfile = (await call(12, "select public.hcm_join_profile('Hồ sơ nữ', 9, 'female', 'miku') as state")).state;
    assert.equal(femaleProfile.me.gender, 'female');
    assert.equal(femaleProfile.me.avatar, 'miku');
    assert.deepEqual(
      femaleProfile.players.find(player => player.id === id(12)),
      { id: id(12), name: 'Hồ sơ nữ', role: 'student', gender: 'female', avatar: 'miku',
        x: 5.4, z: 3.7, rotation: Math.PI, seatId: null },
    );
    await assert.rejects(call(11, 'select * from public.hcm_exam_questions'), /permission denied/);
    await assert.rejects(call(2, 'select public.hcm_start_exam()'), /Chỉ giảng viên/);

    for (const number of [2, 11]) {
      await call(number, 'select public.hcm_touch(-5.65, -0.85, 0)');
      const state = (await call(number, 'select public.hcm_sit(0) as state')).state;
      assert.equal(state.me.seatId, 0);
    }
    const opened = (await call(1, 'select public.hcm_start_exam() as state')).state;
    assert.equal(opened.counts.seated, 2);
    assert.equal(opened.exam.participantCount, 2);
    assert.equal(opened.exam.phase, 'active');
    assert.equal(opened.me.eligible, false);
    const otherRoom = (await call(11, 'select public.hcm_state() as state')).state;
    assert.equal(otherRoom.me.eligible, true);
    assert.equal(otherRoom.exam.startedAt, opened.exam.startedAt);
    assert.equal(otherRoom.exam.endsAt, opened.exam.endsAt);
    assert.equal(otherRoom.questions.length, 15);
    assert.equal((await call(3, 'select public.hcm_state() as state')).state.me.eligible, false);

    const first = (await call(2, `select public.hcm_submit_exam('${JSON.stringify(perfectExamAnswers)}'::jsonb) as state`)).state;
    assert.equal(first.me.submitted, true);
    assert.equal(first.exam.submittedCount, 1);
    const second = (await call(11, `select public.hcm_submit_exam('${JSON.stringify(Array(15).fill(0))}'::jsonb) as state`)).state;
    assert.equal(second.exam.phase, 'finished');
    assert.equal(second.exam.rankings.length, 2);
    assert.equal(second.exam.rankings[0].id, id(2));
    assert.equal(second.exam.rankings[0].correct, 15);
    assert.equal(second.exam.rankings[1].id, id(11));
    const stoodUp = (await call(2, 'select public.hcm_stand() as state')).state;
    assert.equal(stoodUp.me.seatId, null);
    const ownStanding = stoodUp.players.find(player => player.id === id(2));
    assert.equal(ownStanding.x, -5.65);
    assert.equal(ownStanding.z, -0.42);
    await call(2, 'select public.hcm_touch(1.05, 4.65, 0)');
    await call(2, 'select public.hcm_sit(8)');
    const rejoined = (await call(2, "select public.hcm_join_profile('Sinh viên 2', 1, 'male', 'male-classic') as state")).state;
    const ownRejoined = rejoined.players.find(player => player.id === id(2));
    assert.equal(rejoined.me.seatId, null);
    assert.equal(ownRejoined.x, 5.4);
    assert.equal(ownRejoined.z, 3.7);
    assert.equal(ownRejoined.rotation, Math.PI);
    await assert.rejects(call(2, 'select public.hcm_reset_exam()'), /Chỉ giảng viên/);
    const reset = (await call(1, 'select public.hcm_reset_exam() as state')).state;
    assert.equal(reset.exam.phase, 'idle');
    assert.equal(reset.exam.participantCount, 0);
    assert.deepEqual(reset.exam.rankings, []);
  } finally {
    await db.close();
  }
});
