/* 統合マスタNの「臨時入庫」（画面側）が、本物の関数で正しく動くかを試す。
   ・予定の作成／数と日付の書き換え／取消
   ・「今すぐ入れる」→ 棚の良品に足す（実在庫・販売可能数は自動でついてくる）
   ・同じ商品にもう一度予定を作ると、前の予定を上書きする形になっていること（1商品1件）
   2026-08-25 追加。本番のデータには触らない。保存もしない。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname,'..','master.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(String(got) === String(want)) pass++; else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

const NAMES = ['restockLotFor','restockCreate','restockSetQty','restockSetDate','restockCancel',
  'restockApplyNow','closeRestockPanel_','doRestockApply','computeStockNumbers'];
let code = ''; NAMES.forEach(function(n){ code += H.cut(src, n) + '\n'; });

const PRODUCTS = [{ id:1, sku:'BAG002', name:'紙袋 黒 大', boxQty:1, group:'ギフト箱・備品' }];
let lots, defects, holds, addLogCalls, savedCalls, renderCalls, toastCalls;

function reset(){
  lots = [{ id:'lot-1', pid:1, lotCode:'A', expiry:'', stock:40, status:'new', note:'' }];
  defects = []; holds = [];
  addLogCalls = []; savedCalls = []; renderCalls = 0; toastCalls = [];
}
function nextId(){ return 'id-'+(Math.random()+'').slice(2,8); }

function buildSandbox(){
  const G = H.makeSandbox({
    lots: null, defects: null, holds: null,
    PRODUCTS: PRODUCTS,
    findProduct(pid){ return PRODUCTS.find(function(p){ return p.id==pid; }); },
    nextId: nextId,
    addLog(action, detail){ addLogCalls.push(action+'｜'+detail); },
    scheduleAutoSave(){ savedCalls.push(1); },
    renderInvTable(){ renderCalls++; },
    showSyncStatus(msg){ toastCalls.push(msg); },
    esc(s){ return String(s==null?'':s); },
    confirm(){ return true; },  // テストでは常に「OK」を押した扱い
    reservedByPidCache(){ return {}; }
  });
  G.ctx.lots = lots; G.ctx.defects = defects; G.ctx.holds = holds;
  H.runZaiko(G.ctx);
  vm.runInContext(code, G.ctx);
  return G;
}

/* ── ① 予定を作る → 数と日付を入れる ─────────────────────────── */
reset();
{
  const G = buildSandbox();
  eq('①はじめは予定が無い', G.box.restockLotFor(1), undefined);
  G.box.restockCreate(1);
  const rl1 = G.ctx.lots.find(function(l){ return l.status==='restock'; });
  eq('①予定が1件できる', !!rl1, true);
  eq('①はじめは0本', rl1.stock, 0);
  G.box.restockSetQty(1, '100');
  G.box.restockSetDate(1, '2026-08-28');
  eq('①数を入れられる', rl1.stock, 100);
  eq('①日付を入れられる', rl1.note, '2026-08-28');
  eq('①1商品1件のまま', G.ctx.lots.filter(function(l){ return l.pid==1 && l.status==='restock'; }).length, 1);
}

/* ── ② 数がマイナスや文字を打っても壊れない ───────────────────── */
reset();
{
  const G = buildSandbox();
  G.box.restockCreate(1);
  G.box.restockSetQty(1, '-5');
  eq('②マイナスは0に丸められる', G.box.restockLotFor(1).stock, 0);
  G.box.restockSetQty(1, 'abc');
  eq('②数字でない入力も0になる（壊れない）', G.box.restockLotFor(1).stock, 0);
}

/* ── ③ 「今すぐ入れる」→ 棚の良品に足す。実在庫・販売可能数は自動でついてくる ── */
reset();
{
  const G = buildSandbox();
  G.box.restockCreate(1);
  G.box.restockSetQty(1, '100');
  G.box.restockSetDate(1, '2026-08-28');
  const before = G.box.computeStockNumbers(1);
  eq('③実行前：棚の良品', before.cur.avail, 40);
  eq('③実行前：販売可能数', before.cur.sellable, 40);
  eq('③実行前：実在庫', before.cur.stock, 40);

  G.ctx.restockConfirmPid = 1;   // 確認パネルで「この内容で入れる」を押した状態を再現
  G.box.doRestockApply();

  const after = G.box.computeStockNumbers(1);
  eq('③実行後：棚の良品が+100', after.cur.avail, 140);
  eq('③実行後：実在庫も+100（自動でついてくる・別に足していない）', after.cur.stock, 140);
  eq('③実行後：販売可能数も+100', after.cur.sellable, 140);
  eq('③臨時入庫の予定は消える', G.box.restockLotFor(1), undefined);
  eq('③ログに記録される', addLogCalls.length, 1);
  eq('③保存がスケジュールされる', savedCalls.length >= 1, true);
}

/* ── ④ 棚の良品('new')ロットが元から無い商品でも、新しく作って足せる ─────── */
reset();
{
  lots = [];  // 'new'ロットが無い状態
  const G = buildSandbox();
  G.box.restockCreate(1);
  G.box.restockSetQty(1, '30');
  G.ctx.restockConfirmPid = 1;
  G.box.doRestockApply();
  const after = G.box.computeStockNumbers(1);
  eq('④棚の良品が新しくできて30本になる', after.cur.avail, 30);
  eq('④実在庫も30', after.cur.stock, 30);
}

/* ── ⑤ 0本のまま「今すぐ入れる」を押しても何も起きない ────────────── */
reset();
{
  const G = buildSandbox();
  const alerted = [];
  G.ctx.alert = function(m){ alerted.push(m); };
  G.box.restockCreate(1);
  G.box.restockApplyNow(1);   // 0本のまま
  eq('⑤確認パネルは開かず、注意が出る', alerted.length, 1);
  eq('⑤在庫は変わらない', G.box.computeStockNumbers(1).cur.avail, 40);
}

/* ── ⑥ 予定を取り消す ────────────────────────────────────── */
reset();
{
  const G = buildSandbox();
  G.box.restockCreate(1);
  G.box.restockSetQty(1, '50');
  eq('⑥取消前は予定がある', !!G.box.restockLotFor(1), true);
  G.box.restockCancel(1);
  eq('⑥取消後は予定が無い', G.box.restockLotFor(1), undefined);
  eq('⑥在庫は変わらない（取り消しただけ）', G.box.computeStockNumbers(1).cur.avail, 40);
}

console.log('===== 臨時入庫（統合マスタN画面側・本物の関数）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
