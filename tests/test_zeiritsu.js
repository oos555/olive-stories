/* 消費税の税率の見張り（2026-08-24 新設）

   きっかけ：ゆかさんの報告
     「芦屋ベイコートの紙袋をアプリで倉庫に依頼したいのですが、
       紙袋が税8%になっているので税10%に変えていただけるでしょうか」

   ★決めごと（2026-08-24 ひろみさん確定・変更禁止）
     ・8%（軽減税率）は【食品だけ】。オリーブオイル・カップオイル・ざくろソース など
     ・それ以外はぜんぶ10%。紙袋・ギフト箱・オーガンジー・空瓶・注ぎ口・本・送料・倉庫手数料
     ・セット商品は中身に食品が入っていれば8%（your story・oliveNOVA は8%）
     ・「わからない商品は10%」。8%を既定にしない（8%を既定にしていたのが今回の穴）
     ・税率を決める場所は oos-zei.js ただ1つ。アプリに同じ判定を書き写さない
     ・消費税の端数は【切り捨て】（RTのアイポーター逆算と1円もずらさないため）

   ここでは、本物のファイルからそのまま関数を抜き出して、
   ①親（oos-zei.js）②4つのアプリ ③GAS が、全部同じ答えを出すかを総当たりで確かめます。 */
const fs = require('fs');
const vm = require('vm');
const R = require('path').join(__dirname, '..') + '/';
const H = require('./harness');

let ok = 0, ng = 0; const bad = [];
function t(name, got, want){ if(String(got) === String(want)) ok++; else { ng++; bad.push(name + '　期待:' + want + '　実際:' + got); } }

/* ── 親（oos-zei.js）を読む ── */
const Z = require(R + 'oos-zei.js');
t('◎ 消費税の親ファイルが読める', typeof Z.rateForSku === 'function', true);

/* ── 名簿（本番の商品マスタと同じ並び。受注A のハードコード版から本物を取る）── */
const idxSrc = fs.readFileSync(R + 'index.html', 'utf8');
const pBox = H.makeSandbox({}).box;
vm.runInContext(H.cutVar(idxSrc, 'PRODUCTS'), vm.createContext(pBox));
const PRODUCTS = pBox.PRODUCTS.concat([
  /* 名簿にあって受注Aのハードコードには無いもの（本番のGASから確認済み・2026-08-24）*/
  { id:990, sku:'BAG003', name:'紙袋 黒 500ｍｌ用', group:'ギフト箱・備品' },
  { id:991, sku:'BAG004', name:'オーガンジー白（カップオイル1，2個用）', group:'ギフト箱・備品' },
  { id:992, sku:'MISC001', name:'初版ピッツァ本 サイン入り', group:'その他' },
  { id:993, sku:'MISC002', name:'トルコ500ml用 空瓶（要後付け注ぎ口1個）', group:'その他' },
  { id:994, sku:'MISC003', name:'空瓶用後付け注ぐ口', group:'その他' },
  { id:995, sku:'ETC-001', name:'ザクロソース', group:'その他' },
  { id:996, sku:'OIL-001', name:'モンテ物産 イタリア産スタルツェブレンド5ℓ', group:'その他オイル' },
  { id:997, sku:'BOX-SEAL', name:'ギフトボックス（シールのみ・お包みなし）', group:'ギフト箱・備品' },
  { id:998, sku:'BOX-WRAP', name:'包装紙で巻いたギフトボックス', group:'ギフト箱・備品' }
]);

/* ── ① 1つずつ、正しい税率が出るか（本番の全商品）── */
console.log('\n■ ① 商品ごとの税率（8%は食品だけ）');
const WANT = {
  /* 食品＝8% */
  ORG100:8, ORG250:8, ORG500:8, ORG750:8, ORG2L:8, ORG5L:8,
  MEM100:8, MEM250:8, MEM500:8, MEM750:8, MEM2L:8, MEM5L:8,
  CHF100:8, CHF250:8, CHF2L:8,
  PRI100:8, PRI250:8, PRI500:8, PRI3L:8,
  ZAI250:8, ZAI500:8,
  AGR100:8, AGR250:8, AGR3L:8,
  TGR100:8, ARM500:8, ARM3L:8, CAS5L:8, 'OIL-001':8,
  CUP001:8, CUP002:8, CUP003:8,
  'ETC-001':8,                                   /* ★ざくろソース（前は10%になっていた）*/
  /* セット（中身がオイル）＝8% */
  YS100:8, YS250A:8, YS250B:8, YS250C:8, GFT001:8,
  /* 食品でないもの＝10% */
  'BOX-YS3':10, 'BOX-YS2':10, 'BOX-CUP':10, 'BOX-SEAL':10, 'BOX-WRAP':10,
  BAG001:10, BAG002:10, BAG003:10, BAG004:10,    /* ★紙袋（ゆかさん報告のもの）*/
  MISC001:10, MISC002:10, MISC003:10
};
Object.keys(WANT).forEach(function(sku){
  const p = PRODUCTS.find(x => x.sku === sku) || {};
  t('① ' + sku + '（' + (p.name||'?') + '）', Z.percentForSku(sku, PRODUCTS), WANT[sku]);
});

/* ── ② 紙袋とざくろソースを名指しで（今回の報告そのもの）── */
console.log('\n■ ② ゆかさんの報告そのもの');
t('② 紙袋 黒 大 は 10%', Z.rateForSku('BAG002', PRODUCTS), 0.1);
t('② 紙袋 黒 小 は 10%', Z.rateForSku('BAG001', PRODUCTS), 0.1);
t('② 紙袋 500ml用 は 10%', Z.rateForSku('BAG003', PRODUCTS), 0.1);
t('② ざくろソースは 8%', Z.rateForSku('ETC-001', PRODUCTS), 0.08);
t('② オリーブオイルは 8%', Z.rateForSku('ORG500', PRODUCTS), 0.08);

/* ── ③ わからないものは10%（8%を既定にしない）── */
console.log('\n■ ③ わからないものは10%（ここが今回の穴でした）');
t('③ 名簿にない品番は10%', Z.rateForSku('NEW-999', PRODUCTS), 0.1);
t('③ グループ空っぽの商品は10%', Z.rateForProduct({ sku:'X', group:'' }), 0.1);
t('③ 知らないグループは10%', Z.rateForProduct({ sku:'X', group:'新しい雑貨' }), 0.1);
t('③ 送料・手数料はいつでも10%', Z.RATE_SERVICE, 0.1);
t('③ 新しい備品を足しても8%にならない', Z.rateForProduct({ sku:'BAG005', name:'紙袋 白', group:'ギフト箱・備品' }), 0.1);

/* ── ④ 書き方がゆれても取り違えない（0.1 / 10 / "10%"）── */
console.log('\n■ ④ 「10」と書いてあるのに8%で計算される事故を防ぐ');
[[0.1,0.1],[0.10,0.1],[10,0.1],['10',0.1],['10%',0.1],[0.08,0.08],[8,0.08],['8',0.08],['8%',0.08]]
  .forEach(function(pair){ t('④ ' + JSON.stringify(pair[0]) + ' → ' + pair[1], Z.normalizeRate(pair[0]), pair[1]); });
t('④ 空っぽは判定しない', Z.normalizeRate(''), null);
t('④ 8%かどうかの判定（10）', Z.isReduced(10), false);
t('④ 8%かどうかの判定（0.1）', Z.isReduced(0.1), false);
t('④ 8%かどうかの判定（8）', Z.isReduced(8), true);

/* ── ⑤ 4つのアプリが、自分で判定せず親と同じ答えを出すか ── */
console.log('\n■ ⑤ 売上Ｃ・見積請求書Ｍ・倉庫Ｄ が親と同じ答えを出すか');
[['billing.html','売上Ｃ'],['mitsumori.html','見積・請求書Ｍ'],['pickup.html','倉庫Ｄ']].forEach(function(app){
  const src = fs.readFileSync(R + app[0], 'utf8');
  const S = H.makeSandbox({ PRODUCTS: PRODUCTS, priceMaster: [], PRICE_MASTER: [] });
  vm.runInContext(H.cut(src, 'defaultTaxRateForGroup'), S.ctx);
  vm.runInContext(H.cut(src, 'taxRateForSku'), S.ctx);
  vm.runInContext(H.cut(src, 'findProductBySku'), S.ctx);
  let diff = 0;
  PRODUCTS.forEach(function(p){
    if(S.box.taxRateForSku(p.sku) !== Z.rateForSku(p.sku, PRODUCTS)) diff++;
  });
  t('⑤ ' + app[1] + ' が親と同じ（' + PRODUCTS.length + '商品）', diff, 0);
  /* 価格マスタに古い8%が残っていても、親の答えが勝つ（黙って間違えない） */
  S.box.priceMaster = [{ sku:'BAG002', taxRate:0.08 }];
  S.box.PRICE_MASTER = [{ sku:'BAG002', taxRate:0.08 }];
  t('⑤ ' + app[1] + ' 価格マスタに8%が入っていても紙袋は10%', S.box.taxRateForSku('BAG002'), 0.1);
});

/* ── ⑥ 受注Ａ のRT納品書（今回の報告の現場）── */
console.log('\n■ ⑥ 受注Ａ のRT納品書');
const A = H.makeSandbox({ PRODUCTS: PRODUCTS });
vm.runInContext(H.cut(idxSrc, '_rtLineRate'), A.ctx);
const bag = PRODUCTS.find(p => p.sku === 'BAG002');
const oil = PRODUCTS.find(p => p.sku === 'ORG500');
t('⑥ 紙袋の行は10%と出る', A.box._rtLineRate({ productId: bag.id }), 10);
t('⑥ オイルの行は8%と出る', A.box._rtLineRate({ productId: oil.id }), 8);
t('⑥ 商品がまだ選ばれていない行は10%', A.box._rtLineRate({ productId:'' }), 10);
t('⑥ しまってある古い8%より、いまの商品が勝つ',
  A.box._rtLineRate({ productId: bag.id, taxRate: 8 }), 10);

/* 納品書を実際に組み立てて、内訳に10%が出るか */
const D = H.makeSandbox({ document:{ getElementById(){ return null; } } });
vm.runInContext(H.cutVar(idxSrc, 'PRODUCTS'), D.ctx);
vm.runInContext('var PRODUCTS_EXTRA=' + JSON.stringify(PRODUCTS.slice(-9)) + '; PRODUCTS = PRODUCTS.concat(PRODUCTS_EXTRA);', D.ctx);
vm.runInContext('function esc(s){ return String(s==null?"":s); } var RT_SEAL_IMG="";', D.ctx);
vm.runInContext(H.cut(idxSrc, '_rtLineRate'), D.ctx);
vm.runInContext(H.cut(idxSrc, 'rtDeliveryNoteHtml'), D.ctx);
D.box.rtParsed = {
  recipientName:'芦屋ベイコート倶楽部', nouhinNo:'123456', deliveryDate:'2026-08-25',
  lines: [
    { productId: oil.id, bottles: 6, unitPrice: 6884 },
    { productId: bag.id, bottles: 6, unitPrice: 100 }
  ]
};
const note = D.box.rtDeliveryNoteHtml();
const sub8 = 6*6884, sub10 = 6*100;
t('⑥ 納品書に8%対象の小計が出る', note.indexOf(sub8.toLocaleString()) >= 0, true);
t('⑥ 納品書に10%対象の小計が出る', note.indexOf('10%対象') >= 0, true);
t('⑥ 納品書の10%の消費税が正しい', note.indexOf(Math.floor(sub10*0.10).toLocaleString() + '円') >= 0, true);
t('⑥ 合計＝8%分＋10%分（切り捨て）',
  note.indexOf((sub8 + Math.floor(sub8*0.08) + sub10 + Math.floor(sub10*0.10)).toLocaleString()) >= 0, true);
t('⑥ 紙袋には軽減税率の ※ を付けない', /紙袋 黒 大 ※/.test(note), false);

/* ── ⑦ GAS（サーバー側の1つだけ残るコピー）が親と同じか ── */
console.log('\n■ ⑦ GAS と親（oos-zei.js）が同じ答えを出すか');
const GAS_PATH = require('path').join(R, '..', 'olive-stories-gas', 'コード.js');
if(fs.existsSync(GAS_PATH)){
  const gasSrc = fs.readFileSync(GAS_PATH, 'utf8');
  const G = H.makeSandbox({});
  ['OOS_ZEI_FOOD_GROUPS','OOS_ZEI_FOOD_SKUS','OOS_ZEI_SET_GROUP'].forEach(function(v){
    vm.runInContext(H.cutVar(gasSrc, v), G.ctx);
  });
  vm.runInContext(H.cut(gasSrc, 'oosZeiIsFood_'), G.ctx);
  vm.runInContext(H.cut(gasSrc, 'oosZeiRateForSku_'), G.ctx);
  let gdiff = [];
  PRODUCTS.forEach(function(p){
    const g = G.box.oosZeiRateForSku_(p.sku, PRODUCTS);
    const z = Z.rateForSku(p.sku, PRODUCTS);
    if(g !== z) gdiff.push(p.sku + '（GAS:' + g + ' 親:' + z + '）');
  });
  t('⑦ GASと親が全商品で同じ（' + PRODUCTS.length + '商品）', gdiff.join('／'), '');
  t('⑦ GASも 名簿にない品番は10%', G.box.oosZeiRateForSku_('NEW-999', PRODUCTS), 0.1);
} else {
  console.log('　（GASのフォルダが見つからないので、この項目はとばしました）');
}

/* ── ⑧ 古い書き方が戻っていないか（先祖返りの見張り）── */
console.log('\n■ ⑧ 古い書き方が戻っていないか');
const FILES = ['billing.html','mitsumori.html','pickup.html','index.html','oos-doc.js'];
FILES.forEach(function(f){
  const src = fs.readFileSync(R + f, 'utf8');
  t('⑧ ' + f + ' に古い「備品だけ10%」の判定が無い',
    src.indexOf("(group==='ギフト箱・備品' || group==='その他') ? 0.10 : 0.08") >= 0, false);
  t('⑧ ' + f + ' に taxRate===0.10 の書き方が残っていない',
    /taxRate\s*===\s*0\.10/.test(src), false);
  t('⑧ ' + f + ' が消費税の親を読んでいる', src.indexOf('OOS_ZEI') >= 0, true);
});
t('⑧ 受注Ａに taxRate: 8 の決め打ちが残っていない', /taxRate:\s*8\b/.test(idxSrc), false);
t('⑧ 受注ＡのRT納品書の端数は切り捨て',
  idxSrc.indexOf('var base = rateSub[r], t = Math.floor(base*Number(r)/100);') >= 0, true);
FILES.concat(['tests/harness.js']).forEach(function(f){
  const src = fs.readFileSync(R + f, 'utf8');
  /* 「★税率の既定ではありません」と書いてある行（過去の記録の写しなど）は数えない */
  const cleaned = src.replace(/[^\n]*oos-zei[^\n]*/g, '').replace(/[^\n]*★税率の既定ではありません[^\n]*/g, '');
  t('⑧ ' + f + ' に 0.08 を既定にする書き方が残っていない',
    /:\s*0\.08\s*[;,)]/.test(cleaned), false);
});
/* 親ファイルとその見張りが、アプリから読み込まれているか */
['billing.html','mitsumori.html','pickup.html','index.html'].forEach(function(f){
  const src = fs.readFileSync(R + f, 'utf8');
  t('⑧ ' + f + ' が oos-zei.js を読み込んでいる', src.indexOf('src="oos-zei.js') >= 0, true);
  t('⑧ ' + f + ' に「読めなかったとき」の赤い見張りがある',
    src.indexOf('消費税の計算ファイル（oos-zei.js）が読み込めていません') >= 0, true);
});

/* ── まとめ ── */
console.log('\n===== 消費税の税率 =====');
console.log('PASS ' + ok + ' / FAIL ' + ng);
if(ng){ console.log('--- FAIL の中身 ---'); bad.forEach(b => console.log('  ' + b)); process.exit(1); }
