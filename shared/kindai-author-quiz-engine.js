(function () {
  const { QUESTIONS, GRADES, ROUND_SIZE } = window.KindaiAuthorQuizData;

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

  function startRound(size) {
    const count = Math.min(size || ROUND_SIZE, QUESTIONS.length);
    return shuffle(QUESTIONS).slice(0, count).map(shuffleChoices);
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

  window.KindaiAuthorQuizEngine = {
    startRound,
    isCorrect,
    scoreRound,
    resolveGrade,
  };
})();
