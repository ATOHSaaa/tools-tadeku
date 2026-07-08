import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
  explainWorkAuthor,
  explainAuthorWork,
  explainGenre,
  explainMovement,
  explainField,
  factExplain,
  isNamedAuthor,
  authorQuestionLabel,
  JODAI_RELATED,
  explainRelatedWork,
} from './bungakushi-explanations.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '../shared/bungakushi-quiz-data.js');

const ERAS = [
  { id: 'jodai', name: '上代', period: '〜794年', blurb: '記紀・万葉・伝説文学' },
  { id: 'chuko', name: '中古', period: '794〜1185年', blurb: '王朝文学・和歌・物語' },
  { id: 'chusei', name: '中世', period: '1185〜1603年', blurb: '軍記・随筆・連歌・五山文学' },
  { id: 'kinsei', name: '近世', period: '1603〜1868年', blurb: '俳諧・浮世草子・戯曲・国学' },
  { id: 'kindai', name: '近代', period: '1868年〜', blurb: '近代小説・短歌・プロレタリア文学' },
  { id: 'all', name: 'すべて', period: '全時代', blurb: '500問からランダム出題' },
];

const GRADES = [
  { min: 100, name: '文学博士', blurb: '完璧です。文学史の教科書そのもの。' },
  { min: 90, name: '准教授', blurb: 'ほぼ満点。細部まで押さえています。' },
  { min: 75, name: '大学院生', blurb: 'しっかり基礎が身についています。' },
  { min: 60, name: '文学部生', blurb: '概ね正解。もう一歩で上級者。' },
  { min: 40, name: '受験生', blurb: '要点は掴めています。復習で伸びしろ大。' },
  { min: 0, name: '書生見習い', blurb: '解説を読みながら、もう一度挑戦してみましょう。' },
];

const ROUND_SIZE = 10;
const QUESTIONS_PER_ERA = 100;

function slug(text) {
  return String(text).replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-').slice(0, 40);
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickOthers(pool, value, count) {
  const others = [...new Set(pool.filter((item) => item !== value))];
  return shuffle(others).slice(0, count);
}

function makeQuestion(eraId, id, text, correct, wrongPool, explanation) {
  const eraName = ERAS.find((e) => e.id === eraId).name;
  const wrong = pickOthers(wrongPool, correct, 3);
  if (wrong.length < 3) return null;
  const choices = shuffle([correct, ...wrong]);
  return {
    id,
    era: eraName,
    text,
    choices,
    correct: choices.indexOf(correct),
    explanation,
  };
}

function finalizeQuestions(rawList, eraId) {
  const seen = new Set();
  const out = [];
  rawList.forEach((item) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  });
  if (out.length < QUESTIONS_PER_ERA) {
    throw new Error(`${eraId}: ${out.length}問しか生成できません（${QUESTIONS_PER_ERA}問必要）`);
  }
  return out.slice(0, QUESTIONS_PER_ERA);
}

function q(eraName, id, text, choices, correctIndex, explanation) {
  return { id, era: eraName, text, choices, correct: correctIndex, explanation };
}

const YEAR_CHOICES = ['645年', '712年', '751年', '794年', '905年', '951年', '1005年', '1185年', '1212年', '1330年'];

const GENRE_POOL = [
  '軍記物語', '浮世草子', '戯曲', '随筆', '私小説', '近代小説', '王朝物語', '歌物語',
  '日記', '歌集', '勅撰和歌集', '記紀', '風土記', '物語', '歌集・詩集', '説話集',
  '国学', '紀行文', '浄瑠璃・歌舞伎', '歌舞伎', '軍記・物語', '祝詞', '浮世文学', '王朝文学',
];

function normalizeYear(year) {
  if (!year) return null;
  if (/8世紀後半/.test(year)) return '8世紀';
  return year.replace(/頃$/, '');
}

function makeYearQuestion(eraId, eraName, work, year, body, id) {
  const correct = normalizeYear(year);
  if (!correct) return null;
  const pool = YEAR_CHOICES.concat([correct]).filter((v, i, a) => a.indexOf(v) === i);
  return makeQuestion(
    eraId,
    id,
    `『${work}』の成立・撰進の時期として最も近いのは？`,
    correct,
    pool,
    `正解は${correct}。${body}`,
  );
}

function buildFromCatalog(eraId, eraName, works, authors, facts, extraBuilders) {
  const workTitles = [...new Set([
    ...works.map((w) => w.work),
    ...authors.map((a) => a.work),
  ])];
  const authorNames = authors.map((a) => a.name);
  const namedWorks = works.filter((w) => isNamedAuthor(w.author));
  const wrongAuthors = authorNames.concat(namedWorks.map((w) => w.author));
  const wrongGenres = GENRE_POOL;

  const generated = [];
  works.forEach((w) => {
    if (isNamedAuthor(w.author)) {
      const role = authorQuestionLabel(w.work);
      generated.push(makeQuestion(
        eraId,
        `${eraId}-wa-${slug(w.work)}`,
        `『${w.work}』の${role}として最も適切なのは？`,
        w.author,
        wrongAuthors,
        explainWorkAuthor(w.work, w.author, eraName, w.body),
      ));
    } else {
      generated.push(makeYearQuestion(
        eraId,
        eraName,
        w.work,
        w.year,
        w.body,
        `${eraId}-wy-${slug(w.work)}`,
      ));
    }
    if (w.genre) {
      generated.push(makeQuestion(
        eraId,
        `${eraId}-wg-${slug(w.work)}`,
        `『${w.work}』のジャンルとして最も近いのは？`,
        w.genre,
        wrongGenres,
        explainGenre(w.work, w.genre, eraName, w.body),
      ));
    }
  });
  authors.forEach((a) => {
    generated.push(makeQuestion(
      eraId,
      `${eraId}-aw-${slug(a.name)}`,
      `${a.name}が関わる作品として最も適切なのは？`,
      a.work,
      workTitles,
      explainAuthorWork(a.name, a.work, eraName, a.body),
    ));
  });

  extraBuilders.forEach((builder) => generated.push(...builder()));

  return finalizeQuestions([...facts, ...generated.filter(Boolean)], eraId);
}

function buildJodai() {
  const era = '上代';
  const eraId = 'jodai';
  const facts = [
    q(era, 'jodai-f1', '万葉集の仮名表記として知られるのはどれ？', ['万葉仮名', '片仮名', '平仮名', '送り仮名'], 0, factExplain('jodai-f1')),
    q(era, 'jodai-f2', '古事記の成立年に最も近いのは？', ['712年', '794年', '905年', '1185年'], 0, factExplain('jodai-f2')),
    q(era, 'jodai-f3', '日本書紀の文体として正しいのは？', ['漢文', '仮名文', '言文一致', '口語体'], 0, factExplain('jodai-f3')),
    q(era, 'jodai-f4', '「上代」が指す時代として最も適切なのは？', ['大化改新〜平安遷都前', '江戸時代', '明治以降', '鎌倉時代'], 0, factExplain('jodai-f4')),
    q(era, 'jodai-f5', '記紀の「記」が指すのは？', ['古事記', '日本書紀', '万葉集', '風土記'], 0, factExplain('jodai-f5')),
    q(era, 'jodai-f6', '記紀の「紀」が指すのは？', ['日本書紀', '古事記', '続日本紀', '日本後紀'], 0, factExplain('jodai-f6')),
    q(era, 'jodai-f7', '万葉集の巻数として知られるのは？', ['20巻', '54帖', '100首', '4巻'], 0, factExplain('jodai-f7')),
    q(era, 'jodai-f8', '竹取物語の主人公は？', ['かぐや姫', '紫式部', '清少納言', '小野小町'], 0, factExplain('jodai-f8')),
    q(era, 'jodai-f9', '風土記の叙述で知られる特徴は？', ['仮名交じりの説話性', '俳諧の句', '軍記の語り', '戯曲のセリフ'], 0, factExplain('jodai-f9')),
    q(era, 'jodai-f10', '上代の歌の形式として基本は？', ['和歌（短歌）', '連歌', '俳句', '自由詩'], 0, factExplain('jodai-f10')),
  ];
  const extraFacts = [
    ['jodai-e1', '大化改新が行われた年に最も近いのは？', ['645年', '794年', '1192年', '1603年']],
    ['jodai-e2', '平城京に都が置かれた時代は？', ['奈良時代', '平安時代', '鎌倉時代', '江戸時代']],
    ['jodai-e3', '万葉歌人として知られないのは？', ['松尾芭蕉', '柿本人麻呂', '大伴家持', '山上憶良']],
    ['jodai-e4', '上代の文字文化で漢字の用途として正しいのは？', ['表記・表意', '印刷活字', 'ローマ字併記', 'タイプライター']],
    ['jodai-e5', '「聖徳太子」が関連する文献は？', ['十七条の憲法', '源氏物語', '平家物語', '徒然草']],
    ['jodai-e6', '日本最古級の漢詩集は？', ['懐風藻', '万葉集', '古今和歌集', '新古今和歌集']],
    ['jodai-e7', '古事記の内容の柱として正しいのは？', ['神話と皇室系譜', '都市の恋愛', '戦国の合戦', '滑稽な噺']],
    ['jodai-e8', '万葉集の歌題「反歌」とは？', ['相和歌', '長歌', '旋頭歌', '葬送歌']],
    ['jodai-e9', '上代文学の媒体として最も多いのは？', ['竹簡・木簡・紙', '活字印刷', 'Web', 'ラジオ']],
    ['jodai-e10', '「長歌」の代表的歌人は？', ['柿本人麻呂', '松尾芭蕉', '与謝蕪村', '正岡子規']],
  ];

  return buildFromCatalog(eraId, era, JODAI_WORKS, JODAI_AUTHORS, facts, [
    () => extraFacts.map(([id, text, choices]) => q(era, id, text, choices, 0, factExplain(id))),
    () => {
      const workTitles = JODAI_WORKS.map((item) => item.work);
      const relatedEntries = Object.entries(JODAI_RELATED);
      const out = [];
      for (let i = 1; i <= 50; i += 1) {
        const [work, { related, note }] = relatedEntries[i % relatedEntries.length];
        const wrongPool = workTitles.filter((title) => title !== work);
        out.push(makeQuestion(
          eraId,
          `jodai-v-${i}`,
          `上代文学で『${work}』と関連が深いのはどれ？`,
          related,
          wrongPool,
          explainRelatedWork(work, related, note),
        ));
      }
      return out;
    },
    () => {
      const workTitles = JODAI_WORKS.map((item) => item.work);
      const out = [];
      for (let i = 1; i <= 50; i += 1) {
        const a = JODAI_AUTHORS[i % JODAI_AUTHORS.length];
        out.push(makeQuestion(
          eraId,
          `jodai-p-${i}`,
          `${a.name}が知られる作品・文献は？`,
          a.work,
          workTitles,
          explainAuthorWork(a.name, a.work, era, a.body),
        ));
      }
      return out.filter(Boolean);
    },
  ]);
}

function buildChuko() {
  const era = '中古';
  const eraId = 'chuko';
  const facts = [
    q(era, 'chuko-f1', '「中古」が指す時代として最も適切なのは？', ['平安時代', '江戸時代', '明治時代', '奈良時代'], 0, factExplain('chuko-f1')),
    q(era, 'chuko-f2', '王朝物語の代表作は？', ['源氏物語', '平家物語', '武家物語', '浮世物語'], 0, factExplain('chuko-f2')),
    q(era, 'chuko-f3', '仮名文学の成立に寄与したのは？', ['女房の手習い文化', '武士の軍記', '商人の草子', '禅僧の語録'], 0, factExplain('chuko-f3')),
    q(era, 'chuko-f4', '六歌仙に含まれるのは？', ['小野小町', '松尾芭蕉', '石川啄木', '与謝野晶子'], 0, factExplain('chuko-f4')),
    q(era, 'chuko-f5', '「物の哀れ」を説いたのは？', ['本居宣長（後世の総括）', '紫式部', '近松門左衛門', '坪内逍遥'], 0, factExplain('chuko-f5')),
    q(era, 'chuko-f6', '勅撰和歌集の第一とされるのは？', ['古今和歌集', '万葉集', '新古今和歌集', '小倉百人一首'], 0, factExplain('chuko-f6')),
    q(era, 'chuko-f7', '古今和歌集の特徴として知られるのは？', ['和歌の規範化', '幽玄・余情', '滑稽・風刺', '政治宣伝'], 0, factExplain('chuko-f7')),
    q(era, 'chuko-f8', '日記文学の例として正しいのは？', ['更級日記', '羅生門', '檸檬', '人間失格'], 0, factExplain('chuko-f8')),
    q(era, 'chuko-f9', '歌物語の例は？', ['伊勢物語', '竹取物語', '好色一代男', '浮云'], 0, factExplain('chuko-f9')),
    q(era, 'chuko-f10', '平安末期に『今昔物語集』が成立。これは？', ['説話集', '歌集', '軍記', '俳諧集'], 0, factExplain('chuko-f10')),
  ];
  const moreFacts = [
    ['chuko-m1', '三十六歌仙の人数は？', ['36人', '100人', '54人', '20人']],
    ['chuko-m2', '女流文学が盛んだった背景は？', ['仮名文化', '印刷出版', '洋書輸入', 'ラジオ']],
    ['chuko-m3', '「王朝文学」の舞台は？', ['平安の宮廷', '江戸の町', '鎌倉の武家', '明治の都市']],
    ['chuko-m4', '『源氏物語』の帖数は？', ['54帖', '20巻', '100首', '4巻']],
    ['chuko-m5', '清少納言の作品は？', ['枕草子', '源氏物語', '平家物語', '徒然草']],
    ['chuko-m6', '和歌の基本音数は？', ['31音', '17音', '5・7のみ', '自由']],
    ['chuko-m7', '『土佐日記』の特徴は？', ['仮名序', '軍記', '滑稽', '推理']],
    ['chuko-m8', '後鳥羽院と関連するのは？', ['和歌所', '浮世草子', '新聞', '活字']],
    ['chuko-m9', '『更級日記』の作者は？', ['菅原孝標女', '紫式部', '清少納言', '和泉式部']],
    ['chuko-m10', '中古の終わりに近い出来事は？', ['平家の滅亡', '大化改新', '明治維新', '関ヶ原']],
  ];

  return buildFromCatalog(eraId, era, CHUKO_WORKS, CHUKO_AUTHORS, facts, [
    () => moreFacts.map(([id, text, choices]) => q(era, id, text, choices, 0, factExplain(id))),
    () => {
      const namedWorks = CHUKO_WORKS.filter((item) => isNamedAuthor(item.author));
      const wrongAuthors = [...new Set(CHUKO_AUTHORS.map((item) => item.name).concat(namedWorks.map((item) => item.author)))];
      const out = [];
      for (let i = 1; i <= 100; i += 1) {
        const w = namedWorks[i % namedWorks.length];
        const role = authorQuestionLabel(w.work);
        out.push(makeQuestion(
          eraId,
          `chuko-v-${i}`,
          `『${w.work}』の${role}として正しいのは誰？`,
          w.author,
          wrongAuthors,
          explainWorkAuthor(w.work, w.author, era, w.body),
        ));
      }
      return out.filter(Boolean);
    },
  ]);
}

function buildChusei() {
  const era = '中世';
  const eraId = 'chusei';
  const facts = [
    q(era, 'chusei-f1', '軍記物語の代表作は？', ['平家物語', '源氏物語', '枕草子', '浮云'], 0, factExplain('chusei-f1')),
    q(era, 'chusei-f2', '「中世」の開始に近い出来事は？', ['鎌倉幕府成立', '大化改新', '明治維新', '関ヶ原の戦い'], 0, factExplain('chusei-f2')),
    q(era, 'chusei-f3', '五山文学で用いられた文体は？', ['漢文', '仮名草子', '言文一致', '口語小説'], 0, factExplain('chusei-f3')),
    q(era, 'chusei-f4', '連歌の形式として正しいのは？', ['複数歌人が句を詠む', '一人が長歌', '31音のみ', '自由韻'], 0, factExplain('chusei-f4')),
    q(era, 'chusei-f5', '『方丈記』のテーマは？', ['無常', '恋愛', '滑稽', '科学'], 0, factExplain('chusei-f5')),
    q(era, 'chusei-f6', '『徒然草』の文体は？', ['随筆', '軍記', '草双紙', '新聞'], 0, factExplain('chusei-f6')),
    q(era, 'chusei-f7', '説話文学の集大成は？', ['今昔物語集', '万葉集', '浮世草子', '私小説'], 0, factExplain('chusei-f7')),
    q(era, 'chusei-f8', '和歌所を設けたのは？', ['後鳥羽院', '聖徳太子', '德川家康', '明治天皇'], 0, factExplain('chusei-f8')),
    q(era, 'chusei-f9', '中世の新仏教と文学の関係で正しいのは？', ['教典・語録が漢文で書かれる', '俳句のみ', '活字出版', 'ラジオ放送'], 0, factExplain('chusei-f9')),
    q(era, 'chusei-f10', '「平家物語」の語りの特徴は？', ['語りと韻文の交錯', '一人称私小説', '書簡体', '対話劇のみ'], 0, factExplain('chusei-f10')),
  ];

  return buildFromCatalog(eraId, era, CHUSEI_WORKS, CHUSEI_AUTHORS, facts, [
    () => {
      const out = [];
      const wrongGenres = GENRE_POOL;
      for (let i = 1; i <= 70; i += 1) {
        const w = CHUSEI_WORKS[i % CHUSEI_WORKS.length];
        const correct = w.genre;
        const choices = shuffle([correct, ...pickOthers(wrongGenres, correct, 3)]);
        out.push(q(
          era,
          `chusei-x-${i}`,
          `中世文学で『${w.work}』が属するジャンルに最も近いのは？`,
          choices,
          choices.indexOf(correct),
          explainGenre(w.work, correct, era, w.body),
        ));
      }
      return out;
    },
  ]);
}

function buildKinsei() {
  const era = '近世';
  const eraId = 'kinsei';
  const facts = [
    q(era, 'kinsei-f1', '松尾芭蕉の俳諧理念は？', ['不易流行', '自然主義', '新感覚', '白樺派'], 0, factExplain('kinsei-f1')),
    q(era, 'kinsei-f2', '浮世草子の特徴は？', ['町人の生活と欲望', '贵族恋愛', '軍記', '私小説'], 0, factExplain('kinsei-f2')),
    q(era, 'kinsei-f3', '近松門左衛門の作品形式は？', ['浄瑠璃・歌舞伎', '能楽のみ', '落語', '新聞'], 0, factExplain('kinsei-f3')),
    q(era, 'kinsei-f4', '本居宣長の『物の哀れ』論は何を対象に？', ['源氏物語', '万葉集', '平家物語', '浮云'], 0, factExplain('kinsei-f4')),
    q(era, 'kinsei-f5', '江戸時代の読み物「読本」の例は？', ['八犬伝', '源氏物語', '方丈記', '羅生門'], 0, factExplain('kinsei-f5')),
    q(era, 'kinsei-f6', '滑稽本の例は？', ['東海道中膝栗毛', '曾根崎心中', '万葉集', '枕草子'], 0, factExplain('kinsei-f6')),
    q(era, 'kinsei-f7', '俳句の定型音数は？', ['17音（5-7-5）', '31音', '7-5', '自由'], 0, factExplain('kinsei-f7')),
    q(era, 'kinsei-f8', '国学の目的として近いのは？', ['日本古典の研究', '西洋文学翻訳', '政治宣伝', '科学実験'], 0, factExplain('kinsei-f8')),
    q(era, 'kinsei-f9', '「近世」が指す時代は？', ['江戸時代中心', '平安', '明治', '奈良'], 0, factExplain('kinsei-f9')),
    q(era, 'kinsei-f10', '草双紙・絵本の読者層は？', ['庶民・町人', '宮廷のみ', '武士のみ', '海外'], 0, factExplain('kinsei-f10')),
  ];

  return buildFromCatalog(eraId, era, KINSEI_WORKS, KINSEI_AUTHORS, facts, [
    () => {
      const out = [];
      const wrongFields = ['軍記物語', '私小説', '新聞記事', '洋楽評'];
      for (let i = 1; i <= 70; i += 1) {
        const a = KINSEI_AUTHORS[i % KINSEI_AUTHORS.length];
        const correct = a.field;
        const choices = shuffle([correct, ...pickOthers(wrongFields, correct, 3)]);
        out.push(q(
          era,
          `kinsei-x-${i}`,
          `${a.name}が活躍した分野として最も適切なのは？`,
          choices,
          choices.indexOf(correct),
          explainField(a.name, correct, a.body),
        ));
      }
      return out;
    },
  ]);
}

function buildKindai() {
  const era = '近代';
  const eraId = 'kindai';
  const facts = [
    q(era, 'kindai-f1', '「小説の開化元年」とされる年は？', ['1887年', '1868年', '1910年', '1945年'], 0, factExplain('kindai-f1')),
    q(era, 'kindai-f2', '言文一致運動の目的は？', ['口語と文語の一致', '漢文復活', '英語のみ', '仮名禁止'], 0, factExplain('kindai-f2')),
    q(era, 'kindai-f3', '芥川賞の名称の由来作家は？', ['芥川龍之介', '夏目漱石', '太宰治', '三島由紀夫'], 0, factExplain('kindai-f3')),
    q(era, 'kindai-f4', '川端康成が受賞した国際賞は？', ['ノーベル文学賞', 'ピューリッツァー', 'ブッカー', 'ゴンクール'], 0, factExplain('kindai-f4')),
    q(era, 'kindai-f5', '与謝野晶子の反戦歌の背景戦争は？', ['日露戦争', '太平洋戦争', '日清戦争', '第一次世界大戦'], 0, factExplain('kindai-f5')),
    q(era, 'kindai-f6', '大正デモクラシー期の文学潮流は？', ['白樺派・マスメディア', '軍記物語', '俳諧', '風土記'], 0, factExplain('kindai-f6')),
    q(era, 'kindai-f7', '三島由紀夫の代表作の一つは？', ['金閣寺', '雪国', 'こころ', '曾根崎心中'], 0, factExplain('kindai-f7')),
    q(era, 'kindai-f8', '青空文庫の主な対象は？', ['著作権切れ作品', '最新ベストセラー', '海外のみ', '評論のみ'], 0, factExplain('kindai-f8')),
    q(era, 'kindai-f9', '「近代」文学の開始目安は？', ['明治維新以降', '794年', '1185年', '1603年'], 0, factExplain('kindai-f9')),
    q(era, 'kindai-f10', '新聞連載小説の普及時期は？', ['明治〜大正', '奈良', '平安', '室町'], 0, factExplain('kindai-f10')),
  ];

  const authorNames = KINDAI_PAIRS.map((p) => p.author);
  const workTitles = KINDAI_PAIRS.map((p) => p.work);
  const generated = [];
  KINDAI_PAIRS.forEach((p) => {
    generated.push(makeQuestion(
      eraId,
      `kindai-aw-${slug(p.author)}`,
      `${p.author}の代表作として最も適切なのは？`,
      p.work,
      workTitles,
      explainAuthorWork(p.author, p.work, era, p.body),
    ));
    generated.push(makeQuestion(
      eraId,
      `kindai-wa-${slug(p.work)}`,
      `『${p.work}』の作者は誰？`,
      p.author,
      authorNames,
      explainWorkAuthor(p.work, p.author, era, p.body),
    ));
  });
  KINDAI_MOVEMENTS.forEach((m) => {
    generated.push(makeQuestion(
      eraId,
      `kindai-mv-${slug(m.movement)}`,
      `「${m.movement}」の代表作家として最も適切なのは？`,
      m.author,
      authorNames,
      explainMovement(m.author, m.movement, m.body),
    ));
  });

  const extra = [];
  const movementPool = [...new Set([
    ...KINDAI_MOVEMENTS.map((m) => m.movement),
    ...KINDAI_PAIRS.map((p) => p.movement),
  ])];
  for (let i = 1; i <= 50; i += 1) {
    const p = KINDAI_PAIRS[i % KINDAI_PAIRS.length];
    extra.push(makeQuestion(
      eraId,
      `kindai-x-${i}`,
      `近代文学史で${p.author}が属する潮流に最も近いのは？`,
      p.movement,
      movementPool,
      explainMovement(p.author, p.movement, p.body),
    ));
  }

  return finalizeQuestions([...facts, ...generated.filter(Boolean), ...extra.filter(Boolean)], eraId);
}

const QUESTIONS_BY_ERA = {
  jodai: buildJodai(),
  chuko: buildChuko(),
  chusei: buildChusei(),
  kinsei: buildKinsei(),
  kindai: buildKindai(),
};

const QUESTIONS = Object.values(QUESTIONS_BY_ERA).flat();
const ERA_COUNTS = Object.fromEntries(
  Object.entries(QUESTIONS_BY_ERA).map(([id, list]) => [id, list.length]),
);

const output = `/* generated by scripts/build-bungakushi-data.mjs — do not edit by hand */
(function () {
  const ERAS = ${JSON.stringify(ERAS, null, 2)};

  const GRADES = ${JSON.stringify(GRADES, null, 2)};

  const ROUND_SIZE = ${ROUND_SIZE};

  const QUESTIONS_BY_ERA = ${JSON.stringify(QUESTIONS_BY_ERA, null, 2)};

  const QUESTIONS = Object.values(QUESTIONS_BY_ERA).flat();

  const ERA_COUNTS = ${JSON.stringify(ERA_COUNTS, null, 2)};

  window.BungakushiQuizData = {
    ERAS,
    GRADES,
    ROUND_SIZE,
    QUESTIONS_BY_ERA,
    QUESTIONS,
    ERA_COUNTS,
  };
})();
`;

fs.writeFileSync(outPath, output, 'utf8');
console.log('Wrote', outPath);
Object.entries(ERA_COUNTS).forEach(([id, n]) => console.log(`  ${id}: ${n} questions`));
console.log(`  total: ${QUESTIONS.length} questions`);

const lengths = QUESTIONS.map((item) => item.explanation.length);
const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
const min = Math.min(...lengths);
console.log(`  explanation chars: avg ${avg}, min ${min}`);

QUESTIONS.forEach((item) => {
  if (!Array.isArray(item.choices) || item.choices.length !== 4) {
    throw new Error(`Invalid choices: ${item.id}`);
  }
  if (item.correct < 0 || item.correct > 3) {
    throw new Error(`Invalid correct index: ${item.id}`);
  }
  if (item.explanation.length < 25) {
    throw new Error(`Explanation too short: ${item.id} (${item.explanation.length} chars): ${item.explanation}`);
  }
  if (/の作者として|の作者は誰|の作者・編纂者/.test(item.text) && /編者|作者不詳|不明|^不詳$|文官|ほか$|ら$/.test(item.choices[item.correct])) {
    throw new Error(`Vague author answer: ${item.id}`);
  }
  if (/と関連が深い/.test(item.text)) {
    const match = item.text.match(/『(.+?)』/);
    const subject = match?.[1];
    const answer = item.choices[item.correct];
    if (subject && answer === subject) {
      throw new Error(`Self-referential related question: ${item.id}`);
    }
    if (subject && item.choices.includes(subject)) {
      throw new Error(`Subject in related choices: ${item.id}`);
    }
    if (!item.explanation.startsWith('正解は『')) {
      throw new Error(`Bad related explanation: ${item.id}`);
    }
  }
  if (new Set(item.choices).size !== item.choices.length) {
    throw new Error(`Duplicate choices: ${item.id}`);
  }
  if (/潮流|流派/.test(item.text) && item.choices[item.correct] === '近代写実') {
    throw new Error(`Invalid movement answer: ${item.id}`);
  }
  const nonWorkAnswers = ['俳諧', '俳句', '蘭学', '国学', '浮世草子', '浄瑠璃・歌舞伎', '読本・滑稽本'];
  if (/作品として|作品・文献は/.test(item.text) && nonWorkAnswers.includes(item.choices[item.correct])) {
    throw new Error(`Non-work answer for author-work question: ${item.id}`);
  }
});

const catalogGenres = new Map();
[JODAI_WORKS, CHUKO_WORKS, CHUSEI_WORKS, KINSEI_WORKS].forEach((works) => {
  works.forEach((w) => {
    if (w.genre) catalogGenres.set(w.work, w.genre);
  });
});
QUESTIONS.forEach((item) => {
  if (/ジャンルとして/.test(item.text)) {
    const match = item.text.match(/『(.+?)』/);
    const expected = catalogGenres.get(match?.[1]);
    const answer = item.choices[item.correct];
    if (expected && answer !== expected) {
      throw new Error(`Genre mismatch ${item.id}: expected ${expected}, got ${answer}`);
    }
  }
});
console.log('Validation OK');
