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

console.log('===== 古い「取り置き・予約シート」はもう使わない（2026-09-10）=====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fails.length) { console.log('--- FAIL の中身 ---'); fails.forEach(function (f) { console.log(f); }); }
process.exit(fail ? 1 : 0);
