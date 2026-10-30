import { examQuestions } from './exam-questions.js';

export function scoreAnswers(answers) {
  return examQuestions.reduce((correct, question, index) => correct + Number(answers[index] === question.answer), 0);
}

export function rankSubmissions(submissions) {
  return [...submissions].sort((a, b) =>
    b.correct - a.correct || a.durationMs - b.durationMs || a.submittedAt - b.submittedAt || a.name.localeCompare(b.name, 'vi')
  ).map((entry, index) => ({
    rank: index + 1,
    id: entry.id,
    name: entry.name,
    correct: entry.correct,
    points: Math.round(entry.correct / examQuestions.length * 100),
    durationMs: entry.durationMs,
    submittedAt: entry.submittedAt,
    automatic: Boolean(entry.automatic),
  }));
}
