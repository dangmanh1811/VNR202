import { hostExamQuestions } from './exam-questions.js';
import {
  BUZZER_GROUP_COUNT, BUZZER_POINTS, BUZZER_SECONDS, BUZZER_HANDICAP_MS, BUZZER_DOUBLE_INDEXES,
} from '../src/classroom-config.js';

const VALID_TOKEN = /^[a-f0-9-]{36}$/i;
const GROUP_IDS = Array.from({ length: BUZZER_GROUP_COUNT }, (_, index) => index + 1);

function questionPoints(questionIndex) {
  return BUZZER_DOUBLE_INDEXES.includes(questionIndex) ? BUZZER_POINTS * 2 : BUZZER_POINTS;
}

function emptyGroups() {
  return new Map(GROUP_IDS.map(id => [id, {
    id, name: `Nhóm ${id}`, score: 0, connected: false, clientId: null, buzzOpensAt: 0,
  }]));
}

function connectedGroups(groups) {
  return GROUP_IDS.map(id => groups.get(id)).filter(group => group.connected);
}

export function createBuzzerGame({ send }) {
  const clients = new Map();
  let hostId = null;
  let groups = emptyGroups();
  let index = 0;
  let phase = 'lobby';
  let buzzedGroup = null;
  let eliminated = new Set();
  let round = 0;
  let armedAt = 0;
  let endsAt = 0;
  let pausedRemaining = 0;
  let lastOpenKey = '';

  function sendTo(client, payload) {
    if (client?.ws) send(client.ws, payload);
  }

  function questionFor(role) {
    const current = hostExamQuestions[index];
    if (!current || phase === 'lobby' || phase === 'done') return null;
    if (role === 'host') {
      return {
        id: current.id,
        question: current.question,
        options: current.options,
        answer: phase === 'revealed' ? current.answer : undefined,
        explanation: phase === 'revealed' ? current.explanation : undefined,
      };
    }
    return null;
  }

  function assignHandicaps() {
    const alive = connectedGroups(groups).filter(group => !eliminated.has(group.id));
    const minScore = alive.length ? Math.min(...alive.map(group => group.score)) : 0;
    const now = Date.now();
    armedAt = now;
    for (const group of groups.values()) {
      if (!group.connected || eliminated.has(group.id)) {
        group.buzzOpensAt = 0;
        continue;
      }
      const delay = Math.min(2000, ((group.score - minScore) / BUZZER_POINTS) * BUZZER_HANDICAP_MS);
      group.buzzOpensAt = now + delay;
    }
  }

  function groupStatus(id) {
    const group = groups.get(id);
    if (!group.connected) return 'empty';
    if (phase === 'done') return 'done';
    if (phase === 'lobby') return 'ready';
    if (eliminated.has(id)) return 'out';
    if (buzzedGroup === id) return phase === 'revealed' ? 'answered' : 'buzzed';
    if (phase === 'locked' || phase === 'revealed') return 'waiting';
    if (phase === 'armed') return Date.now() < group.buzzOpensAt ? 'queued' : 'armed';
    return 'ready';
  }

  function snapshot(viewer) {
    const now = Date.now();
    const groupList = GROUP_IDS.map(id => {
      const group = groups.get(id);
      return {
        id, name: group.name, score: group.score, connected: group.connected,
        status: groupStatus(id), buzzOpensAt: group.buzzOpensAt || 0,
      };
    });
    const current = hostExamQuestions[index];
    const opensAt = viewer.role === 'group' ? groups.get(viewer.groupId)?.buzzOpensAt || 0 : 0;
    const open = viewer.role === 'group' && phase === 'armed' && !eliminated.has(viewer.groupId) && now >= opensAt;
    const remaining = phase === 'locked'
      ? pausedRemaining
      : phase === 'armed' && endsAt ? Math.max(0, endsAt - now) : 0;
    return {
      type: 'buzzer_state',
      serverNow: now,
      role: viewer.role,
      groupId: viewer.groupId || null,
      name: viewer.name,
      phase, index, round,
      total: hostExamQuestions.length,
      buzzedGroup, armedAt, endsAt,
      timerPaused: phase === 'locked',
      remainingMs: remaining,
      doublePoints: BUZZER_DOUBLE_INDEXES.includes(index) && phase !== 'lobby' && phase !== 'done',
      points: questionPoints(index),
      canBuzz: open,
      youBuzzed: viewer.role === 'group' && buzzedGroup === viewer.groupId,
      buzzOpensAt: opensAt,
      score: viewer.role === 'group' ? groups.get(viewer.groupId)?.score || 0 : null,
      question: questionFor(viewer.role),
      correctLetter: phase === 'revealed' && current ? String.fromCharCode(65 + current.answer) : null,
      groups: groupList,
    };
  }

  function broadcast() {
    for (const client of clients.values()) {
      if (client.connected) sendTo(client, snapshot(client));
    }
  }

  function error(ws, message) {
    send(ws, { type: 'error', message });
  }

  function resetQuestionLocks() {
    buzzedGroup = null;
    eliminated = new Set();
  }

  function armQuestion() {
    if (index >= hostExamQuestions.length) {
      phase = 'done';
      resetQuestionLocks();
      return;
    }
    phase = 'armed';
    resetQuestionLocks();
    pausedRemaining = 0;
    lastOpenKey = '';
    endsAt = Date.now() + BUZZER_SECONDS * 1000;
    assignHandicaps();
  }

  function handleHello(ws, message) {
    const role = message.role === 'host' ? 'host' : 'group';
    const token = typeof message.token === 'string' && VALID_TOKEN.test(message.token) ? message.token : null;
    const id = token || `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const requestedName = typeof message.name === 'string' ? message.name.trim().slice(0, 24) : '';

    if (role === 'host') {
      const otherHost = hostId && hostId !== id && clients.get(hostId)?.connected;
      if (otherHost) { error(ws, 'Đã có màn hình lớn đang mở.'); return; }
      let client = clients.get(id);
      if (client?.ws && client.ws !== ws) client.ws.close(4000, 'Phiên đã mở trên thiết bị khác');
      client = { id, role: 'host', groupId: null, name: requestedName || 'Giảng viên', ws, connected: true };
      clients.set(id, client);
      hostId = id;
      ws.buzzerId = id;
      sendTo(client, { type: 'buzzer_welcome', id, role: 'host', name: client.name });
      broadcast();
      return;
    }

    const groupId = Number(message.groupId);
    if (!GROUP_IDS.includes(groupId)) { error(ws, 'Chọn nhóm từ 1 đến 5.'); return; }
    const occupant = [...clients.values()].find(item => item.role === 'group' && item.groupId === groupId && item.connected && item.id !== id);
    if (occupant) { error(ws, `Nhóm ${groupId} đã có người vào.`); return; }
    let client = clients.get(id);
    if (client?.ws && client.ws !== ws) client.ws.close(4000, 'Phiên đã mở trên thiết bị khác');
    const group = groups.get(groupId);
    const name = requestedName || `Nhóm ${groupId}`;
    client = { id, role: 'group', groupId, name, ws, connected: true };
    clients.set(id, client);
    group.clientId = id;
    group.connected = true;
    group.name = name;
    ws.buzzerId = id;
    sendTo(client, { type: 'buzzer_welcome', id, role: 'group', groupId, name });
    broadcast();
  }

  function requireHost(ws) {
    const client = clients.get(ws.buzzerId);
    if (!client || client.role !== 'host' || !client.connected) {
      error(ws, 'Chỉ màn hình lớn mới điều khiển được trò chơi.');
      return null;
    }
    return client;
  }

  function handle(ws, message) {
    if (message.type === 'hello' || message.type === 'buzzer_hello') {
      handleHello(ws, message);
      return;
    }
    const client = clients.get(ws.buzzerId);
    if (!client || client.ws !== ws) return;

    if (message.type === 'buzz') {
      if (client.role !== 'group') return;
      if (phase !== 'armed') return;
      if (eliminated.has(client.groupId)) return;
      const opensAt = groups.get(client.groupId)?.buzzOpensAt || 0;
      if (Date.now() < opensAt) return;
      if (endsAt && Date.now() >= endsAt) return;
      pausedRemaining = Math.max(0, (endsAt || Date.now()) - Date.now());
      phase = 'locked';
      buzzedGroup = client.groupId;
      round++;
      broadcast();
      return;
    }

    if (!requireHost(ws)) return;

    if (message.type === 'start') {
      if (phase !== 'lobby' && phase !== 'done') return;
      index = 0;
      for (const group of groups.values()) group.score = 0;
      armQuestion();
      broadcast();
    } else if (message.type === 'next') {
      if (phase !== 'revealed' && phase !== 'locked' && phase !== 'armed') return;
      index += 1;
      if (index >= hostExamQuestions.length) {
        phase = 'done';
        resetQuestionLocks();
      } else armQuestion();
      broadcast();
    } else if (message.type === 'correct') {
      if (phase !== 'locked' || buzzedGroup == null) return;
      const group = groups.get(buzzedGroup);
      group.score += questionPoints(index);
      phase = 'revealed';
      broadcast();
    } else if (message.type === 'wrong') {
      if (phase !== 'locked' || buzzedGroup == null) return;
      eliminated.add(buzzedGroup);
      const remaining = GROUP_IDS.filter(id => groups.get(id).connected && !eliminated.has(id));
      if (remaining.length && pausedRemaining > 0) {
        buzzedGroup = null;
        phase = 'armed';
        lastOpenKey = '';
        endsAt = Date.now() + pausedRemaining;
        pausedRemaining = 0;
        assignHandicaps();
      } else {
        pausedRemaining = 0;
        phase = 'revealed';
      }
      broadcast();
    } else if (message.type === 'reveal') {
      if (phase === 'lobby' || phase === 'done') return;
      pausedRemaining = 0;
      phase = 'revealed';
      broadcast();
    } else if (message.type === 'reset') {
      index = 0;
      phase = 'lobby';
      endsAt = 0;
      pausedRemaining = 0;
      lastOpenKey = '';
      resetQuestionLocks();
      for (const group of groups.values()) group.score = 0;
      broadcast();
    }
  }

  function onClose(ws) {
    const client = clients.get(ws.buzzerId);
    if (!client || client.ws !== ws) return;
    client.connected = false;
    client.ws = null;
    if (hostId === client.id) hostId = null;
    if (client.role === 'group') {
      const group = groups.get(client.groupId);
      if (group?.clientId === client.id) group.connected = false;
    }
    broadcast();
    setTimeout(() => {
      if (!client.connected) {
        if (client.role === 'group') {
          const group = groups.get(client.groupId);
          if (group?.clientId === client.id) {
            group.clientId = null;
            group.name = `Nhóm ${client.groupId}`;
          }
        }
        clients.delete(client.id);
        broadcast();
      }
    }, 10_000).unref?.();
  }

  const clock = setInterval(() => {
    if (phase === 'armed' && endsAt && Date.now() >= endsAt) {
      phase = 'revealed';
      buzzedGroup = null;
      pausedRemaining = 0;
      broadcast();
      return;
    }
    if (phase === 'armed') {
      const key = GROUP_IDS.filter(id => {
        const group = groups.get(id);
        return group.connected && !eliminated.has(id) && Date.now() >= (group.buzzOpensAt || 0);
      }).join(',');
      if (key !== lastOpenKey) {
        lastOpenKey = key;
        broadcast();
      }
    }
  }, 150);
  clock.unref?.();

  function stop() { clearInterval(clock); }

  return { handle, onClose, stop };
}
