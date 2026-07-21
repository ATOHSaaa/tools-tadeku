// Yobikata のデモデータ投入スクリプト
// http://localhost:8765/yobikata/ を開いた状態で、Chrome のコンソールに貼り付けて実行

(() => {
  const STORAGE_KEY = 'yobikata-matrix-v1';

  const cell = (text, color = 'none') => ({ text, color });

  const data = {
    title: 'デモ作品',
    characters: ['青木', '美咲', '健太', '淑子', '吉田', '花子'],
    cells: {
      // 青木 →
      '0-0': cell('俺', 'orange'),
      '0-1': cell('美咲', 'yellow'),
      '0-2': cell('健太くん', 'blue'),
      '0-3': cell('淑子様', 'purple'),
      '0-4': cell('吉田', 'yellow'),
      '0-5': cell('花', 'red'),

      // 美咲 →
      '1-0': cell('青木さん', 'green'),
      '1-1': cell('私', 'orange'),
      '1-2': cell('健太くん', 'blue'),
      '1-3': cell('淑子様', 'purple'),
      '1-4': cell('吉田さん', 'green'),
      '1-5': cell('花ちゃん', 'red'),

      // 健太 →
      '2-0': cell('青木先輩', 'green'),
      '2-1': cell('美咲さん', 'green'),
      '2-2': cell('僕', 'orange'),
      '2-3': cell('淑子様', 'purple'),
      '2-4': cell('吉田さん', 'green'),
      '2-5': cell('花さん', 'green'),

      // 淑子 →
      '3-0': cell('青木', 'yellow'),
      '3-1': cell('美咲', 'yellow'),
      '3-2': cell('健太', 'yellow'),
      '3-3': cell('わたくし', 'orange'),
      '3-4': cell('吉田', 'yellow'),
      '3-5': cell('花', 'yellow'),

      // 吉田 →
      '4-0': cell('青木', 'yellow'),
      '4-1': cell('美咲ちゃん', 'red'),
      '4-2': cell('健太', 'yellow'),
      '4-3': cell('淑子さん', 'green'),
      '4-4': cell('ワイ', 'orange'),
      '4-5': cell('花', 'cyan'),

      // 花子 →
      '5-0': cell('青木さん', 'green'),
      '5-1': cell('美咲ちゃん', 'red'),
      '5-2': cell('健太くん', 'blue'),
      '5-3': cell('お淑子様', 'purple'),
      '5-4': cell('吉田さん', 'green'),
      '5-5': cell('ウチ', 'orange'),
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  location.reload();
})();
