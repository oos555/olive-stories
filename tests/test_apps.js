/* ① 受注A・倉庫D・請求C・マスターN が同じ販売可能数を出すか
   ② 不良品の出荷が「選んだ程度×現/旧」からだけ減るか
   ③ 注文番号が重複しないか
   ── すべて本番ファイルの本物の関数で流す。 */
const vm = require('vm');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(got === want) pass++;
  else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}

/* ── 共通の在庫データ（4アプリに同じものを渡す）──────────── */
function DATA(){
  return {
    PRODUCTS: [
      { id:1, sku:'ORG100', name:'オルガニック100ml', boxQty:12 },
      { id:2, sku:'ORG250', name:'オルガニック250ml', boxQty:12 },
      { id:9, sku:'SET-A',  name:'ギフトセットA', isSet:true, components:[{sku:'ORG100',qty:2},{sku:'ORG250',qty:1}] }
    ],
    lots: [
      { id:'a', pid:1, expiry:'2027-01', stock:45, status:'new' },
      { id:'b', pid:1, expiry:'2026-01', stock:38, status:'old' },
      { id:'c', pid:1, expiry:'',        stock:1,  status:'hold_old' },
      { id:'d', pid:1, expiry:'',        stock:3,  status:'discard' },
      { id:'e', pid:2, expiry:'2027-01', stock:20, status:'new' }
    ],
    defects: [
      { id:'d1', pid:1, level:'lv1', qty:2, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'cur', reportedAt:'2026-08-01' },
      { id:'d2', pid:1, level:'lv1', qty:1, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'old', reportedAt:'2026-08-02' },
      { id:'d3', pid:1, level:'lv3', qty:3, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'cur', reportedAt:'2026-08-03' },
      { id:'d4', pid:1, level:'lv3', qty:3, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'old', reportedAt:'2026-08-04' },
      { id:'d5', pid:1, level:'lv2', qty:4, shippedQty:0, status:'open', source:'warehouse', reviewed:false, lotKind:'cur', reportedAt:'2026-08-05' }
    ],
    holds: [{ pid:1, qty:10 }]
  };
}
const STUB = {};
['renderInvTable','renderLotList','renderCatSummary','renderDefectGroups','renderInvLogs','scheduleAutoSave',
 'showSyncStatus','renderReportList','renderList','updateSummary','syncOrdersToGAS','saveAllDataToGAS',
 'renderStockList','renderOrders','showToast','renderBilling','esc','addLog']
 .forEach(n => { STUB[n] = function(){ return ''; }; });

function build(file, names, extra){
  const src = H.read(file);
  let code = '';
  names.forEach(n => { try{ code += H.cut(src, n) + '\n'; }catch(e){ code += `/* ${n} 見つからず */\n`; } });
  const d = DATA();
  const { box, ctx } = H.makeSandbox(Object.assign({}, STUB, {
    lots: d.lots, defects: d.defects, holds: d.holds, PRODUCTS: d.PRODUCTS, products: d.PRODUCTS,
    preorders: [], orders: [], invLogs: [], logs: [], _resCache: null, idSeq: 1, invEditMode: true
  }, extra || {}));
  H.runZaiko(ctx);
  vm.runInContext(code, ctx);
  box.__ctx = ctx;
  return box;
}

/* ═══ ① 4アプリの突き合わせ ═══════════════════════════ */
const M = build('master.html', ['findProduct','findProductBySku','isActiveDefect','reservedByPidCache','computeStockNumbers','computeAvailable']);
/* 受注Aは holds を持たず、取り置き注文（status='held'）から毎回作り直す。同じ10本になる注文を渡す */
const A = build('index.html',  ['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable'],
  { orders: [{ id:'o1', status:'held', lines:[{ productId:1, bottles:10, boxes:0 }] }] });
const D = build('pickup.html', ['stockNumbersFor']);
const B = build('billing.html',['computeStockNumbersB']);

eq('① 受注Aの取り置きが注文から10本できている', A.buildHoldsForZaiko()[0].qty, 10);
['ORG100','ORG250','SET-A'].forEach(function(sku){
  const want = M.computeAvailable(sku);
  eq(`① ${sku} 受注A = マスターN（${want}）`, A.computeAvailable(sku), want);
});
const mn = M.computeStockNumbers(1);
const dn = D.stockNumbersFor(1, D.lots, D.defects, D.holds);
const bn = B.computeStockNumbersB(1, B.holds);
eq('① 倉庫D 販売可能 = マスターN', dn.sellable, mn.sellable);
eq('① 倉庫D 実在庫   = マスターN', dn.stock,    mn.stock);
eq('① 請求C 販売可能 = マスターN', bn.sellable, mn.sellable);
eq('① 請求C 実在庫   = マスターN', bn.stock,    mn.stock);
eq('① マスターN 現ロット販売可能', mn.cur.sellable, 35);
eq('① マスターN 実在庫（現+旧）',  mn.stock, (45+2+3) + (38+1+3+1));
eq('① 廃棄3本は実在庫に入っていない', mn.cur.discardQty, 3);

/* 親を変えたら4アプリとも追随するか（取置10→20） */
[M, D, B].forEach(function(app){ app.holds.length = 0; app.holds.push({ pid:1, qty:20 }); });
A.orders[0].lines[0].bottles = 20;
eq('① 取置20に変えたら 受注A 25',    A.computeAvailable('ORG100'), 25);
eq('① 取置20に変えたら マスターN 25', M.computeAvailable('ORG100'), 25);
eq('① 取置20に変えたら 倉庫D 25',    D.stockNumbersFor(1, D.lots, D.defects, D.holds).sellable, 25);
eq('① 取置20に変えたら 請求C 25',    B.computeStockNumbersB(1, B.holds).sellable, 25);

/* ═══ ② 不良品の出荷（程度×現/旧 からだけ減る）═══════════ */
function freshA(){
  const b = build('index.html', ['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
    'deductFromDefects','lotStockFor','defectStockFor','condAvail','defectBuckets','condRemainFor','conditionOptionsHtml'],
    { orders: [] });
  vm.runInContext(H.cutVar(H.read('index.html'), 'DEFECT_LEVELS'), b.__ctx);
  return b;
}
function pic(app){
  const g = {};
  app.defects.forEach(function(d){
    if(!app.isActiveDefect(d)) return;
    const lv = d.level==='lv1' ? 'lv1' : (d.level==='lv3' ? 'lv3' : 'lv2');
    const lk = d.lotKind==='old' ? 'old' : 'cur';
    g[lv+'|'+lk] = (g[lv+'|'+lk]||0) + ((d.qty||0)-(d.shippedQty||0));
  });
  return g;
}
let a = freshA();
eq('② 減らす前 軽(現)', pic(a)['lv1|cur'], 2);
eq('② 減らす前 重(現)', pic(a)['lv3|cur'], 3);
eq('② 減らす前 重(旧)', pic(a)['lv3|old'], 3);

a = freshA();
a.deductFromDefects(1, 2, [], 'lv1', 'cur');           // 軽（現ロット）から2本
let g = pic(a);
eq('② 軽(現)2本出荷 → 軽(現) 0', g['lv1|cur']||0, 0);
eq('② 軽(現)2本出荷 → 重(現) 3のまま', g['lv3|cur'], 3);
eq('② 軽(現)2本出荷 → 重(旧) 3のまま', g['lv3|old'], 3);
eq('② 軽(現)2本出荷 → 軽(旧) 1のまま', g['lv1|old'], 1);

a = freshA();
a.deductFromDefects(1, 2, [], 'lv3', 'old');           // 重（旧ロット）から2本
g = pic(a);
eq('② 重(旧)2本出荷 → 重(旧) 1', g['lv3|old'], 1);
eq('② 重(旧)2本出荷 → 重(現) 3のまま', g['lv3|cur'], 3);
eq('② 重(旧)2本出荷 → 軽(現) 2のまま', g['lv1|cur'], 2);

a = freshA();
a.deductFromDefects(1, 99, [], 'lv1', 'cur');          // 在庫より多く指定
g = pic(a);
eq('② 残りを超える指定でも 他の程度には手を出さない（重(現)）', g['lv3|cur'], 3);
eq('② 残りを超える指定でも 他のロットには手を出さない（軽(旧)）', g['lv1|old'], 1);

/* 未反映（倉庫報告 reviewed=false）の不良は出荷対象に出ない */
a = freshA();
eq('② 未反映の中(現)は数に入らない', (pic(a)['lv2|cur']||0), 0);

/* 選択肢は8つ・0本は選べない */
a = freshA();
const html = a.conditionOptionsHtml(1, 'normal');
const opts = (html.match(/<option/g) || []).length;
const dis  = (html.match(/disabled/g) || []).length;
eq('② 状態の選択肢は8つ', opts, 8);
eq('② 0本の選択肢は選べない（中・現／中・旧／軽・旧以外…）', dis > 0, true);

/* ═══ ③ 注文番号が重複しないか（3,000本）═══════════════ */
const src = H.read('index.html');
const O = H.makeSandbox({ orders: [] });
['todayYmd','orderNumCode'].forEach(function(n){ vm.runInContext(H.cut(src, n), O.ctx); });
vm.runInContext(H.cut(src, 'nextOrderNum'), O.ctx);
eq('③ 暗号表 バサラ=BA', O.box.orderNumCode('basara'), 'BA');
eq('③ 暗号表 定価=TK',   O.box.orderNumCode('general'), 'TK');
eq('③ 暗号表 不良特価=FT', O.box.orderNumCode('defectprice'), 'FT');
const seen = new Set(); let dup = 0; let badFmt = 0;
for(let i = 0; i < 3000; i++){
  const num = O.box.nextOrderNum(0, 'basara');
  if(!/^BA-\d{8}-\d{4}$/.test(num)) badFmt++;
  if(seen.has(num)) dup++;
  seen.add(num);
  O.box.orders.push({ num: num });
}
eq('③ 注文番号の形（暗号-日付-ランダム4桁）が崩れた数', badFmt, 0);
eq('③ 3,000本つくって重複した数', dup, 0);

/* お客様の注文ページ（order.html）も同じ形か */
/* お客様の注文ページ（order.html）。
   ここは番号を作る瞬間には他の注文が見えないので、作るところでは重複を防げない。
   決まり（すでにある番号と同じなら引き直す）は【保存の直前】に効く（reissueNumIfTaken）。
   だから、実際に走る順番どおり「作る → 保存直前に引き直す」で測る。 */
const fsMod = require('fs');
const orderSrc = fsMod.readFileSync(require('path').join(__dirname,'..','order.html'), 'utf8');
const O2 = H.makeSandbox({ PAYLOAD: { customer: { type:'general' } }, ORDER_NUM: '' });
try{
  ['orderNumCode','genOrderNum','reissueNumIfTaken'].forEach(n => vm.runInContext(H.cut(orderSrc, n), O2.ctx));
  const saved = []; let d2 = 0, b2 = 0;
  for(let i = 0; i < 3000; i++){
    const ord = { id:'o'+i, num: O2.box.genOrderNum() };
    O2.box.reissueNumIfTaken(ord, saved);              // ★保存直前の引き直し
    if(!/^TK-\d{8}-\d{4}$/.test(ord.num)) b2++;
    if(saved.some(s => s.num === ord.num)) d2++;
    saved.push(ord);
  }
  eq('③ order.html の形が崩れた数', b2, 0);
  eq('③ order.html で重複した数（3,000本）', d2, 0);
}catch(e){ fails.push('③ order.html を動かせず: ' + e.message); fail++; }

console.log('===== 4アプリ突き合わせ／不良出荷／注文番号 =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
