(function () {
    const config = window.WORDFALL_CONFIG;
    const state = { words: config?.words || [], recentSpawns: [] };
    const gasUrl = config?.gasUrl;

    if (!state.words.length) {
        console.error('WORDFALL_CONFIG.words is required');
        return;
    }

    function getSettings() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        // 画面面積に比例した語数を保ち、幅が変わっても体感密度を一定にする
        const maxWords = Math.max(8, Math.min(40, Math.round((w * h) / 26000)));
        return {
            spawnInterval: 380,
            maxWords,
            initialCount: Math.min(Math.round(maxWords * 0.7), state.words.length),
            minDuration: 22,
            maxDuration: 34,
        };
    }

    function pickWord() {
        return state.words[Math.floor(Math.random() * state.words.length)];
    }

    // 直近に出した語から横方向に離れた位置を選び、重なりを減らす
    function pickLeftVw() {
        const now = Date.now();
        state.recentSpawns = state.recentSpawns.filter((s) => now - s.t < 9000);

        let best = Math.random() * 88;
        let bestScore = -1;
        for (let i = 0; i < 10; i++) {
            const candidate = Math.random() * 88;
            let score = Infinity;
            state.recentSpawns.forEach((s) => {
                const ageSec = (now - s.t) / 1000;
                score = Math.min(score, Math.abs(candidate - s.left) + ageSec * 4);
            });
            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        state.recentSpawns.push({ t: now, left: best });
        return best;
    }

    // 画面より下に抜けた語以外（画面内＋出現待ち）をすべて数える
    function activeWordCount() {
        const vh = window.innerHeight;
        return [...document.querySelectorAll('.word')].filter((el) => {
            return el.getBoundingClientRect().top < vh;
        }).length;
    }

    function createWord(wordObj, prefillFraction) {
        const settings = getSettings();
        if (!prefillFraction && activeWordCount() >= settings.maxWords) return;

        const a = document.createElement('a');
        a.innerText = wordObj.word;
        a.href = wordObj.url;
        a.target = '_blank';
        a.className = 'word';
        a.style.left = pickLeftVw() + 'vw';

        const duration = Math.random() * (settings.maxDuration - settings.minDuration) + settings.minDuration;
        a.style.animationDuration = duration + 's';

        let remainMs = duration * 1000;
        if (prefillFraction) {
            // 負のdelayで落下途中から表示し、初期画面から語が見えるようにする
            a.style.animationDelay = (-prefillFraction * duration) + 's';
            remainMs = duration * (1 - prefillFraction) * 1000;
        }

        document.body.appendChild(a);
        setTimeout(() => a.remove(), remainMs);
    }

    function refreshFromGas() {
        if (!gasUrl || !navigator.onLine) return;

        fetch(gasUrl)
            .then((response) => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then((fresh) => {
                if (fresh?.length) state.words = fresh;
            })
            .catch((e) => {
                console.warn('GAS からの取得に失敗したため、同梱データを使います:', e);
            });
    }

    function scheduleSpawn() {
        createWord(pickWord());
        setTimeout(scheduleSpawn, getSettings().spawnInterval);
    }

    refreshFromGas();

    const initial = getSettings().initialCount;
    for (let i = 0; i < initial; i++) {
        createWord(pickWord(), 0.05 + Math.random() * 0.8);
    }

    scheduleSpawn();
})();
