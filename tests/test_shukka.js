/* 受注A（index.html）の在庫の減り方を、本物の関数で試す。
   ・画面に入っている見張り oosZaikoSelfCheck を、そのまま走らせて18項目を採点させる
   ・出荷依頼を2回送っても在庫が2回減らないことを確かめる
   ・キャンセルで戻ること、戻したあとまた減らせることを確かめる
   本番のデータには触らない（作り物の在庫だけ）。保存も一切しない。 */
const vm = require('vm');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(String(got) === String(want)) pass++;
  else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

const src = H.read('index.html');
const NAMES = ['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
  'lotStockFor','defectStockFor','condAvail','defectBuckets','condValueOfLine','condLabelOfLine','condRemainFor',
  'shortagesNow','orderShortages','isZaikoMachi','isSentButNotDeducted','zaikoMachiQty',
  'deductFromLots','deductFromDefects','deductStockForOrder','restoreStockForOrder',
  'applyStockDeductOnSend','undoStockForOrder','lineTotal','oosZaikoSelfCheck'];
let code = '';
NAMES.forEach(n => { code += H.cut(src, n) + '\n'; });

const STUB = {};
['renderList','updateSummary','syncOrdersToGAS','showSyncStatus','persistStockDeduct','addLog','esc',
 'scheduleAutoSave','saveAllDataToGAS'].forEach(n => { STUB[n] = function(){}; });
const alarmed = [];
STUB.oosZaikoRuleAlarm = function(f){ alarmed.push(f); };

const { box, ctx } = H.makeSandbox(Object.assign({}, STUB, {
  PRODUCTS: [{ id:1, sku:'ORG100', name:'オルガニック100ml', boxQty:12 }],
  lots: [], defects: [], orders: [], holds: [], idSeq: 1
}));
H.runZaiko(ctx);
vm.runInContext(H.cutVar(src, 'DEFECT_LEVELS'), ctx);
vm.runInContext(code, ctx);

/* ── ① 画面に入っている見張りを、そのまま走らせる ─────────── */
box.lots = [{ id:'keep', pid:1, status:'new', expiry:'2030-01-01', stock:777 }];
box.defects = [{ id:'keepD', pid:1, qty:9, shippedQty:0, level:'lv1', status:'pending', reviewed:true }];
const before = JSON.stringify({ l: box.lots, d: box.defects });
const violations = box.oosZaikoSelfCheck();
eq('① 見張りが見つけた違反の数', violations.length, 0);
if(violations.length) violations.forEach(v => fails.push('   見張りの指摘: ' + v));
eq('① 見張りは本物の在庫を元に戻す', JSON.stringify({ l: box.lots, d: box.defects }), before);

/* ── ② 見張りが「わざと壊したら」ちゃんと気づくか（にせの故障を入れて試す）── */
const realDeduct = box.deductFromDefects;
box.deductFromDefects = function(pid, qty, log, level, lotKind){
  return realDeduct.call(null, pid, qty, log, null, null);   // 絞り込みをわざと外す
};
const violations2 = box.oosZaikoSelfCheck();
eq('② 絞り込みを外すと見張りが気づく（1件以上）', violations2.length > 0, true);
box.deductFromDefects = realDeduct;
const violations3 = box.oosZaikoSelfCheck();
eq('② 戻すと また全部OKになる', violations3.length, 0);

/* ── ③ 出荷依頼を2回送っても、在庫は1回分しか減らない ─────── */
function setup(){
  box.lots = [
    { id:'A', pid:1, status:'new', expiry:'2026-12-01', stock:20 },
    { id:'B', pid:1, status:'old', expiry:'2026-06-01', stock:8 }
  ];
  box.defects = [
    { id:'d1', pid:1, qty:4, shippedQty:0, level:'lv1', status:'pending', reviewed:true, lotKind:'cur', processedAt:'2026-08-01' },
    { id:'d2', pid:1, qty:3, shippedQty:0, level:'lv3', status:'pending', reviewed:true, lotKind:'old', processedAt:'2026-07-01' }
  ];
  box.orders = [];
}
function stockOf(id){ const l = box.lots.find(x => x.id === id); return l ? (l.stock||0) : -1; }
function defOf(id){ const d = box.defects.find(x => x.id === id); return d ? ((d.qty||0)-(d.shippedQty||0)) : -1; }

setup();
const o = { id:'o1', status:'pending', stockDeducted:false, stockLog:[],
  lines:[{ productId:1, bottles:5, boxes:0, boxQty:1, condition:'normal' }] };
box.applyStockDeductOnSend(o);
eq('③ 1回目：現ロット 20→15', stockOf('A'), 15);
eq('③ 印がつく', o.stockDeducted, true);
box.applyStockDeductOnSend(o);
box.applyStockDeductOnSend(o);
box.applyStockDeductOnSend(o);
eq('③ 4回送っても 15 のまま（二重に減らない）', stockOf('A'), 15);
eq('③ 旧ロットは触られていない', stockOf('B'), 8);

/* ── ④ 取り消したら戻る。そのあともう一度減らせる ─────────── */
box.undoStockForOrder(o);
eq('④ 取り消しで 20 に戻る', stockOf('A'), 20);
eq('④ 印が外れる', o.stockDeducted, false);
box.undoStockForOrder(o);
eq('④ 取り消しを2回押しても 20 のまま（増えない）', stockOf('A'), 20);
box.applyStockDeductOnSend(o);
eq('④ もう一度送ると 15', stockOf('A'), 15);

/* ── ⑤ 不良品の出荷は、選んだ程度×ロットからだけ減る ───────── */
setup();
const o2 = { id:'o2', status:'pending', stockDeducted:false, stockLog:[],
  lines:[{ productId:1, bottles:2, boxes:0, boxQty:1, condition:'defect', defectLevel:'lv1', defectLotKind:'cur' }] };
box.applyStockDeductOnSend(o2);
eq('⑤ 軽(現)から2本 → 軽(現) 4→2', defOf('d1'), 2);
eq('⑤ 重(旧) 3 は動かない', defOf('d2'), 3);
eq('⑤ 棚の良品 20 は動かない', stockOf('A'), 20);
eq('⑤ 旧ロット 8 は動かない', stockOf('B'), 8);

setup();
const o3 = { id:'o3', status:'pending', stockDeducted:false, stockLog:[],
  lines:[{ productId:1, bottles:2, boxes:0, boxQty:1, condition:'defect', defectLevel:'lv3', defectLotKind:'old' }] };
box.applyStockDeductOnSend(o3);
eq('⑤ 重(旧)から2本 → 重(旧) 3→1', defOf('d2'), 1);
eq('⑤ 軽(現) 4 は動かない', defOf('d1'), 4);

/* ── ⑥ 旧ロット指定は旧ロットからだけ減る ─────────────────── */
setup();
const o4 = { id:'o4', status:'pending', stockDeducted:false, stockLog:[],
  lines:[{ productId:1, bottles:3, boxes:0, boxQty:1, condition:'old' }] };
box.applyStockDeductOnSend(o4);
eq('⑥ 旧ロット 8→5', stockOf('B'), 5);
eq('⑥ 現ロット 20 は動かない', stockOf('A'), 20);

console.log('===== 受注A 在庫の減り方／見張り =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
