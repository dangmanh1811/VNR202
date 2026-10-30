import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { createLanServer } from './lan.js';
import { rankSubmissions, scoreAnswers } from './scoring.js';
import { SPAWN_POSITION, standingPosition, TEACHER_NAME } from '../src/classroom-config.js';
import { perfectExamAnswers } from './exam-questions.js';

const twelveCorrect = perfectExamAnswers.map((answer, index) => index < 12 ? answer : 0);

test('chấm theo số câu đúng rồi thời gian hoàn thành', () => {
  assert.equal(scoreAnswers(perfectExamAnswers), 15);
  assert.equal(scoreAnswers(twelveCorrect), 12);
  const ranked = rankSubmissions([
    { id: 'b', name: 'B', correct: 12, durationMs: 2000, submittedAt: 2000 },
    { id: 'a', name: 'A', correct: 15, durationMs: 7000, submittedAt: 7000 },
    { id: 'c', name: 'C', correct: 12, durationMs: 1000, submittedAt: 1000 },
  ]);
  assert.deepEqual(ranked.map(row => row.id), ['a', 'c', 'b']);
  assert.equal(ranked[0].points, 100);
  assert.equal(ranked[1].points, 80);
});

test('hai sinh viên ngồi, giảng viên mở đề và máy chủ xếp hạng', async t => {
  const server = createLanServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const port = server.address().port;
  const clients = [];
  t.after(async () => {
    clients.forEach(client => client.ws.close());
    await new Promise(resolve => server.close(resolve));
  });

  async function join(name, roomNo = null, profile = {}) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(ws, 'open');
    const inbox = [];
    const waiters = [];
    ws.on('message', data => {
      const message = JSON.parse(data.toString());
      inbox.push(message);
      for (const waiter of [...waiters]) if (waiter.predicate(message)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(message); }
    });
    const client = {
      ws,
      inbox,
      send: message => ws.send(JSON.stringify(message)),
      wait: (type, check = () => true) => {
        const existing = inbox.find(message => message.type === type && check(message));
        if (existing) return Promise.resolve(existing);
        return new Promise((resolve, reject) => {
          const waiter = { predicate: message => message.type === type && check(message), resolve };
          waiters.push(waiter);
          setTimeout(() => { const index = waiters.indexOf(waiter); if (index >= 0) { waiters.splice(index, 1); reject(new Error(`Timeout: ${type}`)); } }, 5000).unref();
        });
      },
    };
    clients.push(client);
    client.send({ type: 'hello', token: randomUUID(), name, roomNo, ...profile });
    client.identity = await client.wait('welcome');
    return client;
  }

  async function walkTo(client, targetX, targetZ) {
    let x = SPAWN_POSITION.x; let z = SPAWN_POSITION.z;
    while (Math.hypot(targetX - x, targetZ - z) > .01) {
      const dx = targetX - x; const dz = targetZ - z;
      const factor = Math.min(1, .43 / Math.hypot(dx, dz));
      x += dx * factor; z += dz * factor;
      client.send({ type: 'pose', x, z, rotation: Math.PI });
      await new Promise(resolve => setTimeout(resolve, 115));
    }
  }

  const teacher = await join(TEACHER_NAME);
  const first = await join('An');
  const second = await join('Bình');
  const otherRoom = await join('Chi', 2, { gender: 'female', avatar: 'female-suzuka' });
  assert.equal(teacher.identity.role, 'teacher');
  assert.equal(teacher.identity.name, 'Giảng viên');
  assert.equal(otherRoom.identity.roomNo, 2);
  assert.equal(otherRoom.identity.gender, 'female');
  assert.equal(otherRoom.identity.avatar, 'female-suzuka');
  const isolatedState = await otherRoom.wait('state', state => state.counts?.online === 4);
  assert.deepEqual(isolatedState.players.map(player => player.name), ['Chi']);
  assert.equal(isolatedState.players[0].avatar, 'female-suzuka');

  first.send({ type: 'chat', text: '  Chào cả phòng!  ' });
  const chat = await teacher.wait('chat');
  assert.equal(chat.name, 'An');
  assert.equal(chat.text, 'Chào cả phòng!');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(otherRoom.inbox.some(message => message.type === 'chat'), false);
  const lateJoiner = await join('Dũng');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(lateJoiner.inbox.some(message => message.type === 'chat'), false);

  first.send({ type: 'start_exam' });
  assert.match((await first.wait('error')).message, /Chỉ giảng viên/);

  await Promise.all([walkTo(first, 1.05, 4.75), walkTo(second, -2.35, 4.75)]);
  const movingPose = await teacher.wait('pose', pose => pose.id === first.identity.id && Math.hypot(pose.x - 1.05, pose.z - 4.75) < .1);
  assert.equal(movingPose.type, 'pose');
  first.send({ type: 'sit', seatId: 8 });
  second.send({ type: 'sit', seatId: 7 });
  await teacher.wait('state', state => state.players.filter(player => player.seatId !== null).length === 2);
  teacher.send({ type: 'start_exam' });
  const [firstExam, secondExam] = await Promise.all([first.wait('exam_open'), second.wait('exam_open')]);
  assert.equal(firstExam.questions.length, 15);
  assert.equal(firstExam.questions[0].answer, undefined);
  assert.equal(secondExam.endsAt - secondExam.startedAt, 15 * 60_000);

  second.send({ type: 'submit_exam', answers: twelveCorrect });
  await second.wait('exam_result');
  first.send({ type: 'submit_exam', answers: perfectExamAnswers });
  const done = await teacher.wait('exam_finished');
  assert.equal(done.rankings[0].name, 'An');
  assert.equal(done.rankings[0].points, 100);
  assert.equal(done.rankings[1].name, 'Bình');
  assert.equal(done.rankings[1].points, 80);
  teacher.send({ type: 'reset_exam' });
  await first.wait('exam_reset');
  const resetState = await teacher.wait('state', state => state.exam?.round === 1 && state.exam.phase === 'idle');
  assert.equal(resetState.exam.participantCount, 0);
  assert.deepEqual(resetState.exam.rankings, []);

  first.send({ type: 'stand' });
  const safeStand = standingPosition(8);
  const stoodUp = await first.wait('state', state => {
    const own = state.players?.find(player => player.id === first.identity.id);
    return state.me?.seatId === null && own?.x === safeStand.x && own?.z === safeStand.z;
  });
  const ownStanding = stoodUp.players.find(player => player.id === first.identity.id);
  assert.equal(ownStanding.x, safeStand.x);
  assert.equal(ownStanding.z, safeStand.z);
  first.send({ type: 'pose', x: safeStand.x + .2, z: safeStand.z, rotation: Math.PI / 2 });
  const poseAfterStanding = await teacher.wait('pose', pose => pose.id === first.identity.id && pose.x > safeStand.x + .1);
  assert.equal(poseAfterStanding.type, 'pose');
});
