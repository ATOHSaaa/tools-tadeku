(function () {
  const DIMENSIONS = ['introspect', 'light', 'lyric', 'family', 'society', 'compact'];

  const WORKS = [
    {
      id: 'ningen-shikaku',
      name: '人間失格',
      year: '1948年',
      typeName: '自白の独白',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/files/301_14912.html',
      traits: ['恥', '破滅', '一人称'],
      dims: { introspect: 10, light: 1, lyric: 4, family: 3, society: 6, compact: 5 },
      blurb: '「恥の多い生涯」を、一人称で剥き出しにする。弱さと罪を、最も鮮烈に描いた遺作です。',
    },
    {
      id: 'shayo',
      name: '斜陽',
      year: '1947年',
      typeName: '斜陽族の物語',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/card1565.html',
      traits: ['没落', '母女', '戦後'],
      dims: { introspect: 8, light: 3, lyric: 5, family: 10, society: 9, compact: 6 },
      blurb: '没落貴族の家を、母と娘の手紙と独白で描く。戦後の「斜陽族」のリアルがここにあります。',
    },
    {
      id: 'hashire-meros',
      name: '走れメロス',
      year: '1940年',
      typeName: '忠義の寓話',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/files/1567_14913.html',
      traits: ['友情', '信義', '明快'],
      dims: { introspect: 3, light: 10, lyric: 4, family: 4, society: 2, compact: 10 },
      blurb: '友情と約束を、明快な文体で描く。教科書でも読まれる、太宰屈指の明るい短篇です。',
    },
    {
      id: 'tsugaru',
      name: '津軽',
      year: '1944年',
      typeName: '故郷への旅',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/card2282.html',
      traits: ['紀行', '郷愁', '土地'],
      dims: { introspect: 6, light: 5, lyric: 9, family: 8, society: 5, compact: 4 },
      blurb: '故郷津軽を旅し、土地の人々と自分を重ねる。乳母たけとの再会で知られる紀行的傑作です。',
    },
    {
      id: 'villon',
      name: 'ヴィヨンの妻',
      year: '1947年',
      typeName: '妻の眼差し',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/card2253.html',
      traits: ['献身', '詩人', '戦後'],
      dims: { introspect: 7, light: 2, lyric: 6, family: 9, society: 7, compact: 8 },
      blurb: '破滅した詩人の妻の視点から、愛と生活を綴る。献身的な語り口が胸を打ちます。',
    },
    {
      id: 'fugaku',
      name: '富嶽百景',
      year: '1939年',
      typeName: '山の生活譚',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/card270.html',
      traits: ['富士', '山間', '余韻'],
      dims: { introspect: 6, light: 6, lyric: 10, family: 3, society: 2, compact: 7 },
      blurb: '御坂峠での日々と、富士を望む情景。「富士には月見草がよく似合う」の余韻が残ります。',
    },
    {
      id: 'pandora',
      name: 'パンドラの匣',
      year: '1945–46年',
      typeName: '療養所の光',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/card1566.html',
      traits: ['ユーモア', '健康', '連作'],
      dims: { introspect: 5, light: 9, lyric: 5, family: 4, society: 5, compact: 5 },
      blurb: '結核療養所の「健康道場」を、明るく軽やかに描く。太宰の中でも珍しいユーモア溢れる連作です。',
    },
    {
      id: 'joseito',
      name: '女生徒',
      year: '1939年',
      typeName: '少女の日記',
      workUrl: 'https://www.aozora.gr.jp/cards/000035/card275.html',
      traits: ['日記', '純粋', '青春'],
      dims: { introspect: 8, light: 4, lyric: 7, family: 5, society: 6, compact: 8 },
      blurb: '女子校生の日記形式で、純粋な心と社会の狭さを描く。繊細な内面描写が印象に残ります。',
    },
  ];

  const QUESTIONS = [
    {
      id: 'q1',
      text: '今の気分に近い読書は？',
      choices: [
        { text: '自分の弱さと向き合う', dims: { introspect: 3 } },
        { text: '明るく元気をもらう', dims: { light: 3 } },
        { text: '風景や土地に浸る', dims: { lyric: 3 } },
        { text: '家族や人間関係の温もり', dims: { family: 3 } },
      ],
    },
    {
      id: 'q2',
      text: '物語の舞台に惹かれるのは？',
      choices: [
        { text: '都会の密室', dims: { introspect: 2, society: 2 } },
        { text: '故郷や旅路', dims: { lyric: 2, family: 1 } },
        { text: '山や自然', dims: { lyric: 3 } },
        { text: '学校や日常', dims: { society: 2, compact: 1 } },
      ],
    },
    {
      id: 'q3',
      text: '語り手の視点で好きなのは？',
      choices: [
        { text: '一人の独白', dims: { introspect: 3 } },
        { text: '手紙や日記', dims: { introspect: 2, family: 1 } },
        { text: '第三者の語り', dims: { lyric: 1, light: 1 } },
        { text: '妻や娘の視点', dims: { family: 3, society: 1 } },
      ],
    },
    {
      id: 'q4',
      text: '読み終えたあと欲しい余韻は？',
      choices: [
        { text: '深い自省', dims: { introspect: 3 } },
        { text: '爽快さ', dims: { light: 3 } },
        { text: '静かな情景', dims: { lyric: 3 } },
        { text: '時代への理解', dims: { society: 3 } },
      ],
    },
    {
      id: 'q5',
      text: '分量の好みに近いのは？',
      choices: [
        { text: '一気に読める短篇', dims: { compact: 3 } },
        { text: '中編でじっくり', dims: { compact: 2, family: 1 } },
        { text: '長編で沈む', dims: { family: 2, introspect: 2 } },
        { text: '連作・エッセイ風', dims: { lyric: 2, compact: 1 } },
      ],
    },
    {
      id: 'q6',
      text: '太宰の文体で惹かれるのは？',
      choices: [
        { text: '自虐的な正直さ', dims: { introspect: 3 } },
        { text: 'ユーモアと軽さ', dims: { light: 3 } },
        { text: '叙情と風景', dims: { lyric: 3 } },
        { text: '社会批評の機微', dims: { society: 3 } },
      ],
    },
    {
      id: 'q7',
      text: '好きな人間関係の描き方は？',
      choices: [
        { text: '血のつながり', dims: { family: 3 } },
        { text: '友情と信義', dims: { light: 2, compact: 1 } },
        { text: '恋と献身', dims: { family: 2, lyric: 1 } },
        { text: '孤独な個人', dims: { introspect: 3 } },
      ],
    },
    {
      id: 'q8',
      text: 'いま求めているものに近いのは？',
      choices: [
        { text: '王道の一作', dims: { introspect: 2, society: 1 } },
        { text: '意外な明るさ', dims: { light: 3 } },
        { text: '土地の匂い', dims: { lyric: 2, family: 1 } },
        { text: '短時間で味わう', dims: { compact: 3 } },
      ],
    },
  ];

  window.DazaiWorkQuizData = {
    DIMENSIONS,
    WORKS,
    QUESTIONS,
  };
})();
