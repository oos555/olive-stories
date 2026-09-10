/* ══════════════════════════════════════════════════════════════════════
   古い「取り置き・予約シート」（読むだけの鏡）はもう使わない　2026-09-10

   ★ひろみさんの判断（原文）
     「本部管理専用ゆかスプシの方なんだけれども、そこに取り置き予約シートがあります。
     　これは前に作ってもらったものだと思うんだけれども、今作ったものを正しいものと
     　すると、これはもう古いものになるからいらないのではないかと思います」

   ★調べたこと（2026-09-10）
     ・このタブは oosHonbuSync が上から書くだけの【読むだけの鏡】で、
     　どのコードもこのタブから【読んでいません】。消しても他は壊れません。
     ・中身は受注Ａから作り直せます（ここにしか無いデータはありません）。
     　実際、しまったときに入っていたのは1行（テスト注文）だけでした。
     ・RTの分はもともとここに出ません（「RT専用取り置き・予約」タブに出ます）。
     ・後を引き継ぐのは【🗂 取り置き及び発注前予約リスト（ホテル以外）】です。
     　倉庫さんにも見えて、A列で発注書へ送れます。

   ★やり方（いきなり消さない）
     oosYoyakuSheetRetire … 名前を「（使いません）…」に変えて隠す（自動更新が止まる）
     oosYoyakuSheetRevive … 元に戻す
     oosYoyakuSheetDelete … 本当に消す（しまったあとだけ通る）

   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function has(name, needle) { ok(name, GAS.indexOf(needle) >= 0, '（' + needle.slice(0, 40) + ' が無い）'); }
function hasNot(name, needle) { ok(name, GAS.indexOf(needle) < 0, '（' + needle.slice(0, 40) + ' が残っている）'); }
function bodyOf(src, name) {
  const m = src.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
  if (!m) return '';
  let i = src.indexOf(m[0]) + m[0].length - 1, d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) break; } }
  return src.slice(src.indexOf(m[0]), i + 1);
}

/* ── ① しまう・戻す・消す の3つがそろっている ───────────────── */
has('① しまう窓口がある',   'function oosYoyakuSheetRetire(');
has('① 戻す窓口がある',     'function oosYoyakuSheetRevive(');
has('① 消す窓口がある',     'function oosYoyakuSheetDelete(');
has('① しまったあとの名前が決まっている', "var OOS_YOYAKU_SHEET_OFF = '（使いません）取り置き・予約シート';");
has('① 外からも押せる（しまう）', "if(action === 'oosYoyakuSheetRetire')");
has('① 外からも押せる（戻す）',   "if(action === 'oosYoyakuSheetRevive')");
has('① 外からも押せる（消す）',   "if(action === 'oosYoyakuSheetDelete')");

/* ── ② いきなり消さない（安全よけ） ──────────────────────── */
const del = bodyOf(GAS, 'oosYoyakuSheetDelete');
ok('② 消す前に「しまってあるか」を見ている', del.indexOf('OOS_YOYAKU_SHEET_OFF') >= 0);
ok('② しまっていなければ消さない', del.indexOf('⛔ まだ') >= 0 && del.indexOf('なっていないので消しません') >= 0);
ok('② 消す前の案内に、しまう窓口の名前が書いてある', del.indexOf('oosYoyakuSheetRetire') >= 0);

/* ── ③ しまうときに、行き先を1行目に書いておく ───────────────── */
const ret = bodyOf(GAS, 'oosYoyakuSheetRetire');
ok('③ 1行目に「このタブは使いません」と書く', ret.indexOf('このタブは使いません') >= 0);
ok('③ 行き先（新しいリスト）の名前を書く', ret.indexOf('取り置き及び発注前予約リスト（ホテル以外）') >= 0);
ok('③ 戻し方（oosYoyakuSheetRevive）も書く', ret.indexOf('oosYoyakuSheetRevive') >= 0);
ok('③ 何行入っていたかを数えてから、しまう', ret.indexOf('getLastRow()') >= 0);
ok('③ タブを隠す', ret.indexOf('hideSheet()') >= 0);
ok('③ 目次を作り直す', ret.indexOf('oosYukaTocBuild_') >= 0);

/* ── ④ 鏡の書き込みは「タブが無ければ何もしない」 ───────────── */
has('④ 鏡はタブを探してから書く', "var sy = oosYoyakuFile_().getSheetByName(OOS_YOYAKU_SHEET);");
has('④ タブが無いときは飛ばす（if(sy)）', 'if(sy){');
hasNot('④ 鏡が勝手にタブを作り直さない', "insertSheet(OOS_YOYAKU_SHEET)");

/* ── ⑤ 目次は新しいリストを指している ──────────────────── */
has('⑤ 目次に新しいリストの行がある', "[gidLink(OOS_YL_SHEET,'🗂 取り置き及び発注前予約リスト（ホテル以外）')");
hasNot('⑤ 目次に古い「🔒 取り置き・予約シート（このファイルの中）」の行は無い',
       "ownLink(OOS_YOYAKU_SHEET,'🔒 取り置き・予約シート（このファイルの中）')");
ok('⑤ 目次の行を増やしていない（書式の行番号がずれないように）',
   GAS.indexOf('行を足さずに【差し替え】にしてあるのは') >= 0);

/* ── ⑥ 流れ図のひとことも新しい名前 ─────────────────────── */
has('⑥ 流れ図が新しいリストを案内している',
    '※🔒取り置き・✈️予約で受けた注文は「🗂 取り置き及び発注前予約リスト（ホテル以外）」に1件1行で見えます');
hasNot('⑥ 流れ図に古い言い方が残っていない',
       "※🔒取り置き・✈️予約で受けた注文は「取り置き・予約シート」に1行で見えます");

/* ── ⑦ 新しいリストは生きている（受け皿がある） ───────────── */
has('⑦ 新しいリストのタブ名が決まっている', "var OOS_YL_SHEET ");
has('⑦ 新しいリストに1行足す入口がある',   'function oosYoyakuListAdd(');
has('⑦ 新しいリストから発注書へ送る動きがある', 'function oosYoyakuListGo_(');
has('⑦ 新しいリストは分類ごとの合計を出す', 'function oosYoyakuListSummary_(');

/* ── ⑧ RTの分は今までどおり「RT専用取り置き・予約」 ─────────── */
has('⑧ RT専用タブの名前は変わっていない', "var OOS_RTC_SHEET = 'RT専用取り置き・予約';");
ok('⑧ RT専用タブをしまう・消すコードを書いていない',
   GAS.indexOf('oosRtcSheetDelete') < 0 && GAS.indexOf('oosRtcSheetRetire') < 0);

/* ── ⑨ 「（使いません）」で言葉がそろっているか（2026-09-10 ひろみさん指示） ── */
/* ひろみさん：「出荷依頼書のタブのところを、今は使ってないとか消す予定とか、
   　　　　　　何か統一したその言葉をつけておいてもらって、
   　　　　　　できるだけシンプルに分かりやすくしていってもらいたい」
   → 統一の言葉は【（使いません）】。ほかの言い方を混ぜないでください。 */
const IDX = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/index.html', 'utf8');
function hasIdx(name, needle){ ok(name, IDX.indexOf(needle) >= 0, '（' + needle.slice(0,40) + ' が無い）'); }
hasIdx('⑨出荷依頼書タブに印',        '（使いません）出荷依頼書');
hasIdx('⑨バサラ半自動取込タブに印',  '（使いません）📧 バサラ半自動化・取り込み');
hasIdx('⑨出荷依頼書のパネルに理由',  '🗃 このタブは使いません（2026-09-10）');
hasIdx('⑨いまの行き先も書いてある',  '発注書』タブのA列を【🔵 発送してください】にしたとき');
hasIdx('⑨カードの出荷依頼書ボタンもグレー', '📄 （使いません）出荷依頼書を確認・編集する');
/* ★2026-09-10（同じ日の夕方）ひろみさん指示で、受注一覧のカードから大きな枠を外しました。
   バサラの受注確定メールのボタンは【グレーにする】から【もう置かない】に変わりました。 */
ok('⑨バサラの受注確定メールのボタンはもう置かない', IDX.indexOf('バサラに受注確定のメールを送る') < 0);
ok('⑨受注一覧に📮倉庫LINEのボタンも無い',           IDX.indexOf('📮 倉庫にLINEで送る') < 0);
ok('⑨①②のステップの枠はもう作らない',              IDX.indexOf('rk-no">①') < 0);
hasIdx('⑨見るのは1つだけ：発注書に行ったか',        '🔴 まだ発注書に送っていません');
hasIdx('⑨行ったものは緑で出る',                     '✅ 発注書に送りました');
hasIdx('⑨倉庫へ行くのは🔵のときだけと書いてある',    '発注書のA列を【🔵 発送してください】');
hasIdx('⑨「記録のみ」にする道は残してある',          '🚫 倉庫には送らない（記録のみ');

/* ── ⑩ 流れの説明は【1枚の図（HTML）】で。スプシに長い文章を作らない ───── */
/* ひろみさん：「こんなにたくさん文字ばっかりで、何も読まないよこんなの。
   　　　　　　もっとさっぱりシンプルに、前にバサラの発注の流れを作ってくれたみたいに
   　　　　　　書いてもらいたい。で、そのリンクを私が目次に貼るので、
   　　　　　　そのリンクが欲しかったの」
   → 図のファイル名は変えないこと（変えるとひろみさんが貼り直しになります）。 */
const path = require('path');
const ZU = path.join(__dirname, '..', 'mocks', 'mock_取り置き予約の流れ_2026-09-10.html');
ok('⑩流れの図がある（ファイル名を変えない）', fs.existsSync(ZU));
const zu = fs.existsSync(ZU) ? fs.readFileSync(ZU, 'utf8') : '';
function hasZu(name, needle){ ok(name, zu.indexOf(needle) >= 0, '（図に ' + needle.slice(0,30) + ' が無い）'); }
hasZu('⑩題名は「取り置き・予約の流れ」', '<title>取り置き・予約の流れ</title>');
hasZu('⑩バサラの図と同じ札（LINEが飛ぶ）', '💬 LINEが飛ぶ');
hasZu('⑩何も飛ばないことも書く',           '👁 何も飛ばない');
hasZu('⑩在庫がどこで動くかを書く',         '📦 在庫が動く');
hasZu('⑩取り置きは在庫を押さえる',         '取り置き＝在庫を押さえます');
hasZu('⑩予約は在庫が減らない',             '予約＝在庫は減りません');
hasZu('⑩新しいリストに入ることを書く',     '取り置き及び発注前予約リスト');
hasZu('⑩まだ倉庫に行かないと書く',         'この時点では倉庫にはまだ連絡が行っていません');
hasZu('⑩🔵ここで合流がある',               'ここで合流');
hasZu('⑩倉庫へ飛ぶのはA列🔵のときだけ',     'A列を🔵にしたときだけ');
hasZu('⑩RTはここに出ないと書く',           'ホテル（RT）はここに出ません');
hasZu('⑩入荷したら取り置きに変わる',       '予約が 🗄 取り置きに変わります');
ok('⑩スプシに長い文章の説明書を作らない',   GAS.indexOf('function oosYoyakuManualBuild') < 0);
has('⑩作ってしまった説明書を片づける窓口',  'function oosYoyakuManualRemove(');

console.log('===== 古い「取り置き・予約シート」はもう使わない（2026-09-10）=====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fails.length) { console.log('--- FAIL の中身 ---'); fails.forEach(function (f) { console.log(f); }); }
process.exit(fail ? 1 : 0);
