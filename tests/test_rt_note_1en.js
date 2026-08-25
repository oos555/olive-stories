/* RT納品書：①「まず計算する」の合計と、アプリが作る納品書の合計が1円ずれる不具合の再発防止
   （2026-08-25 ゆかさん報告：サンクチュアリコート日光の発送分。①203,685円／納品書203,686円）

   原因：①はアイポーターの都合で「ぴったり合わない時は送料を1〜5円引いて合わせる」処理
   （rtReverse の reduced）をしているのに、②へ明細を取り込むときは調整前の生の送料をそのまま
   使っていた。★rtPullFromCalc は rtCalcAdjustedShipFee()（①と同じ rtReverse を通す）を
   使うことで、①と納品書の合計を必ず一致させる。

   本番の index.html から本物の関数をそのまま切り出して動かす。保存先には一切書き込まない。 */
const vm = require('vm');
const H = require('./harness');

const src = H.read('index.html');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

/* ── ①ソース上の確認：②が①と同じ調整後の送料を使っているか ── */
ok('①rtCalcAdjustedShipFeeがある', src.indexOf('function rtCalcAdjustedShipFee') >= 0);
ok('①rtPullFromCalcが調整後の送料を使っている',
   H.cut(src, 'rtPullFromCalc').indexOf('rtParsed.shipFee = rtCalcAdjustedShipFee();') >= 0);
ok('①生の送料（rtCalcShipFee）に戻っていない',
   H.cut(src, 'rtPullFromCalc').indexOf('rtCalcShipFee()') < 0);

/* ── ②実際に動かして確認（本物の rtReverse 等を使う） ── */
function makeRow(pid, qty, price){
  return {
    querySelector(sel){
      if(sel === '.rtc-prod') return { value: String(pid) };
      if(sel === '.rtc-qty')  return { value: String(qty) };
      if(sel === '.rtc-price') return { value: String(price) };
      return null;
    }
  };
}
function buildDoc(rows, shipVal, pickupVal){
  return {
    querySelectorAll(sel){
      if(sel === '#rtc-rows > [id^="rtc-row-"]') return rows;
      return [];
    },
    getElementById(id){
      if(id === 'rtc-shipping') return { value: String(shipVal) };
      if(id === 'rtc-pickup')   return { value: String(pickupVal) };
      return null;
    }
  };
}

/* 8%課税の商品1つ（オルガニック250ml想定）。税率判定は本物の OOS_ZEI を使う */
const PRODUCTS = [
  { id: 1, sku: 'ORG250', name: 'オルガニック250ml', group: 'オルガニック' },
  { id: 99, sku: 'BOX-CUP', name: 'ギフト箱', group: 'ギフト箱・備品' }
];

function loadCore(doc){
  const { box, ctx } = H.makeSandbox({ PRODUCTS: PRODUCTS, document: doc, rtParsed: null });
  vm.runInContext(H.cut(src, 'rtInvoiceTotal'), ctx);
  vm.runInContext(H.cut(src, 'rtFindTarget'), ctx);
  vm.runInContext(H.cut(src, 'rtDistribute'), ctx);
  vm.runInContext(H.cut(src, 'rtReverse'), ctx);
  vm.runInContext(H.cut(src, 'rtCalcAdjustedShipFee'), ctx);
  vm.runInContext(H.cut(src, 'rtCalcLines'), ctx);
  vm.runInContext(H.cut(src, 'rtCalcShipFee'), ctx);
  vm.runInContext(H.cut(src, 'rtPullFromCalc'), ctx);
  return box;
}

/* ── ケースA：送料がぴったり合わず、①が送料を引いて合わせる場合（reduced > 0 を作る） ── */
{
  // 数量・単価を選び、意図的に「ぴったり合わない」組み合わせを探す（reduced 1〜5円のどれかで必ず合う設計）
  let found = null;
  for(let ship = 1200; ship < 1230 && !found; ship++){
    const rows = [makeRow(1, 3, 4750)];
    const doc = buildDoc(rows, ship, 0);
    const box = loadCore(doc);
    const r = box.rtReverse([{ name:'オルガニック250ml', bottles:3, unit:4750 }], ship);
    if(!r.error && r.reduced > 0) found = { ship, r };
  }
  ok('Aテスト用に「送料を引いて合わせる」場面が作れた', !!found);
  if(found){
    const rows = [makeRow(1, 3, 4750)];
    const doc = buildDoc(rows, found.ship, 0);
    const box = loadCore(doc);
    box.rtParsed = null;
    const adjusted = box.rtCalcAdjustedShipFee();
    eq('A① 調整後の送料は「生の送料 − reduced」', adjusted, found.ship - found.r.reduced);
    ok('A① 生の送料そのままではない（reducedが効いている）', adjusted !== found.ship);

    // rtPullFromCalc が実際にこの調整後の送料を rtParsed.shipFee に入れるか
    box.rtPullFromCalc(true);
    eq('A② rtPullFromCalcのshipFeeが調整後の値と一致', box.rtParsed.shipFee, adjusted);

    // ①の表示合計と、②（納品書側）が同じ考え方で出す合計が一致することを確認
    // （①の合計＝rtInvoiceTotal(oilPreTax, feeUsed)。②側は shipFee=feeUsed-amt10 を使うので
    //   納品書のrateSub[10]は ship分のみ＝feeUsed と等しくなり、①と同じ式で合計が出せる）
    const ichiTotal = box.rtInvoiceTotal(3*4750, found.ship - found.r.reduced);
    const noteFeePreTax = box.rtParsed.shipFee; // amt10=0のケースなのでこのままfeePreTax相当
    const noteTotal = box.rtInvoiceTotal(3*4750, noteFeePreTax);
    eq('A③ ①の合計と、修正後の送料で作る納品書の合計が一致する', noteTotal, ichiTotal);
  }
}

/* ── ケースB：ぴったり合う通常のケース（reduced=0）では、今までどおり生の送料と同じ ── */
{
  const rows = [makeRow(1, 2, 4750)];
  // reduced=0で通る送料を探す
  let ship0 = null;
  for(let s = 900; s < 1000 && ship0===null; s++){
    const box = loadCore(buildDoc(rows, s, 0));
    const r = box.rtReverse([{ name:'x', bottles:2, unit:4750 }], s);
    if(!r.error && r.reduced === 0) ship0 = s;
  }
  ok('Bテスト用に「ぴったり合う」場面が作れた', ship0 !== null);
  if(ship0 !== null){
    const box = loadCore(buildDoc(rows, ship0, 0));
    const adjusted = box.rtCalcAdjustedShipFee();
    eq('B reduced=0のときは生の送料と同じ', adjusted, ship0);
  }
}

/* ── ケースC：10%の商品（ギフト箱など）が混ざっていても、送料側だけが正しく調整される ── */
{
  const rows = [makeRow(1, 1, 4750), makeRow(99, 1, 700)]; // ギフト箱700円（10%）
  const box = loadCore(buildDoc(rows, 500, 0));
  const adjusted = box.rtCalcAdjustedShipFee();
  // amt10=700。fee10 = 500+0+700=1200。rtReverseの結果からamt10を引いた値になっているはず
  const r = box.rtReverse([{ name:'x', bottles:1, unit:4750 }], 1200);
  eq('C 10%商品があってもshipFeeはamt10を含まない（送料ぶんだけ）', adjusted, r.feeUsed - 700);
}

/* ── ケースD：8%商品が1つも無い（送料・10%品だけ）ときも壊れない ── */
{
  const rows = [makeRow(99, 1, 700)];
  const box = loadCore(buildDoc(rows, 300, 0));
  const adjusted = box.rtCalcAdjustedShipFee();
  eq('D 8%商品が無いときは生の送料のまま（reduced計算の対象外）', adjusted, 300);
}

console.log('===== RT納品書：①と納品書の合計1円ずれの見張り =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
