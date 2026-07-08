(function () {
  const DIMENSIONS = ['confession', 'sensation', 'realism', 'idealism', 'decadence', 'technique'];

  const MOVEMENTS = [
    {
      id: 'shizenshugi',
      name: '自然主義',
      era: '1900年代',
      typeName: 'Naturalism',
      examples: [
        { author: '田山花袋', work: '蒲団', workUrl: 'https://www.aozora.gr.jp/cards/000214/files/1669_8259.html' },
        { author: '島崎藤村', work: '破戒', workUrl: 'https://www.aozora.gr.jp/cards/000158/files/1502_24633.html' },
        { author: '徳田秋声', work: 'あらくれ', workUrl: 'https://www.aozora.gr.jp/cards/000023/files/199_44926.html' },
      ],
      traits: ['赤裸々', '告白', '写実'],
      dims: { confession: 10, sensation: 2, realism: 9, idealism: 2, decadence: 4, technique: 2 },
      blurb: '人間の欲望や恥を隠さず、ありのままに描く。社会の体面より、生々しい事実を優先する姿勢が核です。',
    },
    {
      id: 'shinkankaku',
      name: '新感覚派',
      era: '1920年代',
      typeName: 'Neo-sensualism',
      examples: [
        { author: '横光利一', work: '春は馬車に乗って', workUrl: 'https://www.aozora.gr.jp/cards/000168/files/904.html' },
        { author: '川端康成', work: '伊豆の踊子' },
        { author: '堀辰雄', work: '風立ちぬ', workUrl: 'https://www.aozora.gr.jp/cards/001030/files/4803_14204.html' },
      ],
      traits: ['感覚', '比喩', 'モダニズム'],
      dims: { confession: 2, sensation: 10, realism: 2, idealism: 2, decadence: 3, technique: 8 },
      blurb: '筋より文体と感覚を優先する。都市のノイズを、比喩とリズムの跳躍で切り取る1920年代の前衛です。',
    },
    {
      id: 'buraiko',
      name: '無頼派',
      era: '1940年代',
      typeName: 'Decadent rebels',
      examples: [
        { author: '太宰治', work: '人間失格', workUrl: 'https://www.aozora.gr.jp/cards/000035/files/301_14912.html' },
        { author: '坂口安吾', work: '堕落論', workUrl: 'https://www.aozora.gr.jp/cards/001095/files/42620_21407.html' },
        { author: '織田作之助', work: '夫婦善哉', workUrl: 'https://www.aozora.gr.jp/cards/000040/files/545_33102.html' },
      ],
      traits: ['頽廃', '反骨', '自堕落'],
      dims: { confession: 8, sensation: 3, realism: 3, idealism: 1, decadence: 10, technique: 2 },
      blurb: '弱さや敗北を肯定し、世間の常識に反骨を示す。恥の多い生涯を、独白として書き切る姿勢が特徴です。',
    },
    {
      id: 'shirakaba',
      name: '白樺派',
      era: '1910年代',
      typeName: 'Humanism',
      examples: [
        { author: '志賀直哉', work: '暗夜行路' },
        { author: '武者小路実篤', work: '友情' },
        { author: '有島武郎', work: '或る女', workUrl: 'https://www.aozora.gr.jp/cards/000025/files/201_20052.html' },
      ],
      traits: ['理想', '個性', '人道'],
      dims: { confession: 5, sensation: 3, realism: 4, idealism: 10, decadence: 1, technique: 5 },
      blurb: '個性と理想、人間の尊厳を重んじる。自己の葛藤を通して、清々しい成長や信念を描きます。',
    },
    {
      id: 'shinchoso',
      name: '新思潮派',
      era: '1910年代',
      typeName: 'Intellectual craft',
      examples: [
        { author: '芥川龍之介', work: '羅生門', workUrl: 'https://www.aozora.gr.jp/cards/000879/files/128_15261.html' },
        { author: '菊池寛', work: '恩讐の彼方に', workUrl: 'https://www.aozora.gr.jp/cards/000083/files/496_19866.html' },
        { author: '久保田万太郎', work: '驚風' },
      ],
      traits: ['技巧', '知性', '短篇'],
      dims: { confession: 3, sensation: 3, realism: 6, idealism: 4, decadence: 2, technique: 10 },
      blurb: '知力と構成で人間を切り取る。短い篇幅に本性を凝縮し、読後に問いを残す完成度を追求します。',
    },
    {
      id: 'yubiha',
      name: '耽美派',
      era: '1910年代〜',
      typeName: 'Aestheticism',
      examples: [
        { author: '谷崎潤一郎', work: '春琴抄', workUrl: 'https://www.aozora.gr.jp/cards/001383/files/56866_58169.html' },
        { author: '永井荷風', work: '濹東綺譚', workUrl: 'https://www.aozora.gr.jp/cards/001341/files/52016_42178.html' },
        { author: '佐藤春夫', work: 'あかい実' },
      ],
      traits: ['耽美', '官能', '日本美'],
      dims: { confession: 2, sensation: 9, realism: 2, idealism: 3, decadence: 7, technique: 5 },
      blurb: '光より影、西洋より日本の美を追う。肌触りや匂いまで描き切る、感覚と耽美の文学です。',
    },
    {
      id: 'yoyu',
      name: '余裕派',
      era: '明治後期〜大正',
      typeName: 'Intellectual leisure',
      examples: [
        { author: '夏目漱石', work: 'こころ', workUrl: 'https://www.aozora.gr.jp/cards/000148/files/773_14560.html' },
        { author: '森鴎外', work: '高瀬舟', workUrl: 'https://www.aozora.gr.jp/cards/000129/files/691_15352.html' },
        { author: '高浜虚子', work: '美しき日' },
      ],
      traits: ['心理', '倫理', '余裕'],
      dims: { confession: 4, sensation: 3, realism: 6, idealism: 8, decadence: 1, technique: 9 },
      blurb: '知識人の倫理と心理を、距離のある視線で描く。重いテーマも、どこか余裕のある筆致で語ります。',
    },
    {
      id: 'romanticism',
      name: '浪漫主義',
      era: '明治30年代',
      typeName: 'Romanticism',
      examples: [
        { author: '北村透谷', work: '楚囚之詩', workUrl: 'https://www.aozora.gr.jp/cards/000157/files/834.html' },
        { author: '与謝野晶子', work: '君死にたまふことなかれ', workUrl: 'https://www.aozora.gr.jp/cards/000885/files/2557_15784.html' },
        { author: '森鴎外', work: '舞姫', workUrl: 'https://www.aozora.gr.jp/cards/000129/files/682_15414.html' },
      ],
      traits: ['理想', '反抗', '情熱'],
      dims: { confession: 3, sensation: 8, realism: 3, idealism: 9, decadence: 4, technique: 2 },
      blurb: '理想と反抗、情熱を胸に時代と格闘する。近代自我の叫びと、ロマン的な求道が原動力です。',
    },
    {
      id: 'jitsushugi',
      name: '写実主義',
      era: '1880年代',
      typeName: 'Realism',
      examples: [
        { author: '二葉亭四迷', work: '浮雲', workUrl: 'https://www.aozora.gr.jp/cards/000006/files/1869_33656.html' },
        { author: '坪内逍遥', work: '当世書生気質' },
        { author: '樋口一葉', work: 'たけくらべ', workUrl: 'https://www.aozora.gr.jp/cards/000064/files/56041_54765.html' },
      ],
      traits: ['現実', '観察', '冷静'],
      dims: { confession: 2, sensation: 2, realism: 10, idealism: 3, decadence: 1, technique: 8 },
      blurb: '目の前の現実を、飾らず冷静に描く。言文一致の文体で人間をあるがままに観察し、近代小説の土台を築きました。',
    },
    {
      id: 'gensho',
      name: '幻想文学',
      era: '1890年代〜',
      typeName: 'Fantasy',
      examples: [
        { author: '泉鏡花', work: '草迷宮', workUrl: 'https://www.aozora.gr.jp/cards/000050/files/3586_12103.html' },
        { author: '小泉八雲', work: '怪談' },
        { author: '幸田露伴', work: '五重塔', workUrl: 'https://www.aozora.gr.jp/cards/000051/files/50351_36759.html' },
      ],
      traits: ['幻想', '妖艶', '異界'],
      dims: { confession: 2, sensation: 10, realism: 1, idealism: 2, decadence: 9, technique: 3 },
      blurb: '現実のルールを緩め、妖しい幻想の世界へ誘う。艶やかな文体で、異界と現世の境目を溶かします。',
    },
  ];

  const DIMENSION_LABELS = {
    confession: '告白',
    sensation: '感覚',
    realism: '写実',
    idealism: '理想',
    decadence: '頽廃',
    technique: '技巧',
  };

  const VOTE_BLEND = 0.85;

  const QUESTIONS = [
    {
      id: 'q1',
      text: '物語で描きたい「真実」に近いのは？',
      choices: [
        { text: '人間の欲望や恥を隠さないこと', dims: { confession: 3, realism: 1 }, movementId: 'shizenshugi' },
        { text: '都市の感覚や比喩の跳躍', dims: { sensation: 3 }, movementId: 'shinkankaku' },
        { text: '社会の構造と不公平', dims: { realism: 2, idealism: 1 }, movementId: 'jitsushugi' },
        { text: '人間の理想と成長', dims: { idealism: 3 }, movementId: 'shirakaba' },
      ],
    },
    {
      id: 'q2',
      text: '執筆スタイルに近いのは？',
      choices: [
        { text: '自分の体験をそのまま書く', dims: { confession: 3 }, movementId: 'shirakaba' },
        { text: '文体とリズムをいじる', dims: { sensation: 2, technique: 1 }, movementId: 'shinkankaku' },
        { text: '筋と構成を練る', dims: { technique: 3 }, movementId: 'shinchoso' },
        { text: '弱さや敗北を肯定する', dims: { decadence: 3 }, movementId: 'buraiko' },
      ],
    },
    {
      id: 'q3',
      text: '読者に残したいものに近いのは？',
      choices: [
        { text: '生々しい衝撃', dims: { confession: 2, realism: 1 }, movementId: 'jitsushugi' },
        { text: '言葉の余韻と酔い', dims: { sensation: 3 }, movementId: 'yubiha' },
        { text: '問いと思索', dims: { technique: 2, idealism: 1 }, movementId: 'yoyu' },
        { text: '反骨のクールさ', dims: { decadence: 2, technique: 1 }, movementId: 'romanticism' },
      ],
    },
    {
      id: 'q4',
      text: '物語の主人公像に近いのは？',
      choices: [
        { text: '罪深い告白者', dims: { confession: 2, decadence: 1 }, movementId: 'buraiko' },
        { text: '都市を漂う感覚派', dims: { sensation: 3 }, movementId: 'gensho' },
        { text: '労働者・庶民の代表', dims: { realism: 2, idealism: 1 }, movementId: 'shinchoso' },
        { text: '理想に生きる青年', dims: { idealism: 3 }, movementId: 'romanticism' },
      ],
    },
    {
      id: 'q5',
      text: '文章の書き方に近いのは？',
      choices: [
        { text: 'ありのまま、飾らない', dims: { confession: 2, realism: 1 }, movementId: 'shizenshugi' },
        { text: '比喩と跳躍', dims: { sensation: 3 }, movementId: 'gensho' },
        { text: '丁寧な心理描写', dims: { technique: 2, idealism: 1 }, movementId: 'yoyu' },
        { text: '官能的・耽美的', dims: { sensation: 2, decadence: 1 }, movementId: 'yubiha' },
      ],
    },
    {
      id: 'q6',
      text: '創作のモチベーションに近いのは？',
      choices: [
        { text: '自分の内面を曝け出す', dims: { confession: 3 }, movementId: 'shizenshugi' },
        { text: '新しい言葉を試す', dims: { sensation: 2, technique: 1 }, movementId: 'gensho' },
        { text: '社会を変えたい', dims: { idealism: 2, realism: 1 }, movementId: 'shirakaba' },
        { text: '世間の常識に反したい', dims: { decadence: 3 }, movementId: 'buraiko' },
      ],
    },
    {
      id: 'q7',
      text: '好きな「読後感」に近いのは？',
      choices: [
        { text: '重い告白の余韻', dims: { confession: 2, realism: 1 }, movementId: 'jitsushugi' },
        { text: 'モダンな高揚感', dims: { sensation: 3 }, movementId: 'shinkankaku' },
        { text: '清々しい希望', dims: { idealism: 3 }, movementId: 'romanticism' },
        { text: '知的な満足', dims: { technique: 3 }, movementId: 'shinchoso' },
      ],
    },
    {
      id: 'q8',
      text: '周囲から言われがちなことに近いのは？',
      choices: [
        { text: '「正直すぎる」', dims: { confession: 3 }, movementId: 'yoyu' },
        { text: '「センスが尖っている」', dims: { sensation: 2, technique: 1 }, movementId: 'gensho' },
        { text: '「芯が通っている」', dims: { idealism: 2, realism: 1 }, movementId: 'jitsushugi' },
        { text: '「少しダメな感じがいい」', dims: { decadence: 3 }, movementId: 'yubiha' },
      ],
    },
  ];

  window.BungakuHaQuizData = {
    DIMENSIONS,
    DIMENSION_LABELS,
    MOVEMENTS,
    QUESTIONS,
    VOTE_BLEND,
  };
})();
