/* ══════════════════════════════════════════════════════════════════════
   💴 消費税の端数：RTだけ切り捨て・ほかは四捨五入
   2026-09-17　ひろみさん確定

   ★ひろみさんの言葉
     「多くのところで計算方法が四捨五入になっているので、
     　うちだけ切り捨てちゃうと、よそと合わなくなってしまう可能性があるの。
     　なので、**RTだけは切り捨て、他は今までどおり四捨五入**。このやり方にする」

   ★なぜRTだけ切り捨てか
     RTは、アイポーターの発注伝票に書かれた金額と、うちの納品書の合計が
     1円でもちがうと、そこで話が止まります。伝票が切り捨てなので、合わせます。
     　RTの逆算（rtInvoiceTotal）＝ 商品＋floor(商品×8%) ＋ 料金＋floor(料金×10%)

   ★決めごとの置き場所は【oos-zei.js】1つだけです。
     　・OOS_ZEI.kirisuteKa(区分) … その注文は切り捨てか
     　・OOS_ZEI.zeiGaku(金額, 税率, 切り捨てか) … 税額を出す
     書類の親（oos-doc.js）は、自分で Math.round / Math.floor を書きません。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const ZEI = require(path.join(LIVE, 'oos-zei.js'));
const DOCSRC = fs.readFileSync(path.join(LIVE, 'oos-doc.js'), 'utf8');
const NOUSRC = fs.readFileSync(path.join(LIVE, 'oos-nouhin.js'), 'utf8');
const IDX = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '💴 消費税の端数：RTだけ切り捨て（2026-09-17）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function eq(name, got, want){
  ok(name, got === want, '（出た答え：' + JSON.stringify(got) + '／ほしい答え：' + JSON.stringify(want) + '）');
}

/* ══════════════════════════════════════════════════════════════
   ① どの区分が切り捨てか
   ══════════════════════════════════════════════════════════════ */
ok('①RT は切り捨て', ZEI.kirisuteKa('rt') === true);
ok('①RTGC（ゴルフ）も切り捨て', ZEI.kirisuteKa('rtgc') === true);
ok('①日本語の「RT」も切り捨て', ZEI.kirisuteKa('RT') === true);
ok('①定価（一般）は切り捨てない', ZEI.kirisuteKa('general') === false);
ok('①日本語の「定価」も切り捨てない', ZEI.kirisuteKa('定価') === false);
ok('①卸①は切り捨てない', ZEI.kirisuteKa('wholesale1') === false);
ok('①バサラは切り捨てない', ZEI.kirisuteKa('basara') === false);
ok('①区分が空でも切り捨てない（安全側）', ZEI.kirisuteKa('') === false);
ok('①区分が無くても切り捨てない（安全側）', ZEI.kirisuteKa(undefined) === false);

/* ══════════════════════════════════════════════════════════════
   ② 税額の出し方
   ══════════════════════════════════════════════════════════════ */
eq('②切り捨て 3,906×10%', ZEI.zeiGaku(3906, 0.10, true), 390);
eq('②四捨五入 3,906×10%', ZEI.zeiGaku(3906, 0.10, false), 391);
eq('②切り捨て 71,100×8%', ZEI.zeiGaku(71100, 0.08, true), 5688);
eq('②四捨五入 71,100×8%', ZEI.zeiGaku(71100, 0.08, false), 5688);
eq('②0円は0円', ZEI.zeiGaku(0, 0.08, true), 0);

/* ══════════════════════════════════════════════════════════════
   ③ ★RTの納品書の合計が、アイポーターの逆算と【1円もずれない】
      （本物の書類を組み立ててくらべます）
   ══════════════════════════════════════════════════════════════ */
function karaEl(){ return { style:{}, innerHTML:'', textContent:'',
  appendChild(){}, removeChild(){}, setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; }
function tsukuru(kubun, lines, shipInclTax){
  const R = H.makeSandbox({ document:{ getElementById(){ return null; },
    createElement(){ return karaEl(); }, head: karaEl(), body: karaEl() } });
  const o = { id:'t1', num:'RT-1', customerType: kubun, client:'テスト', recipientName:'テスト',
              isCompany:true, companyName:'テスト', zip:'', addr:'', tel:'',
              enclosedDoc:'納品書', note:'RT伝票取込 ／ 伝票番号 1',
              shippingFee: (shipInclTax == null ? '' : shipInclTax), warehouseFee:'nashi',
              lines: lines.map(function(l){ return { productId:l.pid, sku:l.sku, productName:l.name,
                                                     bottles:l.hon, boxes:0, boxQty:1 }; }) };
  const deps = { products: lines.map(function(l){ return { id:l.pid, sku:l.sku, name:l.name, group:l.group }; }),
                 priceMaster: lines.map(function(l){ return { sku:l.sku, priceRT:l.tanka, priceGeneral:l.tanka }; }),
                 defaults: null };
  R.ctx.__o = o; R.ctx.__d = deps;
  return vm.runInContext("OOS_NOUHIN.build(__o, __d, '納品書')", R.ctx) || '';
}
/* 端数が出る組み合わせ：8%の小計 111,306円／送料（税込4,297＝税抜3,906） */
const LINES = [{ pid:1, sku:'A8', name:'オイルA', group:'オルガニック', hon:3, tanka:7110 },
               { pid:2, sku:'B8', name:'オイルB', group:'オルガニック', hon:4, tanka:2613 },
               { pid:3, sku:'C8', name:'オイルC', group:'オルガニック', hon:6, tanka:6884 }];
const sub8 = 3*7110 + 4*2613 + 6*6884;          /* 8%の小計 */
const shipNet = 3906;                            /* 送料（税抜） */
const shipIncl = Math.round(shipNet * 1.1);      /* 画面が親へ渡す形（税込） */

{
  const noteRT = tsukuru('rt', LINES, shipIncl);
  /* アイポーターの逆算（受注Ａの rtInvoiceTotal と同じ式） */
  const gouRT = sub8 + Math.floor(sub8 * 0.08) + shipNet + Math.floor(shipNet * 0.10);
  ok('③RTの納品書が作れる', noteRT.length > 0);
  ok('③RTの合計が、アイポーターの逆算とぴったり同じ',
     noteRT.indexOf(gouRT.toLocaleString()) >= 0,
     '（ほしい合計：¥' + gouRT.toLocaleString() + '）');
  ok('③RTの8%の消費税が切り捨て',
     noteRT.indexOf(Math.floor(sub8 * 0.08).toLocaleString()) >= 0);
}
{
  const noteIppan = tsukuru('general', LINES, shipIncl);
  ok('④一般の納品書が作れる', noteIppan.length > 0);
  /* 一般は【行ごとに四捨五入】。RTの合計とちがってよい（ちがうことを確かめる） */
  const gouRT = sub8 + Math.floor(sub8 * 0.08) + shipNet + Math.floor(shipNet * 0.10);
  ok('④一般はRTと同じ丸め方にしていない（よそに合わせて四捨五入のまま）',
     noteIppan.indexOf(gouRT.toLocaleString()) < 0,
     '（一般までRTと同じにすると、よその会社と合わなくなります）');
}

/* ══════════════════════════════════════════════════════════════
   ⑤ 決めごとの置き場所は1つだけ（書類の親が自分で丸めていないこと）
   ══════════════════════════════════════════════════════════════ */
{
  const docNoC = DOCSRC.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('⑤書類の親は、自分で Math.round して税を出していない',
     /tax(8|10)\s*\+?=\s*Math\.(round|floor)\(/.test(docNoC) === false,
     '（税の丸め方を書けるのは oos-zei.js だけです）');
  ok('⑤書類の親は、親（OOS_ZEI.zeiGaku）に聞いている',
     docNoC.indexOf('OOS_ZEI.zeiGaku(') >= 0);
  ok('⑤RTは小計が出そろってから切り捨てている（1行ずつ切り捨てない）',
     docNoC.indexOf('OOS_ZEI.zeiGaku(sub8,  0.08, true)') >= 0
     || docNoC.indexOf('OOS_ZEI.zeiGaku(sub8, 0.08, true)') >= 0);
  const nouNoC = NOUSRC.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('⑤どちらで数えるかは、親に聞いて渡している',
     nouNoC.indexOf('ZEI.kirisuteKa(o.customerType)') >= 0);
  ok('⑤書類の親に「RT」の決め打ちが入っていない',
     /['"]rt['"]/i.test(docNoC) === false,
     '（区分の判定は oos-zei.js の仕事です）');
}

/* ══════════════════════════════════════════════════════════════
   ⑥ 受注Ａの逆算の式は、切り捨てのまま（RTの土台）
   ══════════════════════════════════════════════════════════════ */
{
  const fn = H.cut(IDX, 'rtInvoiceTotal');
  ok('⑥アイポーターの逆算は切り捨てのまま',
     fn.indexOf('Math.floor(oilPreTax*0.08)') >= 0 && fn.indexOf('Math.floor(feePreTax*0.10)') >= 0,
     '（ここを四捨五入にすると、納品書と伝票がずれます）');
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
