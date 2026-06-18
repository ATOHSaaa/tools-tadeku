(function () {
    const words = window.WORDFALL_CONFIG?.words;
    if (!words?.length) {
        console.error('WORDFALL_CONFIG.words is required');
        return;
    }

    function pickWord() {
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

    const initialCount = Math.min(5, words.length);
    for (let i = 0; i < initialCount; i++) {
        createWord(pickWord());
    }

    setInterval(() => {
        createWord(pickWord());
    }, 200);
})();
