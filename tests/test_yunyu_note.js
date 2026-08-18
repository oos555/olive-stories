/* 輸入準備計算 →（確定）→ 輸入ノート に流す決めごとを、本物の関数で確かめる。
   2026-08-18 ひろみさん確定。
   ・「商品明細のところを一個一個手入力するのを省きたい」
   ・「オイルのグラムと瓶の重さはいつも一緒なので、もうこれは入力するも何もっていう感じです」
   ・「二回送ろうとした時はそのカードを開くだけにして、もう一回作ることはしないでください」
   ・「750mlは常に缶です」
   本番のデータには一切書き込まない（作り物だけ）。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname, '..', 'import.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, got, want){ if(String(got) === String(want)) pass++; else { fail++; fails.push(`${l}  期待:${want}  実際:${got}`); } }
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

/* ── 本物の関数を切り出す ───────────────────────────── */
const NAMES = ['ynMlOfSku','ynWeightFor','ynApplyWeightRule','ynWeightLocked','ynCalc','prepSendFindNote','prepSendDefaultYm'];
let code = '';
NAMES.forEach(function(n){
  try{ code += H.cut(src, n) + '\n'; }
  catch(e){ fail++; fails.push('★ 関数が消えています: ' + n); }
});

const { box, ctx } = H.makeSandbox({ ynNotes: [] });
['YN_W_PREFIX','YN_W_ML','YN_W_SKU'].forEach(function(v){
  try{ vm.runInContext(H.cutVar(src, v), ctx); }
  catch(e){ fail++; fails.push('★ 重さのルールが消えています: ' + v); }
});
try{ vm.runInContext(code, ctx); }catch(e){ fail++; fails.push('★ 関数が動きません: ' + e.message); }

/* ── ① 1本の重さのルール（ひろみさん指定・変更禁止） ───────── */
const W = [
  ['ORG100', 100,   92,  158,  250],
  ['ORG250', 250,  230,  262,  492],
  ['ORG500', 500,  460,  507,  967],
  ['ORG750', 750,  690,  162,  852],
  ['ORG2L', 2000, 1840,  327, 2167],
  ['ORG5L', 5000, 4600,  819, 5419],
  ['MEM100', 100,   92,  158,  250],
  ['MEM500', 500,  460,  507,  967],
  ['MEM750', 750,  690,  162,  852],
  ['CHF250', 250,  230,  262,  492]
];
W.forEach(function(r){
  const w = box.ynWeightFor(r[0]) || {};
  eq('①'+r[0]+' ml',      w.ml,    r[1]);
  eq('①'+r[0]+' オイルg', w.oil,   r[2]);
  eq('①'+r[0]+' 容器g',   w.cont,  r[3]);
  eq('①'+r[0]+' 合計g',   w.total, r[4]);
});
/* 特別な2つ */
const zk = box.ynWeightFor('ZAKURO') || {};
eq('①ザクロソース 合計g', zk.total, 604);
eq('①ザクロソース ml',    zk.ml,    250);
ok('①ザクロソースは内訳が無い（オイルg）', zk.oil == null);
ok('①ザクロソースは内訳が無い（容器g）', zk.cont == null);
const kb = box.ynWeightFor('MISC002') || {};
eq('①500ml用空瓶 合計g',   kb.total, 470);
eq('①500ml用空瓶 オイルg', kb.oil,   0);
eq('①500ml用空瓶 容器g',   kb.cont,  470);
eq('①500ml用空瓶 ml',      kb.ml,    500);

/* ★750mlの合計は500mlより軽い（缶とガラス瓶のちがい。ここが逆になったら間違い） */
ok('①750mlの合計 < 500mlの合計（缶のほうが軽い）',
   box.ynWeightFor('ORG750').total < box.ynWeightFor('ORG500').total);

/* ── ② 他の農園（モジカート・レ・トレ・コロンネ）も同じ重さ（2026-08-18 ひろみさん「同じ重さでOK！」） ── */
[['PRI100',250],['PRI250',492],['PRI500',967],['ZAI250',492],['ZAI500',967],
 ['AGR100',250],['AGR250',492],['TGR100',250],['ARM500',967]].forEach(function(r){
  const w = box.ynWeightFor(r[0]) || {};
  eq('②'+r[0]+' も同じ合計g', w.total, r[1]);
});
/* ★セット商品と、ルールに無い容量（3Lなど）は空のまま＝手で打つ */
['YS100','YS250A','PRI3L','AGR3L','ARM3L'].forEach(function(s){
  ok('②'+s+' はルールに無い＝空のまま（手で打つ）', box.ynWeightFor(s) === null);
});

/* ── ③ すでに手で入れた重さは書き換えない（古いノートの原価を動かさない） ── */
function line(o){ return Object.assign({ sku:'', eur:'', qty:'', g:'', ml:'' }, o); }

let n1 = { lines:[ line({sku:'ORG500', qty:60}) ] };
box.ynApplyWeightRule(n1);
eq('③空の重さにはルールが入る（合計g）', n1.lines[0].g,    967);
eq('③空の重さにはルールが入る（ml）',    n1.lines[0].ml,   500);
eq('③空の重さにはルールが入る（オイル）', n1.lines[0].oilG,  460);
eq('③空の重さにはルールが入る（容器）',   n1.lines[0].contG, 507);

let n2 = { lines:[ line({sku:'ORG500', qty:60, g:970}) ] };
box.ynApplyWeightRule(n2);
eq('③★手で入れた重さは書き換えない', n2.lines[0].g, 970);

let n3 = { lines:[ line({sku:'ARM3L', qty:10}) ] };
box.ynApplyWeightRule(n3);
eq('③ルールに無い商品の重さは空のまま', n3.lines[0].g, '');

ok('③合計gがルールどおりなら打てない（鍵つき）', box.ynWeightLocked(line({sku:'ORG500', g:967})) === true);
ok('③合計gが手入力なら打てる',                   box.ynWeightLocked(line({sku:'ORG500', g:970})) === false);
ok('③ルールに無い商品は打てる',                   box.ynWeightLocked(line({sku:'ARM3L', g:500})) === false);
ok('③重さがまだ空なら鍵つき（ルールが入る）',      box.ynWeightLocked(line({sku:'ORG500', g:''}))  === true);

/* ── ④ 総重量は「本数 × 合計g」で足し算できる ─────────────── */
let n4 = { exchangeRate:'', exp:{}, lines:[
  line({sku:'ORG250', qty:360}), line({sku:'ORG500', qty:60}), line({sku:'ORG750', qty:12})
]};
box.ynApplyWeightRule(n4);
const c4 = box.ynCalc(n4);
eq('④総重量 g（360×492 + 60×967 + 12×852）', c4.totalG, 360*492 + 60*967 + 12*852);
eq('④総重量 g の実数', c4.totalG, 245364);

/* ── ⑤ 同じ農園・同じ年月のカードは二度作らない ─────────────── */
box.ynNotes = [
  { id:'note_A', farm:'novavera',  yearMonth:'2026-08' },
  { id:'note_B', farm:'mozzicato', yearMonth:'2026-08' }
];
eq('⑤同じ農園・同じ年月は見つかる',   (box.prepSendFindNote('novavera','2026-08')||{}).id, 'note_A');
eq('⑤農園がちがえば別もの',           (box.prepSendFindNote('mozzicato','2026-08')||{}).id, 'note_B');
ok('⑤年月がちがえば見つからない',      box.prepSendFindNote('novavera','2026-09') === null);
ok('⑤どちらも無ければ見つからない',    box.prepSendFindNote('letrecolonne','2026-08') === null);
ok('⑤輸入年月は 2026-08 の形で出る',   /^\d{4}-\d{2}$/.test(box.prepSendDefaultYm()));

/* ── ⑥ 750mlの容器は缶（農園への英語表に Bottle と出さない） ── */
ok('⑥750mlの容器が「瓶」で残っていない', src.indexOf('"vol": "750ml", "cont": "瓶"') < 0);
eq('⑥750mlの容器は「缶」（2商品とも）',
   (src.match(/"vol": "750ml", "cont": "缶"/g) || []).length, 2);
ok('⑥保存済みの古い「瓶」も缶に直す仕掛けがある',
   src.indexOf("String(p.vol||'')==='750ml' && p.cont==='瓶'") >= 0);

/* ── ⑦ 画面の決めごと（消えたら気づけるように） ─────────────── */
ok('⑦ボタンの文言',            src.indexOf('✅ この内容で輸入を確定して、輸入ノートに送る') >= 0);
ok('⑦送る前の確認パネルがある', src.indexOf('prep-send-panel') >= 0);
ok('⑦確認パネルで農園を選べる', src.indexOf('prepSendSetFarm') >= 0);
ok('⑦確認パネルで年月を選べる', src.indexOf('prepSendSetYm') >= 0);
ok('⑦二重のときは「そのカードを開く」', src.indexOf('📂 そのカードを開く') >= 0);
ok('⑦★「もう1枚作る」は作らない（ひろみさん指示）', src.indexOf('もう1枚 作る') < 0 && src.indexOf('それでも') < 0);
ok('⑦押したら入力欄まで画面が動く', src.indexOf('function ynScrollToDetail') >= 0);
ok('⑦明細に「オイル g」の列がある', src.indexOf('オイル g') >= 0);
ok('⑦明細に「容器 g」の列がある',   src.indexOf('容器 g') >= 0);
ok('⑦明細に「この行の総重量 g」がある', src.indexOf('この行の<br>総重量 g') >= 0);
ok('⑦承認済みモックがある',
   fs.existsSync(path.join(__dirname, '..', 'mocks', 'mock_importE_prep_to_note_2026-08-18.html')));

/* ── ⑧ 原価の守りを外していない ───────────────────────── */
ok('⑧EMPTY_GUARD の呼び名が残っている',   src.indexOf('costLoadedOk') >= 0);
ok('⑧確定したときだけ原価に反映する道が残っている', src.indexOf('✅ 確定する → 原価データに反映') >= 0);
ok('⑧送るだけでは原価に触らない（確認パネルに明記）', src.indexOf('原価データには何も入りません') >= 0);

/* ── 結果 ───────────────────────────────────────── */
console.log('\n輸入ノートへ流す  PASS ' + pass + ' / FAIL ' + fail);
if(fails.length){ console.log('\n--- 直すところ ---'); fails.forEach(function(f){ console.log('  ★ ' + f); }); }
process.exit(fail ? 1 : 0);
