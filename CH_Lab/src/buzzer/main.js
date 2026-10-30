import './style.css';
import { createBuzzerClient } from './client.js';
import { ringBell, startMusic, setMuted, isMuted } from './audio.js';

const groupIds = [1, 3, 4, 5, 6, 7];
const params = new URLSearchParams(location.search);
const app = document.querySelector('#app');
app.innerHTML = `
  <section id="gate" class="gate">
    <article class="gate-card">
      <p class="eyebrow">VNR202 · DI CƯ BẮC – NAM 1954</p>
      <h1>Rung chuông vàng</h1>
      <p>Chọn nhóm của bạn. Bấm chuông để xếp hàng trả lời trên màn hình lớn.</p>
      <label class="field">Tên đội <span>(không bắt buộc)</span><input id="team-name" maxlength="24" autocomplete="organization" placeholder="Ví dụ: Sao Vàng"></label>
      <div class="gate-groups" id="group-buttons" aria-label="Chọn nhóm tham gia"></div>
      <p class="gate-note">6 nhóm thi · Mỗi câu đúng 1 điểm<br>Nhóm 2 dẫn chương trình</p>
      <details id="host-login"><summary>Mở màn hình người dẫn</summary>
        <form id="host-form">
          <label class="field">Mã người dẫn<input id="host-key" type="password" autocomplete="off" placeholder="Nhập mã riêng của nhóm 2" required></label>
          <button class="host-enter" type="submit">Vào màn hình lớn →</button>
        </form>
      </details>
      <p id="gate-error" class="error hidden" role="alert"></p>
      <p id="gate-status" role="status"></p>
    </article>
  </section>
  <main id="board" class="board hidden">
    <header class="board-top">
      <p class="brand">VNR202 · Di cư 1954<b>Rung chuông vàng</b></p>
      <div class="meta"><div><strong id="board-progress">Chưa bắt đầu</strong><small id="board-status">Chờ nhóm vào</small></div>
        <button class="mute" id="mute" type="button">Tắt tiếng</button></div>
    </header>
    <div class="play-area">
      <section class="question-card" aria-live="polite">
        <p class="kicker" id="question-kicker">SẴN SÀNG VÀO CUỘC</p>
        <h2 id="question-text">Chờ người dẫn mở câu hỏi</h2>
        <div id="options" class="options"></div>
        <p id="explain" class="explain hidden"></p>
        <p id="idle-copy" class="idle-copy">Mời các nhóm vào chỗ.<br>Người dẫn bấm Bắt đầu khi sẵn sàng.</p>
      </section>
      <aside class="queue-panel" aria-label="Thứ tự bấm chuông">
        <div class="queue-heading"><h2>✋ Hàng chờ</h2><span id="queue-count">0 / 6</span></div>
        <p class="queue-hint">Bấm trước ở trên · Các nhóm vẫn được bấm tiếp</p>
        <ol id="queue-list" class="queue-list" aria-live="polite" aria-relevant="additions text"></ol>
        <p id="queue-empty" class="queue-empty">Chưa có nhóm bấm chuông</p>
        <p id="attempted" class="attempted"></p>
      </aside>
    </div>
    <section class="controls" aria-label="Điều khiển trò chơi">
      <button data-action="start" id="start" type="button">Bắt đầu</button>
      <button data-action="correct" id="correct" class="good hidden" type="button">Đúng · +1 điểm</button>
      <button data-action="wrong" id="wrong" class="bad hidden" type="button">Sai · Mời nhóm tiếp</button>
      <button data-action="reveal" id="reveal" class="ghost hidden" type="button">Hiện đáp án</button>
      <button data-action="next" id="next" class="hidden" type="button">Câu tiếp theo →</button>
      <button data-action="reset" id="reset" class="ghost hidden" type="button">Chơi lại</button>
    </section>
    <p id="board-error" class="error hidden" role="alert"></p>
    <section class="slots" id="slots" aria-label="Điểm các nhóm"></section>
  </main>
  <main id="pad" class="pad hidden">
    <header class="pad-top"><p class="brand">Đội của bạn<b id="pad-name">Nhóm</b></p>
      <div class="meta"><div><strong id="pad-score">0 điểm</strong><small id="pad-progress">Chờ bắt đầu</small></div></div></header>
    <div class="pad-center"><p id="pad-position" class="pad-position"></p>
      <button id="buzz" class="buzz" type="button" disabled>Rung chuông</button></div>
    <div><p id="pad-note" class="pad-note" role="status" aria-live="polite">Chờ người dẫn mở câu</p>
      <p id="pad-error" class="error hidden" role="alert"></p><p id="pad-connection" class="connection"></p></div>
  </main>
`;

const $ = id => document.getElementById(id);
let state = null;
let busy = false;
let online = false;
let musicStarted = false;
const client = createBuzzerClient(receive, connection, showError);

for (const id of groupIds) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `Nhóm ${id}`;
  button.dataset.group = id;
  $('group-buttons').append(button);
}

function show(id) {
  for (const key of ['gate', 'board', 'pad']) $(key).classList.toggle('hidden', key !== id);
}

function showError(message, expired = false) {
  if (expired) { state = null; show('gate'); }
  const target = !state ? $('gate-error') : state.role === 'host' ? $('board-error') : $('pad-error');
  target.textContent = message;
  target.classList.remove('hidden');
}

function connection(status) {
  online = status === 'online';
  const text = online ? 'Đã kết nối' : status === 'connecting' ? 'Đang kết nối…' : 'Mất kết nối · Đang thử lại…';
  $('pad-connection').textContent = text;
  $('pad-connection').classList.toggle('offline', !online);
  $('gate-status').textContent = state ? '' : text;
  updateButtons();
  if (state?.role === 'host' && !online) $('board-status').textContent = text;
}

function updateButtons() {
  $('buzz').disabled = busy || !online || !state?.canBuzz;
  document.querySelectorAll('[data-action]').forEach(button => { button.disabled = busy || !online; });
  document.querySelectorAll('#group-buttons button, #host-form button').forEach(button => { button.disabled = busy; });
}

function nameFor(id) {
  return state.groups.find(group => group.id === id)?.name || `Nhóm ${id}`;
}

function renderQueue() {
  $('queue-count').textContent = `${state.queue.length} / 6`;
  $('queue-empty').classList.toggle('hidden', state.queue.length > 0);
  $('queue-empty').textContent = state.phase === 'open' ? 'Chưa có lượt chờ. Các nhóm chưa trả lời vẫn được bấm.' : 'Chưa có nhóm bấm chuông';
  $('queue-list').replaceChildren(...state.queue.map((id, index) => {
    const row = document.createElement('li');
    row.className = `queue-item${state.activeGroup === id ? ' is-active' : ''}`;
    const rank = document.createElement('span'); rank.className = 'queue-rank'; rank.textContent = index + 1;
    const copy = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = nameFor(id);
    const note = document.createElement('small');
    note.textContent = state.phase === 'revealed' ? (state.correctGroup === id ? 'Đúng · +1 điểm' : 'Câu đã chốt')
      : index === 0 ? 'ĐANG TRẢ LỜI' : `Chờ lượt ${index + 1}`;
    copy.append(name, note); row.append(rank, copy);
    return row;
  }));
  $('attempted').textContent = state.attempted.length ? `Đã trả lời sai: ${state.attempted.map(nameFor).join(', ')}` : '';
}

function renderHost() {
  const question = state.question;
  $('board-progress').textContent = state.phase === 'lobby' ? 'Chưa bắt đầu'
    : state.phase === 'done' ? 'Đã hoàn thành' : `Câu ${state.index + 1} / ${state.total}`;
  $('board-status').textContent = { lobby: 'Chờ các nhóm vào', open: 'Chuông đang mở', revealed: 'Đã chốt câu', done: 'Kết thúc trò chơi' }[state.phase];
  $('question-kicker').textContent = state.activeGroup ? `${nameFor(state.activeGroup)} ĐƯỢC TRẢ LỜI`
    : state.phase === 'done' ? 'KẾT QUẢ CHUNG CUỘC' : 'MỖI CÂU ĐÚNG · 1 ĐIỂM';
  $('question-text').textContent = question?.question || (state.phase === 'done' ? `Hoàn thành ${state.total} câu hỏi!` : 'Chờ người dẫn mở câu hỏi');
  $('idle-copy').classList.toggle('hidden', state.phase !== 'lobby');
  $('options').replaceChildren(...(question?.options || []).map((text, index) => {
    const row = document.createElement('div'); row.className = `option${question.answer === index ? ' is-correct' : ''}`;
    const label = document.createElement('b'); label.textContent = String.fromCharCode(65 + index);
    const copy = document.createElement('span'); copy.textContent = text;
    row.append(label, copy); return row;
  }));
  $('explain').textContent = question?.explanation || '';
  $('explain').classList.toggle('hidden', !question?.explanation);
  $('start').classList.toggle('hidden', !['lobby', 'done'].includes(state.phase));
  for (const id of ['correct', 'wrong']) $(id).classList.toggle('hidden', !state.activeGroup);
  $('reveal').classList.toggle('hidden', state.phase !== 'open');
  $('next').classList.toggle('hidden', state.phase !== 'revealed');
  $('next').textContent = state.index + 1 >= state.total ? 'Xem kết quả →' : 'Câu tiếp theo →';
  $('reset').classList.toggle('hidden', state.phase === 'lobby');
  $('slots').replaceChildren(...state.groups.map(group => {
    const slot = document.createElement('article');
    slot.className = `slot${group.connected ? ' connected' : ''}${state.activeGroup === group.id ? ' is-buzzed' : ''}${state.attempted.includes(group.id) ? ' is-out' : ''}`;
    const title = document.createElement('h3'); title.textContent = group.name;
    const score = document.createElement('p'); score.className = 'score'; score.textContent = `${group.score} điểm`;
    const status = document.createElement('p'); status.className = 'status';
    status.textContent = state.attempted.includes(group.id) ? 'Sai câu này' : group.connected ? 'Đã kết nối' : 'Chưa kết nối';
    slot.append(title, score, status); return slot;
  }));
  renderQueue();
}

function renderPad() {
  const own = state.groups.find(group => group.id === state.groupId);
  $('pad-name').textContent = state.name;
  $('pad-score').textContent = `${own.score} điểm`;
  $('pad-progress').textContent = state.phase === 'lobby' ? 'Chờ bắt đầu'
    : state.phase === 'done' ? 'Đã hoàn thành' : `Câu ${state.index + 1} / ${state.total}`;
  const active = state.activeGroup === state.groupId;
  $('buzz').classList.toggle('is-winner', active);
  $('buzz').textContent = active ? 'Được trả lời' : state.position && state.phase === 'open' ? 'Đã xếp hàng' : 'Rung chuông';
  $('pad-position').textContent = state.phase === 'open' && state.position ? `Lượt ${state.position} trong hàng chờ` : '';
  $('pad-note').textContent = state.phase === 'lobby' ? 'Chờ người dẫn bắt đầu.'
    : state.phase === 'done' ? 'Cảm ơn nhóm đã tham gia! Xem kết quả trên màn hình lớn.'
    : state.phase === 'revealed' ? (state.correctGroup === state.groupId ? 'Chính xác! Nhóm được cộng 1 điểm.' : `Đáp án: ${state.correctLetter}. Chờ câu tiếp theo.`)
    : active ? 'Đến lượt nhóm mình! Hãy trả lời người dẫn.'
    : state.attempted.includes(state.groupId) ? 'Nhóm đã trả lời sai câu này. Chờ câu tiếp theo.'
    : state.position ? `Đã ghi nhận lượt bấm. Có ${state.position - 1} nhóm ở trước.`
    : 'Biết đáp án? Bấm chuông để vào hàng chờ!';
}

function receive(next) {
  const previous = state;
  state = next;
  show(next.role === 'host' ? 'board' : 'pad');
  if (next.role === 'host') {
    renderHost();
    if (previous && next.phase === 'open' && next.activeGroup && (next.round !== previous.round || next.activeGroup !== previous.activeGroup)) ringBell();
  } else renderPad();
  updateButtons();
}

async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('.error').forEach(element => element.classList.add('hidden'));
  updateButtons();
  try { await action(); } catch (error) { showError(error.message); }
  finally { busy = false; updateButtons(); }
}

$('group-buttons').addEventListener('click', event => {
  const groupId = Number(event.target.closest('[data-group]')?.dataset.group);
  if (groupIds.includes(groupId)) run(() => client.connect({ role: 'group', groupId, name: $('team-name').value.trim() }));
});
$('host-form').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    await client.connect({ role: 'host', hostKey: $('host-key').value.trim() });
    $('host-key').value = '';
  });
});

async function command(action) {
  if (!state || !online || busy) return;
  if (action === 'reset' && !confirm('Chơi lại từ đầu và xóa điểm của cả 6 nhóm?')) return;
  if (state.role === 'host' && !musicStarted && action === 'start') { startMusic(); musicStarted = true; }
  const { round, activeGroup } = state;
  await run(() => client.send(action, round, activeGroup));
}
for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => command(button.dataset.action));
$('buzz').addEventListener('click', () => { if (state?.canBuzz) command('buzz'); });
$('mute').addEventListener('click', () => {
  setMuted(!isMuted());
  if (!isMuted() && !musicStarted) { startMusic(); musicStarted = true; }
  $('mute').textContent = isMuted() ? 'Bật tiếng' : 'Tắt tiếng';
});
window.addEventListener('keydown', event => {
  if (state?.role !== 'host' || /INPUT|TEXTAREA|BUTTON/.test(event.target.tagName) || event.repeat) return;
  const action = event.key.toLowerCase() === 'd' ? 'correct' : event.key.toLowerCase() === 's' ? 'wrong'
    : event.key === 'Enter' ? (state.phase === 'revealed' ? 'next' : ['lobby', 'done'].includes(state.phase) ? 'start' : null) : null;
  if (action) { event.preventDefault(); command(action); }
});
window.addEventListener('pagehide', event => { if (!event.persisted) client.stop(); });
$('host-login').open = params.has('host');
run(async () => {
  if (await client.resume()) return;
  const groupId = Number(params.get('nhom'));
  if (groupIds.includes(groupId)) await client.connect({ role: 'group', groupId });
});
