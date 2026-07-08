(function () {
  const { DIMENSIONS, WORKS } = window.DazaiWorkQuizData;

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

  function rankWorks(answers) {
    const userDims = computeUserDims(answers);
    const userMag = magnitude(userDims) || 1;

    const ranked = WORKS.map((work) => {
      const workDims = work.dims;
      const workMag = magnitude(workDims) || 1;
      const raw = dotProduct(userDims, workDims);
      const similarity = raw / (userMag * workMag);
      const matchPct = Math.round(Math.min(100, Math.max(35, similarity * 100)));
      return {
        id: work.id,
        name: work.name,
        year: work.year,
        typeName: work.typeName,
        workUrl: work.workUrl,
        traits: work.traits,
        blurb: work.blurb,
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

  window.DazaiWorkQuizEngine = {
    computeUserDims,
    rankWorks,
  };
})();
