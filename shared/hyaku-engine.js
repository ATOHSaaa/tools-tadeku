(function () {
  const { AXES, TYPES, QUESTIONS, SCALE_LEVELS } = window.HyakuData;

  const axisById = {};
  AXES.forEach((axis) => { axisById[axis.id] = axis; });

  function emptyScores() {
    const scores = {};
    AXES.forEach((axis) => {
      scores[axis.left] = 0;
      scores[axis.right] = 0;
    });
    return scores;
  }

  function getScaleLevel(level) {
    return SCALE_LEVELS.find((item) => item.level === level);
  }

  function computeScores(answers) {
    const scores = emptyScores();
    answers.forEach((answer) => {
      const axis = axisById[answer.axis];
      const weight = getScaleLevel(answer.level);
      if (!axis || !weight) return;
      scores[axis.left] += weight.left;
      scores[axis.right] += weight.right;
    });
    return scores;
  }

  function resolveLetter(axis, scores) {
    const left = scores[axis.left] || 0;
    const right = scores[axis.right] || 0;
    if (left === right) return axis.left;
    return left > right ? axis.left : axis.right;
  }

  function buildAxisResults(scores) {
    return AXES.map((axis) => {
      const left = scores[axis.left] || 0;
      const right = scores[axis.right] || 0;
      const total = left + right || 1;
      const letter = resolveLetter(axis, scores);
      return {
        id: axis.id,
        letter,
        letterEn: letter === axis.left ? axis.leftEn : axis.rightEn,
        leftLetter: axis.left,
        rightLetter: axis.right,
        leftEn: axis.leftEn,
        rightEn: axis.rightEn,
        leftLabel: axis.leftLabel,
        rightLabel: axis.rightLabel,
        left,
        right,
        leftPct: Math.round((left / total) * 100),
        rightPct: Math.round((right / total) * 100),
        dominantPct: Math.round((Math.max(left, right) / total) * 100),
        isLeft: letter === axis.left,
      };
    });
  }

  function resolveTypeCode(axisResults) {
    const map = {};
    axisResults.forEach((item) => { map[item.id] = item.letter; });
    return map.SN + map.CW + map.PT + map.RF;
  }

  function diagnose(answers) {
    const scores = computeScores(answers);
    const axisResults = buildAxisResults(scores);
    const code = resolveTypeCode(axisResults);
    const type = TYPES.find((t) => t.code === code) || TYPES[0];
    return { scores, axisResults, code, type };
  }

  window.HyakuEngine = {
    QUESTIONS,
    SCALE_LEVELS,
    getScaleLevel,
    computeScores,
    buildAxisResults,
    diagnose,
  };
})();
