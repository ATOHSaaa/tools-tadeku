import {
  JODAI_WORKS,
  JODAI_AUTHORS,
  CHUKO_WORKS,
  CHUKO_AUTHORS,
  CHUSEI_WORKS,
  CHUSEI_AUTHORS,
  KINSEI_WORKS,
  KINSEI_AUTHORS,
  KINDAI_PAIRS,
  KINDAI_MOVEMENTS,
  JODAI_RELATED,
  isNamedAuthor,
} from './bungakushi-explanations.mjs';

const raw = await import('fs').then((fs) =>
  fs.promises.readFile(new URL('../shared/bungakushi-quiz-data.js', import.meta.url), 'utf8'));
const start = raw.indexOf('const QUESTIONS_BY_ERA = ');
const end = raw.indexOf('\n  const QUESTIONS = Object.values');
const objStr = raw.slice(start + 'const QUESTIONS_BY_ERA = '.length, end).trim().replace(/;$/, '');
const QUESTIONS_BY_ERA = Function(`return ${objStr}`)();
const QUESTIONS = Object.values(QUESTIONS_BY_ERA).flat();

const issues = [];

function add(id, type, msg) {
  issues.push({ id, type, msg });
}

const workCatalog = new Map();
const authorCatalog = new Map();
[
  ['上代', JODAI_WORKS, JODAI_AUTHORS],
  ['中古', CHUKO_WORKS, CHUKO_AUTHORS],
  ['中世', CHUSEI_WORKS, CHUSEI_AUTHORS],
  ['近世', KINSEI_WORKS, KINSEI_AUTHORS],
].forEach(([era, works, authors]) => {
  works.forEach((w) => workCatalog.set(`${era}:${w.work}`, w));
  authors.forEach((a) => authorCatalog.set(`${era}:${a.name}`, a));
});

const kindaiByAuthor = new Map(KINDAI_PAIRS.map((p) => [p.author, p]));
const kindaiByWork = new Map(KINDAI_PAIRS.map((p) => [p.work, p]));
const movementByName = new Map(KINDAI_MOVEMENTS.map((m) => [m.movement, m]));

QUESTIONS.forEach((q) => {
  const answer = q.choices[q.correct];

  // Generic checks
  if (new Set(q.choices).size !== 4) add(q.id, 'duplicate', '選択肢に重複あり');
  if (/編者ら|作者不詳|^不詳$|編者不明|編纂者ら/.test(answer) && /作者|撰者/.test(q.text)) {
    add(q.id, 'vague-author', `曖昧な作者が正解: ${answer}`);
  }
  if (/と関連が深い/.test(q.text)) {
    const m = q.text.match(/『(.+?)』/);
    if (m && answer === m[1]) add(q.id, 'self-ref', '自分自身が正解');
  }
  if (answer === '近代写実') add(q.id, 'bad-movement', '近代写実が正解');

  // Explanation mismatches
  if (/の作者は誰|の作者として|の撰者として/.test(q.text)) {
    const wm = q.text.match(/『(.+?)』/);
    if (wm) {
      const work = wm[1];
      const eraEntry = [...workCatalog.entries()].find(([k, w]) => w.work === work);
      if (eraEntry) {
        const [, w] = eraEntry;
        if (isNamedAuthor(w.author) && answer !== w.author) {
          add(q.id, 'wrong-answer', `正解不一致: 期待=${w.author}, 実際=${answer}`);
        }
        if (!q.explanation.includes(answer)) {
          add(q.id, 'explain', `解説に正解「${answer}」が含まれない`);
        }
      }
    }
  }

  if (/が関わる作品|が知られる作品|の代表作として/.test(q.text)) {
    const am = q.text.match(/^(.+?)が/);
    if (am) {
      const author = am[1];
      const kindai = kindaiByAuthor.get(author);
      const eraAuthor = [...authorCatalog.entries()].find(([, a]) => a.name === author);
      const expected = kindai?.work || eraAuthor?.[1]?.work;
      if (expected && answer !== expected) {
        add(q.id, 'wrong-answer', `作家の代表作: 期待=${expected}, 実際=${answer}`);
      }
    }
  }

  if (/「(.+?)」の代表作家/.test(q.text)) {
    const mm = q.text.match(/「(.+?)」/);
    const mov = movementByName.get(mm[1]);
    if (mov && answer !== mov.author) {
      add(q.id, 'wrong-answer', `流派代表: 期待=${mov.author}, 実際=${answer}`);
    }
  }

  if (/属する潮流/.test(q.text)) {
    const am = q.text.match(/で(.+?)が属する/);
    const kindai = kindaiByAuthor.get(am?.[1]);
    if (kindai && answer !== kindai.movement) {
      add(q.id, 'wrong-answer', `潮流: 期待=${kindai.movement}, 実際=${answer}`);
    }
  }

  // Suspicious explanation templates
  if (/作者とセットで覚える/.test(q.explanation) && /作者不詳|編者不明/.test(q.explanation)) {
    add(q.id, 'explain', '不明な作者なのに「作者とセット」');
  }
  if (/正解は舎人親王|正解は編者|正解は作者不詳/.test(q.explanation) && !/の作者|の撰者/.test(q.text)) {
    add(q.id, 'explain', '設問と解説の形式不一致');
  }
});

// Catalog-level issues
if (CHUSEI_WORKS.some((w) => w.work === '奥の細道')) {
  add('catalog', 'era', '奥の細道が中世作品に含まれている（近世・芭蕉）');
}

const nonWorkAnswers = ['俳諧', '俳句', '蘭学', '国学', '浮世草子'];
QUESTIONS.forEach((q) => {
  const answer = q.choices[q.correct];
  if (/作品として|作品・文献は/.test(q.text) && nonWorkAnswers.includes(answer)) {
    add(q.id, 'non-work', `分野名「${answer}」が作品の正解になっている`);
  }
  if (/ジャンルとして/.test(q.text)) {
    const m = q.text.match(/『(.+?)』/);
    const work = m?.[1];
    const catalog = [...workCatalog.entries()].find(([, w]) => w.work === work);
    if (catalog && catalog[1].genre && answer !== catalog[1].genre) {
      add(q.id, 'genre', `ジャンル不一致: 期待=${catalog[1].genre}, 実際=${answer}`);
    }
  }
  if (/と関連が深い/.test(q.text)) {
    const m = q.text.match(/『(.+?)』/);
    const subject = m?.[1];
    if (subject && q.choices.includes(subject)) {
      add(q.id, 'self-ref', `設問の作品「${subject}」が選択肢に含まれている`);
    }
  }
});

console.log(`Audited ${QUESTIONS.length} questions, found ${issues.length} issues:\n`);
issues.forEach((i) => console.log(`[${i.type}] ${i.id}: ${i.msg}`));
