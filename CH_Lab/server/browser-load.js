import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { WebSocket } from 'ws';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const playerCount = Number(process.argv[2]) || 10;
const durationMs = Number(process.argv[3]) || 8000;
const movementTickMs = Number(process.argv[4]) || 50;
const webUrl = process.env.HCM_WEB_URL || 'http://127.0.0.1:5173/';
const socketUrl = process.env.HCM_SOCKET_URL || 'ws://127.0.0.1:5174';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
};

async function waitForFile(path, timeoutMs = 10000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    try { return await readFile(path, 'utf8'); } catch { await wait(100); }
  }
  throw new Error(`Timeout waiting for ${path}`);
}

async function connectBot(index) {
  const ws = new WebSocket(socketUrl);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const identity = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Bot ${index + 1} không vào được lớp.`)), 5000);
    ws.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'welcome') { clearTimeout(timer); resolve(message); }
    });
  });
  ws.send(JSON.stringify({ type: 'hello', token: randomUUID(), name: `Bot chuyển động ${index + 1}` }));
  await identity;
  return ws;
}

const profilePath = await mkdtemp(join(tmpdir(), 'hcm-browser-load-'));
const bots = [];
let chrome;
try {
  for (let index = 0; index < playerCount; index++) bots.push(await connectBot(index));

  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu-sandbox', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--remote-debugging-port=0', `--user-data-dir=${profilePath}`, webUrl,
  ], { stdio: 'ignore', windowsHide: true });
  const [portLine] = (await waitForFile(join(profilePath, 'DevToolsActivePort'))).trim().split(/\r?\n/);
  const targets = await (await fetch(`http://127.0.0.1:${portLine}/json/list`)).json();
  let target = targets.find(item => item.type === 'page' && item.url.startsWith(webUrl));
  for (let attempt = 0; !target && attempt < 30; attempt++) {
    await wait(100);
    const nextTargets = await (await fetch(`http://127.0.0.1:${portLine}/json/list`)).json();
    target = nextTargets.find(item => item.type === 'page' && item.url.startsWith(webUrl));
  }
  if (!target) throw new Error('Không tìm thấy trang benchmark trong Chrome.');

  const cdp = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { cdp.once('open', resolve); cdp.once('error', reject); });
  let commandId = 0;
  const pending = new Map();
  cdp.on('message', raw => {
    const message = JSON.parse(raw.toString());
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    cdp.send(JSON.stringify({ id, method, params }));
  });

  await command('Runtime.enable');
  const deadline = performance.now() + 10000;
  while (performance.now() < deadline) {
    const result = await command('Runtime.evaluate', { expression: "document.querySelector('#online-count')?.textContent || ''", returnByValue: true });
    if (Number.parseInt(result.result.value, 10) >= playerCount + 1) break;
    await wait(200);
  }

  let tick = 0;
  const movement = setInterval(() => {
    const elapsed = tick * movementTickMs / 1000;
    bots.forEach((ws, index) => {
      const angle = elapsed * .7 + index * Math.PI * 2 / playerCount;
      ws.send(JSON.stringify({
        type: 'pose', x: 4.55 + Math.cos(angle) * .65,
        z: 3.7 + Math.sin(angle) * .65, rotation: -angle,
      }));
    });
    tick++;
  }, movementTickMs);

  const expression = `(async () => {
    const duration = ${durationMs};
    const frames = [];
    let previous = performance.now();
    const start = previous;
    await new Promise(resolve => {
      function frame(now) {
        frames.push(now - previous); previous = now;
        if (now - start >= duration) resolve(); else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    return { frames, online: document.querySelector('#online-count')?.textContent || '' };
  })()`;
  const measured = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  clearInterval(movement);
  const { frames, online } = measured.result.value;
  const total = frames.reduce((sum, value) => sum + value, 0);
  console.log(JSON.stringify({
    remotePlayers: playerCount, movementHz: Math.round(1000 / movementTickMs),
    online, durationMs: Math.round(total), frames: frames.length,
    fps: Math.round(frames.length / total * 10000) / 10,
    frameMs: {
      p50: Math.round(percentile(frames, .5) * 10) / 10,
      p95: Math.round(percentile(frames, .95) * 10) / 10,
      p99: Math.round(percentile(frames, .99) * 10) / 10,
      max: Math.round(Math.max(...frames) * 10) / 10,
    },
    slowFramesOver33ms: frames.filter(value => value > 33.4).length,
  }));
  cdp.close();
} finally {
  for (const ws of bots) ws.close();
  chrome?.kill();
  await wait(300);
  await rm(profilePath, { recursive: true, force: true });
}
