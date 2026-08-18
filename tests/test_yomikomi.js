/* 読み込みが終わる前に「ありません」と出さないか、本物の関数で試す。
   2026-08-18 ひろみさん指示：「取り込むまでのリロードしている間に『現在、取り置き中の
   受注はありません』って出ちゃうと、あれ、また消えたって思ってしまう」
   本番のデータには触らない。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname,'..','index.html'), 'utf8');

let pass=0, fail=0; const fails=[];
function eq(l,g,w){ if(String(g)===String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

/* 画面の身代わり（書き込まれた中身を覚えておく） */
function makeDom(){
  const el = {};
  function node(id){ return { id:id, innerHTML:'', textContent:'', style:{} }; }
  ['held-count','reserved-count','held-order-list','reserved-order-list','hold-selected-count','hold-batch-bar']
    .forEach(function(i){ el[i]=node(i); });
  return { el:el, getElementById(i){ return el[i] || node(i); },
           querySelectorAll(){ return []; }, querySelector(){ return null; } };
}

const NAMES=['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
  'lotStockFor','defectStockFor','condAvail','defectBuckets','condValueOfLine','condLabelOfLine','condRemainFor',
  'shortagesNow','orderShortages','isZaikoMachi','zaikoMachiQty','lineTotal',
  'yoyakuArrivedList','renderYoyakuArrivedBar',
  'daysUntil','isHeldOverdue','isHeldDueSoon','isReservedOverdue','isReservedDueSoon',
  'updateHoldSelected','renderHoldPreLists'];
let code=''; NAMES.forEach(n=>{ try{ code += H.cut(src,n)+'\n'; }catch(e){ code += '/* '+n+' なし */\n'; } });

function build(loaded, orders){
  const dom = makeDom();
  const {box,ctx}=H.makeSandbox({
    document: dom,
    PRODUCTS:[{id:1,sku:'ORG250',name:'オルガニック250ml',boxQty:12}],
    lots:[{id:'a',pid:1,status:'new',stock:100}], defects:[], holds:[],
    orders: orders||[], ordersLoaded: loaded, esc:function(s){ return String(s==null?'':s); },
    renderHoldPreAlerts:function(){}, renderHoldNote:function(){}, alertBucketCount:function(){ return 0; }
  });
  H.runZaiko(ctx);
  vm.runInContext(H.cutVar(src,'DEFECT_LEVELS'),ctx);
  vm.runInContext(code,ctx);
  box.renderHoldPreLists();
  return dom.el;
}

/* ── ① 読み込み中は「ありません」と言わない ─────────────── */
let el = build(false, []);
eq('① 取り置き：読み込み中と出る', el['held-order-list'].innerHTML.indexOf('読み込み中です') >= 0, true);
eq('① 取り置き：「ありません」とは言わない', el['held-order-list'].innerHTML.indexOf('ありません。') < 0, true);
eq('① 予約：読み込み中と出る', el['reserved-order-list'].innerHTML.indexOf('読み込み中です') >= 0, true);
eq('① 予約：「ありません」とは言わない', el['reserved-order-list'].innerHTML.indexOf('ありません。') < 0, true);
eq('① 「消えたわけではありません」と添える', el['held-order-list'].innerHTML.indexOf('消えたわけではありません') >= 0, true);

/* ── ② 読み込み中は件数を「0」と言わない ─────────────── */
eq('② 取り置きの件数は「…」', el['held-count'].textContent, '…');
eq('② 予約の件数は「…」',   el['reserved-count'].textContent, '…');

/* ── ③ 読み込みが終わって本当に0件なら「ありません」でよい ───── */
el = build(true, []);
eq('③ 取り置き：ありませんと出る', el['held-order-list'].innerHTML.indexOf('取り置き中の受注はありません') >= 0, true);
eq('③ 予約：ありませんと出る',   el['reserved-order-list'].innerHTML.indexOf('予約中の受注はありません') >= 0, true);
eq('③ 件数は0', el['held-count'].textContent, '0');
eq('③ 読み込み中とは言わない', el['held-order-list'].innerHTML.indexOf('読み込み中です') < 0, true);

/* ── ④ 読み込みが終わって件数があれば、ふつうに出る ─────────── */
el = build(true, [
  {id:'h1',num:'TK-1',status:'held',holdUntilDate:'',lines:[{productId:1,bottles:2,boxes:0,boxQty:1}]},
  {id:'r1',num:'TK-2',status:'reserved',expectedDate:'',lines:[{productId:1,bottles:3,boxes:0,boxQty:1}]}
]);
eq('④ 取り置き 1件', el['held-count'].textContent, '1');
eq('④ 予約 1件',   el['reserved-count'].textContent, '1');
eq('④ 読み込み中とは言わない', el['reserved-order-list'].innerHTML.indexOf('読み込み中です') < 0, true);

console.log('===== 読み込み中に「ありません」と言わないか =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
