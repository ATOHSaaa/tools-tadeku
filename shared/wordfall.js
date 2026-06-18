(function () {
    const gasUrl = window.WORDFALL_CONFIG?.gasUrl;
    if (!gasUrl) {
        console.error('WORDFALL_CONFIG.gasUrl is required');
        return;
    }

    async function fetchWords() {
        try {
            const response = await fetch(gasUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (e) {
            console.error('データの取得に失敗しました:', e);
            return [{ word: '取得失敗。URLを確認してください', url: '#' }];
        }
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
        const words = await fetchWords();
        if (words.length === 0) return;
        setInterval(() => {
            const randomIndex = Math.floor(Math.random() * words.length);
            createWord(words[randomIndex]);
        }, 200);
    }

    init();
})();
