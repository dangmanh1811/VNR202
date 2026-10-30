import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import { loadEnv } from 'vite';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { seatPosition, SPAWN_POSITION } from '../src/classroom-config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const statusPath = resolve(root, '.simulated-students.json');
const stopPath = resolve(root, '.simulated-students.stop');
const count = 12;
const bots = [];
const startedAt = new Date().toISOString();
let stopping = false;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

async function writeStatus() {
  await writeFile(statusPath, JSON.stringify({
    pid: process.pid,
    startedAt,
    users: bots.map(({ name, roomNo, seatId }) => ({ name, roomNo, seatId })),
  }, null, 2));
}

async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('Đang cho 12 sinh viên ảo rời lớp...');
  await Promise.allSettled(bots.map(async bot => {
    clearInterval(bot.heartbeat);
    if (bot.channel) await bot.client.removeChannel(bot.channel);
    await rpc(bot.client, 'hcm_leave');
  }));
  await Promise.allSettled([rm(statusPath, { force: true }), rm(stopPath, { force: true })]);
  process.exit(process.exitCode || 0);
}

if (process.argv.includes('--stop')) {
  try {
    const status = JSON.parse(await readFile(statusPath, 'utf8'));
    await writeFile(stopPath, String(status.pid));
    for (let i = 0; i < 20; i++) {
      await wait(500);
      try { await readFile(statusPath); } catch { console.log('Đã dừng mô phỏng.'); process.exit(0); }
    }
    console.error('Tiến trình chưa xác nhận dừng. Hãy kiểm tra file .simulated-students.json.');
    process.exit(1);
  } catch {
    console.log('Không có mô phỏng đang chạy.');
    process.exit(0);
  }
}

try {
  const previous = JSON.parse(await readFile(statusPath, 'utf8'));
  process.kill(previous.pid, 0);
  console.error(`Mô phỏng đã chạy với PID ${previous.pid}.`);
  process.exit(1);
} catch { /* Không có tiến trình cũ. */ }
await rm(stopPath, { force: true });

const env = loadEnv('development', root, '');
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Thiếu URL hoặc publishable key của Supabase trong .env.');
  process.exit(1);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  for (let index = 1; index <= count; index++) {
    const name = `Sinh viên ảo ${String(index).padStart(2, '0')}`;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { transport: WebSocket },
    });
    const { error } = await client.auth.signInAnonymously();
    if (error) throw new Error(`${name}: ${error.message}`);
    const state = await rpc(client, 'hcm_join', { p_name: name });
    const roomNo = state.me.roomNo;
    const bot = { client, name, roomNo, seatId: null, channel: null, heartbeat: null };
    bots.push(bot);

    const occupied = new Set(state.players.map(player => player.seatId).filter(seat => seat !== null));
    const seatId = Array.from({ length: 10 }, (_, id) => id).find(id => !occupied.has(id));
    if (seatId !== undefined) {
      const seat = seatPosition(seatId);
      for (let attempt = 0; attempt < 3 && bot.seatId === null; attempt++) {
        try {
          await rpc(client, 'hcm_touch', { p_x: seat.x, p_z: seat.z, p_rotation: 0 });
          await rpc(client, 'hcm_sit', { p_seat: seatId });
          bot.seatId = seatId;
        } catch (seatError) {
          if (attempt === 2) console.warn(`${name}: chưa ngồi được (${seatError.message}).`);
          else await wait(750);
        }
      }
    }

    const channel = client.channel(`hcm-room-${roomNo}`, {
      config: { private: true, presence: { key: state.me.id } },
    });
    bot.channel = channel;
    channel.subscribe(async subscription => {
      if (subscription === 'SUBSCRIBED' && !stopping) {
        await channel.track({
          id: state.me.id, name, role: 'student', seatId: bot.seatId,
          x: bot.seatId === null ? SPAWN_POSITION.x : seatPosition(bot.seatId).x,
          z: bot.seatId === null ? SPAWN_POSITION.z : seatPosition(bot.seatId).z,
          rotation: bot.seatId === null ? SPAWN_POSITION.rotation : Math.PI,
        }).catch(error => console.warn(`${name}: Presence: ${error.message}`));
      }
    });
    bot.heartbeat = setInterval(async () => {
      try { await rpc(client, 'hcm_touch', {
        p_x: SPAWN_POSITION.x, p_z: SPAWN_POSITION.z, p_rotation: SPAWN_POSITION.rotation,
      }); }
      catch (heartbeatError) { console.warn(`${name}: heartbeat: ${heartbeatError.message}`); }
    }, 15000);
    console.log(`${name} → phòng ${roomNo}${bot.seatId === null ? ' (đứng)' : `, ghế ${bot.seatId + 1}`}`);
    await writeStatus();
    await wait(350);
  }
  const roomTwoBot = bots.find(bot => bot.roomNo === 2);
  if (roomTwoBot) {
    const check = await rpc(roomTwoBot.client, 'hcm_state');
    console.log(`Xác nhận từ phòng 2: ${check.counts.online} người trực tuyến, ${check.counts.roomOccupancy} người trong phòng 2.`);
  }
  console.log(`Đã tạo ${bots.length} sinh viên ảo. Dừng bằng: npm run simulate:students:stop`);
  setInterval(async () => {
    try {
      const targetPid = await readFile(stopPath, 'utf8');
      if (targetPid.trim() === String(process.pid)) await stop();
    } catch { /* Chưa có yêu cầu dừng. */ }
  }, 1000);
} catch (error) {
  console.error(`Không thể hoàn tất mô phỏng: ${error.message}`);
  process.exitCode = 1;
  await stop();
}
