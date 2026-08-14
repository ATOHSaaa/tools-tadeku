export const QUESTIONS = [
  {
    id: 'q1',
    text: '普段の暇つぶしに近いのは？',
    choices: [
      { text: '動画やSNSを見る', dims: { fun: 3, easy: 2 } },
      { text: 'ゲームや漫画', dims: { pace: 3, fun: 2 } },
      { text: '音楽やポッドキャスト', dims: { deep: 2, real: 2 } },
      { text: '散歩や外に出る', dims: { real: 3, deep: 1 } },
    ],
  },
  {
    id: 'q2',
    text: '映画やドラマで好きなジャンルは？',
    choices: [
      { text: 'コメディ・バラエティ', dims: { fun: 3, easy: 1 } },
      { text: '恋愛・人間ドラマ', dims: { deep: 3, real: 2 } },
      { text: 'サスペンス・ミステリー', dims: { pace: 3, fun: 1 } },
      { text: 'ファンタジー・アニメ', dims: { pace: 2, deep: 2 } },
    ],
  },
  {
    id: 'q3',
    text: '本を読まない理由に近いのは？',
    choices: [
      { text: '時間がない', dims: { short: 3, easy: 1 } },
      { text: '難しそうで怖い', dims: { easy: 3, fun: 1 } },
      { text: '途中で飽きる', dims: { pace: 3, short: 1 } },
      { text: '何を読めばいいかわからない', dims: { easy: 2, fun: 2 } },
    ],
  },
  {
    id: 'q4',
    text: '1冊にかけられる時間は？',
    choices: [
      { text: '30分くらい', dims: { short: 3, easy: 2 } },
      { text: '1〜2時間', dims: { short: 2, easy: 2 } },
      { text: '週末にまとめて', dims: { pace: 2, deep: 1 } },
      { text: '面白ければ気にしない', dims: { deep: 2, pace: 2 } },
    ],
  },
  {
    id: 'q5',
    text: '物語で惹かれるのは？',
    choices: [
      { text: '面白い設定・世界観', dims: { pace: 2, fun: 2 } },
      { text: '人の心理や感情', dims: { deep: 3, real: 1 } },
      { text: '日常の中のちょっとした違和感', dims: { real: 3, deep: 2 } },
      { text: 'テンポの速い展開', dims: { pace: 3, fun: 1 } },
    ],
  },
  {
    id: 'q6',
    text: '読み終えたあと欲しい気持ちは？',
    choices: [
      { text: 'すっきり・元気が出た', dims: { fun: 3, easy: 2 } },
      { text: 'じんわり余韻が残る', dims: { deep: 3, real: 1 } },
      { text: '「もっと読みたい」感', dims: { pace: 3, fun: 1 } },
      { text: '何か考えさせられた', dims: { deep: 2, real: 2 } },
    ],
  },
  {
    id: 'q7',
    text: '主人公に近いのは？',
    choices: [
      { text: '普通の人の日常', dims: { real: 3, easy: 2 } },
      { text: '特殊な境遇や能力', dims: { pace: 2, deep: 2 } },
      { text: '内面を抱えた人', dims: { deep: 3, real: 1 } },
      { text: '明るくお調子者', dims: { fun: 3, easy: 1 } },
    ],
  },
  {
    id: 'q8',
    text: '文章の好みに近いのは？',
    choices: [
      { text: 'サクサク読める軽い文体', dims: { easy: 3, pace: 2 } },
      { text: '情景や言葉の美しさ', dims: { deep: 3, short: 1 } },
      { text: 'ユーモアや笑い', dims: { fun: 3, easy: 1 } },
      { text: '飾らないリアルな語り', dims: { real: 3, deep: 1 } },
    ],
  },
  {
    id: 'q9',
    text: '今の気分に近いのは？',
    choices: [
      { text: 'リラックスしたい', dims: { easy: 2, fun: 2 } },
      { text: '刺激が欲しい', dims: { pace: 3, fun: 1 } },
      { text: '誰かの話に浸りたい', dims: { deep: 2, real: 3 } },
      { text: '新しい世界を知りたい', dims: { deep: 2, pace: 2 } },
    ],
  },
  {
    id: 'q10',
    text: '読書への不安、いちばん近いのは？',
    choices: [
      { text: '途中で飽きる', dims: { pace: 3, short: 1 } },
      { text: '難しい漢字・言い回し', dims: { easy: 3, fun: 1 } },
      { text: '暗い内容が続く', dims: { fun: 2, easy: 2 } },
      { text: '長くて挫折する', dims: { short: 3, easy: 1 } },
    ],
  },
];
