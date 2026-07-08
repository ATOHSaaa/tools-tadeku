(function () {
  const DIMENSIONS = ['structure', 'character', 'world', 'prose', 'intuition', 'theme'];

  const TYPES = [
    {
      id: 'architect',
      name: '構成の設計者',
      typeName: 'STRUCTURE',
      subtitle: 'プロットから物語を組み立てる',
      traits: ['伏線', '章立て', '因果'],
      dims: { structure: 10, character: 5, world: 4, prose: 4, intuition: 2, theme: 7 },
      blurb: 'あらすじと展開を先に固め、登場人物をその枠に載せていくタイプ。読者を驚かせる仕掛けや、後から効いてくる伏線を仕込むのが得意です。',
      picks: [
        { title: 'Scene', href: '../scene/', about: 'シーン単位で物語の骨組みを組み立てるエディタ。ドラッグで並べ替え、構成だけに集中できます。', point: '伏線と展開の流れを、シーン一覧で俯瞰しやすい' },
        { title: 'Tachometer', href: '../tachometer/', about: '執筆速度をリアルタイムで計測するエディタ。文字/分・進捗・到達予測時刻を確認できます。', point: '章立てどおりに執筆量を積み上げ、構成のペースを崩さず書ける' },
      ],
    },
    {
      id: 'wanderer',
      name: '直感の旅人',
      typeName: 'INTUITION',
      subtitle: '書きながら道を見つける',
      traits: ['飛び書き', '発見', '意外性'],
      dims: { structure: 3, character: 6, world: 5, prose: 5, intuition: 10, theme: 4 },
      blurb: '白紙から書き始め、キャラや展開が途中で自分を驚かせるタイプ。構成表より「今この一文」を信じて進む執筆が合っています。',
      picks: [
        { title: 'Stoic', href: '../stoic/', about: '前進専用エディタ。削除も戻りもできず、書くことだけに向き合えます。', point: '考えすぎず、勢いのまま前へ進める' },
        { title: 'Interval', href: '../Interval/', about: '入力ペースを制限する執筆エディタ。言葉が冷めるのを待ってから次の一行を書きます。', point: '立ち止まりながらも、勢いを殺さず書き続けられる' },
      ],
    },
    {
      id: 'psychologist',
      name: '人物の深探',
      typeName: 'CHARACTER',
      subtitle: '内面と関係性が原動力',
      traits: ['心理', '対話', '成長'],
      dims: { structure: 5, character: 10, world: 3, prose: 5, intuition: 5, theme: 6 },
      blurb: '「この人はなぜそう動くのか」から物語が始まるタイプ。セリフと独白で人物を掘り下げ、読者の共感を引き出すのが得意です。',
      picks: [
        { title: 'Cast', href: '../cast/', about: '原稿から登場人物名を自動抽出し、表記ゆれを見つける推敲エディタです。', point: '人物の関係と表記を整理し、対話の温度差を意識しやすい' },
        { title: 'Echo', href: '../echo/', about: '200字以内に2回以上現れる語を色分けしてハイライトするエディタです。', point: '語の反復から、口調や人物の個性を整えられる' },
      ],
    },
    {
      id: 'worldbuilder',
      name: '世界の建築家',
      typeName: 'WORLD',
      subtitle: '設定が物語を支える',
      traits: ['設定', '歴史', 'ルール'],
      dims: { structure: 6, character: 4, world: 10, prose: 4, intuition: 4, theme: 5 },
      blurb: '時代・地理・制度まで描き込み、読者を別世界へ連れていくタイプ。設定の整合性と、そこで生きる人々のリアルさを両立させます。',
      picks: [
        { title: 'Scene', href: '../scene/', about: 'シーン単位で物語の骨組みを組み立てるエディタ。場所と出来事を分けて整理できます。', point: '世界観の穴を、シーン一覧で洗い出しやすい' },
        { title: 'Plain', href: '../plain/', about: 'タイトルと本文だけのシンプルなテキストエディタ。余計な機能なしで書けます。', point: '設定メモと本編を、迷わず書き分けられる' },
      ],
    },
    {
      id: 'stylist',
      name: '言葉の職人',
      typeName: 'PROSE',
      subtitle: '一文一文にこだわる',
      traits: ['リズム', '比喩', '推敲'],
      dims: { structure: 4, character: 4, world: 3, prose: 10, intuition: 3, theme: 5 },
      blurb: '意味より音とリズム、比喩の鮮やかさを優先するタイプ。書き終えたあとに言葉を削ぎ、余白を残す推敲が創作の中心にあります。',
      picks: [
        { title: 'Length', href: '../length/', about: '一文が一定字数を超えた箇所をハイライトするエディタ。目安の字数を自由に設定できます。', point: '一文の長さを可視化し、リズムとテンポを整えやすい' },
        { title: 'Echo', href: '../echo/', about: '200字以内に2回以上現れる語を色分けしてハイライトするエディタです。', point: '同じ語の反復を見つけて、言葉のムダを削れる' },
      ],
    },
    {
      id: 'lyricist',
      name: '情景の詩人',
      typeName: 'LYRIC',
      subtitle: '空気と余韻を紡ぐ',
      traits: ['五感', '叙情', '余韻'],
      dims: { structure: 3, character: 6, world: 6, prose: 8, intuition: 6, theme: 4 },
      blurb: '事件より「その場の空気」を描くタイプ。光、音、匂いで心情を伝え、読後に静かな余韻を残す物語を目指します。',
      picks: [
        { title: 'Mirage', href: '../mirage/', about: '執筆が止まったとき、背景に薄く語が浮かぶ執筆エディタです。', point: '浮かんだ語が、情景描写のヒントになる' },
        { title: 'Cue', href: '../cue/', about: '執筆中に語彙が表示されるエディタ。用例を参照しながら書けます。', point: '語彙の刺激から、五感の表現を広げられる' },
      ],
    },
    {
      id: 'observer',
      name: '社会の観察者',
      typeName: 'THEME',
      subtitle: '時代と問題を描く',
      traits: ['リアル', '問題意識', '視点'],
      dims: { structure: 6, character: 7, world: 5, prose: 5, intuition: 3, theme: 10 },
      blurb: '個人の物語を通して社会や倫理を問うタイプ。取材や観察から得たリアルなディテールを、テーマの説教にならない形で織り込みます。',
      picks: [
        { title: 'Tachometer', href: '../tachometer/', about: '執筆速度をリアルタイムで計測するエディタ。文字/分・進捗・到達予測時刻を確認できます。', point: '執筆量を計測し、観察メモを原稿へ還元する習慣づけに向く' },
        { title: 'Plain', href: '../plain/', about: 'タイトルと本文だけのシンプルなテキストエディタ。余計な機能なしで書けます。', point: '取材メモと原稿を、迷わず書き分けてため込める' },
      ],
    },
    {
      id: 'imaginer',
      name: '奇想の魔術師',
      typeName: 'IMAGINE',
      subtitle: '常識の外側へ連れていく',
      traits: ['奇想', '変格', '夢'],
      dims: { structure: 4, character: 5, world: 8, prose: 6, intuition: 9, theme: 5 },
      blurb: '現実のルールを緩め、読者の期待を裏切るタイプ。夢や怪異、SF的な設定を、論理より感覚で成立させる創作が向いています。',
      picks: [
        { title: '三題噺ガチャ', href: '../sandai/', about: '三題噺用に3つのお題をランダム表示するガチャ。短編や執筆練習のアイデア発想に使えます。', point: '異質なお題の組み合わせから、予想外の奇想が生まれやすい' },
        { title: '語彙ガチャ', href: '../goigacha/', about: '物書きのための語彙辞典から30語をランダムで引くガチャです。', point: '離れた語の衝突で、設定や比喩の発想が広がる' },
      ],
    },
  ];

  const DIMENSION_LABELS = {
    structure: '構成',
    character: '人物',
    world: '世界観',
    prose: '文体',
    intuition: '直感',
    theme: 'テーマ',
  };

  const QUESTIONS = [
    {
      id: 'q1',
      text: '執筆を始める前に、いちばん時間をかけるのは？',
      choices: [
        { text: '全体のあらすじと構成', dims: { structure: 3, theme: 1 } },
        { text: '登場人物の設定と関係', dims: { character: 3 } },
        { text: '世界観や時代背景', dims: { world: 3 } },
        { text: 'とにかく書き始める', dims: { intuition: 3 } },
      ],
    },
    {
      id: 'q2',
      text: '原稿を書いているとき、いちばん楽しい瞬間は？',
      choices: [
        { text: '伏線がつながったとき', dims: { structure: 3 } },
        { text: 'キャラが自分の言葉を喋ったとき', dims: { character: 3 } },
        { text: '美しい一文が生まれたとき', dims: { prose: 3 } },
        { text: '想定外の展開が来たとき', dims: { intuition: 3 } },
      ],
    },
    {
      id: 'q3',
      text: '推敲で最初に直すのは？',
      choices: [
        { text: '構成と展開の流れ', dims: { structure: 3 } },
        { text: '人物の一貫性', dims: { character: 3 } },
        { text: '言葉のリズムと表現', dims: { prose: 3 } },
        { text: 'テーマの伝わり方', dims: { theme: 3 } },
      ],
    },
    {
      id: 'q4',
      text: '物語の核になっているものは？',
      choices: [
        { text: '「この事件を描きたい」', dims: { structure: 2, theme: 1 } },
        { text: '「この人の物語を描きたい」', dims: { character: 3 } },
        { text: '「この世界を描きたい」', dims: { world: 3 } },
        { text: '「この感覚を残したい」', dims: { prose: 2, intuition: 1 } },
      ],
    },
    {
      id: 'q5',
      text: 'アイデアの泉に近いのは？',
      choices: [
        { text: 'ニュースや社会問題', dims: { theme: 3 } },
        { text: '人間関係の葛藤', dims: { character: 2, theme: 1 } },
        { text: '風景や建物のイメージ', dims: { world: 2, prose: 1 } },
        { text: 'ふと浮かんだ一言', dims: { intuition: 2, prose: 1 } },
      ],
    },
    {
      id: 'q6',
      text: '理想の読後感に近いのは？',
      choices: [
        { text: '「よく練られた物語だった」', dims: { structure: 3 } },
        { text: '「この人のことが忘れられない」', dims: { character: 3 } },
        { text: '「別の世界にいた気分」', dims: { world: 3 } },
        { text: '「言葉の余韻が残る」', dims: { prose: 3 } },
      ],
    },
    {
      id: 'q7',
      text: '執筆する時の机の状態に近いのは？',
      choices: [
        { text: 'プロット表やメモが整然と並ぶ', dims: { structure: 3 } },
        { text: 'キャラ設定や関係図が広がる', dims: { character: 3 } },
        { text: '資料や地図、参考画像が並ぶ', dims: { world: 3 } },
        { text: '白紙とペンだけ', dims: { intuition: 3 } },
      ],
    },
    {
      id: 'q8',
      text: '周囲から言われがちなことに近いのは？',
      choices: [
        { text: '「設定が細かい」', dims: { world: 2, structure: 1 } },
        { text: '「セリフがうまい」', dims: { character: 2, prose: 1 } },
        { text: '「比喩がきれい」', dims: { prose: 3 } },
        { text: '「展開が読めない／意外」', dims: { intuition: 2, structure: 1 } },
      ],
    },
  ];

  window.StyleQuizData = {
    DIMENSIONS,
    DIMENSION_LABELS,
    TYPES,
    QUESTIONS,
  };
})();
