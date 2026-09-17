/* ══════════════════════════════════════════════════════════════════════
   📄 RTの納品書は【親＝oos-nouhin.js】1枚だけ
   2026-09-17　ひろみさん指示

   ★ひろみさんの言葉
     「古い写し（rtDeliveryNoteHtml）を捨てて、全部親の oos-nouhin.js に
     　一本化します。そうしてください」

   ★2026-09-17に実物で見つけたこと
     RTの納品書を作る場所が【2つ】ありました。
     　・🖨️ で取り出すPDF … 親　　　会社の住所＝南青山2-2-15 ✅
     　・発注書に貼るPDFと画面のプレビュー … 古い写し　会社の住所＝立川市柴崎町 ❌
     同じ注文なのに、倉庫の発注書に貼られる納品書だけ、会社の住所がちがっていました。
     （ひろみさんがダウンロードした本物のPDFを開いて、中の画像を取り出して確認）

   ★2026-09-10の決めごと「納品書は親に集約・HTMLに写しを作らない」に戻しただけです。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '📄 RTの納品書は親1枚だけ（2026-09-17）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ① 古い写しを、どこからも呼んでいないこと */
{
  /* 定義そのもの（function …(){）と説明文は数えません。数えるのは【呼んでいる場所】だけ。
     ★古い写しの中身はまだファイルに残っていますが、もうどこからも呼ばれていないので
     　画面にも書類にも出ません。消すのはひろみさんの許可が出てからにします。 */
  const honbun = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/function\s+rtDeliveryNote\w+/g, '');
  const yobu = function(n){ return (honbun.split(n + '()').length - 1); };
  const nokori = yobu('rtDeliveryNoteHtml');
  ok('①古い写し（rtDeliveryNoteHtml）を、どこからも呼んでいない', nokori === 0,
     '（まだ ' + nokori + ' か所から呼ばれています。住所が立川のままの納品書が出ます）');
  const css = yobu('rtDeliveryNoteCss');
  ok('①古い写しの見た目（rtDeliveryNoteCss）も、どこからも呼んでいない', css === 0);
}

/* ② 3つの出口が、ぜんぶ親を通ること */
{
  const preview = H.cut(SRC, 'rtNouhinHtml').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('②画面のプレビューは、親で作る', preview.indexOf('OOS_NOUHIN.build(') >= 0);
  const pdf = H.cut(SRC, 'rtBuildNotePdfB64').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('②発注書に貼るPDFも、同じ1枚から作る', pdf.indexOf('rtNouhinHtml()') >= 0);
  const toridashi = H.cut(SRC, 'rtMakeDeliveryNote').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('②🖨️で取り出すPDFも、親で作る', toridashi.indexOf("OOS_NOUHIN.build(o, nouhinDeps(), '納品書')") >= 0);
}

/* ③ 会社の住所が、1か所だけであること（立川がどこにも無いこと） */
{
  /* ★古い写しの中にはまだ「立川」の住所が残っていますが、
     　もうどこからも呼ばれていないので、画面にも書類にも出ません（①で見張っています）。
     　消すのはひろみさんの許可が出てからにします（死んでいるコードの削除は許可待ち）。
     ★生きているところ（出口の3つ）に立川が入っていないことだけを見ます。 */
  const ikiteru = [H.cut(SRC,'rtNouhinHtml'), H.cut(SRC,'rtBuildNotePdfB64'), H.cut(SRC,'rtMakeDeliveryNote')].join('');
  ok('③いま使う納品書の作り方に「立川市柴崎町」が入っていない',
     ikiteru.indexOf('立川市柴崎町') < 0);
  ok('③うちの住所は南青山で決めてある', SRC.indexOf("addr:'東京都港区南青山2-2-15'") >= 0);
}

/* ④ 親が、納品日・登録番号を必ず出すこと */
{
  const DOC = fs.readFileSync(path.join(LIVE, 'oos-doc.js'), 'utf8');
  ok('④登録番号は、親（oos-doc.js）が必ず出す', DOC.indexOf('登録番号：') >= 0);
  const NOU = fs.readFileSync(path.join(LIVE, 'oos-nouhin.js'), 'utf8');
  ok('④納品日は、親（oos-nouhin.js）が出す', NOU.indexOf("'納品日：'") >= 0);
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
