/* 見張りの見張り（総点検）── 2026-08-25 作成
   「見張り」を1つ1つ足しても、その見張り自体が後から静かに外されたら
   誰も気づけない。このテストは、見張りが今もそこにあるか（消されていないか）を
   まとめて確認する【見張りの見張り】である。

   ここで確認すること（個別の在庫・税・原価の数字テストはやらない。それは他のテストの役目）:
   ① 版の見張り：全アプリのHTMLで <meta name="oos-version"> と version.json の値が
      一致しているか（先祖返り・上げ忘れを機械で検知する）。oos-version.js を
      読み込んでいるかも確認する。
   ② 主要4アプリ（マスターN・受注A・倉庫D・請求C）が oos-zaiko.js を読み込んでいるか。
   ③ 既知の「画面を開くと自動で走る自己点検・監視・照合」が、今もソースに存在するか
      （関数やバナーの要素idが消えている＝見張りそのものが外されている、を検知する）。
   ④ 「もう使わない」と決めた危険な画面（在庫Bの在庫一覧など）が、
      静かに生き返っていないか（開くボタンが増えていないか）。
   ⑤ GASに同じ名前の関数が2つ以上定義されていないか
      （後で書かれたほうだけが有効になり、片方が一生呼ばれない事故の再発防止。
      2026-08-25、oosRestockCheck が実際にこの状態で見つかり oosBasaraRestockCheck に改名した）。

   本番のファイルをそのまま読むだけ（実行はしない項目もある）。保存先には一切書き込まない。 */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

/* ── ① 版の見張り：version.json ⇔ 各HTMLの <meta name="oos-version"> ── */
const versionJson = JSON.parse(fs.readFileSync(path.join(H.LIVE, 'version.json'), 'utf8'));
const pages = versionJson.pages || {};

Object.keys(pages).forEach(function(file){
  const expect = pages[file];
  let src;
  try{ src = H.read(file); }
  catch(e){ ok('①' + file + ' が存在する（version.jsonに載っているのにファイルが無い）', false); return; }
  const m = /<meta\s+name="oos-version"\s+content="([^"]*)">/.exec(src);
  ok('①' + file + ' に oos-version の meta タグがある', !!m);
  if(m){
    ok('①' + file + ' の meta 版(' + m[1] + ') と version.json の版(' + expect + ') が一致', m[1] === expect);
  }
  ok('①' + file + ' が oos-version.js を読み込んでいる', src.indexOf('src="oos-version.js"') >= 0);
});

/* version.jsonに載っていない .html ファイルが無いか（新しいアプリを作って登録し忘れる事故の防止）。
   mock_*.html（承認モックの控え）だけは対象外。 */
const allHtml = fs.readdirSync(H.LIVE).filter(function(f){
  return f.endsWith('.html') && !f.startsWith('mock_') && !f.startsWith('mock');
});
allHtml.forEach(function(file){
  ok('①' + file + ' が version.json に登録されている（新アプリの登録漏れ防止）', Object.prototype.hasOwnProperty.call(pages, file));
});

/* ══════════════════════════════════════════════════════════════════════
   🔑 親ファイル（oos-◯◯.js）の合言葉 ?v= も、上げ忘れを見つける
   ──────────────────────────────────────────────────────────────────────
   ★2026-09-12 ひろみさん：「PDFは、さっきからおねがいしてるけど一切直ってない」

   起きていたこと：oos-doc.js の中身は直したのに、読み込む側の ?v= を上げ忘れた。
   ブラウザは古いファイルを使いつづけるので、直したものが画面に届かない。
   さらに oos-shorui-kimari.js は アプリによって ?v= が違っていて、
   【アプリごとに決めごとが違う】状態になっていた（実際に見つかった）。

   直し方：合言葉を【親ファイルの中身から計算】する（scripts/oya-version.js）。
   中身が1文字でも変われば合言葉が変わるので、上げ忘れが起きない。

   ★ここは版の見張り（①）の一部です。別の見張りを新しく作らないでください。
   　ずれていたら  node scripts/oya-version.js --naosu  でそろえます。
   ══════════════════════════════════════════════════════════════════════ */
{
  const OYA = require(path.join(H.LIVE, 'scripts', 'oya-version.js'));
  const r = OYA.shirabe();
  ok('①親ファイルの合言葉(?v=)が全部そろっている' +
     (r.zure.length ? '　ずれ：' + r.zure.slice(0,3).map(function(x){ return x.file + ' ' + x.tag; }).join(' / ') +
        (r.zure.length > 3 ? ' ほか' + (r.zure.length - 3) + 'か所' : '') : '（合言葉 ' + r.ima + '）'),
     r.zure.length === 0);
}

/* ── ② 在庫の親 oos-zaiko.js を読み込んでいるべき4アプリ ── */
const ZAIKO_APPS = ['master.html', 'index.html', 'pickup.html', 'billing.html'];
ZAIKO_APPS.forEach(function(file){
  const src = H.read(file);
  ok('②' + file + ' が oos-zaiko.js を読み込んでいる', src.indexOf('src="oos-zaiko.js') >= 0);
});

/* ── ③ 既知の「画面を開くと自動で走る自己点検」が今もソースに存在するか ── */
const KNOWN_WATCHERS = [
  { file: 'index.html',  needle: 'oosZaikoSelfCheck',      label: '受注A：在庫の数え方セルフチェック（赤い帯）' },
  { file: 'index.html',  needle: 'oos-zaiko-alarm',         label: '受注A：セルフチェック異常時の赤い帯（見た目側）' },
  { file: 'home.html',   needle: 'renderAlerts',            label: '玄関：期限・在庫アラート描画' },
  { file: 'home.html',   needle: 'oosGenkanSelfCheck',      label: '玄関：セルフチェック（作り物データを本物関数に流す採点式）' },
  { file: 'home.html',   needle: 'OOS_MIHARI',              label: '玄関：「いま見張っているもの」一覧の常時表示' },
  { file: 'master.html', needle: 'oosCheckStale',           label: '統合マスタN：3分おきの在庫の指紋照合（古い画面検知）' },
  { file: 'master.html', needle: 'oosSaveFailShow',         label: '統合マスタN：画面が隠れる瞬間の保存失敗バナー' },
  { file: 'labels.html', needle: 'setLabelBanner',          label: 'ラベル：読み込み0件・失敗の警告バナー' },
  { file: 'import.html', needle: 'showPriceGasBanner',      label: '輸入・原価E：価格保存後の反映照合バナー' },
  { file: 'hiromi.html', needle: 'bdVerify',                label: 'ひろみメモ：伝言板の送信後の保存照合' },
  { file: 'yuka.html',   needle: 'bdVerify',                label: 'ゆかメモ：伝言板の送信後の保存照合' },
  { file: 'oos-version.js', needle: 'reloadFresh',          label: '版の見張り：古い版を自動で読み直す仕組み' },
  /* ★2026-09-12 ひろみさん：「0になったり、抜けてますとか言ってくるやつ」
     　　　　　　　　　　　　「徹底的に調べて　修正ゲームはやめたい」
     商品名簿は GAS の【loadProducts】という窓口だけが返します（2026-09-12実測55件）。
     各アプリの中には古い名簿が焼き付いていて（受注Ａは43件）、
     読めなかったときは【黙って】その古い名簿で動き続けていました。
     足りない12件（紙袋・オーガンジー・注ぎ口・ギフトボックス2種・
     モンテ物産オイル・ザクロソース・セット4種）は単価が引けず、
     あとから「単価が登録されていない商品があります」と言われる原因でした。
     ★7つのアプリすべてが、出どころを親に知らせること。消すとまた黙ります。 */
  { file: 'oos-meibo.js',   needle: 'function shirase',    label: '名簿の見張り：出どころを知らせる親' },
  { file: 'index.html',     needle: 'OOS_MEIBO.shirase',   label: '受注Ａ：名簿の出どころを親に知らせる' },
  { file: 'billing.html',   needle: 'OOS_MEIBO.shirase',   label: '請求Ｃ：名簿の出どころを親に知らせる' },
  { file: 'mitsumori.html', needle: 'OOS_MEIBO.shirase',   label: '見積М：名簿の出どころを親に知らせる' },
  { file: 'master.html',    needle: 'OOS_MEIBO.shirase',   label: '統合マスタＮ：名簿の出どころを親に知らせる' },
  { file: 'pickup.html',    needle: 'OOS_MEIBO.shirase',   label: '倉庫Ｄ：名簿の出どころを親に知らせる' },
  { file: 'stock.html',     needle: 'OOS_MEIBO.shirase',   label: '在庫Ｂ：名簿の出どころを親に知らせる' },
  { file: 'import.html',    needle: 'OOS_MEIBO.shirase',   label: '輸入Ｅ：名簿の出どころを親に知らせる' },
];
/* ★2026-09-12 ここを強くしました。ひろみさん：
   「見張りを入れる前に見張りを更新するか、古い見張りを捨てて！！また同じことが起きる」
   ──────────────────────────────────────────────────────────────
   前は、ファイルの中に文字があるかだけを見ていました。
   そのため【注記（コメント）に関数名を書いただけ】で通ってしまい、
   本体を外しても落ちませんでした（2026-09-12 に実際に起きました）。
   → コメントを落としてから見ます。これで、本物のコードだけを見ます。
   ★komentoNashi3 を外さないでください。外すと、また注記で通ります。 */
var SOTEN_CB = new RegExp("/" + "\\*[\\s\\S]*?\\*" + "/", "g");   /* かたまりのコメント */
var SOTEN_CL = new RegExp("//[^" + String.fromCharCode(10) + "]*", "g");                 /* // のコメント */
var SOTEN_HC = new RegExp("<!--[\\s\\S]*?-->", "g");                        /* HTMLのコメント */
function komentoNashi3(s){
  return String(s).replace(SOTEN_CB, "").replace(SOTEN_HC, "").replace(SOTEN_CL, "");
}
/* 名前が「そこで終わっているか」を見る。後ろに英数字や _ が続いていたら別ものです。
   （要素id のように - を含む名前も、そのまま探せます） */
function tangoDeAruKa(src, needle){
  var esc = String(needle).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
  return new RegExp(esc + "(?![A-Za-z0-9_])").test(String(src));
}
KNOWN_WATCHERS.forEach(function(w){
  const src = komentoNashi3(H.read(w.file));
  /* ★2026-09-12 ただの indexOf をやめました。
     　名前の後ろに文字が続いていたら【別もの】とみなします。
     　例：oosGenkanSelfCheck を oosGenkanSelfCheck_KESHITA に変えても、
     　　　前は部分一致で通ってしまい、見張りが落ちませんでした。
     ★この tangoDeAruKa を外さないでください。 */
  ok('③' + w.label + '（' + w.file + ' 内 ' + w.needle + '）が存在する', tangoDeAruKa(src, w.needle));
});

/* ── ④ 「もう使わない」と決めた危険な画面が生き返っていないか ──
   在庫B（stock.html）は不良在庫リストの1画面だけが正しい姿。「在庫一覧」等の
   タブを開くボタンが増えると、古い計算モデルのまま統合マスタN（親）と
   食い違う数字を保存できる状態が復活してしまう（master-n-rules確定事項）。 */
{
  const src = H.read('stock.html');
  const tabButtons = (src.match(/class="tab[ "][^>]*onclick="showPanel\('(\w+)'/g) || [])
    .map(function(s){ return /showPanel\('(\w+)'/.exec(s)[1]; });
  ok('④stock.html：タブを開くボタンは1個だけ（在庫一覧などが復活していない）', tabButtons.length === 1);
  ok('④stock.html：その1個は「不良在庫リスト(defect)」のみ', tabButtons.length === 1 && tabButtons[0] === 'defect');
}

/* ── ⑤ GASの「トップレベル」関数に、同じ名前の重複が無いか ──
   インデントされた関数（他の関数の中だけで使うローカルの入れ子ヘルパー、例：w()）は
   別スコープなので対象外。行頭（インデント無し）で定義されたものだけを見る。
   ただし、意図的に「あとに書いたほうを使う」上書き方式（renraku-rulesで正式に認められた
   手渡し用の安全策）は例外として許す。その関数名はここに書き出し、増やすときは
   コード側に必ず「上書きします」の注記があることを人が確認してから足すこと。 */
{
  const gasPath = path.join(H.LIVE, '..', 'olive-stories-gas', 'コード.js');
  const ALLOWED_INTENTIONAL_OVERRIDE = ['oosRenrakuRoute'];  // 末尾に「上書きします」の注記あり（画面からの入口を安全に足す手法）
  if(fs.existsSync(gasPath)){
    const gasSrc = fs.readFileSync(gasPath, 'utf8');
    const re = /(?:^|\n)function\s+([A-Za-z0-9_]+)\s*\(/g;  // 行頭＝インデント無しのみ
    const seen = {};
    let m;
    while((m = re.exec(gasSrc))){ const name = m[1]; seen[name] = (seen[name]||0) + 1; }
    const dups = Object.keys(seen).filter(function(k){ return seen[k] > 1 && ALLOWED_INTENTIONAL_OVERRIDE.indexOf(k) < 0; });
    ok('⑤GASのトップレベル関数に想定外の重複が無い（見つかった重複：' + dups.join('、') + '）', dups.length === 0);
  } else {
    console.log('  －  GASのファイルが手元にありません（⑤は飛ばしました）');
  }
}

/* ── ⑥ 見張りの砂場に【決めごとの親】が入っているか ──────────────────
   ★2026-09-12 この項目が生まれた理由（実際に起きた事故）
   tests/harness.js の makeSandbox に 書類の決めごとの親 oos-shorui-kimari.js を
   入れていませんでした。そのため、書類の親（oos-nouhin.js）を動かす見張りが
   【古い動きのまま通って】いました。実際に見つかった3件：
   　・「納品書だけなら金額を出さない」（2026-09-11に変えた古い決めごと）
   　・合計26,244円（ピックアップ料金・送料が入る前の数）
   　・「送料が無い注文＝別途申し受けます」（別途はえらぶものに変わった）
   全部PASSなのに、本物とちがうものを測っていた。これがいちばん怖い壊れ方です。
   ★この項目を消さないでください。消すと、また静かに古い決めごとで通ります。
   ──────────────────────────────────────────────────────────── */
{
  /* 砂場に必ず入っていないといけない親。親を増やしたら、ここにも足すこと */
  var OYA_HISSU = [
    [ "oos-zei.js",           "消費税" ],
    [ "oos-kakaku.js",        "単価" ],
    [ "oos-shorui-kimari.js", "書類の決めごと（数字が載る書類・必ず載る枠・単位・送料）" ],
    [ "oos-doc.js",           "書類の体裁" ],
    [ "oos-nouhin.js",        "納品書の中身" ]
  ];
  /* ★コメントを落としてから見る（自分の注記に当たって誤判定しないため）。
     　2026-09-12 に、コメントで親の名前に触れているだけの見張りを
     　「入れ忘れ」と誤って名指しする失敗を3回しました。 */
  var COMMENT_BLOCK = new RegExp("/\\*[\\s\\S]*?\\*/", "g");
  var COMMENT_LINE  = new RegExp("//[^" + String.fromCharCode(10) + "]*", "g");
  function komentoNashi(s){ return String(s).replace(COMMENT_BLOCK, "").replace(COMMENT_LINE, ""); }

  var hNaka = komentoNashi(H.read("tests/harness.js"));
  var mkI = hNaka.indexOf("function makeSandbox");
  ok("⑥harness.js に makeSandbox がある", mkI >= 0);
  OYA_HISSU.forEach(function (x) {
    var f = x[0], na = x[1];
    ok("⑥砂場に親 " + f + "（" + na + "）を入れている",
       mkI >= 0 && hNaka.indexOf(f, mkI) > mkI);
  });

  /* 親を入れずに、自分で砂場を作って書類の親を動かしている見張りがないか。
     makeSandbox を使っていれば親は自動で入るので、それは合格とみなす。 */
  var tDir = path.join(H.LIVE, "tests");
  var tFiles = fs.readdirSync(tDir).filter(function (f) { return /^test_/.test(f) && /[.]js$/.test(f); });
  var warui = [];
  tFiles.forEach(function (f) {
    var naka = komentoNashi(fs.readFileSync(path.join(tDir, f), "utf8"));
    if (naka.indexOf("makeSandbox") >= 0) return;        /* 親は自動で入る＝合格 */
    if (naka.indexOf("createContext") < 0) return;       /* 砂場を作っていない＝関係ない */
    /* 書類の親を本当に動かしているか（名前を書いているだけでは数えない） */
    var ugokasu = /OOS_NOUHIN|OOS_DOC|buildInvoiceHtml|shoruiList|needsNouhin/.test(naka);
    if (!ugokasu) return;
    /* ★自分で5つの親を全部名指しで読み込んでいるなら合格。
       　（例：test_shorui_kanarazu.js は makeSandbox を使わず、自分で全部入れています。
       　　それは正しいやり方なので、名指しするだけで落とさないこと） */
    var zenbuAru = OYA_HISSU.every(function (x) { return naka.indexOf(x[0]) >= 0; });
    if (!zenbuAru) warui.push(f);
  });
  ok("⑥自分で砂場を作って書類の親を動かす見張りに、親の入れ忘れが無い（見つかった：" +
     warui.join("、") + "）", warui.length === 0);
}

/* ── ⑤-B アプリ（HTML）と親ファイルにも、同じ名前の関数の重なりが無いか ──
   ★2026-09-12 ⑤の守備範囲を広げました（新しい見張りは作っていません）。
   ──────────────────────────────────────────────────────────────
   ⑤はGASだけを見ていました。でも同じ事故はHTMLアプリでも起きます。
   JavaScript は同じ名前の関数が2つあると【あとに書いたほう】だけを使うので、
   前のほうは一生呼ばれません。＝「直したのに直らない」の正体です。

   2026-09-12 に実際に見つかったもの：
   　・mitsumori.html の v3RegisterQuote が2つ。前のほうは
   　　「この機能はまだ準備中です」の殻で、死んでいた（片づけました）。
   　・master.html の4つ（renderCatSummary / renderCatOptions /
   　　renderDefectGroups / renderDefectHistory）は【わざと】空にしたもの。
   　　削除した5タブの描画を止めるための意図的な上書きで、理由もコードに
   　　書いてあります。だから下の「わざとの上書き」に載せて許しています。

   ★許す一覧に足すときは、コード側に「なぜわざと2つにしたか」の注記が
   　あることを人が見てから足すこと。注記の無い重なりは事故です。
   ──────────────────────────────────────────────────────────── */
{
  /* わざと2つにしてあるもの（ファイル名 → 関数名） */
  var WAZATO = {
    "master.html": ["renderCatSummary", "renderCatOptions",
                    "renderDefectGroups", "renderDefectHistory"]
  };
  var CB2 = new RegExp("/\\*[\\s\\S]*?\\*/", "g");
  var CL2 = new RegExp("//[^" + String.fromCharCode(10) + "]*", "g");
  var FN2 = /function\s+([A-Za-z0-9_$]+)\s*\(/g;

  /* インデントの無い（行頭の）関数だけを見る。
     　他の関数の中だけで使う入れ子のヘルパー（同じ名前でも別のもの）は対象外。
     　例：master.html の withPN / bucketOf / arrow は入れ子なので問題ありません。 */
  function gyoutouDake(src) {
    var naka = String(src).replace(CB2, "").replace(CL2, "");
    /* ★async function も数える。これを入れ忘れて、実際に mitsumori.html の
       　async function v3RegisterQuote を見落としました（2026-09-12）。
       ★"(?:async\\\\s+)?" を外さないでください。 */
    var re = new RegExp("(?:^|" + String.fromCharCode(10) + ")(?:async\\s+)?function\\s+([A-Za-z0-9_$]+)\\s*\\(", "g");
    var seen = {}, m;
    while ((m = re.exec(naka))) { seen[m[1]] = (seen[m[1]] || 0) + 1; }
    return seen;
  }

  var mitaFile = fs.readdirSync(H.LIVE).filter(function (f) {
    if (/^mock_/.test(f)) return false;            /* モックは対象外 */
    return /[.]html$/.test(f) || /^oos-.*[.]js$/.test(f);
  });
  mitaFile.forEach(function (f) {
    var seen = gyoutouDake(fs.readFileSync(path.join(H.LIVE, f), "utf8"));
    var yurusu = WAZATO[f] || [];
    var dup = Object.keys(seen).filter(function (k) {
      return seen[k] > 1 && yurusu.indexOf(k) < 0;
    });
    ok("⑤-B " + f + " に想定外の関数の重なりが無い（見つかった：" + dup.join("、") + "）",
       dup.length === 0);
  });
}

/* ── ③-B 7つのアプリが、名簿の親（oos-meibo.js）を読み込んでいるか ──
   ★知らせる1行を書いても、親を読み込んでいなければ何も起きません。
   　2026-09-12 に実際、コメントの中の「oos-meibo.js」に引っかかって
   　script タグを入れ忘れかけました。両方そろって初めて動きます。 */
{
  ['index.html','billing.html','mitsumori.html','master.html',
   'pickup.html','stock.html','import.html'].forEach(function(f){
    var src = komentoNashi3(H.read(f));
    ok('③-B ' + f + ' が名簿の親 oos-meibo.js を読み込んでいる',
       src.indexOf('<script src="oos-meibo.js') >= 0);
  });
}

console.log('===== 見張りの見張り（総点検） =====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if(fail){ fails.forEach(function(f){ console.log('  ★ ' + f); }); process.exit(1); }
