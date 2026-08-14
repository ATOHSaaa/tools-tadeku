(function () {
  const { DIMENSIONS, BOOKS, QUESTIONS } = window.HajimeteHonData;

  function emptyDims() {
    const dims = {};
    DIMENSIONS.forEach((key) => { dims[key] = 0; });
    return dims;
  }

  function computeUserDimMaxes() {
    const maxes = emptyDims();
    QUESTIONS.forEach((question) => {
      DIMENSIONS.forEach((key) => {
        let qMax = 0;
        question.choices.forEach((choice) => {
          qMax = Math.max(qMax, choice.dims?.[key] || 0);
        });
        maxes[key] += qMax;
      });
    });
    return maxes;
  }

  const USER_DIM_MAXES = computeUserDimMaxes();

  function normalizeUserDimsTo10Float(userDims) {
    const out = emptyDims();
    DIMENSIONS.forEach((key) => {
      const max = USER_DIM_MAXES[key] || 1;
      out[key] = Math.min(10, ((userDims[key] || 0) / max) * 10);
    });
    return out;
  }

  function normalizeUserDimsTo10(userDims) {
    const out = normalizeUserDimsTo10Float(userDims);
    DIMENSIONS.forEach((key) => {
      out[key] = Math.round(out[key]);
    });
    return out;
  }

  function addDims(target, source) {
    if (!source) return target;
    DIMENSIONS.forEach((key) => {
      target[key] += source[key] || 0;
    });
    return target;
  }

  function computeUserDims(answers) {
    const user = emptyDims();
    answers.forEach((choice) => addDims(user, choice.dims));
    return user;
  }

  function axisMatch(userVal, bookVal) {
    return Math.max(0, 10 - Math.abs(userVal - bookVal)) / 10;
  }

  function rankBooks(answers) {
    const userDims = computeUserDims(answers);
    const user10 = normalizeUserDimsTo10Float(userDims);
    const focusKeys = [...DIMENSIONS]
      .sort((a, b) => user10[b] - user10[a] || a.localeCompare(b, 'ja'))
      .slice(0, 3);
    const focusWeights = [3, 2, 1];
    const maxScore = focusWeights.reduce((sum, w) => sum + w, 0) + DIMENSIONS.length * 0.12;

    const ranked = BOOKS.map((book) => {
      const bookDims = book.dims;
      let score = 0;
      focusKeys.forEach((key, index) => {
        score += axisMatch(user10[key], bookDims[key] || 0) * focusWeights[index];
      });
      DIMENSIONS.forEach((key) => {
        if (focusKeys.includes(key)) return;
        score += axisMatch(user10[key], bookDims[key] || 0) * 0.12;
      });
      const matchPct = Math.round(Math.max(0, Math.min(100, (score / maxScore) * 100)));
      return {
        id: book.id,
        name: book.name,
        author: book.author,
        year: book.year,
        typeName: book.typeName,
        workUrl: book.workUrl,
        traits: book.traits,
        blurb: book.blurb,
        synopsis: book.synopsis || '',
        asin: book.asin,
        coverUrl: book.coverUrl,
        amazonUrl: book.amazonUrl,
        dims: bookDims,
        score,
        matchPct,
      };
    });

    ranked.sort((a, b) => b.matchPct - a.matchPct || a.score - b.score || a.id.localeCompare(b.id, 'ja'));
    const top = ranked[0];
    const topPct = top.matchPct || 1;
    ranked.forEach((item) => {
      item.barPct = Math.round((item.matchPct / topPct) * 100);
    });

    return { userDims, ranked, top };
  }

  window.HajimeteHonEngine = {
    computeUserDims,
    computeUserDimMaxes,
    normalizeUserDimsTo10,
    USER_DIM_MAXES,
    rankBooks,
  };
})();
