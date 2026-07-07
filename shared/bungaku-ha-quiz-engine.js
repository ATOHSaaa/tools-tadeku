(function () {
  const { DIMENSIONS, MOVEMENTS, VOTE_BLEND } = window.BungakuHaQuizData;

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

  function computeMovementVotes(answers) {
    const votes = {};
    MOVEMENTS.forEach((movement) => { votes[movement.id] = 0; });
    answers.forEach((choice) => {
      if (choice.movementId) votes[choice.movementId] += 1;
    });
    return votes;
  }

  function rankMovements(answers) {
    const userDims = computeUserDims(answers);
    const userMag = magnitude(userDims) || 1;
    const votes = computeMovementVotes(answers);
    const maxVotes = Math.max(...Object.values(votes), 1);
    const voteBlend = VOTE_BLEND ?? 0.85;

    const ranked = MOVEMENTS.map((movement) => {
      const movementDims = movement.dims;
      const movementMag = magnitude(movementDims) || 1;
      const raw = dotProduct(userDims, movementDims);
      const cosine = raw / (userMag * movementMag);
      const voteScore = votes[movement.id] / maxVotes;
      const similarity = cosine * (1 - voteBlend) + voteScore * voteBlend;
      const matchPct = Math.round(Math.min(100, Math.max(35, similarity * 100)));
      return {
        id: movement.id,
        name: movement.name,
        era: movement.era,
        typeName: movement.typeName,
        examples: movement.examples,
        traits: movement.traits,
        blurb: movement.blurb,
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

  window.BungakuHaQuizEngine = {
    computeUserDims,
    rankMovements,
  };
})();
