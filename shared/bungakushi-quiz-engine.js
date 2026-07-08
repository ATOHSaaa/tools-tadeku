(function () {
  const { QUESTIONS, QUESTIONS_BY_ERA, GRADES, ROUND_SIZE } = window.BungakushiQuizData;

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function shuffleChoices(question) {
    const indexed = question.choices.map((text, i) => ({
      text,
      isCorrect: i === question.correct,
    }));
    const shuffled = shuffle(indexed);
    return {
      ...question,
      choices: shuffled.map((item) => item.text),
      correct: shuffled.findIndex((item) => item.isCorrect),
    };
  }

  function getPool(eraId) {
    if (!eraId || eraId === 'all') return QUESTIONS;
    return QUESTIONS_BY_ERA[eraId] || [];
  }

  function getEraLabel(eraId) {
    if (!eraId || eraId === 'all') return 'すべて';
    const era = window.BungakushiQuizData.ERAS.find((item) => item.id === eraId);
    return era ? era.name : 'すべて';
  }

  function startRound(size, eraId) {
    const pool = getPool(eraId);
    const count = Math.min(size || ROUND_SIZE, pool.length);
    return shuffle(pool).slice(0, count).map(shuffleChoices);
  }

  function isCorrect(question, choiceIndex) {
    return choiceIndex === question.correct;
  }

  function scoreRound(questions, answers) {
    let correct = 0;
    const details = questions.map((question, index) => {
      const selected = answers[index];
      const ok = isCorrect(question, selected);
      if (ok) correct += 1;
      return {
        question,
        selected,
        ok,
      };
    });
    const total = questions.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    return { correct, total, pct, details };
  }

  function resolveGrade(pct) {
    return GRADES.find((grade) => pct >= grade.min) || GRADES[GRADES.length - 1];
  }

  window.BungakushiQuizEngine = {
    getPool,
    getEraLabel,
    startRound,
    isCorrect,
    scoreRound,
    resolveGrade,
  };
})();
