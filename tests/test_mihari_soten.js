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
];
KNOWN_WATCHERS.forEach(function(w){
  const src = H.read(w.file);
  ok('③' + w.label + '（' + w.file + ' 内 ' + w.needle + '）が存在する', src.indexOf(w.needle) >= 0);
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

console.log('===== 見張りの見張り（総点検） =====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if(fail){ fails.forEach(function(f){ console.log('  ★ ' + f); }); process.exit(1); }
