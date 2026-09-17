/* ══════════════════════════════════════════════════════════════════════
   🔍 単価の照合ボタン（RT伝票取り込み）
   2026-09-16　ひろみさん指示

   ★ひろみさんの言葉
     「商品名を人が選んだあとに、単価のところにすでに数字が入っているけれども、
     　その横に【単価を念のため正しいものと照合する】ボタンを作って。
     　押して、RTの単価ともしこの金額が違っていた場合に
     　**【金額が違います、修正してください】**と出るようにしてほしい」

   ★なぜ要るか
     納品書に出る単価は【価格マスタ】から引きます（2026-09-16確定）。
     伝票の単価が違っていても、そのままでは誰も気づけません。
     このボタンが、気づける唯一の場所です。

   ★くらべる相手は、書類とまったく同じ計算（OOS_KAKAKU.unitPriceForLine）。
     ここがズレると「照合はOKなのに納品書はちがう金額」になります。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '🔍 単価の照合ボタン（RT伝票取り込み／2026-09-16）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ── 小さな画面を作って、本物の関数を動かす ── */
function tameshi(opt){
  const msgs = {};
  const doc = {
    getElementById: function(id){
      if (!(id in msgs)) msgs[id] = { id: id, innerHTML: '' };
      return msgs[id];
    }
  };
  const ctx = vm.createContext({
    document: doc, console: console, Math: Math, String: String, Number: Number,
    Array: Array, Object: Object, parseInt: parseInt,
    PRODUCTS: opt.products,
    priceMaster: opt.priceMaster,
    rtParsed: { lines: [opt.line] }
  });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(LIVE, 'oos-kakaku.js'), 'utf8'), ctx);
  vm.runInContext(H.cut(INDEX, 'rtTankaMaster') + '\n' + H.cut(INDEX, 'rtTankaCheck')
                + '\n' + H.cut(INDEX, 'rtTankaClear'), ctx);
  vm.runInContext('rtTankaCheck(0)', ctx);
  return msgs['rt-tanka-msg-0'].innerHTML;
}

const PRODUCTS = [{ id: 1, sku: 'ORG100', name: 'オルガニック 100ml' },
                  { id: 2, sku: 'NOPRICE', name: '単価のない商品' }];
const PM = [{ sku: 'ORG100', priceRT: 7000 }];

/* ① 同じとき */
{
  const h = tameshi({ products: PRODUCTS, priceMaster: PM, line: { productId: 1, unitPrice: 7000 } });
  ok('①同じときは「価格マスタと同じです」と出る', h.indexOf('価格マスタと同じです') >= 0, '（出た答え：' + h.slice(0, 80) + '）');
  ok('①同じときは金額も出る', h.indexOf('7,000') >= 0);
  ok('①同じときに「違います」とは出ない', h.indexOf('違います') < 0);
  /* ★2026-09-17 ひろみさん「この表示が大きすぎて、ボタンと同じに見えて、
     　何かしなきゃいけないのかなと思ってしまう」→ 枠（背景・線）は付けません。 */
  ok('①★ボタンに見える枠（背景・線）が付いていない',
     h.indexOf('background:') < 0 && h.indexOf('border:') < 0,
     '（出た答え：' + h.slice(0, 120) + '）');
  ok('①★ふだんは赤い文字にしない', h.indexOf('#b91c1c') < 0);
}

/* ② 違うとき ── ひろみさんの言葉どおりの文言 */
{
  const h = tameshi({ products: PRODUCTS, priceMaster: PM, line: { productId: 1, unitPrice: 7110 } });
  ok('②「金額が違います、修正してください」と出る',
     h.indexOf('金額が違います、修正してください') >= 0, '（出た答え：' + h.slice(0, 120) + '）');
  ok('②伝票の単価が出る', h.indexOf('7,110') >= 0);
  ok('②価格マスタの単価が出る', h.indexOf('7,000') >= 0);
  ok('②納品書には価格マスタの金額が出る、と書いてある', h.indexOf('納品書には') >= 0);
  /* ★2026-09-17 ひろみさん「もし金額が違っている場合は赤文字で出して」 */
  ok('②★金額が違うときは赤い文字', h.indexOf('#b91c1c') >= 0,
     '（出た答え：' + h.slice(0, 120) + '）');
  ok('②★ここでも枠（背景・線）は付けない',
     h.indexOf('background:') < 0 && h.indexOf('border:') < 0);
}

/* ③ 価格マスタに無いとき */
{
  const h = tameshi({ products: PRODUCTS, priceMaster: PM, line: { productId: 2, unitPrice: 500 } });
  ok('③価格マスタに無ければ、その旨を出す', h.indexOf('価格マスタにRTの単価が入っていません') >= 0,
     '（出た答え：' + h.slice(0, 100) + '）');
  ok('③勝手に「同じです」とは言わない', h.indexOf('同じです') < 0);
}

/* ④ 商品をえらんでいないとき */
{
  const h = tameshi({ products: PRODUCTS, priceMaster: PM, line: { productId: '', unitPrice: 100 } });
  ok('④商品が未選択なら、先に選んでと出す', h.indexOf('先に商品をえらんでください') >= 0);
}

/* ⑤ 画面の作り（ボタンと置き場所） */
{
  const row = H.cut(INDEX, 'rtLineRowHtml');
  ok('⑤単価のとなりに照合ボタンがある', row.indexOf('rtTankaCheck(') >= 0);
  ok('⑤お知らせの置き場所がある', row.indexOf('rt-tanka-msg-') >= 0);
  ok('⑤★お知らせは右端（照合の下）に小さく出す',
     row.indexOf('text-align:right') >= 0 && row.indexOf('font-size:11.5px') >= 0,
     '（ボタンのように大きく出すと、押すものだと思われます）');
  ok('⑤単価を打ち直すと、前のお知らせは消える', row.indexOf('rtTankaClear(') >= 0);
}

/* ⑥ くらべる相手が、書類と同じ計算であること（★ここがズレると意味がない） */
{
  const fn = H.cut(INDEX, 'rtTankaMaster');
  ok('⑥書類と同じ計算（unitPriceForLine）でくらべている',
     fn.indexOf('OOS_KAKAKU.unitPriceForLine') >= 0,
     '（priceForSku を直に呼ぶ形だと、書類とズレる恐れがあります）');
  ok('⑥RTの区分でくらべている', fn.indexOf("customerType: 'rt'") >= 0);
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
