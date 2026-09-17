/* ══════════════════════════════════════════════════════════════════════
   📄 RTは【納品書と発注伝票の2つ】を、必ず発注書のV列に貼る
   2026-09-17　ひろみさん指示

   ★ひろみさんの言葉
     「RTは常に2種類の書類を、発送するときに同梱しなければいけません。
     　**伝票とそして納品書です。**
     　この2つが間違いなく倉庫に届くように、必ず倉庫のスプレッドシートに
     　リンクを貼るようにしてください。
     　そのリンクは**これまで途切れてしまって何度もやり取りしている**ので、
     　そこはちゃんとできているのか、私が確認する前に確認してください」

   ★本番を読んで分かったこと（2026-09-17）
     発注書に出ているRTの2行（RT-20260911-8924／RT-20260916-7361）は、
     **2つとも1つもリンクが貼られていませんでした。**
     注文には「貼る処理が最後まで進みませんでした」と残っていました。
     　原因：受注登録へ進むときに rtParsed を空にしていたので、
     　　　　［貼る］を押しても rtAttachDocsToOrder が即やめていた。

   ★直したかたち
     ① 伝票が開いていなくても、【注文から】納品書を作って必ず1枚つくる
     ② 発注伝票は、注文に控えたURL（o.extraDocUrl）から貼る
     ③ 貼ったあと**発注書を読み直して、2つとも入っているか自分で確かめる**
        片方でも欠けたら、どちらが欠けたかを注文に残す（黙って終わらない）
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');
const GASJS = (function(){
  const p = path.join(LIVE, '..', 'olive-stories-gas', 'コード.js');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
})();

const title = '📄 RTは納品書と発注伝票の2つを必ず貼る（2026-09-17）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

const FN = H.cut(SRC, 'rtAttachDocsToOrder');
const FNC = FN.replace(/\/\*[\s\S]*?\*\//g, '');   /* 説明文は数えない */

/* ══════════════════════════════════════════════════════════════
   ① 2つの名札が決まっていること（発注書側もこの名札で数えます）
   ══════════════════════════════════════════════════════════════ */
ok('①納品書の名札が決まっている', SRC.indexOf("RT_DOC_NOUHIN  = '📄 納品書（ひらく）'") >= 0);
ok('①発注伝票の名札が決まっている', SRC.indexOf("RT_DOC_DENPYOU = '📄 発注伝票（ひらく）'") >= 0);
ok('①貼るときに、2つとも名札を渡している',
   FNC.indexOf('RT_DOC_NOUHIN') >= 0 && FNC.indexOf('RT_DOC_DENPYOU') >= 0);

/* ══════════════════════════════════════════════════════════════
   ② 伝票が開いていなくても、納品書をあきらめない
   ══════════════════════════════════════════════════════════════ */
ok('②伝票が無いだけで、途中でやめていない',
   FNC.indexOf('if(!rtParsed) return') < 0,
   '（これがあると、あとから貼るときに何もせず終わります＝2026-09-16に起きたこと）');
ok('②伝票から作る道がある', FNC.indexOf('rtBuildNotePdfB64()') >= 0);
ok('②伝票が無いときは、注文から作る道がある',
   FNC.indexOf("nouhinBuildPdfB64(o, '納品書')") >= 0,
   '（伝票を閉じたあとでも、納品書を1枚は必ず作れるようにするため）');
ok('②注文から作る道は、伝票から作る道のあとに来る',
   FNC.indexOf('rtBuildNotePdfB64()') < FNC.indexOf("nouhinBuildPdfB64(o, '納品書')"),
   '（伝票から作るほうが正しいので、そちらを先に試します）');

/* ══════════════════════════════════════════════════════════════
   ③ 発注伝票は、注文に控えたURLから貼る
   ══════════════════════════════════════════════════════════════ */
ok('③注文に控えた伝票のURLを使う', FNC.indexOf('o.extraDocUrl') >= 0);
ok('③控えが無くて伝票を開いているときは、その場で入れ直す',
   FNC.indexOf('rtSlipPdfB64') >= 0);

/* ══════════════════════════════════════════════════════════════
   ④ ふだ（転記キー）が無いときに、黙って帰らない
   ══════════════════════════════════════════════════════════════ */
ok('④ふだができるのを待つ', FNC.indexOf('docFudaMachi(o)') >= 0);
ok('④それでも無ければ、理由を注文に残す',
   FNC.indexOf('まだ発注書に行ができていません') >= 0);
ok('④「if(!o.yukaKey) return;」で黙って帰る形に戻っていない',
   /if\(!o\.yukaKey\)\s*return;/.test(FNC) === false,
   '（黙って帰ると、貼れていないことに誰も気づけません）');

/* ══════════════════════════════════════════════════════════════
   ⑤ ★貼ったあと、自分で確かめる（ひろみさんの一番のご要望）
   ══════════════════════════════════════════════════════════════ */
ok('⑤貼ったあとに発注書を読み直している', FNC.indexOf('docVretsuYomu(true)') >= 0);
ok('⑤読み直しは、貼ったあとに来る',
   FNC.indexOf('yukaSetDocLinks') < FNC.lastIndexOf('docVretsuYomu(true)'));
ok('⑤2つとも入っているかを、名札で確かめている',
   FNC.indexOf('rtDocHareteru(o, RT_DOC_NOUHIN)') >= 0
   && FNC.indexOf('rtDocHareteru(o, RT_DOC_DENPYOU)') >= 0);
ok('⑤2つそろって初めて「2つとも貼れました」と言う',
   FNC.indexOf('2つとも貼れました') >= 0,
   '（片方だけで「貼れました」と言うと、また途切れたことに気づけません）');
ok('⑤欠けたほうの名前を、注文に残す',
   FNC.indexOf("kaketa.push('納品書')") >= 0 && FNC.indexOf("kaketa.push('発注伝票')") >= 0);
ok('⑤欠けたときの言い方が、ひろみさんの決めごとどおり',
   FN.indexOf('RTは【納品書と発注伝票の2つ】が要ります') >= 0);
ok('⑤伝票のPDFが残っていないときは、どうすればよいかを言う',
   FN.indexOf('②RT伝票取込でこの伝票をもう一度読み込んでから') >= 0);
ok('⑤2つそろったときだけ、理由を消す',
   FNC.indexOf("o.nouhinDocNg = ''") >= 0
   && FNC.indexOf("o.nouhinDocNg = ''") > FNC.indexOf('rtDocHareteru(o, RT_DOC_DENPYOU)'));

/* ══════════════════════════════════════════════════════════════
   ⑥ W列にはさわらない（パンフレットの指示が消えるため）
   ══════════════════════════════════════════════════════════════ */
if (GASJS) {
  ok('⑥発注書側は、PDFを【V列だけ】に集めている',
     GASJS.indexOf('PDFは全部V列') >= 0 && GASJS.indexOf('W列には一切さわりません') >= 0);
  ok('⑥V列は2つまで', GASJS.indexOf('var SAIDAI = 2;') >= 0);
  ok('⑥同じものを二度入れない（何回押しても増えない）',
     GASJS.indexOf('同じ名前の書類は二重に入りません') >= 0);
  ok('⑥読むだけの点検窓口がある（oosYukaDocCheck）',
     (GASJS.match(/oosYukaDocCheck/g) || []).length >= 2,
     '（受け口か中身のどちらかがありません）');
} else {
  console.log('        （GASのコード.js が手元に無いので、⑥は飛ばしました）');
}

/* ══════════════════════════════════════════════════════════════
   ⑦ RTの同梱書類は「RT発注伝票＋納品書」で、名札は「納品書」になる
      （ここがずれると、貼れているのに「貼れていません」と出ます）
   ══════════════════════════════════════════════════════════════ */
{
  const NOU = fs.readFileSync(path.join(LIVE, 'oos-nouhin.js'), 'utf8');
  const vm = require('vm');
  const ctx = vm.createContext({ console: console, String: String, Object: Object, Array: Array,
    Math: Math, Number: Number, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, Date: Date });
  ctx.window = ctx; ctx.globalThis = ctx;
  /* ★決めごとの親は5つとも入れます（入れ忘れると、本物とちがう動きで通ってしまいます）。
     　見張り：tests/test_mihari_soten.js の ⑥ */
  ['oos-zei.js', 'oos-kakaku.js', 'oos-shorui-kimari.js', 'oos-doc.js'].forEach(function(f){
    vm.runInContext(fs.readFileSync(path.join(LIVE, f), 'utf8'), ctx);
  });
  vm.runInContext(NOU, ctx);   /* oos-nouhin.js */
  const t = vm.runInContext("OOS_NOUHIN.docTitleOf('RT発注伝票＋納品書')", ctx);
  ok('⑦「RT発注伝票＋納品書」の表題は「納品書」', t === '納品書',
     '（出た答え：' + t + '／ここがずれると、貼れているのに「貼れていません」と出ます）');
  ok('⑦その表題から作る名札が、RTの名札と同じ',
     ('📄 ' + t + '（ひらく）') === '📄 納品書（ひらく）');
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
