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
/* ★3L は 2L の1.5倍（2026-08-18 ひろみさん「3LTは2LTの1.5倍しておいて」） */
['PRI3L','AGR3L'].forEach(function(s){
  const w = box.ynWeightFor(s) || {};
  eq('②'+s+' ml',      w.ml,    3000);
  eq('②'+s+' オイルg', w.oil,   2760);
  eq('②'+s+' 容器g',   w.cont,  490.5);
  eq('②'+s+' 合計g',   w.total, 3250.5);
});
/* ★アルモニア3L は bag in box。容器だけ半分（2026-08-18 ひろみさん「バッグインボックスは重量半分にしておいて」） */
const arm = box.ynWeightFor('ARM3L') || {};
eq('②ARM3L ml',      arm.ml,    3000);
eq('②ARM3L オイルg', arm.oil,   2760);
eq('②ARM3L 容器g（缶の半分）', arm.cont,  245.25);
eq('②ARM3L 合計g',   arm.total, 3005.25);
eq('②ARM3Lの容器は缶の3Lのちょうど半分', arm.cont, box.ynWeightFor('PRI3L').cont / 2);
ok('②ARM3Lのオイルは半分にしない（3Lは3L）', arm.oil === box.ynWeightFor('PRI3L').oil);

const w2L = box.ynWeightFor('ORG2L'), w3L = box.ynWeightFor('PRI3L');
eq('②3Lのオイルは2Lの1.5倍', w3L.oil,   w2L.oil  * 1.5);
eq('②3Lの容器は2Lの1.5倍',   w3L.cont,  w2L.cont * 1.5);
eq('②3Lの合計は2Lの1.5倍',   w3L.total, w2L.total * 1.5);

/* ★セット商品（箱に何本も入るもの）は空のまま＝手で打つ */
['YS100','YS250A'].forEach(function(s){
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

let n3 = { lines:[ line({sku:'YS100', qty:10}) ] };
box.ynApplyWeightRule(n3);
eq('③ルールに無い商品の重さは空のまま', n3.lines[0].g, '');

ok('③合計gがルールどおりなら打てない（鍵つき）', box.ynWeightLocked(line({sku:'ORG500', g:967})) === true);
ok('③合計gが手入力なら打てる',                   box.ynWeightLocked(line({sku:'ORG500', g:970})) === false);
ok('③ルールに無い商品は打てる',                   box.ynWeightLocked(line({sku:'YS100', g:500})) === false);
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
/* ★2026-08-18 ボタンは短くして、何が起きるかは下の説明に書く（ひろみさん了承） */
ok('⑦ボタンの文言',            src.indexOf('✅ この内容で輸入を確定する') >= 0);
ok('⑦ボタンの下の説明',        src.indexOf('統合マスタの在庫リストの「輸入」の予定列に数を転記します') >= 0);
ok('⑦タブの名前は輸入準備計算室', src.indexOf('🧮 輸入準備計算室') >= 0);
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

/* ══════ ⑨ 統合マスタの「輸入」の予定列への転記（2026-08-18） ══════
   ★ひろみさん「すでに入ってる数は絶対に消さないように、
     計算式も絶対に絶対に絶対に変えないように、そこだけは気を付けてください」 */
ok('⑨転記の一覧を作る関数がある',   src.indexOf('function prepIncomingList') >= 0);
ok('⑨その行だけ書き換える入り口を使う', src.indexOf("action:'setIncomingOnly'") >= 0);
ok('⑨★輸入Ｅは「在庫まるごと保存」を呼ばない',
   src.indexOf("action:'saveAllData'") < 0 && src.indexOf("action: 'saveAllData'") < 0);
ok('⑨いまの予定は読むだけ（GETで読む）', src.indexOf("?action=loadAllData") >= 0);
ok('⑨「置き換え」だと画面に書いてある', src.indexOf('足し算ではなく「置き換え」です') >= 0);
ok('⑨ほかの商品はさわらないと書いてある', src.indexOf('ほかの商品の予定は<b>1本もさわりません</b>') >= 0);
ok('⑨販売可能・実在庫は動かないと書いてある', src.indexOf('販売可能数と実在庫は1本も動きません') >= 0);
ok('⑨ノートがある場合も転記だけできる', src.indexOf('function prepSendIncomingOnly') >= 0);
ok('⑨★在庫の計算式（oos-zaiko.js）を輸入Ｅに書き写していない',
   src.indexOf("status==='hold'") < 0 && src.indexOf('sellable') < 0);

const gasPath2 = path.join(__dirname, '..', '..', 'olive-stories-gas', 'コード.js');
if(fs.existsSync(gasPath2)){
  const gas2 = fs.readFileSync(gasPath2, 'utf8');
  ok('⑨setIncomingOnly がある', gas2.indexOf('function setIncomingOnly') >= 0);
  ok('⑨doPost につながっている', gas2.indexOf("action === 'setIncomingOnly'") >= 0);
  const f2 = gas2.slice(gas2.indexOf('function setIncomingOnly'));
  const b2 = f2.slice(0, f2.indexOf('\n}') + 2);
  ok('⑨★シートを全部消していない',        b2.indexOf('clearContents') < 0);
  ok('⑨★書き換えるのは incoming の行だけ', b2.indexOf("!== 'incoming'") >= 0);
  ok('⑨★頼まれていない商品は飛ばす',      b2.indexOf('if (!it) continue;') >= 0);
  ok('⑨在庫数の列だけ書き換える',          b2.indexOf('COL_STOCK') >= 0);
} else {
  console.log('（GASのファイルが手元にないので ⑨のGAS分 は飛ばしました）');
}

/* ── 結果 ───────────────────────────────────────── */
console.log('\n輸入ノートへ流す  PASS ' + pass + ' / FAIL ' + fail);
if(fails.length){ console.log('\n--- 直すところ ---'); fails.forEach(function(f){ console.log('  ★ ' + f); }); }
process.exit(fail ? 1 : 0);
