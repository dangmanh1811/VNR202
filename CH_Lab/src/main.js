import './style.css';
import './quiz.css';
import './exam.css';
import './profile.css';
import { createClassroom } from './scene.js';
import { artworks } from './presentation-art.js';
import { createQuiz } from './quiz.js';
import { createOnlineClient } from './online.js';
import { AVATAR_OPTIONS, getAvatarOption, isValidAvatarProfile } from './avatar-options.js';
import { COURSE_CODE, EXAM_MINUTES, EXAM_QUESTION_COUNT, TEACHER_NAME } from './classroom-config.js';

const sunIcon = `<svg class="sun-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" fill="#ffd45c"/><path d="M12 1.8v2.1M12 20.1v2.1M1.8 12h2.1M20.1 12h2.1M4.78 4.78l1.49 1.49m11.46 11.46 1.49 1.49m0-14.44-1.49 1.49M6.27 17.73l-1.49 1.49" fill="none" stroke="#e5a929" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const avatarOptionsMarkup = AVATAR_OPTIONS.map((option, index) => `
  <label class="avatar-option" style="--avatar-accent:${option.accent}">
    <input type="radio" name="profile-avatar" value="${option.id}" data-gender="${option.gender}" ${index === 0 ? 'checked' : ''}>
    <span class="avatar-stage" aria-hidden="true"><span class="avatar-model-preview">${option.name.slice(0, 1)}</span></span>
    <span class="avatar-option-copy"><strong>${option.name}</strong><small>${option.genderLabel} · ${option.description}</small></span>
    <span class="avatar-check">✓</span>
  </label>`).join('');

document.querySelector('#app').innerHTML = `
  <main class="experience">
    <div class="scene-shell">
      <canvas id="classroom" aria-label="Lớp học 3D tương tác về chính sách di cư Bắc – Nam 1954"></canvas>
      <div class="soft-light" aria-hidden="true"></div>
    </div>

    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" role="img" aria-label="Quốc kỳ Việt Nam"><svg viewBox="0 0 48 32" aria-hidden="true" focusable="false"><rect width="48" height="32" fill="#da251d"/><polygon points="24,6.6 26.2,13 32.9,13 27.5,17.1 29.5,23.7 24,19.7 18.5,23.7 20.5,17.1 15.1,13 21.8,13" fill="#ffff00"/></svg></div>
        <div>
          <p class="eyebrow">MINI GAME ${COURSE_CODE}</p>
          <h1>Di cư 1954 <em>Tương tác</em></h1>
        </div>
      </div>
      <div class="top-actions">
        <span class="sunny-pill">${sunIcon}<span>Bắc – Nam sau Giơnevơ</span></span>
        <span id="lan-status" class="lan-status" role="status">Chưa vào lớp</span>
        <span id="online-count" class="lan-status online-count" role="status">0 trực tuyến · 0 đã ngồi · Phòng 1</span>
        <button id="chat-button" class="score-button chat-button" type="button" aria-expanded="false" aria-controls="chat-panel" title="Trò chuyện trong phòng"><span class="chat-icon" aria-hidden="true">●</span><span class="chat-label">Trò chuyện</span><span id="chat-unread" class="chat-unread hidden" aria-label="Tin nhắn chưa đọc"></span></button>
        <button id="leaderboard-button" class="score-button" type="button" aria-expanded="false" aria-controls="leaderboard-panel">Bảng điểm</button>
        <button id="profile-button" class="icon-button" type="button" title="Đổi avatar" aria-label="Đổi avatar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="currentColor"/><path d="M5.5 19c.7-4 3-6 6.5-6s5.8 2 6.5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <button id="reset-view" class="icon-button" type="button" title="Đặt lại góc nhìn" aria-label="Đặt lại góc nhìn">↺</button>
        <button id="help-button" class="icon-button help-button" type="button" title="Hướng dẫn" aria-label="Hướng dẫn">?</button>
      </div>
    </header>

    <div class="online-panels">
      <section id="teacher-controls" class="teacher-controls hidden" aria-label="Điều khiển của giảng viên">
        <span id="teacher-exam-status">Chờ sinh viên ngồi vào ghế</span>
        <button id="copy-class-url" type="button">Sao chép link lớp</button>
        <button id="start-exam" type="button">Mở kiểm tra 15 phút</button>
        <button id="finish-exam" class="hidden" type="button">Kết thúc &amp; chấm bài</button>
        <button id="reset-exam" class="hidden" type="button">Reset bảng xếp hạng</button>
      </section>
      <section id="chat-panel" class="chat-panel hidden" aria-label="Trò chuyện trong phòng">
        <div class="panel-heading"><span>TRÒ CHUYỆN · PHÒNG <b id="chat-room">1</b></span><button id="close-chat" type="button" aria-label="Đóng trò chuyện">×</button></div>
        <div id="chat-messages" class="chat-messages" role="log" aria-live="polite" aria-relevant="additions">
          <p id="chat-empty" class="chat-empty">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!</p>
        </div>
        <form id="chat-form" class="chat-form" autocomplete="off">
          <input id="chat-input" type="text" maxlength="200" placeholder="Nhập tin nhắn…" aria-label="Tin nhắn" enterkeyhint="send">
          <button type="submit" aria-label="Gửi tin nhắn">Gửi</button>
        </form>
        <small>Tin nhắn chỉ lưu trong RAM và sẽ mất khi thoát.</small>
      </section>
      <section id="leaderboard-panel" class="leaderboard-panel hidden" aria-label="Bảng điểm kiểm tra">
        <div class="panel-heading"><span>BẢNG XẾP HẠNG</span><button id="close-leaderboard" type="button" aria-label="Đóng bảng điểm">×</button></div>
        <p id="leaderboard-summary">Chưa có bài kiểm tra.</p>
        <ol id="leaderboard-list"></ol>
        <p class="leaderboard-rule">Xếp theo số câu đúng, sau đó theo thời gian nộp nhanh hơn.</p>
      </section>
    </div>

    <div id="seat-status" class="seat-status hidden" role="status"></div>
    <div id="online-toast" class="online-toast hidden" role="status" aria-live="polite"></div>

    <div id="profile-modal" class="profile-modal" aria-hidden="false">
      <div class="profile-backdrop"></div>
      <article class="profile-card" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div class="profile-copy">
          <p class="section-label">THẺ VÀO LỚP ${COURSE_CODE}</p>
          <h2 id="profile-title">Bước vào lớp học 3D</h2>
          <p>Đặt tên, chọn nhân vật rồi đi trong lớp. Khi sẵn sàng chơi, tới ghế và bấm <strong>Ngồi xuống</strong> để chọn nhóm Rung chuông vàng.</p>
          <div class="profile-note"><span>✦</span><span>Máy chiếu dùng link host riêng. Người chơi dùng link này, dạo lớp, rồi ngồi ghế để vào chọn nhóm.</span></div>
        </div>
        <form id="profile-form" class="profile-form" autocomplete="off">
          <div class="profile-fields">
            <label><span>Tên hiển thị</span><input id="profile-name" type="text" maxlength="32" autocomplete="nickname" spellcheck="false" placeholder="Tên của bạn" required></label>
            <label><span>Phòng</span><input id="profile-room" type="number" min="1" max="9999" step="1" inputmode="numeric" placeholder="Tự động"></label>
          </div>
          <fieldset class="avatar-picker">
            <legend>Chọn giới tính và avatar</legend>
            <div class="avatar-options" id="avatar-options">${avatarOptionsMarkup}</div>
          </fieldset>
          <p id="profile-error" class="profile-error hidden" role="alert"></p>
          <button class="profile-enter" type="submit">Vào lớp học <span>→</span></button>
        </form>
      </article>
    </div>

    <div class="floating-info floating-intro">
      <button id="intro-toggle" class="bubble-trigger" type="button" aria-expanded="false" aria-controls="intro-card">
        <span class="bubble-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" focusable="false"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3 5.3-2.3Z" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="#fff9df"/></svg></span><span>Khám phá 8 trạm 1954</span>
      </button>
      <section id="intro-card" class="intro-card bubble-content hidden" aria-label="Giới thiệu lớp học">
        <span class="small-star">✳</span>
        <p class="section-label">CHÍNH SÁCH DI CƯ BẮC – NAM SAU HIỆP ĐỊNH GIƠNEVƠ 1954</p>
        <p>Đi quanh lớp để xem 8 trạm tư liệu. Khi sẵn sàng chơi, tới ghế rồi bấm Ngồi xuống để chọn nhóm.</p>
        <div class="art-count"><span class="count-dot"></span><strong>08</strong> trạm · <strong>15</strong> câu kiểm tra</div>
      </section>
    </div>

    <div id="nearby" class="nearby hidden" role="status" aria-live="polite">
      <span class="nearby-icon">✦</span>
      <span><span id="nearby-prefix">Gần tranh</span> <strong id="nearby-title"></strong></span>
      <button id="inspect-button" type="button"><span id="nearby-action">Xem tranh</span> <kbd>E</kbd></button>
    </div>

    <p class="scene-caption"><span class="caption-line"></span> Di cư Bắc – Nam 1954 · VNR202 <span>✳</span></p>

    <div class="mobile-pad" aria-label="Joystick di chuyển" role="group">
      <div class="joystick" aria-label="Kéo để di chuyển theo mọi hướng">
        <div class="joystick-thumb" aria-hidden="true"></div>
      </div>
    </div>

    <div id="art-modal" class="modal hidden" aria-hidden="true">
      <div class="modal-backdrop" data-close="true"></div>
      <article class="art-dialog" role="dialog" aria-modal="true" aria-labelledby="art-title">
        <button class="close-button" id="close-modal" type="button" aria-label="Đóng">×</button>
        <div class="art-preview"><img id="art-image" alt="" /></div>
        <div class="art-copy">
          <p class="section-label">TRẠM TƯ LIỆU VNR202 <span>✦</span> <span id="art-category"></span></p>
          <h2 id="art-title"></h2>
          <p id="art-note"></p>
          <ul id="art-points" class="art-points"></ul>
          <a id="art-source" class="art-source" target="_blank" rel="noopener noreferrer"></a>
          <div class="art-footer"><span>Đọc trạm này, rồi ngồi ghế khi đến giờ kiểm tra.</span><button id="next-art" type="button">Chủ đề tiếp theo →</button></div>
        </div>
      </article>
    </div>

    <div id="help-modal" class="modal hidden" aria-hidden="true">
      <div class="modal-backdrop" data-close="true"></div>
      <article class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button class="close-button" id="close-help" type="button" aria-label="Đóng">×</button>
        <span class="help-sun">${sunIcon}</span>
        <p class="section-label">BẮT ĐẦU MINI GAME VNR202</p>
        <h2 id="help-title">Học di cư 1954 trong lớp 3D</h2>
        <p>Dùng <strong>W A S D</strong> hoặc phím mũi tên để đi; trên điện thoại, kéo joystick. Kéo chuột để xoay góc nhìn, cuộn để phóng to. Nhấp tranh để đọc 8 trạm tư liệu; nhấp TV để chơi quiz khởi động. Tới gần rồi nhấn <strong>E</strong> cũng được.</p>
        <div class="lan-name-form">
          <label>Hồ sơ trong lớp</label>
          <div class="profile-summary"><span id="profile-summary">Chưa chọn nhân vật</span><button id="edit-profile" type="button">Đổi hồ sơ</button></div>
          <small id="lan-help-status">Tới gần ghế rồi nhấn E hoặc bấm Ngồi xuống để vào màn hình chọn nhóm.</small>
        </div>
        <button class="primary-button" id="start-exploring" type="button">Bắt đầu dạo quanh <span>→</span></button>
      </article>
    </div>

    <div id="quiz-modal" class="modal hidden" aria-hidden="true">
      <div class="modal-backdrop" data-close="true"></div>
      <article class="quiz-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
        <button class="close-button" id="close-quiz" type="button" aria-label="Đóng">×</button>
        <div class="quiz-flight" aria-hidden="true">
          <div id="quiz-gates" class="quiz-gates"></div>
          <div id="quiz-progress" class="quiz-flight-progress"></div>
          <img id="quiz-bird" class="quiz-bird" src="/flappy/yellowbird-midflap.png" alt="">
        </div>
        <div class="quiz-body">
          <p class="section-label">TV VNR202 · QUIZ KHỞI ĐỘNG</p>
          <h2 id="quiz-title">Bay qua 8 cửa 1954</h2>
          <p class="quiz-intro">Chọn đáp án để đưa chú chim qua từng cánh cổng về Hiệp định Giơnevơ và cuộc di cư Bắc – Nam.</p>
          <div id="quiz-play">
            <div class="quiz-meta"><span id="quiz-number"></span><span id="quiz-score"></span></div>
            <h3 id="quiz-question"></h3>
            <div id="quiz-options" class="quiz-options"></div>
            <p id="quiz-feedback" class="quiz-feedback hidden" role="status" aria-live="polite"></p>
            <button id="quiz-next" class="quiz-next hidden" type="button">Câu tiếp theo →</button>
          </div>
          <div id="quiz-finish" class="quiz-finish hidden">
            <p>HOÀN THÀNH CHUYẾN BAY</p>
            <strong id="quiz-result"></strong>
            <span id="quiz-result-note"></span>
            <button id="quiz-restart" class="quiz-next" type="button">Chơi lại ↺</button>
          </div>
        </div>
      </article>
    </div>

    <div id="exam-modal" class="modal exam-modal hidden" aria-hidden="true">
      <div class="modal-backdrop"></div>
      <article class="exam-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-title">
        <header class="exam-paper-header">
          <div><p class="section-label">${COURSE_CODE} · MINI GAME DI CƯ 1954</p><h2 id="exam-title">Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ</h2><span id="exam-subtitle">15 câu trắc nghiệm · 15 phút</span></div>
          <strong id="exam-timer" aria-live="off">15:00</strong>
        </header>
        <div class="exam-scroll"><form id="exam-form"></form></div>
        <footer class="exam-footer"><span id="exam-progress">0 / ${EXAM_QUESTION_COUNT} câu đã chọn</span><button id="submit-exam" type="button">Nộp bài kiểm tra →</button></footer>
      </article>
    </div>
  </main>
`;

const artModal = document.querySelector('#art-modal');
const helpModal = document.querySelector('#help-modal');
const quizModal = document.querySelector('#quiz-modal');
const examModal = document.querySelector('#exam-modal');
const profileModal = document.querySelector('#profile-modal');
const quiz = createQuiz(quizModal);
const nearby = document.querySelector('#nearby');
const bubbleToggles = [...document.querySelectorAll('.bubble-trigger')];
let currentArtwork = null;
let classroom;
let lan;
let selfId = null;
let role = 'student';
let roomNo = 1;
let connected = false;
let examOpen = false;
let examRound = null;
let examEndsAt = 0;
let examQuestionCount = EXAM_QUESTION_COUNT;
let clockOffset = 0;
let latestState = null;
let toastTimer = null;
let chatMessages = [];
let chatUnread = 0;
const CHAT_MEMORY_LIMIT = 60;

function genderLabel(gender) {
  return gender === 'female' ? 'Nữ' : gender === 'other' ? 'Linh vật' : 'Nam';
}

function selectAvatarInput(avatar) {
  const option = getAvatarOption(avatar);
  const input = document.querySelector(`input[name="profile-avatar"][value="${option.id}"]`);
  if (input) input.checked = true;
  return option;
}

function toast(message) {
  const element = document.querySelector('#online-toast');
  element.textContent = message;
  element.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.add('hidden'), 4500);
}

function showLeaderboard(open) {
  const panel = document.querySelector('#leaderboard-panel');
  panel.classList.toggle('hidden', !open);
  document.querySelector('#leaderboard-button').setAttribute('aria-expanded', String(open));
  if (open) showChat(false);
}

function updateChatBadge() {
  const badge = document.querySelector('#chat-unread');
  badge.textContent = chatUnread > 99 ? '99+' : String(chatUnread);
  badge.classList.toggle('hidden', chatUnread === 0);
}

function showChat(open) {
  const panel = document.querySelector('#chat-panel');
  panel.classList.toggle('hidden', !open);
  document.querySelector('#chat-button').setAttribute('aria-expanded', String(open));
  if (open) {
    showLeaderboard(false);
    chatUnread = 0; updateChatBadge();
    requestAnimationFrame(() => {
      const messages = document.querySelector('#chat-messages');
      messages.scrollTop = messages.scrollHeight;
      document.querySelector('#chat-input').focus();
    });
  }
}

function clearChat() {
  chatMessages = []; chatUnread = 0;
  document.querySelector('#chat-messages').replaceChildren(document.querySelector('#chat-empty'));
  document.querySelector('#chat-empty').classList.remove('hidden');
  document.querySelector('#chat-room').textContent = String(roomNo);
  updateChatBadge();
}

function appendChatMessage(message) {
  if (!message || typeof message.text !== 'string' || typeof message.name !== 'string') return;
  const text = message.text.trim().slice(0, 200);
  if (!text) return;
  const now = Date.now();
  const item = { id: message.id, name: message.name.slice(0, 32), text,
    sentAt: Number.isFinite(message.sentAt) && Math.abs(message.sentAt - now) < 86_400_000 ? message.sentAt : now,
    messageId: message.messageId };
  if (item.messageId && chatMessages.some(entry => entry.messageId === item.messageId)) return;
  chatMessages.push(item);
  if (chatMessages.length > CHAT_MEMORY_LIMIT) chatMessages.shift();
  document.querySelector('#chat-empty').classList.add('hidden');
  const row = document.createElement('article');
  row.className = `chat-message${item.id === selfId ? ' is-own' : ''}`;
  const meta = document.createElement('div');
  const name = document.createElement('strong'); name.textContent = item.id === selfId ? 'Bạn' : item.name;
  const time = document.createElement('time');
  time.dateTime = new Date(item.sentAt).toISOString();
  time.textContent = new Date(item.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const copy = document.createElement('p'); copy.textContent = item.text;
  meta.append(name, time); row.append(meta, copy);
  const messages = document.querySelector('#chat-messages');
  messages.append(row);
  while (messages.querySelectorAll('.chat-message').length > CHAT_MEMORY_LIMIT) messages.querySelector('.chat-message')?.remove();
  messages.scrollTop = messages.scrollHeight;
  if (document.querySelector('#chat-panel').classList.contains('hidden') && item.id !== selfId) {
    chatUnread++; updateChatBadge();
  }
}

function updateLeaderboard(exam) {
  const summary = document.querySelector('#leaderboard-summary');
  const list = document.querySelector('#leaderboard-list');
  if (!exam || exam.phase === 'idle') summary.textContent = 'Chưa có bài kiểm tra.';
  else if (exam.phase === 'active') summary.textContent = `${exam.submittedCount}/${exam.participantCount} sinh viên đã nộp · còn ${formatTime(Math.max(0, exam.endsAt - (Date.now() + clockOffset)))}`;
  else summary.textContent = `Đã chấm ${exam.participantCount} bài · ${exam.rankings.length} kết quả`;
  list.replaceChildren(...(exam?.rankings || []).map(row => {
    const item = document.createElement('li');
    item.className = `rank-row rank-${Math.min(row.rank, 4)}`;
    const place = document.createElement('strong'); place.textContent = String(row.rank).padStart(2, '0');
    const name = document.createElement('span'); name.textContent = row.name;
    const result = document.createElement('small'); result.textContent = `${row.correct}/${examQuestionCount} · ${formatTime(row.durationMs)}`;
    item.append(place, name, result);
    return item;
  }));
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateTeacherControls(state) {
  const panel = document.querySelector('#teacher-controls');
  panel.classList.toggle('hidden', role !== 'teacher');
  if (role !== 'teacher') return;
  const seated = state?.counts?.seated ?? state?.players.filter(player => player.role === 'student' && player.seatId !== null).length ?? 0;
  const exam = state?.exam;
  document.querySelector('#teacher-exam-status').textContent = exam?.phase === 'active'
    ? `${exam.submittedCount}/${exam.participantCount} bài đã nộp · còn ${formatTime(exam.endsAt - (Date.now() + clockOffset))}`
    : `${seated} sinh viên đang ngồi ở tất cả phòng · ${exam?.phase === 'finished' ? 'đã chấm xong' : 'chờ mở bài'}`;
  document.querySelector('#start-exam').disabled = !connected || !seated || exam?.phase === 'active';
  document.querySelector('#finish-exam').classList.toggle('hidden', exam?.phase !== 'active');
  const reset = document.querySelector('#reset-exam');
  reset.classList.toggle('hidden', !exam || exam.phase === 'idle');
  reset.disabled = !connected;
}

function updateSeatStatus(state) {
  const seat = state?.players.find(player => player.id === selfId)?.seatId;
  const label = document.querySelector('#seat-status');
  label.classList.toggle('hidden', seat === null || seat === undefined);
  if (seat !== null && seat !== undefined) label.textContent = `Đang ngồi bàn ${seat + 1} · giấy kiểm tra đã đặt trên bàn · nhấn E để đứng dậy`;
}

function updateLanStatus(status) {
  connected = status === 'online';
  const element = document.querySelector('#lan-status');
  element.dataset.status = status;
  element.textContent = status === 'online' ? 'Trực tuyến' : status === 'connecting' ? 'Đang kết nối' : 'Mất kết nối';
  document.querySelector('#lan-help-status').textContent = status === 'online'
    ? role === 'teacher' ? 'Bạn là giảng viên. Bài kiểm tra sẽ mở đồng thời cho sinh viên đang ngồi ở mọi phòng.' : `Đã vào phòng ${roomNo}. Tới gần ghế và nhấn E để ngồi.`
    : 'Đang kết nối lớp. Hãy mở đúng đường link do giảng viên chia sẻ trên cùng mạng Wi-Fi.';
  updateTeacherControls(latestState);
}

function updateOnlineCounts(state) {
  const counts = state?.counts;
  const online = counts?.online ?? state?.players?.length ?? 0;
  const seated = counts?.seated ?? state?.players?.filter(player => player.role === 'student' && player.seatId !== null).length ?? 0;
  roomNo = state?.me?.roomNo ?? roomNo;
  document.querySelector('#online-count').textContent = `${online} trực tuyến · ${seated} đã ngồi · Phòng ${roomNo} (${counts?.roomOccupancy ?? state?.players?.length ?? 0}/10)`;
}

function updateExamProgress() {
  const count = document.querySelectorAll('#exam-form input:checked').length;
  document.querySelector('#exam-progress').textContent = `${count} / ${examQuestionCount} câu đã chọn`;
}

function showExam(message) {
  clockOffset = message.serverNow - Date.now();
  examEndsAt = message.endsAt;
  if (examOpen && examRound === message.round) return;
  examRound = message.round;
  examOpen = true;
  examQuestionCount = message.questions.length;
  document.querySelector('#exam-subtitle').textContent = `${examQuestionCount} câu trắc nghiệm · ${EXAM_MINUTES} phút`;
  const form = document.querySelector('#exam-form');
  form.replaceChildren(...message.questions.map((question, index) => {
    const fieldset = document.createElement('fieldset'); fieldset.className = 'exam-question';
    const legend = document.createElement('legend'); legend.textContent = `Câu ${index + 1}. ${question.question}`;
    fieldset.append(legend);
    question.options.forEach((option, choice) => {
      const label = document.createElement('label'); label.className = 'exam-choice';
      const input = document.createElement('input'); input.type = 'radio'; input.name = `question-${index}`; input.value = String(choice);
      const letter = document.createElement('b'); letter.textContent = String.fromCharCode(65 + choice);
      const copy = document.createElement('span'); copy.textContent = option;
      label.append(input, letter, copy); fieldset.append(label);
    });
    return fieldset;
  }));
  updateExamProgress();
  document.querySelector('#submit-exam').disabled = false;
  document.querySelector('#submit-exam').textContent = 'Nộp bài kiểm tra →';
  closeModals(); closeBubbles(); resetJoystick();
  examModal.classList.remove('hidden'); examModal.setAttribute('aria-hidden', 'false');
  classroom?.setActive(false);
  document.querySelector('#exam-title').focus?.();
}

function hideExam() {
  examOpen = false;
  examModal.classList.add('hidden'); examModal.setAttribute('aria-hidden', 'true');
  classroom?.setActive(profileModal.classList.contains('hidden'));
}

function handleOnlineMessage(message) {
  if (typeof message.serverNow === 'number') clockOffset = message.serverNow - Date.now();
  if (message.type === 'welcome') {
    const nextRoomNo = message.roomNo ?? roomNo;
    if (selfId && nextRoomNo !== roomNo) { roomNo = nextRoomNo; clearChat(); }
    else roomNo = nextRoomNo;
    selfId = message.id; role = message.role;
    const selectedAvatar = selectAvatarInput(message.avatar);
    const gender = selectedAvatar.gender;
    const avatar = selectedAvatar.id;
    localStorage.setItem('vnr202-gender', gender);
    localStorage.setItem('vnr202-avatar', avatar);
    classroom?.resetSelfPose();
    classroom?.setProfile({ name: message.name, gender, avatar });
    document.querySelector('#profile-summary').textContent = `${message.name} · ${selectedAvatar.name} · ${genderLabel(gender)} · Phòng ${roomNo}`;
    document.querySelector('#chat-room').textContent = String(roomNo);
    updateLanStatus('online');
    toast(role === 'teacher' ? 'Đã vào lớp với vai trò giảng viên.' : `Chào ${message.name}, bạn đã vào phòng ${roomNo}.`);
  } else if (message.type === 'state') {
    latestState = message;
    classroom?.syncPlayers(message.players, selfId);
    updateOnlineCounts(message);
    updateSeatStatus(message);
    updateTeacherControls(message);
    updateLeaderboard(message.exam);
  } else if (message.type === 'players') {
    classroom?.syncPlayers(message.players, selfId);
  } else if (message.type === 'pose') {
    classroom?.syncPose(message);
  } else if (message.type === 'chat') {
    appendChatMessage(message);
  } else if (message.type === 'exam_open') {
    showExam(message);
  } else if (message.type === 'exam_result') {
    hideExam();
    toast(`Đã nộp bài: ${message.row?.correct ?? 0}/${examQuestionCount} câu đúng. Xem bảng điểm để theo dõi thứ hạng.`);
    showLeaderboard(true);
  } else if (message.type === 'exam_finished') {
    if (examOpen) { hideExam(); toast('Hết giờ kiểm tra. Bài chưa nộp đã được chấm tự động.'); }
    showLeaderboard(true);
  } else if (message.type === 'exam_reset') {
    if (examOpen) hideExam();
    updateLeaderboard({ phase: 'idle', rankings: [], participantCount: 0, submittedCount: 0 });
    showLeaderboard(false);
    toast('Đã reset bài kiểm tra và bảng xếp hạng.');
  } else if (message.type === 'error') {
    if (examOpen) {
      document.querySelector('#submit-exam').disabled = false;
      document.querySelector('#submit-exam').textContent = 'Nộp bài kiểm tra →';
    }
    toast(message.message);
  }
}

function closeBubbles() {
  bubbleToggles.forEach(toggle => {
    toggle.setAttribute('aria-expanded', 'false');
    document.getElementById(toggle.getAttribute('aria-controls')).classList.add('hidden');
  });
}

bubbleToggles.forEach(toggle => toggle.addEventListener('click', () => {
  const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
  closeBubbles();
  if (willOpen) {
    toggle.setAttribute('aria-expanded', 'true');
    document.getElementById(toggle.getAttribute('aria-controls')).classList.remove('hidden');
  }
}));

document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.floating-info')) closeBubbles();
});

function closeModals() {
  artModal.classList.add('hidden'); artModal.setAttribute('aria-hidden', 'true');
  helpModal.classList.add('hidden'); helpModal.setAttribute('aria-hidden', 'true');
  quizModal.classList.add('hidden'); quizModal.setAttribute('aria-hidden', 'true');
  classroom?.setActive(!examOpen && profileModal.classList.contains('hidden'));
}

function openProfileEditor() {
  closeModals(); closeBubbles(); showChat(false); showLeaderboard(false); resetJoystick();
  profileModal.classList.remove('hidden'); profileModal.setAttribute('aria-hidden', 'false');
  classroom?.setActive(false);
  requestAnimationFrame(() => document.querySelector('#profile-name').focus());
}

function openArtwork(artwork) {
  if (examOpen) return;
  closeBubbles();
  resetJoystick();
  currentArtwork = artwork;
  document.querySelector('#art-image').src = artwork.imageUrl;
  document.querySelector('#art-image').alt = artwork.imageAlt;
  document.querySelector('#art-title').textContent = artwork.title;
  document.querySelector('#art-category').textContent = artwork.category;
  document.querySelector('#art-note').textContent = artwork.note;
  const source = document.querySelector('#art-source');
  source.textContent = `Nguồn chính thức: ${artwork.sourceLabel}`;
  source.href = artwork.sourceUrl;
  const points = document.querySelector('#art-points');
  points.replaceChildren(...artwork.points.map(point => {
    const item = document.createElement('li');
    item.textContent = point;
    return item;
  }));
  helpModal.classList.add('hidden'); helpModal.setAttribute('aria-hidden', 'true');
  quizModal.classList.add('hidden'); quizModal.setAttribute('aria-hidden', 'true');
  artModal.classList.remove('hidden'); artModal.setAttribute('aria-hidden', 'false');
  classroom?.setActive(false);
  document.querySelector('#close-modal').focus();
}

function updateNearby(target) {
  if (target && !examOpen && artModal.classList.contains('hidden') && helpModal.classList.contains('hidden') && quizModal.classList.contains('hidden')) {
    const isQuiz = target.type === 'quiz';
    const isSeat = target.type === 'seat';
    document.querySelector('#nearby-prefix').textContent = isQuiz ? 'Gần' : isSeat ? 'Gần ghế' : 'Gần tranh';
    document.querySelector('#nearby-title').textContent = isQuiz ? 'TV quiz khởi động' : isSeat ? `Bàn số ${target.seatId + 1}` : target.artwork.title;
    document.querySelector('#nearby-action').textContent = isQuiz ? 'Chơi quiz' : isSeat ? target.sitting ? 'Rời ghế' : 'Ngồi xuống' : 'Xem tranh';
    nearby.classList.remove('hidden');
  } else nearby.classList.add('hidden');
}

function openQuiz() {
  if (examOpen) return;
  closeBubbles();
  resetJoystick();
  artModal.classList.add('hidden'); artModal.setAttribute('aria-hidden', 'true');
  helpModal.classList.add('hidden'); helpModal.setAttribute('aria-hidden', 'true');
  quiz.start();
  quizModal.classList.remove('hidden'); quizModal.setAttribute('aria-hidden', 'false');
  classroom?.setActive(false);
  document.querySelector('#close-quiz').focus();
}

lan = createOnlineClient(handleOnlineMessage, updateLanStatus);
classroom = createClassroom(document.querySelector('#classroom'), {
  onArtwork: openArtwork,
  onQuiz: openQuiz,
  onNearby: updateNearby,
  onPose: pose => lan.send({ type: 'pose', ...pose }),
  onSeat: seatId => {
    if (role === 'teacher') { toast('Ghế này dành cho nhóm chơi.'); return; }
    if (classroom.getSeatId() === seatId) {
      if (connected) lan.send({ type: 'stand' });
      return;
    }
    const name = document.querySelector('#profile-name').value.trim() || localStorage.getItem('vnr202-player-name') || '';
    if (name) sessionStorage.setItem('vnr202-player-name', name);
    if (connected) lan.send({ type: 'sit', seatId });
    location.href = '/chuong.html';
  },
});

const savedName = localStorage.getItem('vnr202-player-name') || `Sinh viên ${Math.floor(Math.random() * 900 + 100)}`;
const savedRoomValue = Number(localStorage.getItem('vnr202-room-no'));
const savedRoom = Number.isInteger(savedRoomValue) && savedRoomValue >= 1 && savedRoomValue <= 9999 ? savedRoomValue : null;
const savedProfile = getAvatarOption(localStorage.getItem('vnr202-avatar'));
const savedAvatar = savedProfile.id;
const savedGender = savedProfile.gender;
document.querySelector('#profile-name').value = savedName;
document.querySelector('#profile-room').value = savedRoom ?? '';
selectAvatarInput(savedAvatar);
document.querySelector('#profile-summary').textContent = `${savedName} · ${savedProfile.name} · ${genderLabel(savedGender)}${savedRoom ? ` · Phòng ${savedRoom}` : ''}`;
classroom.setProfile({ name: savedName, gender: savedGender, avatar: savedAvatar });
classroom.setActive(false);
window.addEventListener('pagehide', event => { if (!event.persisted) lan.stop(); });

document.querySelector('#reset-view').addEventListener('click', () => classroom.resetCamera());
document.querySelector('#inspect-button').addEventListener('click', () => classroom.inspectNearby());
document.querySelector('#close-modal').addEventListener('click', closeModals);
document.querySelector('#close-help').addEventListener('click', closeModals);
document.querySelector('#close-quiz').addEventListener('click', closeModals);
document.querySelector('#start-exploring').addEventListener('click', closeModals);
document.querySelector('#edit-profile').addEventListener('click', openProfileEditor);
document.querySelector('#profile-button').addEventListener('click', openProfileEditor);
document.querySelector('#profile-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = document.querySelector('#profile-name').value.trim();
  const roomText = document.querySelector('#profile-room').value.trim();
  const nextRoomNo = roomText === '' ? null : Number(roomText);
  const selected = document.querySelector('input[name="profile-avatar"]:checked');
  const avatar = selected?.value;
  const gender = selected?.dataset.gender;
  const error = document.querySelector('#profile-error');
  let errorMessage = '';
  if (!name) errorMessage = 'Hãy nhập tên của bạn.';
  else if (nextRoomNo !== null && (!Number.isInteger(nextRoomNo) || nextRoomNo < 1 || nextRoomNo > 9999)) errorMessage = 'Số phòng phải là số nguyên từ 1 đến 9999.';
  else if (!isValidAvatarProfile(gender, avatar)) errorMessage = 'Hãy chọn một nhân vật.';
  error.textContent = errorMessage;
  error.classList.toggle('hidden', !errorMessage);
  if (errorMessage) return;
  localStorage.setItem('vnr202-player-name', name);
  localStorage.setItem('vnr202-gender', gender);
  localStorage.setItem('vnr202-avatar', avatar);
  if (nextRoomNo === null) localStorage.removeItem('vnr202-room-no');
  else localStorage.setItem('vnr202-room-no', String(nextRoomNo));
  classroom.setProfile({ name, gender, avatar });
  const selectedAvatar = getAvatarOption(avatar);
  document.querySelector('#profile-summary').textContent = `${name} · ${selectedAvatar.name} · ${genderLabel(gender)}${nextRoomNo ? ` · Phòng ${nextRoomNo}` : ''}`;
  profileModal.classList.add('hidden'); profileModal.setAttribute('aria-hidden', 'true');
  classroom.setActive(true);
  lan.connect(name, nextRoomNo, { gender, avatar });
  toast(nextRoomNo === null ? 'Đang tự động chọn phòng còn chỗ…' : `Đang vào phòng ${nextRoomNo}…`);
});
document.querySelector('#leaderboard-button').addEventListener('click', () => showLeaderboard(document.querySelector('#leaderboard-panel').classList.contains('hidden')));
document.querySelector('#close-leaderboard').addEventListener('click', () => showLeaderboard(false));
document.querySelector('#chat-button').addEventListener('click', () => showChat(document.querySelector('#chat-panel').classList.contains('hidden')));
document.querySelector('#close-chat').addEventListener('click', () => showChat(false));
document.querySelector('#chat-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (!connected) { toast('Bạn cần kết nối vào phòng trước khi gửi tin nhắn.'); return; }
  lan.send({ type: 'chat', text });
  input.value = '';
});
function classJoinUrls() {
  const injected = (typeof __VNR_CLASS_URLS__ === 'string' ? __VNR_CLASS_URLS__ : '').split(',').map(value => value.trim()).filter(Boolean);
  return [...new Set([location.origin, ...injected])];
}

document.querySelector('#copy-class-url').addEventListener('click', async () => {
  const urls = classJoinUrls();
  const text = urls.join('\n');
  try {
    await navigator.clipboard.writeText(urls[urls.length - 1] || location.origin);
    toast(`Đã sao chép link lớp. Sinh viên cùng Wi-Fi mở: ${urls.filter(url => !url.includes('127.0.0.1') && !url.includes('localhost')).join(' hoặc ') || urls[0]}`);
  } catch {
    toast(`Nhờ lớp mở: ${text}`);
  }
});
document.querySelector('#start-exam').addEventListener('click', () => lan.send({ type: 'start_exam' }));
document.querySelector('#finish-exam').addEventListener('click', () => lan.send({ type: 'finish_exam' }));
document.querySelector('#reset-exam').addEventListener('click', () => lan.send({ type: 'reset_exam' }));
document.querySelector('#exam-form').addEventListener('change', updateExamProgress);
document.querySelector('#submit-exam').addEventListener('click', () => {
  if (!connected) { toast('Mất kết nối. Hãy chờ kết nối lại rồi nộp bài.'); return; }
  const answers = Array.from({ length: examQuestionCount }, (_, i) => {
    const selected = document.querySelector(`#exam-form input[name="question-${i}"]:checked`);
    return selected ? Number(selected.value) : null;
  });
  if (answers.some(answer => answer === null)) { toast(`Hãy chọn đáp án cho cả ${examQuestionCount} câu trước khi nộp.`); return; }
  lan.send({ type: 'submit_exam', answers });
  document.querySelector('#submit-exam').disabled = true;
  document.querySelector('#submit-exam').textContent = 'Đang nộp bài…';
});
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModals));
document.querySelector('#help-button').addEventListener('click', () => {
  if (examOpen) return;
  closeBubbles();
  resetJoystick();
  artModal.classList.add('hidden'); artModal.setAttribute('aria-hidden', 'true');
  quizModal.classList.add('hidden'); quizModal.setAttribute('aria-hidden', 'true');
  helpModal.classList.remove('hidden'); helpModal.setAttribute('aria-hidden', 'false');
  classroom.setActive(false);
  document.querySelector('#close-help').focus();
});
document.querySelector('#next-art').addEventListener('click', () => {
  openArtwork(artworks[(artworks.indexOf(currentArtwork) + 1) % artworks.length]);
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModals(); closeBubbles(); }
  if (!quizModal.classList.contains('hidden') && /^[1-4]$/.test(e.key)) quiz.choose(Number(e.key) - 1);
});

setInterval(() => {
  if (examOpen) {
    const remaining = Math.max(0, examEndsAt - (Date.now() + clockOffset));
    document.querySelector('#exam-timer').textContent = formatTime(remaining);
    document.querySelector('#exam-timer').classList.toggle('is-urgent', remaining < 60_000);
    if (!remaining) { document.querySelector('#submit-exam').disabled = true; document.querySelector('#submit-exam').textContent = 'Hết giờ · đang chấm'; }
  }
  if (latestState?.exam.phase === 'active') {
    updateTeacherControls(latestState);
    updateLeaderboard(latestState.exam);
  }
}, 1000);

const joystick = document.querySelector('.joystick');
const joystickThumb = joystick.querySelector('.joystick-thumb');
let joystickPointerId = null;

function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const radius = (rect.width - joystickThumb.offsetWidth) / 2;
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(x, y);
  const scale = distance > radius ? radius / distance : 1;
  const offsetX = x * scale;
  const offsetY = y * scale;
  joystickThumb.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  classroom.setMovement(offsetX / radius, -offsetY / radius);
}

function resetJoystick() {
  const pointerId = joystickPointerId;
  joystickPointerId = null;
  if (pointerId !== null && joystick.hasPointerCapture(pointerId)) joystick.releasePointerCapture(pointerId);
  joystickThumb.style.transform = '';
  classroom.setMovement(0, 0);
}

joystick.addEventListener('pointerdown', event => {
  if (joystickPointerId !== null) return;
  event.preventDefault();
  joystickPointerId = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
joystick.addEventListener('pointermove', event => {
  if (event.pointerId === joystickPointerId) updateJoystick(event);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
  joystick.addEventListener(type, event => {
    if (event.pointerId === joystickPointerId) resetJoystick();
  });
});
window.addEventListener('blur', resetJoystick);
