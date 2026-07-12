(function () {
  const PROMO_URL = 'https://tadeku.net/109596/';
  const PROMO_TEXT = '【7月13日まで】『感情類語辞典』などが50%OFF - 蓼食う本の虫';

  const PROMO_END = new Date(2026, 6, 14); // 2026-07-14 0:00 以降は非表示

  function isActive() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today < PROMO_END;
  }

  function createAd(extraClass) {
    const p = document.createElement('p');
    p.className = 'quiz-promo-ad' + (extraClass ? ' ' + extraClass : '');
    p.append('＼');
    const a = document.createElement('a');
    a.href = PROMO_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = PROMO_TEXT;
    p.append(a, '／');
    return p;
  }

  function mount() {
    if (!isActive()) return null;

    const viewQuiz = document.getElementById('view-quiz');
    if (!viewQuiz) return null;

    const quizAd = createAd('view');
    quizAd.hidden = true;
    viewQuiz.insertAdjacentElement('afterend', quizAd);

    const resultWrap = document.getElementById('view-result-wrap');
    if (resultWrap) {
      const resultAd = createAd('quiz-promo-ad-result');
      const anchor = resultWrap.querySelector('.cross-banner-list, a.cross-banner');
      if (anchor) {
        resultWrap.insertBefore(resultAd, anchor);
      } else {
        resultWrap.appendChild(resultAd);
      }
    }

    return { quizAd };
  }

  const state = mount();

  window.QuizPromo = {
    onViewChange(name) {
      if (state?.quizAd) state.quizAd.hidden = name !== 'quiz';
    },
  };
})();
