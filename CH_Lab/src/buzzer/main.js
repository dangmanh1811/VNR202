import './style.css';
import { BUZZER_GROUP_COUNT } from '../classroom-config.js';
import { createBuzzerClient } from './client.js';
import { ringBell, startMusic, startClock, stopClock, setMuted, isMuted } from './bell.js';

const params = new URLSearchParams(location.search);
const presetHost = params.has('host');
const presetGroup = Number(params.get('nhom'));
const groupIds = Array.from({ length: BUZZER_GROUP_COUNT }, (_, index) => index + 1);

const app = document.querySelector('#app');
app.innerHTML = `
  <section id="gate" class="gate">
    <article class="gate-card">
      <p class="eyebrow">VNR202 · DI CƯ 1954</p>
      <h1>Rung chuông vàng</h1>
      <p>Chọn nhóm để rung chuông. Máy chiếu dùng màn hình lớn.</p>
      <div class="gate-actions">
        <input id="team-name" maxlength="24" placeholder="Tên nhóm (tuỳ chọn)" />
        <input id="host-name" maxlength="24" placeholder="Tên giảng viên" value="Giảng viên" />
      </div>
      <div class="gate-groups" id="group-buttons"></div>
      <button class="host-enter" id="host-enter" type="button">Mở màn hình lớn</button>
    </article>
  </section>
  <main id="board" class="board hidden">
    <header class="board-top">
      <p class="brand">Mini game di cư 1954<b>Rung chuông vàng</b></p>
      <div class="meta">
        <div class="clock hidden" id="clock"><b id="clock-num">1:00</b><small>phút</small></div>
        <div>
          <div id="board-progress">Câu 0 / 15</div>
          <small id="board-status">Chờ nhóm vào</small>
        </div>
        <button class="mute" id="mute" type="button">Tắt tiếng</button>
      </div>
    </header>
    <section class="question-card" id="question-card" aria-live="polite">
      <p class="kicker" id="question-kicker">MÀN HÌNH LỚN</p>
      <p id="double-badge" class="double-badge hidden">x2 ĐIỂM</p>
      <h2 id="question-text">Chờ giảng viên mở câu hỏi</h2>
      <div id="options" class="options"></div>
      <p id="explain" class="explain hidden"></p>
      <p id="idle-copy" class="idle-copy">Mời 5 nhóm vào chỗ bên dưới, rồi bấm Bắt đầu.</p>
    </section>
    <div class="controls" id="host-controls">
      <button id="start" type="button">Bắt đầu</button>
      <button id="correct" class="good hidden" type="button">Đúng</button>
      <button id="wrong" class="bad hidden" type="button">Sai</button>
      <button id="reveal" class="ghost hidden" type="button">Hiện đáp án</button>
      <button id="next" class="hidden" type="button">Câu tiếp theo</button>
      <button id="reset" class="ghost" type="button">Chơi lại</button>
    </div>
    <section class="slots" id="slots"></section>
  </main>
  <main id="pad" class="pad hidden">
    <header class="pad-top">
      <p class="brand">Nhóm trả lời<b id="pad-name">Nhóm</b></p>
      <div class="meta"><div id="pad-score">0 điểm</div><small id="pad-progress">Chờ câu hỏi</small></div>
    </header>
    <button id="buzz" class="buzz" type="button" disabled>Rung chuông</button>
    <p id="pad-note" class="pad-note">Chờ giảng viên mở câu</p>
  </main>
`;

document.querySelector('#group-buttons').innerHTML = groupIds.map(id =>
  `<button type="button" data-group="${id}">Nhóm ${id}</button>`
).join('');

const letters = ['A', 'B', 'C', 'D'];
const statusLabel = {
  empty: 'Trống', ready: 'Đã vào', armed: 'Sẵn sàng', queued: 'Chuông chậm hơn',
  buzzed: 'Được trả lời', waiting: 'Chờ', out: 'Sai lượt này', answered: 'Đúng', done: 'Hết giờ',
};
const phaseLabel = {
  lobby: 'Chờ nhóm vào', armed: 'Đang mở chuông', locked: 'Tạm dừng · đang trả lời',
  revealed: 'Đã chốt đáp án', done: 'Hết 15 câu',
};

let state = null;
let role = null;
let lastBuzzRound = 0;
let clockSkew = 0;
let musicStarted = false;
const client = createBuzzerClient(handleMessage, updateStatus);

function show(id) {
  ['gate', 'board', 'pad'].forEach(key => {
    document.querySelector(`#${key}`).classList.toggle('hidden', key !== id);
  });
}

function now() {
  return Date.now() + clockSkew;
}

function remainingMs(next = state) {
  if (!next) return 0;
  if (next.timerPaused || next.phase === 'locked') return Math.max(0, next.remainingMs || 0);
  if (next.phase !== 'armed' || !next.endsAt) return 0;
  return Math.max(0, next.endsAt - now());
}

function waitMs(next = state) {
  if (!next || next.role !== 'group' || next.phase !== 'armed') return 0;
  const own = next.groups?.find(group => group.id === next.groupId);
  if (own?.status === 'out') return 0;
  return Math.max(0, (next.buzzOpensAt || 0) - now());
}

function liveCanBuzz(next = state) {
  if (!next || next.role !== 'group' || next.phase !== 'armed') return false;
  const own = next.groups?.find(group => group.id === next.groupId);
  if (own?.status === 'out') return false;
  return now() >= (next.buzzOpensAt || 0);
}

function liveStatus(group) {
  if (state?.phase === 'armed' && (group.status === 'queued' || group.status === 'armed') && now() >= (group.buzzOpensAt || 0)) {
    return 'armed';
  }
  return group.status;
}

function syncMuteButton() {
  const mute = document.querySelector('#mute');
  mute.textContent = isMuted() ? 'Bật tiếng' : 'Tắt tiếng';
  mute.classList.toggle('is-off', isMuted());
}

function ensureMusic() {
  if (role !== 'host' || musicStarted) return;
  startMusic();
  musicStarted = true;
}

function updateStatus(status) {
  const note = document.querySelector('#pad-note');
  const boardStatus = document.querySelector('#board-status');
  if (status === 'offline') {
    note.classList.add('offline');
    note.textContent = 'Mất kết nối, đang vào lại…';
    if (boardStatus) boardStatus.textContent = 'Mất kết nối';
  } else note.classList.remove('offline');
}

function renderHost(next) {
  const question = next.question;
  const doubled = Boolean(next.doublePoints);
  document.querySelector('#question-card').classList.toggle('is-double', doubled);
  document.querySelector('#double-badge').classList.toggle('hidden', !doubled);
  document.querySelector('#board-progress').textContent = next.phase === 'lobby'
    ? 'Chưa bắt đầu' : next.phase === 'done' ? 'Đã hết câu'
      : `Câu ${next.index + 1} / ${next.total}${doubled ? ' · x2' : ''}`;
  document.querySelector('#board-status').textContent = phaseLabel[next.phase];
  document.querySelector('#question-kicker').textContent = next.phase === 'locked' && next.buzzedGroup
    ? `NHÓM ${next.buzzedGroup} ĐƯỢC TRẢ LỜI` : doubled
      ? 'CÂU NHÂN ĐÔI ĐIỂM' : 'CÂU HỎI TRÊN MÀN HÌNH LỚN';
  document.querySelector('#idle-copy').classList.toggle('hidden', Boolean(question) || next.phase === 'done');
  document.querySelector('#question-text').textContent = question?.question
    || (next.phase === 'done' ? 'Hết 15 câu. Xem điểm các nhóm bên dưới.' : 'Chờ giảng viên mở câu hỏi');
  const options = document.querySelector('#options');
  options.replaceChildren(...(question?.options || []).map((text, index) => {
    const row = document.createElement('div');
    row.className = `option${question.answer === index ? ' is-correct' : ''}`;
    row.innerHTML = `<b>${letters[index]}</b><span></span>`;
    row.querySelector('span').textContent = text;
    return row;
  }));
  const explain = document.querySelector('#explain');
  explain.textContent = question?.explanation || '';
  explain.classList.toggle('hidden', !question?.explanation);
  document.querySelector('#start').classList.toggle('hidden', next.phase !== 'lobby' && next.phase !== 'done');
  document.querySelector('#correct').classList.toggle('hidden', next.phase !== 'locked');
  document.querySelector('#wrong').classList.toggle('hidden', next.phase !== 'locked');
  document.querySelector('#reveal').classList.toggle('hidden', next.phase === 'lobby' || next.phase === 'done' || next.phase === 'revealed');
  document.querySelector('#next').classList.toggle('hidden', next.phase !== 'revealed');
  document.querySelector('#next').textContent = next.index + 1 >= next.total ? 'Xem kết quả' : 'Câu tiếp theo';
  document.querySelector('#reset').classList.toggle('hidden', next.phase === 'lobby');
  document.querySelector('#slots').replaceChildren(...next.groups.map(group => {
    const status = liveStatus(group);
    const slot = document.createElement('article');
    slot.className = `slot${group.connected ? ' connected' : ''} is-${status}`;
    slot.innerHTML = `<h3></h3><p class="score"></p><p class="status"></p>`;
    slot.querySelector('h3').textContent = group.name;
    slot.querySelector('.score').textContent = `${group.score} điểm`;
    const delay = status === 'queued' ? Math.max(0, group.buzzOpensAt - now()) : 0;
    slot.querySelector('.status').textContent = delay > 80
      ? `Chuông sau ${(delay / 1000).toFixed(1)}s` : (statusLabel[status] || status);
    return slot;
  }));
  refreshClock();
}

function renderPad(next) {
  document.querySelector('#pad-name').textContent = next.name || `Nhóm ${next.groupId}`;
  document.querySelector('#pad-score').textContent = `${next.score} điểm`;
  document.querySelector('#pad-progress').textContent = next.phase === 'lobby'
    ? 'Chờ bắt đầu' : next.phase === 'done' ? 'Hết câu'
      : `Câu ${next.index + 1} / ${next.total}${next.doublePoints ? ' · x2' : ''}`;
  const open = liveCanBuzz(next);
  const buzz = document.querySelector('#buzz');
  buzz.disabled = !open;
  buzz.classList.toggle('is-winner', next.youBuzzed);
  buzz.textContent = next.youBuzzed ? 'Được trả lời' : open ? 'Rung chuông' : 'Chờ';
  const note = document.querySelector('#pad-note');
  const own = next.groups?.find(group => group.id === next.groupId);
  const wait = waitMs(next);
  if (next.youBuzzed && next.phase === 'locked') note.textContent = 'Nhóm mình rung trước! Hãy trả lời trên màn hình lớn.';
  else if (next.phase === 'armed' && open) note.textContent = next.doublePoints
    ? 'Câu này nhân đôi điểm. Rung chuông nếu nhóm biết đáp án.'
    : 'Giảng viên đã mở câu. Rung chuông nếu nhóm biết đáp án.';
  else if (next.phase === 'armed' && own?.status === 'out') note.textContent = 'Nhóm đã trả lời sai câu này. Chờ nhóm khác hoặc câu mới.';
  else if (next.phase === 'armed' && wait > 80) note.textContent = `Đội đang dẫn điểm, chuông mở chậm hơn một chút. Còn ${(wait / 1000).toFixed(1)}s.`;
  else if (next.phase === 'armed') note.textContent = 'Chuông đã mở.';
  else if (next.phase === 'locked') note.textContent = `Nhóm ${next.buzzedGroup} đang trả lời.`;
  else if (next.phase === 'revealed') note.textContent = next.correctLetter ? `Đáp án: ${next.correctLetter}` : 'Đã chốt câu này.';
  else if (next.phase === 'done') note.textContent = 'Hết 15 câu.';
  else note.textContent = 'Chờ giảng viên mở câu.';
}

function refreshClock() {
  const clock = document.querySelector('#clock');
  if (!state || role !== 'host') {
    clock?.classList.add('hidden');
    return;
  }
  const ms = remainingMs();
  const seconds = Math.ceil(ms / 1000);
  const live = state.phase === 'armed' || state.phase === 'locked';
  clock.classList.toggle('hidden', !live);
  clock.classList.toggle('urgent', live && seconds <= 15);
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  document.querySelector('#clock-num').textContent = `${minutes}:${rest}`;
  const label = clock.querySelector('small');
  if (label) label.textContent = seconds >= 60 ? 'phút' : 'giây';
  if (state.phase === 'armed' || state.phase === 'locked') renderLiveLabels();
}

function renderLiveLabels() {
  if (!state) return;
  if (role === 'host') {
    document.querySelectorAll('#slots .slot').forEach((slot, index) => {
      const group = state.groups[index];
      if (!group) return;
      const status = liveStatus(group);
      const delay = status === 'queued' ? Math.max(0, group.buzzOpensAt - now()) : 0;
      slot.classList.remove('is-queued', 'is-armed');
      if (status === 'queued' || status === 'armed') slot.classList.add(`is-${status}`);
      const label = slot.querySelector('.status');
      if (label) {
        label.textContent = delay > 80
          ? `Chuông sau ${(delay / 1000).toFixed(1)}s` : (statusLabel[status] || status);
      }
    });
  } else if (state.phase === 'armed') {
    const own = state.groups?.find(group => group.id === state.groupId);
    if (own?.status !== 'out') renderPad(state);
  }
}

function handleMessage(message) {
  if (message.type === 'error') {
    const note = document.querySelector('#pad-note');
    if (!document.querySelector('#pad').classList.contains('hidden')) note.textContent = message.message;
    else alert(message.message);
    return;
  }
  if (message.type === 'buzzer_welcome') role = message.role;
  if (message.type !== 'buzzer_state') return;
  const previous = state;
  if (typeof message.serverNow === 'number') clockSkew = message.serverNow - Date.now();
  state = message;
  if (message.role === 'host') {
    show('board');
    renderHost(message);
    if (message.phase === 'armed') {
      ensureMusic();
      startClock(() => remainingMs());
    } else stopClock();
  } else {
    show('pad');
    renderPad(message);
    stopClock();
  }
  if (message.phase === 'locked' && message.round !== lastBuzzRound && message.buzzedGroup) {
    lastBuzzRound = message.round;
    if (previous && previous.phase === 'armed') ringBell();
  }
}

function join(nextRole, groupId = null) {
  const teamName = document.querySelector('#team-name').value.trim();
  const hostName = document.querySelector('#host-name').value.trim();
  role = nextRole;
  client.connect({
    role: nextRole,
    groupId,
    name: nextRole === 'host' ? (hostName || 'Giảng viên') : teamName,
  });
}

document.querySelector('#host-enter').addEventListener('click', () => join('host'));
document.querySelector('#group-buttons').addEventListener('click', event => {
  const groupId = Number(event.target.dataset.group);
  if (groupId) join('group', groupId);
});
document.querySelector('#start').addEventListener('click', () => {
  client.send({ type: 'start' });
  try { ensureMusic(); } catch { /* autoplay may be blocked */ }
});
document.querySelector('#correct').addEventListener('click', () => client.send({ type: 'correct' }));
document.querySelector('#wrong').addEventListener('click', () => client.send({ type: 'wrong' }));
document.querySelector('#reveal').addEventListener('click', () => client.send({ type: 'reveal' }));
document.querySelector('#next').addEventListener('click', () => client.send({ type: 'next' }));
document.querySelector('#reset').addEventListener('click', () => client.send({ type: 'reset' }));
document.querySelector('#mute').addEventListener('click', () => {
  setMuted(!isMuted());
  if (!isMuted()) ensureMusic();
  syncMuteButton();
});
document.querySelector('#buzz').addEventListener('pointerdown', event => {
  event.preventDefault();
  if (!document.querySelector('#buzz').disabled) client.send({ type: 'buzz' });
});

window.addEventListener('keydown', event => {
  if (role !== 'host' || document.querySelector('#board').classList.contains('hidden')) return;
  if (event.key === 'Enter' && (state?.phase === 'lobby' || state?.phase === 'done')) client.send({ type: 'start' });
  if (event.key === 'Enter' && state?.phase === 'revealed') client.send({ type: 'next' });
  if (event.key === 'd' || event.key === 'D') client.send({ type: 'correct' });
  if (event.key === 's' || event.key === 'S') client.send({ type: 'wrong' });
  if (event.key === 'm' || event.key === 'M') {
    setMuted(!isMuted());
    if (!isMuted()) ensureMusic();
    syncMuteButton();
  }
});

window.addEventListener('pagehide', event => { if (!event.persisted) client.stop(); });
window.setInterval(refreshClock, 120);

const savedPlayerName = sessionStorage.getItem('vnr202-player-name') || localStorage.getItem('vnr202-player-name');
if (savedPlayerName) document.querySelector('#team-name').value = savedPlayerName;
if (presetHost) {
  const saved = sessionStorage.getItem('vnr202-host-name');
  if (saved) document.querySelector('#host-name').value = saved;
  join('host');
} else if (groupIds.includes(presetGroup)) {
  join('group', presetGroup);
}
