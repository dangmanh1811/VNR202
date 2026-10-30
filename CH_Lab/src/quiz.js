import { quizQuestions } from './quiz-data.js';

export function createQuiz(root) {
  const questionNumber = root.querySelector('#quiz-number');
  const scoreText = root.querySelector('#quiz-score');
  const questionText = root.querySelector('#quiz-question');
  const options = root.querySelector('#quiz-options');
  const feedback = root.querySelector('#quiz-feedback');
  const nextButton = root.querySelector('#quiz-next');
  const play = root.querySelector('#quiz-play');
  const finish = root.querySelector('#quiz-finish');
  const result = root.querySelector('#quiz-result');
  const resultNote = root.querySelector('#quiz-result-note');
  const bird = root.querySelector('#quiz-bird');
  const progress = root.querySelector('#quiz-progress');
  const gates = root.querySelector('#quiz-gates');
  const birdFrames = ['downflap', 'midflap', 'upflap'].map(frame => `/flappy/yellowbird-${frame}.png`);
  let index = 0;
  let score = 0;
  let answered = false;

  quizQuestions.forEach((_, i) => {
    const gate = document.createElement('span');
    gate.className = 'quiz-gate';
    gate.style.left = `${12 + (i + .5) / quizQuestions.length * 78}%`;
    const topPipe = document.createElement('img');
    topPipe.className = 'pipe-top';
    topPipe.src = '/flappy/pipe-green.png';
    topPipe.alt = '';
    const bottomPipe = document.createElement('img');
    bottomPipe.className = 'pipe-bottom';
    bottomPipe.src = '/flappy/pipe-green.png';
    bottomPipe.alt = '';
    gate.append(topPipe, bottomPipe);
    gates.append(gate);
  });

  window.setInterval(() => {
    if (!root.classList.contains('hidden') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bird.src = birdFrames[Math.floor(performance.now() / 115) % birdFrames.length];
    }
  }, 115);

  function setFlight(completed) {
    bird.style.left = `${8 + completed / quizQuestions.length * 82}%`;
    progress.style.width = `${completed / quizQuestions.length * 100}%`;
    [...gates.children].forEach((gate, i) => gate.classList.toggle('passed', i < completed));
  }

  function renderQuestion() {
    answered = false;
    const current = quizQuestions[index];
    questionNumber.textContent = `Câu ${index + 1} / ${quizQuestions.length}`;
    scoreText.textContent = `${score} điểm`;
    questionText.textContent = current.question;
    options.replaceChildren();
    current.options.forEach((option, choice) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + choice)}</span><span></span>`;
      button.lastElementChild.textContent = option;
      button.addEventListener('click', () => choose(choice));
      options.append(button);
    });
    feedback.className = 'quiz-feedback hidden';
    feedback.textContent = '';
    nextButton.classList.add('hidden');
    play.classList.remove('hidden');
    finish.classList.add('hidden');
    setFlight(index);
  }

  function choose(choice) {
    if (answered || root.classList.contains('hidden')) return;
    const current = quizQuestions[index];
    if (!current) return;
    answered = true;
    const correct = choice === current.answer;
    if (correct) score++;
    [...options.children].forEach((button, i) => {
      button.disabled = true;
      if (i === current.answer) button.classList.add('correct');
      else if (i === choice) button.classList.add('incorrect');
    });
    scoreText.textContent = `${score} điểm`;
    feedback.className = `quiz-feedback ${correct ? 'is-correct' : 'is-incorrect'}`;
    feedback.textContent = `${correct ? 'Chính xác!' : 'Chưa đúng.'} ${current.explanation}`;
    nextButton.textContent = index === quizQuestions.length - 1 ? 'Xem kết quả →' : 'Câu tiếp theo →';
    nextButton.classList.remove('hidden');
    setFlight(index + 1);
    if (!correct) {
      bird.classList.remove('bird-bump');
      void bird.offsetWidth;
      bird.classList.add('bird-bump');
    }
  }

  function next() {
    if (!answered) return;
    index++;
    if (index < quizQuestions.length) { renderQuestion(); return; }
    play.classList.add('hidden');
    finish.classList.remove('hidden');
    result.textContent = `${score} / ${quizQuestions.length}`;
    resultNote.textContent = score >= 7
      ? 'Bạn đã nắm các mốc Giơnevơ, 300 ngày và hướng Bắc – Nam. Hãy ngồi ghế khi giảng viên mở đề 15 câu.'
      : 'Hãy xem lại các trạm trên tường, đặc biệt Điều 14(d) và Passage to Freedom, rồi chơi lại.';
  }

  nextButton.addEventListener('click', next);
  root.querySelector('#quiz-restart').addEventListener('click', start);

  function start() {
    index = 0;
    score = 0;
    renderQuestion();
  }

  return { start, choose, next, get answered() { return answered; } };
}
