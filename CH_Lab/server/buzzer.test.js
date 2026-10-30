import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createLanServer } from './lan.js';
import { hostExamQuestions } from './exam-questions.js';

function connect(port, payload) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox = [];
  const waiters = [];
  const client = {
    ws, inbox,
    send(message) { ws.send(JSON.stringify({ client: 'buzzer', ...message })); },
    wait(type, predicate = () => true) {
      const found = inbox.find(item => item.type === type && predicate(item));
      if (found) return Promise.resolve(found);
      return new Promise(resolve => waiters.push({ type, predicate, resolve }));
    },
  };
  ws.on('message', data => {
    const message = JSON.parse(data.toString());
    inbox.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.type === message.type && waiter.predicate(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });
  return once(ws, 'open').then(() => {
    client.send({ type: 'hello', ...payload });
    return client;
  });
}

test('rung chuông vàng: nhóm bấm trước được trả lời, sai thì mở chuông lại', async t => {
  const server = createLanServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const port = server.address().port;
  const sockets = [];
  t.after(async () => {
    sockets.forEach(client => client.ws.close());
    await new Promise(resolve => server.close(resolve));
  });

  const host = await connect(port, { role: 'host', name: 'Giảng viên' });
  sockets.push(host);
  const first = await connect(port, { role: 'group', groupId: 1, name: 'Sao Vàng' });
  sockets.push(first);
  const second = await connect(port, { role: 'group', groupId: 2, name: 'Lạc Hồng' });
  sockets.push(second);
  await host.wait('buzzer_state', state => state.groups.filter(group => group.connected).length === 2);

  host.send({ type: 'start' });
  const opened = await first.wait('buzzer_state', state => state.phase === 'armed' && state.canBuzz === true);
  assert.equal(opened.question, null);
  const hostOpen = await host.wait('buzzer_state', state => state.phase === 'armed' && state.question);
  assert.equal(hostOpen.question.question, hostExamQuestions[0].question);
  assert.equal(hostOpen.question.answer, undefined);

  second.send({ type: 'buzz' });
  first.send({ type: 'buzz' });
  const locked = await host.wait('buzzer_state', state => state.phase === 'locked');
  assert.equal(locked.buzzedGroup, 2);
  const late = await first.wait('buzzer_state', state => state.phase === 'locked');
  assert.equal(late.canBuzz, false);
  assert.equal(late.youBuzzed, false);

  host.send({ type: 'wrong' });
  const reopened = await first.wait('buzzer_state', state => state.phase === 'armed' && state.groups[1].status === 'out');
  assert.equal(reopened.canBuzz, true);
  const blocked = await second.wait('buzzer_state', state => state.phase === 'armed' && state.groups[1].status === 'out');
  assert.equal(blocked.canBuzz, false);

  first.send({ type: 'buzz' });
  await host.wait('buzzer_state', state => state.phase === 'locked' && state.buzzedGroup === 1);
  host.send({ type: 'correct' });
  const scored = await host.wait('buzzer_state', state => state.phase === 'revealed' && state.groups[0].score === 10);
  assert.equal(scored.groups[0].score, 10);
  assert.equal(scored.question.answer, hostExamQuestions[0].answer);
});

test('rung chuông vàng: đội nhiều điểm hơn thì chuông mở chậm hơn', async t => {
  const server = createLanServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const port = server.address().port;
  const sockets = [];
  t.after(async () => {
    sockets.forEach(client => client.ws.close());
    await new Promise(resolve => server.close(resolve));
  });

  const host = await connect(port, { role: 'host', name: 'Giảng viên' });
  sockets.push(host);
  const lead = await connect(port, { role: 'group', groupId: 1, name: 'Dẫn' });
  sockets.push(lead);
  const chase = await connect(port, { role: 'group', groupId: 2, name: 'Bám' });
  sockets.push(chase);
  await host.wait('buzzer_state', state => state.groups.filter(group => group.connected).length === 2);

  host.send({ type: 'start' });
  await lead.wait('buzzer_state', state => state.phase === 'armed' && state.canBuzz === true);
  lead.send({ type: 'buzz' });
  await host.wait('buzzer_state', state => state.phase === 'locked' && state.buzzedGroup === 1);
  host.send({ type: 'correct' });
  await host.wait('buzzer_state', state => state.phase === 'revealed' && state.groups[0].score === 10);

  host.send({ type: 'next' });
  const chasing = await chase.wait('buzzer_state', state => state.phase === 'armed' && state.index === 1 && state.canBuzz === true);
  assert.equal(chasing.groups[1].status, 'armed');
  const leading = await lead.wait('buzzer_state', state => state.phase === 'armed' && state.index === 1);
  assert.equal(leading.canBuzz, false);
  assert.equal(leading.groups[0].status, 'queued');
  assert.ok(leading.buzzOpensAt > leading.serverNow);

  lead.send({ type: 'buzz' });
  chase.send({ type: 'buzz' });
  const locked = await host.wait('buzzer_state', state => state.phase === 'locked' && state.index === 1);
  assert.equal(locked.buzzedGroup, 2);
});

test('rung chuông vàng: câu 5 nhân đôi điểm', async t => {
  const server = createLanServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const port = server.address().port;
  const sockets = [];
  t.after(async () => {
    sockets.forEach(client => client.ws.close());
    await new Promise(resolve => server.close(resolve));
  });

  const host = await connect(port, { role: 'host', name: 'Giảng viên' });
  sockets.push(host);
  const first = await connect(port, { role: 'group', groupId: 1, name: 'Sao Vàng' });
  sockets.push(first);
  await host.wait('buzzer_state', state => state.groups.some(group => group.connected));

  host.send({ type: 'start' });
  await host.wait('buzzer_state', state => state.phase === 'armed' && state.index === 0);
  host.send({ type: 'next' });
  await host.wait('buzzer_state', state => state.phase === 'armed' && state.index === 1);
  host.send({ type: 'next' });
  await host.wait('buzzer_state', state => state.phase === 'armed' && state.index === 2);
  host.send({ type: 'next' });
  await host.wait('buzzer_state', state => state.phase === 'armed' && state.index === 3);
  host.send({ type: 'next' });
  const doubled = await host.wait('buzzer_state', state => state.phase === 'armed' && state.index === 4);
  assert.equal(doubled.doublePoints, true);
  assert.equal(doubled.points, 20);

  first.send({ type: 'buzz' });
  await host.wait('buzzer_state', state => state.phase === 'locked' && state.index === 4);
  host.send({ type: 'correct' });
  const scored = await host.wait('buzzer_state', state => state.phase === 'revealed' && state.index === 4);
  assert.equal(scored.groups[0].score, 20);
});
