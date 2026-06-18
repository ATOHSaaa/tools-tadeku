(function () {
    const config = window.WORDFALL_CONFIG;
    const state = { words: config?.words || [] };
    const gasUrl = config?.gasUrl;

    if (!state.words.length) {
        console.error('WORDFALL_CONFIG.words is required');
        return;
    }

    function pickWord() {
        return state.words[Math.floor(Math.random() * state.words.length)];
    }

    function createWord(wordObj) {
        const a = document.createElement('a');
        a.innerText = wordObj.word;
        a.href = wordObj.url;
        a.target = '_blank';
        a.className = 'word';
        a.style.left = Math.random() * 90 + 'vw';
        const duration = Math.random() * 20 + 20;
        a.style.animationDuration = duration + 's';
        document.body.appendChild(a);
        setTimeout(() => a.remove(), duration * 1000);
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

    refreshFromGas();

    const initialCount = Math.min(5, state.words.length);
    for (let i = 0; i < initialCount; i++) {
        createWord(pickWord());
    }

    setInterval(() => {
        createWord(pickWord());
    }, 200);
})();
