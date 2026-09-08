/* ══════════════════════════════════════════════════════════════════════
   画面の「連鎖全滅」の見張り　2026-09-08 作成

   ★なぜ作ったか
     ひろみさん報告「統合マスタの価格リストが見れない！！」を調べた結果です。

     原因はロット番号でした。ギフトセット2件（YS250A・YS100）のロット番号に
     【文字の "1" ではなく、数字の 1】が入っていました。
     master.html の中に

         var code = (l.lotCode||'').trim();

     という書き方があり、数字の 1 には .trim() がないのでここで例外が出ます。

     ところが当時、データを読み終えたあとの描画は

         renderInvTable(); renderLotList(); renderMeibo(); renderPrice(); …

     と1行で左から順に呼んでいました。3つ目の renderMeibo が例外で止まった瞬間、
     そこから右【価格リスト・小口卸取引先・取引先の連絡先・新商品のお知らせ・
     取り置き・予約・倉庫からの報告・ログ】が【まるごと描かれません】でした。
     さらに Promise の catch に落ちるので、画面には

         ⚠️ 接続エラー（オフライン？初回起動時は正常です）

     と出ます。通信の問題に見えるので、本当の原因（ロット番号が数字）に
     たどりつけません。価格の数字自体は47件ちゃんと届いていました。

   ★このテストが見張ること
     ① シートから来た値に、String( ) を通さずに .trim() をしていないこと
     ② 描画は1つずつ別々に呼ぶ（oosDrawAll_）形のままであること
     ③ こけた画面の名前を画面に出す仕掛け（oosDrawFail_）が残っていること

   ★このファイルを消さないでください。消すと、また1か所のデータで全滅します。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

const M = read('master.html');

/* ── ① String( ) を通さない .trim() が無いこと ────────────────────────── */
/* シートの値は「数字」「日付」で返ってくることがあります。
   (x||'').trim() は数字が来た瞬間に落ちます。必ず String(x) にしてください。 */
const HTMLS = ['master.html', 'index.html', 'billing.html', 'mitsumori.html', 'pickup.html', 'konpo.html'];
HTMLS.forEach(f => {
  const src = read(f);
  const bad = [];
  src.split('\n').forEach((line, i) => {
    /* (なにか||'').trim() の形。String( で始まっていれば安全なので除く。
       document.getElementById(...).value は必ず文字なので除く。 */
    const m = line.match(/(?<!String)\(\s*[A-Za-z_$][\w$.\[\]]*\s*\|\|\s*['"]['"]\s*\)\s*\.\s*trim\(\)/);
    if (m && !/\.value\s*\|\|/.test(line)) bad.push((i + 1) + '行目: ' + line.trim().slice(0, 90));
  });
  ok('①' + f + '：String( ) を通さない .trim() が無い', bad.length === 0,
    '\n            ' + bad.join('\n            ') +
    '\n           （シートの値は数字や日付で来ます。String(x==null?\'\':x).trim() にしてください）');
});

/* lotCode のところは特に名指しで見張る（今回落ちた場所） */
ok('①統合マスタ：ロット番号は String( ) でくるんでいる',
  M.indexOf("String(l.lotCode == null ? '' : l.lotCode).trim()") >= 0,
  '（数字の 1 が入ったロットで、価格リストごと真っ白になります）');
ok('①統合マスタ：あぶない書き方に戻っていない',
  M.indexOf("var code = (l.lotCode||'').trim();") < 0,
  '（2026-09-08 に直した所です。元に戻さないでください）');

/* ── ② 描画は1つずつ別々に呼ぶこと ───────────────────────────────── */
ok('②統合マスタ：oosDrawAll_ で1つずつ描いている',
  M.indexOf('function oosDrawAll_(') >= 0,
  '（1行に並べて呼ぶと、1つこけただけで先が全部描かれません）');
ok('②統合マスタ：価格リストも oosDrawAll_ の中に入っている',
  /oosDrawAll_\(\[[\s\S]{0,400}?'価格リスト'\s*,\s*renderPrice\]/.test(M),
  '（価格リストが列から外れています）');
ok('②統合マスタ：1行にまとめた昔の形に戻っていない',
  M.indexOf('renderInvTable(); renderLotList(); renderMeibo(); renderPrice();') < 0,
  '（この形に戻すと、また連鎖で全滅します）');
ok('②統合マスタ：取り置き・予約・報告・ログも1つずつ',
  M.indexOf('renderHoldList(); renderPreList(); renderReportList(); renderInvLogs();') < 0 &&
  /oosDrawAll_\(\[\['取り置き'/.test(M),
  '（この4つも1行呼びに戻っています）');

/* ── ③ こけたことを隠さない ───────────────────────────────────── */
ok('③統合マスタ：こけた画面の名前を出す赤い帯がある',
  M.indexOf('function oosDrawFail_(') >= 0 && M.indexOf('oos-draw-fail') >= 0,
  '（黙って空っぽになると、また「接続エラー」だと思ってしまいます）');
ok('③統合マスタ：こけた画面の名前を oosDrawAll_ から知らせている',
  M.indexOf('oosDrawFail_(ng);') >= 0);

/* ── 結果 ───────────────────────────────────────────────── */
const title = '画面の連鎖全滅の見張り（ロット番号が数字で価格リストが消えた事故／2026-09-08）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
