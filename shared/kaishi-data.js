(function () {
  // ASIN は Amazon.co.jp の文庫版商品ページで確認したもののみ。
  const ITEMS = [
    {
      id: 'hakase',
      title: '博士の愛した数式',
      author: '小川洋子',
      asin: '4101215235',
      kind: 'opening',
      era: '2003',
      excerpt: '彼のことを、私と息子は博士と呼んだ。そして博士は息子を、ルートと呼んだ。息子の頭のてっぺんが、ルート記号のように平らだったからだ。',
    },
    {
      id: 'keritai-senaka',
      title: '蹴りたい背中',
      author: '綿矢りさ',
      asin: '4309408419',
      kind: 'opening',
      era: '2004',
      excerpt: 'さびしさは鳴る。耳が痛くなるほど高く澄んだ鈴の音で鳴り響いて、胸を締めつけるから、せめて周りには聞こえないように、私はプリントを指で千切る。',
    },
    {
      id: 'juryoku-pierrot',
      title: '重力ピエロ',
      author: '伊坂幸太郎',
      asin: '4101250235',
      kind: 'opening',
      era: '2003',
      excerpt: '春が二階から落ちてきた。',
    },
    {
      id: 'tanpen-nanaboshi',
      title: '短篇七芒星',
      author: '舞城王太郎',
      asin: '4065358973',
      kind: 'opening',
      era: '2024',
      excerpt: 'ろくでもない人間がいる。お前である。',
    },
  ];

  window.KAISHI_DATA = { ITEMS };
})();
