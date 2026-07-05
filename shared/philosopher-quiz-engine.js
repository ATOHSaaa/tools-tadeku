(function () {
  const { DIMENSIONS, AUTHORS } = window.PhilosopherQuizData;

  function emptyDims() {
    const dims = {};
    DIMENSIONS.forEach((key) => { dims[key] = 0; });
    return dims;
  }

  function addDims(target, source) {
    if (!source) return target;
    DIMENSIONS.forEach((key) => {
      target[key] += source[key] || 0;
    });
    return target;
  }

  function dotProduct(a, b) {
    return DIMENSIONS.reduce((sum, key) => sum + (a[key] || 0) * (b[key] || 0), 0);
  }

  function magnitude(dims) {
    return Math.sqrt(DIMENSIONS.reduce((sum, key) => sum + (dims[key] || 0) ** 2, 0));
  }

  function computeUserDims(answers) {
    const user = emptyDims();
    answers.forEach((choice) => addDims(user, choice.dims));
    return user;
  }

  function rankAuthors(answers) {
    const userDims = computeUserDims(answers);
    const userMag = magnitude(userDims) || 1;

    const ranked = AUTHORS.map((author) => {
      const authorDims = author.dims;
      const authorMag = magnitude(authorDims) || 1;
      const raw = dotProduct(userDims, authorDims);
      const similarity = raw / (userMag * authorMag);
      const matchPct = Math.round(Math.min(100, Math.max(35, similarity * 100)));
      return {
        id: author.id,
        name: author.name,
        era: author.era,
        typeName: author.typeName,
        work: author.work,
        workAsin: author.workAsin,
        traits: author.traits,
        blurb: author.blurb,
        score: raw,
        matchPct,
      };
    });

    ranked.sort((a, b) => b.matchPct - a.matchPct || b.score - a.score);
    const top = ranked[0];
    const topPct = top.matchPct || 1;
    ranked.forEach((item) => {
      item.barPct = Math.round((item.matchPct / topPct) * 100);
    });

    return { userDims, ranked, top };
  }

  window.PhilosopherQuizEngine = {
    computeUserDims,
    rankAuthors,
  };
})();
