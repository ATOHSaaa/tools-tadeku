(function () {
    const script = document.currentScript;
    const mode = script?.dataset?.wordfall;
    const gasUrl = window.WORDFALL_CONFIG?.gasUrl;

    function getWordsPromise() {
        if (window.__wordfallWordsPromise) {
            return window.__wordfallWordsPromise;
        }
        if (!gasUrl) {
            return Promise.resolve([]);
        }
        window.__wordfallWordsPromise = fetch(gasUrl)
            .then((response) => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .catch((e) => {
                console.error('データの取得に失敗しました:', e);
                return [{ word: '取得失敗。URLを確認してください', url: '#' }];
            });
        return window.__wordfallWordsPromise;
    }

    if (mode === 'prefetch') {
        getWordsPromise();
        return;
    }

    if (!gasUrl) {
        console.error('WORDFALL_CONFIG.gasUrl is required');
        return;
    }

    function pickWord(words) {
        return words[Math.floor(Math.random() * words.length)];
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

    async function init() {
        const words = await getWordsPromise();
        if (words.length === 0) return;

        const initialCount = Math.min(5, words.length);
        for (let i = 0; i < initialCount; i++) {
            createWord(pickWord(words));
        }

        setInterval(() => {
            createWord(pickWord(words));
        }, 200);
    }

    init();
})();
