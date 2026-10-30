import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { seatPosition, standingPosition, SPAWN_POSITION, EXAM_MINUTES, TEACHER_NAME, ROOM_CAPACITY } from '../src/classroom-config.js';
import { publicExamQuestions } from './exam-questions.js';
import { scoreAnswers, rankSubmissions } from './scoring.js';
import { normalizeAvatarProfile } from '../src/avatar-options.js';
import { createBuzzerGame } from './buzzer.js';

const VALID_TOKEN = /^[a-f0-9-]{36}$/i;

export function createLanServer({ port = 5174, host = '0.0.0.0' } = {}) {
  const wss = new WebSocketServer({ port, host, maxPayload: 4096 });
  const buzzer = createBuzzerGame({ send: (ws, payload) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  } });
  const players = new Map();
  let teacherId = null;
  let round = 0;
  let exam = { phase: 'idle', startedAt: null, endsAt: null, eligible: new Set(), submissions: new Map() };

  function send(ws, payload) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }

  function sendTo(player, payload) { send(player.ws, payload); }
  function broadcast(payload, roomNo = null) {
    for (const player of players.values()) if (player.connected && (roomNo === null || player.roomNo === roomNo)) sendTo(player, payload);
  }
  function rankings() {
    return rankSubmissions([...exam.submissions].map(([id, item]) => ({ ...item, id, name: players.get(id)?.name || 'Sinh viên' })));
  }
  function snapshot(viewer) {
    const online = [...players.values()].filter(player => player.connected);
    return {
      type: 'state', serverNow: Date.now(),
      me: { id: viewer.id, name: viewer.name, role: viewer.role, roomNo: viewer.roomNo, seatId: viewer.seatId,
        gender: viewer.gender, avatar: viewer.avatar,
        eligible: exam.eligible.has(viewer.id), submitted: exam.submissions.has(viewer.id) },
      players: online.filter(player => player.roomNo === viewer.roomNo)
        .map(({ id, name, role, gender, avatar, x, z, rotation, seatId }) => ({ id, name, role, gender, avatar, x, z, rotation, seatId })),
      counts: { online: online.length, seated: online.filter(player => player.role === 'student' && player.seatId !== null).length,
        rooms: new Set(online.map(player => player.roomNo)).size,
        roomOccupancy: online.filter(player => player.roomNo === viewer.roomNo).length, roomCapacity: ROOM_CAPACITY },
      exam: { phase: exam.phase, round, startedAt: exam.startedAt, endsAt: exam.endsAt, participantCount: exam.eligible.size, submittedCount: exam.submissions.size, rankings: rankings() },
    };
  }
  function broadcastState() { for (const player of players.values()) if (player.connected) sendTo(player, snapshot(player)); }
  function error(playerOrSocket, message) { send(playerOrSocket.ws || playerOrSocket, { type: 'error', message }); }

  function openExamFor(player) {
    if (exam.phase === 'active' && exam.eligible.has(player.id) && !exam.submissions.has(player.id)) {
      sendTo(player, { type: 'exam_open', round, serverNow: Date.now(), startedAt: exam.startedAt, endsAt: exam.endsAt, questions: publicExamQuestions });
    } else if (exam.submissions.has(player.id)) {
      const row = rankings().find(item => item.id === player.id);
      sendTo(player, { type: 'exam_result', round, row });
    }
  }

  function handleHello(ws, message) {
    const requestedName = typeof message.name === 'string' ? message.name.trim().slice(0, 32) : '';
    if (!requestedName) { error(ws, 'Hãy nhập tên trước khi vào lớp LAN.'); return; }
    if (message.roomNo !== null && message.roomNo !== undefined && (!Number.isInteger(message.roomNo) || message.roomNo < 1 || message.roomNo > 9999)) {
      error(ws, 'Số phòng phải là số nguyên từ 1 đến 9999.'); return;
    }
    const id = typeof message.token === 'string' && VALID_TOKEN.test(message.token) ? message.token : randomUUID();
    const { gender, avatar } = normalizeAvatarProfile(message.gender, message.avatar);
    const wantsTeacher = requestedName === TEACHER_NAME;
    const otherTeacher = teacherId && teacherId !== id && players.get(teacherId)?.connected;
    if (wantsTeacher && otherTeacher) { error(ws, 'Giảng viên đã đăng nhập trên thiết bị khác.'); return; }
    let player = players.get(id);
    let nextRoom = message.roomNo ?? player?.roomNo ?? 1;
    if (message.roomNo == null && !player) {
      nextRoom = 1;
      while ([...players.values()].filter(item => item.connected && item.roomNo === nextRoom).length >= ROOM_CAPACITY) nextRoom++;
    }
    if ([...players.values()].filter(item => item.connected && item.id !== id && item.roomNo === nextRoom).length >= ROOM_CAPACITY) {
      error(ws, `Phòng ${nextRoom} đã đủ ${ROOM_CAPACITY} người.`); return;
    }
    if (player?.ws && player.ws !== ws) player.ws.close(4000, 'Phiên đã mở trên thiết bị khác');
    if (!player) {
      player = { id, x: SPAWN_POSITION.x, z: SPAWN_POSITION.z, rotation: SPAWN_POSITION.rotation,
        seatId: null, roomNo: nextRoom, lastPoseAt: Date.now() };
      players.set(id, player);
    }
    if (player.roomNo !== nextRoom) {
      player.roomNo = nextRoom;
    }
    // A join/refresh is a clean entrance to the classroom. Never restore a
    // stale seated pose or a saved position that may now be inside furniture.
    player.seatId = null;
    player.x = SPAWN_POSITION.x; player.z = SPAWN_POSITION.z;
    player.rotation = SPAWN_POSITION.rotation; player.lastPoseAt = Date.now();
    if (teacherId === id && !wantsTeacher) teacherId = null;
    player.name = wantsTeacher ? 'Giảng viên' : requestedName;
    player.role = wantsTeacher ? 'teacher' : 'student';
    player.gender = gender;
    player.avatar = avatar;
    player.ws = ws;
    player.connected = true;
    if (wantsTeacher) { teacherId = id; player.seatId = null; }
    ws.playerId = id;
    sendTo(player, { type: 'welcome', id, role: player.role, name: player.name, gender, avatar,
      roomNo: player.roomNo, serverNow: Date.now(), examMinutes: EXAM_MINUTES });
    sendTo(player, snapshot(player));
    openExamFor(player);
    broadcastState();
  }

  function finishExam() {
    if (exam.phase !== 'active') return;
    const now = Date.now();
    for (const id of exam.eligible) {
      if (!exam.submissions.has(id)) exam.submissions.set(id, { correct: 0, durationMs: Math.max(0, exam.endsAt - exam.startedAt), submittedAt: now, automatic: true });
    }
    exam.phase = 'finished';
    broadcastState();
    broadcast({ type: 'exam_finished', round, rankings: rankings() });
  }

  function resetExam(player) {
    if (player.role !== 'teacher') { error(player, 'Chỉ giảng viên mới reset được bảng xếp hạng.'); return; }
    exam = { phase: 'idle', startedAt: null, endsAt: null, eligible: new Set(), submissions: new Map() };
    broadcast({ type: 'exam_reset', round });
    broadcastState();
  }

  function handleMessage(ws, message) {
    if (message.type === 'hello') { handleHello(ws, message); return; }
    const player = players.get(ws.playerId);
    if (!player || player.ws !== ws) return;
    if (message.type === 'chat') {
      const text = typeof message.text === 'string' ? message.text.trim().slice(0, 200) : '';
      const now = Date.now();
      if (!text || now - (player.lastChatAt || 0) < 300) return;
      player.lastChatAt = now;
      broadcast({ type: 'chat', id: player.id, name: player.name, text, sentAt: now, messageId: randomUUID() }, player.roomNo);
    } else if (message.type === 'pose') {
      if (player.seatId !== null) return;
      const { x, z, rotation } = message;
      if (![x, z, rotation].every(Number.isFinite) || x < -7.82 || x > 7.83 || z < -5.75 || z > 5.86) return;
      const now = Date.now();
      const elapsed = Math.max(.05, Math.min(1, (now - player.lastPoseAt) / 1000));
      if (Math.hypot(x - player.x, z - player.z) > 5.5 * elapsed + .6) return;
      player.x = x; player.z = z; player.rotation = rotation;
      player.lastPoseAt = now;
      const vx = Number.isFinite(message.vx) ? Math.max(-5, Math.min(5, message.vx)) : 0;
      const vz = Number.isFinite(message.vz) ? Math.max(-5, Math.min(5, message.vz)) : 0;
      broadcast({ type: 'pose', id: player.id, x, z, rotation, vx, vz,
        seq: Number.isInteger(message.seq) ? message.seq : undefined }, player.roomNo);
    } else if (message.type === 'sit') {
      if (player.role === 'teacher') { error(player, 'Ghế kiểm tra dành cho sinh viên.'); return; }
      const seatId = message.seatId;
      const seat = Number.isInteger(seatId) ? seatPosition(seatId) : null;
      if (!seat) return;
      if (Math.hypot(player.x - seat.x, player.z - seat.z) > 1.8 && player.seatId !== seatId) {
        error(player, 'Hãy đi tới gần ghế trước khi ngồi.'); return;
      }
      if ([...players.values()].some(p => p.id !== player.id && p.connected && p.roomNo === player.roomNo && p.seatId === seatId)) {
        error(player, 'Ghế này đã có người ngồi.'); return;
      }
      player.seatId = seatId; player.x = seat.x; player.z = seat.z; player.rotation = Math.PI;
      player.lastPoseAt = Date.now();
      broadcastState();
    } else if (message.type === 'stand') {
      if (player.seatId === null) return;
      const stand = standingPosition(player.seatId);
      player.x = stand.x; player.z = stand.z; player.rotation = stand.rotation;
      player.seatId = null; player.lastPoseAt = Date.now();
      broadcastState();
    } else if (message.type === 'start_exam') {
      if (player.role !== 'teacher') { error(player, 'Chỉ giảng viên mới mở được bài kiểm tra.'); return; }
      if (exam.phase === 'active') { error(player, 'Bài kiểm tra đang diễn ra.'); return; }
      const eligible = new Set([...players.values()].filter(p => p.role === 'student' && p.connected && p.seatId !== null).map(p => p.id));
      if (!eligible.size) { error(player, 'Cần ít nhất một sinh viên đang ngồi để mở bài kiểm tra.'); return; }
      const startedAt = Date.now();
      round++;
      exam = { phase: 'active', startedAt, endsAt: startedAt + EXAM_MINUTES * 60_000, eligible, submissions: new Map() };
      broadcastState();
      for (const id of eligible) openExamFor(players.get(id));
    } else if (message.type === 'submit_exam') {
      if (exam.phase !== 'active' || !exam.eligible.has(player.id) || exam.submissions.has(player.id)) return;
      if (Date.now() >= exam.endsAt) { finishExam(); return; }
      const answers = message.answers;
      if (!Array.isArray(answers) || answers.length !== publicExamQuestions.length || answers.some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 3))) {
        error(player, 'Bài làm không hợp lệ. Hãy chọn đáp án trong đề.'); return;
      }
      const now = Date.now();
      exam.submissions.set(player.id, { correct: scoreAnswers(answers), durationMs: now - exam.startedAt, submittedAt: now, automatic: false });
      sendTo(player, { type: 'exam_result', round, row: rankings().find(item => item.id === player.id) });
      broadcastState();
      if (exam.submissions.size === exam.eligible.size) finishExam();
    } else if (message.type === 'finish_exam') {
      if (player.role === 'teacher') finishExam();
    } else if (message.type === 'reset_exam') {
      resetExam(player);
    }
  }

  wss.on('connection', ws => {
    ws.on('message', data => {
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (message?.client === 'buzzer' || String(message?.type || '').startsWith('buzzer_')) {
        buzzer.handle(ws, message);
        return;
      }
      if (message && typeof message.type === 'string') handleMessage(ws, message);
    });
    ws.on('close', () => {
      buzzer.onClose(ws);
      const player = players.get(ws.playerId);
      if (!player || player.ws !== ws) return;
      player.connected = false; player.ws = null;
      if (teacherId === player.id) teacherId = null;
      broadcastState();
      setTimeout(() => {
        if (!player.connected) {
          player.seatId = null;
          if (exam.phase !== 'active' || !exam.eligible.has(player.id)) players.delete(player.id);
          broadcastState();
        }
      }, 10_000).unref();
    });
  });

  const deadlineCheck = setInterval(() => {
    if (exam.phase === 'active' && Date.now() >= exam.endsAt) finishExam();
  }, 500);
  wss.on('close', () => {
    clearInterval(deadlineCheck);
    buzzer.stop();
  });
  return wss;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.LAN_PORT) || 5174;
  createLanServer({ port }).on('listening', () => console.log(`LAN WebSocket: ws://0.0.0.0:${port}`));
}
