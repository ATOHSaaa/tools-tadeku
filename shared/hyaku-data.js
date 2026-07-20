(function () {
  const AXES = [
  {
    "id": "SN",
    "left": "S",
    "right": "N",
    "leftLabel": "構成",
    "rightLabel": "直感",
    "leftEn": "Structure",
    "rightEn": "Inutition"
  },
  {
    "id": "CW",
    "left": "C",
    "right": "W",
    "leftLabel": "人物",
    "rightLabel": "世界",
    "leftEn": "Character",
    "rightEn": "World"
  },
  {
    "id": "PT",
    "left": "P",
    "right": "T",
    "leftLabel": "文体",
    "rightLabel": "テーマ",
    "leftEn": "Prose",
    "rightEn": "Theme"
  },
  {
    "id": "RF",
    "left": "R",
    "right": "F",
    "leftLabel": "推敲",
    "rightLabel": "一気",
    "leftEn": "Revision",
    "rightEn": "Flow"
  }
];

  const SCALE_LEVELS = [
  {
    "level": 1,
    "label": "強くそう思う",
    "left": 2,
    "right": 0
  },
  {
    "level": 2,
    "label": "そう思う",
    "left": 1,
    "right": 0
  },
  {
    "level": 3,
    "label": "どちらでもない",
    "left": 1,
    "right": 1
  },
  {
    "level": 4,
    "label": "そう思わない",
    "left": 0,
    "right": 1
  },
  {
    "level": 5,
    "label": "強くそう思わない",
    "left": 0,
    "right": 2
  }
];

  const TYPES = [
  {
    "code": "SCPR",
    "name": "藍図の工匠",
    "blurb": "構成・人物・文体・推敲をすべて丁寧に積み上げるタイプ。物語の骨格と人物の機微、言葉の精度を同時に追求します。",
    "letters": {
      "SN": "S",
      "CW": "C",
      "PT": "P",
      "RF": "R"
    }
  },
  {
    "code": "SCPF",
    "name": "疾風の設計者",
    "blurb": "構成と人物を描きながら、推敲より勢いで前進するタイプ。設計力がありつつ、一気書きの快感も捨てません。",
    "letters": {
      "SN": "S",
      "CW": "C",
      "PT": "P",
      "RF": "F"
    }
  },
  {
    "code": "SCTR",
    "name": "命題の設計者",
    "blurb": "緻密な構成と社会テーマを両立するタイプ。物語の仕掛けで、読者に問いを投げかけます。",
    "letters": {
      "SN": "S",
      "CW": "C",
      "PT": "T",
      "RF": "R"
    }
  },
  {
    "code": "SCTF",
    "name": "疾風の構成家",
    "blurb": "プロットの才覚とテーマ感覚を持ち、推敲より速度で仕上げるタイプ。勢いの中にも骨格があります。",
    "letters": {
      "SN": "S",
      "CW": "C",
      "PT": "T",
      "RF": "F"
    }
  },
  {
    "code": "SWPR",
    "name": "世界の設計者",
    "blurb": "構成と世界観、文体の美しさを重視するタイプ。設定の整合性と言葉の質を高い次元で両立します。",
    "letters": {
      "SN": "S",
      "CW": "W",
      "PT": "P",
      "RF": "R"
    }
  },
  {
    "code": "SWPF",
    "name": "境界の旅人",
    "blurb": "世界を設計しつつ、一気に書き進めるタイプ。設定の広がりと執筆の速度を同時に楽しみます。",
    "letters": {
      "SN": "S",
      "CW": "W",
      "PT": "P",
      "RF": "F"
    }
  },
  {
    "code": "SWTR",
    "name": "時代の記録者",
    "blurb": "構造と世界、テーマを緻密に描くタイプ。時代や社会を、設計された物語で記録します。",
    "letters": {
      "SN": "S",
      "CW": "W",
      "PT": "T",
      "RF": "R"
    }
  },
  {
    "code": "SWTF",
    "name": "幻想の建築家",
    "blurb": "世界とテーマを構想し、推敲より勢いで形にするタイプ。設定の厚みと速度が共存します。",
    "letters": {
      "SN": "S",
      "CW": "W",
      "PT": "T",
      "RF": "F"
    }
  },
  {
    "code": "NCPR",
    "name": "人心の解読者",
    "blurb": "直感で人物の内面を追い、言葉を丁寧に磨くタイプ。心理描写と推敲が深く結びついています。",
    "letters": {
      "SN": "N",
      "CW": "C",
      "PT": "P",
      "RF": "R"
    }
  },
  {
    "code": "NCPF",
    "name": "直感の語り部",
    "blurb": "人物の感情を直感で捉え、勢いよく書き進めるタイプ。セリフと心情が原稿を牽引します。",
    "letters": {
      "SN": "N",
      "CW": "C",
      "PT": "P",
      "RF": "F"
    }
  },
  {
    "code": "NCTR",
    "name": "内省の観察者",
    "blurb": "人物とテーマを直感的に結び、推敲で深めるタイプ。個人の内面から社会を映し出します。",
    "letters": {
      "SN": "N",
      "CW": "C",
      "PT": "T",
      "RF": "R"
    }
  },
  {
    "code": "NCTF",
    "name": "感情の放浪者",
    "blurb": "人物の機微とテーマを、直感と速度で描くタイプ。書きながら発見する物語が得意です。",
    "letters": {
      "SN": "N",
      "CW": "C",
      "PT": "T",
      "RF": "F"
    }
  },
  {
    "code": "NWPR",
    "name": "言葉の魔術師",
    "blurb": "直感と世界観、文体の感覚を持つタイプ。幻想的な世界を、美しい言葉で織ります。",
    "letters": {
      "SN": "N",
      "CW": "W",
      "PT": "P",
      "RF": "R"
    }
  },
  {
    "code": "NWPF",
    "name": "夢境の織り手",
    "blurb": "世界と言葉を直感で紡ぎ、一気に書き上げるタイプ。夢のようなテンポと感覚が武器です。",
    "letters": {
      "SN": "N",
      "CW": "W",
      "PT": "P",
      "RF": "F"
    }
  },
  {
    "code": "NWTR",
    "name": "社会の鏡",
    "blurb": "世界とテーマを直感的に描き、推敲で研ぎ澄ますタイプ。風景の中に時代を映します。",
    "letters": {
      "SN": "N",
      "CW": "W",
      "PT": "T",
      "RF": "R"
    }
  },
  {
    "code": "NWTF",
    "name": "混沌の創造者",
    "blurb": "世界・テーマ・直感・速度がすべて高いタイプ。常識外れの発想を、勢いで紙に載せます。",
    "letters": {
      "SN": "N",
      "CW": "W",
      "PT": "T",
      "RF": "F"
    }
  }
];

  const QUESTIONS = [
  {
    "id": "sn11",
    "axis": "SN",
    "text": "三幕構成など型を意識する",
    "leftText": "三幕構成など型を意識する",
    "rightText": "型よりその場の筆感を信じる",
    "num": 1
  },
  {
    "id": "rf3",
    "axis": "RF",
    "text": "公開前に何度も読み返す",
    "leftText": "公開前に何度も読み返す",
    "rightText": "公開前の読み返しは最小限",
    "num": 2
  },
  {
    "id": "pt21",
    "axis": "PT",
    "text": "言葉の温度を調整する",
    "leftText": "言葉の温度を調整する",
    "rightText": "議論の温度を調整する",
    "num": 3
  },
  {
    "id": "cw1",
    "axis": "CW",
    "text": "主人公の心理が物語の中心",
    "leftText": "主人公の心理が物語の中心",
    "rightText": "世界観や時代設定が物語の中心",
    "num": 4
  },
  {
    "id": "sn6",
    "axis": "SN",
    "text": "時系列が乱れると直したくなる",
    "leftText": "時系列が乱れると直したくなる",
    "rightText": "時系列より印象の流れを優先する",
    "num": 5
  },
  {
    "id": "pt20",
    "axis": "PT",
    "text": "読者の感情より読者の感覚",
    "leftText": "読者の感情より読者の感覚",
    "rightText": "読者の感情より読者の思考",
    "num": 6
  },
  {
    "id": "pt12",
    "axis": "PT",
    "text": "余韻より余白",
    "leftText": "余韻より余白",
    "rightText": "余韻より結論",
    "num": 7
  },
  {
    "id": "sn12",
    "axis": "SN",
    "text": "未解決の伏線が残ると気になる",
    "leftText": "未解決の伏線が残ると気になる",
    "rightText": "未解決の余白も味だと思う",
    "num": 8
  },
  {
    "id": "pt4",
    "axis": "PT",
    "text": "辞書や語彙集をよく開く",
    "leftText": "辞書や語彙集をよく開く",
    "rightText": "新聞や論説をよく読む",
    "num": 9
  },
  {
    "id": "pt23",
    "axis": "PT",
    "text": "作品の「声」が大事",
    "leftText": "作品の「声」が大事",
    "rightText": "作品の「立場」が大事",
    "num": 10
  },
  {
    "id": "rf20",
    "axis": "RF",
    "text": "推敲で文体を整える",
    "leftText": "推敲で文体を整える",
    "rightText": "文体は執筆の流れに任せる",
    "num": 11
  },
  {
    "id": "sn16",
    "axis": "SN",
    "text": "ミステリの仕掛けを考えるのが楽しい",
    "leftText": "ミステリの仕掛けを考えるのが楽しい",
    "rightText": "ミステリより余韻や気配が好き",
    "num": 12
  },
  {
    "id": "sn10",
    "axis": "SN",
    "text": "因果関係が説明できると落ち着く",
    "leftText": "因果関係が説明できると落ち着く",
    "rightText": "因果より「なんとなく」で進むこともある",
    "num": 13
  },
  {
    "id": "cw5",
    "axis": "CW",
    "text": "「この人の物語」と言える",
    "leftText": "「この人の物語」と言える",
    "rightText": "「この世界の物語」と言える",
    "num": 14
  },
  {
    "id": "sn23",
    "axis": "SN",
    "text": "アウトラインソフトやノートを使う",
    "leftText": "アウトラインソフトやノートを使う",
    "rightText": "アウトラインよりエディタだけで足りる",
    "num": 15
  },
  {
    "id": "sn22",
    "axis": "SN",
    "text": "構造の美しさに満足する",
    "leftText": "構造の美しさに満足する",
    "rightText": "書いている最中の高揚に満足する",
    "num": 16
  },
  {
    "id": "rf2",
    "axis": "RF",
    "text": "同じ段落を何度も書き直す",
    "leftText": "同じ段落を何度も書き直す",
    "rightText": "一度書いた段落はあまり戻らない",
    "num": 17
  },
  {
    "id": "sn24",
    "axis": "SN",
    "text": "読後に「よく練られた」と言われたい",
    "leftText": "読後に「よく練られた」と言われたい",
    "rightText": "読後に「予想外だった」と言われたい",
    "num": 18
  },
  {
    "id": "cw17",
    "axis": "CW",
    "text": "群像劇より一人の深さ",
    "leftText": "群像劇より一人の深さ",
    "rightText": "群像劇より世界の広さ",
    "num": 19
  },
  {
    "id": "cw3",
    "axis": "CW",
    "text": "セリフの違和感がいちばん気になる",
    "leftText": "セリフの違和感がいちばん気になる",
    "rightText": "設定の矛盾がいちばん気になる",
    "num": 20
  },
  {
    "id": "sn18",
    "axis": "SN",
    "text": "「どう繋げるか」が執筆の主戦場",
    "leftText": "「どう繋げるか」が執筆の主戦場",
    "rightText": "「次に何が起きるか」が主戦場",
    "num": 21
  },
  {
    "id": "cw15",
    "axis": "CW",
    "text": "人間ドラマが原動力",
    "leftText": "人間ドラマが原動力",
    "rightText": "設定の発見が原動力",
    "num": 22
  },
  {
    "id": "pt25",
    "axis": "PT",
    "text": "言葉そのものが報酬",
    "leftText": "言葉そのものが報酬",
    "rightText": "伝えたことが報酬",
    "num": 23
  },
  {
    "id": "sn9",
    "axis": "SN",
    "text": "読者の驚きは設計で作りたい",
    "leftText": "読者の驚きは設計で作りたい",
    "rightText": "読者の驚きは偶然から生れたい",
    "num": 24
  },
  {
    "id": "pt10",
    "axis": "PT",
    "text": "比喩が多いと嬉しい",
    "leftText": "比喩が多いと嬉しい",
    "rightText": "議論が生まれると嬉しい",
    "num": 25
  },
  {
    "id": "cw25",
    "axis": "CW",
    "text": "人間関係の変化がクライマックス",
    "leftText": "人間関係の変化がクライマックス",
    "rightText": "世界の真相がクライマックス",
    "num": 26
  },
  {
    "id": "sn7",
    "axis": "SN",
    "text": "登場人物をプロットに載せていく",
    "leftText": "登場人物をプロットに載せていく",
    "rightText": "登場人物がプロットを変えていく",
    "num": 27
  },
  {
    "id": "pt17",
    "axis": "PT",
    "text": "同じ内容でも言い換えを試す",
    "leftText": "同じ内容でも言い換えを試す",
    "rightText": "同じ文体でも視点を変えて試す",
    "num": 28
  },
  {
    "id": "sn4",
    "axis": "SN",
    "text": "結末を先に決めてから書くことが多い",
    "leftText": "結末を先に決めてから書くことが多い",
    "rightText": "結末は最後まで決めないことが多い",
    "num": 29
  },
  {
    "id": "sn3",
    "axis": "SN",
    "text": "章立てやシーン表があると安心する",
    "leftText": "章立てやシーン表があると安心する",
    "rightText": "章の区切りは書きながら自然に決まる",
    "num": 30
  },
  {
    "id": "pt16",
    "axis": "PT",
    "text": "修辞より韻律",
    "leftText": "修辞より韻律",
    "rightText": "修辞より論理",
    "num": 31
  },
  {
    "id": "pt13",
    "axis": "PT",
    "text": "詩的な一文を目指す",
    "leftText": "詩的な一文を目指す",
    "rightText": "明快な一文を目指す",
    "num": 32
  },
  {
    "id": "cw7",
    "axis": "CW",
    "text": "読者に伝えたいのは人物の感情",
    "leftText": "読者に伝えたいのは人物の感情",
    "rightText": "読者に伝えたいのは世界の広がり",
    "num": 33
  },
  {
    "id": "pt8",
    "axis": "PT",
    "text": "私小説的な余白を残す",
    "leftText": "私小説的な余白を残す",
    "rightText": "社会派的な問いを残す",
    "num": 34
  },
  {
    "id": "sn2",
    "axis": "SN",
    "text": "伏線を仕込むのが好きだ",
    "leftText": "伏線を仕込むのが好きだ",
    "rightText": "想定外の展開が来るのが好きだ",
    "num": 35
  },
  {
    "id": "pt1",
    "axis": "PT",
    "text": "比喩やリズムにこだわる",
    "leftText": "比喩やリズムにこだわる",
    "rightText": "テーマや問題意識にこだわる",
    "num": 36
  },
  {
    "id": "rf7",
    "axis": "RF",
    "text": "推敲用と執筆用で原稿を分ける",
    "leftText": "推敲用と執筆用で原稿を分ける",
    "rightText": "同じ原稿を書きながら直す",
    "num": 37
  },
  {
    "id": "rf15",
    "axis": "RF",
    "text": "推敲でタイトルも変える",
    "leftText": "推敲でタイトルも変える",
    "rightText": "タイトルは執筆中に決まる",
    "num": 38
  },
  {
    "id": "cw18",
    "axis": "CW",
    "text": "人物の秘密が物語を動かす",
    "leftText": "人物の秘密が物語を動かす",
    "rightText": "世界の秘密が物語を動かす",
    "num": 39
  },
  {
    "id": "pt2",
    "axis": "PT",
    "text": "一文の美しさで満足する",
    "leftText": "一文の美しさで満足する",
    "rightText": "メッセージの伝わり方で満足する",
    "num": 40
  },
  {
    "id": "rf24",
    "axis": "RF",
    "text": "推敲で完璧を目指す",
    "leftText": "推敲で完璧を目指す",
    "rightText": "完璧より完走を目指す",
    "num": 41
  },
  {
    "id": "cw21",
    "axis": "CW",
    "text": "感情の機微を描くのが得意",
    "leftText": "感情の機微を描くのが得意",
    "rightText": "空気や風土を描くのが得意",
    "num": 42
  },
  {
    "id": "sn20",
    "axis": "SN",
    "text": "短編でも起承転結を意識する",
    "leftText": "短編でも起承転結を意識する",
    "rightText": "短編でも断片的な印象を大切にする",
    "num": 43
  },
  {
    "id": "cw22",
    "axis": "CW",
    "text": "人物像からプロットが生まれる",
    "leftText": "人物像からプロットが生まれる",
    "rightText": "世界観からプロットが生まれる",
    "num": 44
  },
  {
    "id": "rf16",
    "axis": "RF",
    "text": "推敲で伏線を追加する",
    "leftText": "推敲で伏線を追加する",
    "rightText": "伏線は執筆中にしか生まれない",
    "num": 45
  },
  {
    "id": "rf19",
    "axis": "RF",
    "text": "推敲に1週間以上かけることも",
    "leftText": "推敲に1週間以上かけることも",
    "rightText": "推敲は数日で終える",
    "num": 46
  },
  {
    "id": "pt6",
    "axis": "PT",
    "text": "音読してリズムを確かめる",
    "leftText": "音読してリズムを確かめる",
    "rightText": "読後感で意味を確かめる",
    "num": 47
  },
  {
    "id": "rf8",
    "axis": "RF",
    "text": "推敲がいちばん集中できる",
    "leftText": "推敲がいちばん集中できる",
    "rightText": "執筆がいちばん集中できる",
    "num": 48
  },
  {
    "id": "sn13",
    "axis": "SN",
    "text": "事件の順序を入れ替えるのは慎重",
    "leftText": "事件の順序を入れ替えるのは慎重",
    "rightText": "事件の順序は直感で入れ替える",
    "num": 49
  },
  {
    "id": "pt18",
    "axis": "PT",
    "text": "沈黙や間も文章の一部",
    "leftText": "沈黙や間も文章の一部",
    "rightText": "主張や問いかけも文章の一部",
    "num": 50
  },
  {
    "id": "pt9",
    "axis": "PT",
    "text": "文体の統一にこだわる",
    "leftText": "文体の統一にこだわる",
    "rightText": "テーマの一貫性にこだわる",
    "num": 51
  },
  {
    "id": "rf21",
    "axis": "RF",
    "text": "推敲後の方が自信が持てる",
    "leftText": "推敲後の方が自信が持てる",
    "rightText": "書き終えた瞬間がいちばん自信",
    "num": 52
  },
  {
    "id": "cw9",
    "axis": "CW",
    "text": "対話シーンが多いと安心する",
    "leftText": "対話シーンが多いと安心する",
    "rightText": "描写シーンが多いと安心する",
    "num": 53
  },
  {
    "id": "sn5",
    "axis": "SN",
    "text": "プロットの整合性を最優先する",
    "leftText": "プロットの整合性を最優先する",
    "rightText": "物語の勢いを最優先する",
    "num": 54
  },
  {
    "id": "sn15",
    "axis": "SN",
    "text": "書き始める前に全体像を描く",
    "leftText": "書き始める前に全体像を描く",
    "rightText": "書き始めて初めて全体像が見える",
    "num": 55
  },
  {
    "id": "rf5",
    "axis": "RF",
    "text": "1日のうち推敲に時間を割く",
    "leftText": "1日のうち推敲に時間を割く",
    "rightText": "1日のうち新規執筆に時間を割く",
    "num": 56
  },
  {
    "id": "cw23",
    "axis": "CW",
    "text": "「誰の視点か」が最初の設計",
    "leftText": "「誰の視点か」が最初の設計",
    "rightText": "「どの時代・場所か」が最初の設計",
    "num": 57
  },
  {
    "id": "cw12",
    "axis": "CW",
    "text": "名前の響きにこだわる",
    "leftText": "名前の響きにこだわる",
    "rightText": "地名や制度名にこだわる",
    "num": 58
  },
  {
    "id": "rf14",
    "axis": "RF",
    "text": "推敲で他人の目を借りる",
    "leftText": "推敲で他人の目を借りる",
    "rightText": "執筆中は他人の目を借りにくい",
    "num": 59
  },
  {
    "id": "pt19",
    "axis": "PT",
    "text": "語彙の意外な組み合わせが好き",
    "leftText": "語彙の意外な組み合わせが好き",
    "rightText": "価値観の対立が好き",
    "num": 60
  },
  {
    "id": "sn14",
    "axis": "SN",
    "text": "構成を人に説明できる",
    "leftText": "構成を人に説明できる",
    "rightText": "構成より「読んでほしい感じ」で語る",
    "num": 61
  },
  {
    "id": "rf17",
    "axis": "RF",
    "text": "推敲で削除が快感",
    "leftText": "推敲で削除が快感",
    "rightText": "執筆で追加が快感",
    "num": 62
  },
  {
    "id": "rf4",
    "axis": "RF",
    "text": "推敲中に構成も変える",
    "leftText": "推敲中に構成も変える",
    "rightText": "推敲より新規執筆を優先",
    "num": 63
  },
  {
    "id": "sn1",
    "axis": "SN",
    "text": "執筆前に、あらすじや構成を固める",
    "leftText": "執筆前に、あらすじや構成を固める",
    "rightText": "白紙から書き始め、展開は後から決める",
    "num": 64
  },
  {
    "id": "rf22",
    "axis": "RF",
    "text": "推敲で読みやすさを優先",
    "leftText": "推敲で読みやすさを優先",
    "rightText": "執筆で勢いを優先",
    "num": 65
  },
  {
    "id": "sn19",
    "axis": "SN",
    "text": "構成の相談をよくする",
    "leftText": "構成の相談をよくする",
    "rightText": "構成よりセリフの相談をよくする",
    "num": 66
  },
  {
    "id": "pt24",
    "axis": "PT",
    "text": "エッセイ的な散文に近い",
    "leftText": "エッセイ的な散文に近い",
    "rightText": "論考的な散文に近い",
    "num": 67
  },
  {
    "id": "rf6",
    "axis": "RF",
    "text": "語句一つまで直したくなる",
    "leftText": "語句一つまで直したくなる",
    "rightText": "大きな流れだけ直せば十分",
    "num": 68
  },
  {
    "id": "cw4",
    "axis": "CW",
    "text": "人物関係図を描きたくなる",
    "leftText": "人物関係図を描きたくなる",
    "rightText": "勢力関係図や年表を描きたくなる",
    "num": 69
  },
  {
    "id": "cw20",
    "axis": "CW",
    "text": "キャラクター同人を想像しやすい",
    "leftText": "キャラクター同人を想像しやすい",
    "rightText": "設定解説を書きたくなる",
    "num": 70
  },
  {
    "id": "cw13",
    "axis": "CW",
    "text": "読後に「この人が忘れられない」と言われたい",
    "leftText": "読後に「この人が忘れられない」と言われたい",
    "rightText": "読後に「この世界に行きたい」と言われたい",
    "num": 71
  },
  {
    "id": "rf13",
    "axis": "RF",
    "text": "推敲チェックリストがある",
    "leftText": "推敲チェックリストがある",
    "rightText": "執筆ルーティンがある",
    "num": 72
  },
  {
    "id": "pt11",
    "axis": "PT",
    "text": "言葉遊びが好き",
    "leftText": "言葉遊びが好き",
    "rightText": "思想実験が好き",
    "num": 73
  },
  {
    "id": "rf12",
    "axis": "RF",
    "text": "推敲は冷静な時間",
    "leftText": "推敲は冷静な時間",
    "rightText": "執筆は熱い時間",
    "num": 74
  },
  {
    "id": "pt15",
    "axis": "PT",
    "text": "「うまい」と言われたい",
    "leftText": "「うまい」と言われたい",
    "rightText": "「考えさせられる」と言われたい",
    "num": 75
  },
  {
    "id": "cw24",
    "axis": "CW",
    "text": "登場人物の数より質",
    "leftText": "登場人物の数より質",
    "rightText": "登場人物より舞台の厚み",
    "num": 76
  },
  {
    "id": "cw14",
    "axis": "CW",
    "text": "インタビュー形式のプロットメモもあり",
    "leftText": "インタビュー形式のプロットメモもあり",
    "rightText": "年表形式のプロットメモもあり",
    "num": 77
  },
  {
    "id": "pt3",
    "axis": "PT",
    "text": "削ぎ落とした表現を好む",
    "leftText": "削ぎ落とした表現を好む",
    "rightText": "はっきりした主張を好む",
    "num": 78
  },
  {
    "id": "pt22",
    "axis": "PT",
    "text": "美辞麗句も必要",
    "leftText": "美辞麗句も必要",
    "rightText": "率直な言葉も必要",
    "num": 79
  },
  {
    "id": "rf18",
    "axis": "RF",
    "text": "推敲日と執筆日を分ける",
    "leftText": "推敲日と執筆日を分ける",
    "rightText": "毎日同じペースで書く",
    "num": 80
  },
  {
    "id": "cw16",
    "axis": "CW",
    "text": "キャラの口調を先に決める",
    "leftText": "キャラの口調を先に決める",
    "rightText": "世界の言葉遣いを先に決める",
    "num": 81
  },
  {
    "id": "rf9",
    "axis": "RF",
    "text": "推敲で文字数が減ることが多い",
    "leftText": "推敲で文字数が減ることが多い",
    "rightText": "推敲より執筆で文字数が増える",
    "num": 82
  },
  {
    "id": "pt14",
    "axis": "PT",
    "text": "語感で引っかかった語を採用",
    "leftText": "語感で引っかかった語を採用",
    "rightText": "意味で引っかかった語を採用",
    "num": 83
  },
  {
    "id": "rf25",
    "axis": "RF",
    "text": "推敲こそが執筆の本番",
    "leftText": "推敲こそが執筆の本番",
    "rightText": "執筆こそが本番",
    "num": 84
  },
  {
    "id": "sn17",
    "axis": "SN",
    "text": "プロット変更は計画表から直す",
    "leftText": "プロット変更は計画表から直す",
    "rightText": "プロット変更は原稿を書き換えながら",
    "num": 85
  },
  {
    "id": "cw6",
    "axis": "CW",
    "text": "登場人物の過去を深掘りする",
    "leftText": "登場人物の過去を深掘りする",
    "rightText": "社会制度や歴史の過去を深掘りする",
    "num": 86
  },
  {
    "id": "rf1",
    "axis": "RF",
    "text": "書き終えてから推敲する時間を多く取る",
    "leftText": "書き終えてから推敲する時間を多く取る",
    "rightText": "書き終わったらすぐ次へ進む",
    "num": 87
  },
  {
    "id": "rf23",
    "axis": "RF",
    "text": "推敲は孤独な作業",
    "leftText": "推敲は孤独な作業",
    "rightText": "執筆は孤独だが勢いがある",
    "num": 88
  },
  {
    "id": "cw19",
    "axis": "CW",
    "text": "共感より共鳴を狙う",
    "leftText": "共感より共鳴を狙う",
    "rightText": "没入より探索を狙う",
    "num": 89
  },
  {
    "id": "cw10",
    "axis": "CW",
    "text": "人物の成長 arc を意識する",
    "leftText": "人物の成長 arc を意識する",
    "rightText": "世界の変容を意識する",
    "num": 90
  },
  {
    "id": "sn8",
    "axis": "SN",
    "text": "構成メモが机の定位置にある",
    "leftText": "構成メモが机の定位置にある",
    "rightText": "机には原稿だけがあることが多い",
    "num": 91
  },
  {
    "id": "sn21",
    "axis": "SN",
    "text": "逆算して書くことが多い",
    "leftText": "逆算して書くことが多い",
    "rightText": "順算して書くことが多い",
    "num": 92
  },
  {
    "id": "rf10",
    "axis": "RF",
    "text": "推敲中に新しい発見もある",
    "leftText": "推敲中に新しい発見もある",
    "rightText": "執筆中の発見の方が多い",
    "num": 93
  },
  {
    "id": "pt5",
    "axis": "PT",
    "text": "「どう書くか」が悩みの中心",
    "leftText": "「どう書くか」が悩みの中心",
    "rightText": "「何を伝えるか」が悩みの中心",
    "num": 94
  },
  {
    "id": "rf11",
    "axis": "RF",
    "text": "完成度80%で止められない",
    "leftText": "完成度80%で止められない",
    "rightText": "勢いがあれば60%でも進める",
    "num": 95
  },
  {
    "id": "cw8",
    "axis": "CW",
    "text": "キャラが勝手に動き出すと嬉しい",
    "leftText": "キャラが勝手に動き出すと嬉しい",
    "rightText": "世界のルールが見えてくると嬉しい",
    "num": 96
  },
  {
    "id": "cw11",
    "axis": "CW",
    "text": "似た人物より個性的な一人を描く",
    "leftText": "似た人物より個性的な一人を描く",
    "rightText": "似た設定より独自の世界を描く",
    "num": 97
  },
  {
    "id": "pt7",
    "axis": "PT",
    "text": "描写より言葉の選び方",
    "leftText": "描写より言葉の選び方",
    "rightText": "描写より論点の整理",
    "num": 98
  },
  {
    "id": "cw2",
    "axis": "CW",
    "text": "キャラクター設定シートを作る",
    "leftText": "キャラクター設定シートを作る",
    "rightText": "設定資料や地図を作る",
    "num": 99
  },
  {
    "id": "sn25",
    "axis": "SN",
    "text": "物語は建築のようなものだ",
    "leftText": "物語は建築のようなものだ",
    "rightText": "物語は旅のようなものだ",
    "num": 100
  }
];

  window.HyakuData = {
    AXES,
    SCALE_LEVELS,
    TYPES,
    QUESTIONS,
  };
})();
