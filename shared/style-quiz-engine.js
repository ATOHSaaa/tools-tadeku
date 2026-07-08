(function () {
  const { DIMENSIONS, TYPES } = window.StyleQuizData;

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

  function rankTypes(answers) {
    const userDims = computeUserDims(answers);
    const userMag = magnitude(userDims) || 1;

    const ranked = TYPES.map((type) => {
      const typeDims = type.dims;
      const typeMag = magnitude(typeDims) || 1;
      const raw = dotProduct(userDims, typeDims);
      const similarity = raw / (userMag * typeMag);
      const matchPct = Math.round(Math.min(100, Math.max(35, similarity * 100)));
      return {
        id: type.id,
        name: type.name,
        typeName: type.typeName,
        subtitle: type.subtitle,
        traits: type.traits,
        blurb: type.blurb,
        picks: type.picks,
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

    const maxUser = Math.max(...DIMENSIONS.map((key) => userDims[key] || 0), 1);
    const userAxis = DIMENSIONS.map((key) => ({
      key,
      value: userDims[key] || 0,
      barPct: Math.round(((userDims[key] || 0) / maxUser) * 100),
    }));

    return { userDims, userAxis, ranked, top };
  }

  window.StyleQuizEngine = {
    computeUserDims,
    rankTypes,
  };
})();
