import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { WebSocket } from 'ws';
import { createLanServer } from './lan.js';
import { SPAWN_POSITION } from '../src/classroom-config.js';

const players = 10;
const tickMs = 100;
const durationMs = Number(process.argv[2]) || 5000;
const latency = [];
const intervals = [];
const sendTimes = new Map();
const clients = [];
const idByIndex = new Map();
const lastArrival = new Map();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, ratio) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))] * 10) / 10;
};

const server = createLanServer({ host: '127.0.0.1', port: 0 });
const loopDelay = monitorEventLoopDelay({ resolution: 10 });
try {
  await once(server, 'listening');
  const address = `ws://127.0.0.1:${server.address().port}`;
  for (let index = 0; index < players; index++) {
    const ws = new WebSocket(address);
    await once(ws, 'open');
    const welcome = new Promise(resolve => {
      ws.on('message', raw => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'welcome') { idByIndex.set(index, message.id); resolve(); }
        if (message.type !== 'pose') return;
        if (message.id === idByIndex.get(index)) return;
        const sentAt = sendTimes.get(`${message.id}:${message.x}`);
        if (sentAt === undefined) return;
        const now = performance.now();
        latency.push(now - sentAt);
        const prior = lastArrival.get(`${index}:${message.id}`);
        if (prior !== undefined) intervals.push(now - prior);
        lastArrival.set(`${index}:${message.id}`, now);
      });
    });
    clients.push(ws);
    ws.send(JSON.stringify({ type: 'hello', token: randomUUID(), name: `Tải LAN ${index + 1}` }));
    await welcome;
  }

  let ticks = 0;
  loopDelay.enable();
  const startedAt = performance.now();
  while (performance.now() - startedAt < durationMs) {
    const nextTick = startedAt + ticks * tickMs;
    await wait(Math.max(0, nextTick - performance.now()));
    for (let index = 0; index < players; index++) {
      const x = SPAWN_POSITION.x + index * .01 + ticks * .000001;
      const z = SPAWN_POSITION.z + .6 * Math.sin((ticks * tickMs / 1000) * Math.PI / 2 + index * .35);
      sendTimes.set(`${idByIndex.get(index)}:${x}`, performance.now());
      clients[index].send(JSON.stringify({ type: 'pose', x, z, rotation: 0 }));
    }
    ticks++;
  }
  await wait(300);
  loopDelay.disable();
  const expected = ticks * players * (players - 1);
  console.log(JSON.stringify({
    players, durationMs, sent: ticks * players, received: latency.length, expected,
    deliveryPercent: Math.round(latency.length / expected * 1000) / 10,
    latencyMs: { p50: percentile(latency, .5), p95: percentile(latency, .95), max: percentile(latency, 1) },
    intervalMs: { p95: percentile(intervals, .95), max: percentile(intervals, 1) },
    eventLoopP95Ms: Math.round(loopDelay.percentile(95) / 1e5) / 10,
  }));
} finally {
  for (const ws of clients) ws.close();
  await Promise.all(clients.map(ws => once(ws, 'close').catch(() => {})));
  await new Promise(resolve => server.close(resolve));
}
