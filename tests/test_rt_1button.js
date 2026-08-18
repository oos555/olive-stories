/* RTの「📦 確定して在庫を押さえ、予約を登録する」を、本物の関数で試す。
   2026-08-18 ひろみさん指示：ボタンが離れていると予約の登録を忘れるので1つにまとめた。
   ★あわせて「取置ぶんまで予約に入れて二重になる」ズレも直した。
   本番のデータには触らない。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname,'..','index.html'), 'utf8');

let pass=0, fail=0; const fails=[];
function eq(l,g,w){ if(String(g)===String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

const NAMES=['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
  'rtmIsSupplySku','rtmDerived','rtmEffCell','rtmRowSkus','rtmOilRowSkus','rtmTotal','rtmStock','rtmPrice',
  'rtmProdName','rtmAlloc','rtmMinKeep','rtmKeep','rtmHold','rtmNeed','rtmCommitOne','rtmBuildSplitOrders',
  'rtmCancelHeldOrders','rtmRedo','lineTotal'];
let code=''; NAMES.forEach(n=>{ try{ code += H.cut(src,n)+'\n'; }catch(e){ code += '/* '+n+' なし */\n'; } });
const STUB={}; const alerts=[]; const confirms=[];
['rtmRender','rtmPushHist','renderHoldPreLists','syncOrdersToGAS','showSyncStatus','rtPriceOf',
 'renderList','updateSummary','rtmSave'].forEach(n=>STUB[n]=function(){ return ''; });
STUB.generateOrderId=function(){ return 'id'+Math.random(); };
STUB.nextOrderNum=function(){ return 'RT-TEST'; };

/* 施設2つ：高山100本・本社EC課60本＝合計160本。在庫は bagStock ならぬ oilStock */
/* keep ＝「手元に残す」本数。取置＝在庫−残す。
   ★はじめは「取置0（在庫をロックしない）」が既定（2026-08-10 ひろみさん確定）。
   人が🔒取置か🛒残すを打って決めるので、テストでもその状態を作る。 */
function build(oilStock, keep){
  const PRODUCTS=[{id:1,sku:'ORG100',name:'オルガニック100ml',boxQty:12,group:'オイル'}];
  const RTM={ cols:['f1','f2'], q:{ 'ORG100':{ f1:100, f2:60 } },
              alloc:(keep===undefined?{}:{ 'ORG100':{ keep:keep } }), hist:[], supRefl:{} };
  const {box,ctx}=H.makeSandbox(Object.assign({},STUB,{
    PRODUCTS:PRODUCTS,
    lots:[{id:'a',pid:1,status:'new',stock:oilStock}], defects:[], orders:[], holds:[],
    customers:[{id:'f1',name:'高山',series:'RT全体',type:'rt'},{id:'f2',name:'本社EC課',series:'RT全体',type:'rt'}],
    RTM:RTM, rtmS:function(){ return RTM; },
    alert:function(m){ alerts.push(m); }, confirm:function(m){ confirms.push(m); return true; }
  }));
  H.runZaiko(ctx); vm.runInContext(code,ctx);
  return box;
}

/* ── ① 在庫が十分：全部 取り置きになる ─────────────────── */
let b=build(645, 485);   // 在庫645・残す485 → 取置160
eq('① 予約合計 160', b.rtmTotal('ORG100'), 160);
eq('① 取置 160（在庫から確保）', b.rtmHold('ORG100'), 160);
eq('① 予約(要輸入) 0', b.rtmNeed('ORG100'), 0);
alerts.length=0; confirms.length=0;
b.rtmCommitOne('ORG100');
eq('① 確認画面が1回だけ出る', confirms.length, 1);
eq('① 取り置きの注文ができる（施設2件）', b.orders.filter(o=>o.status==='held').length, 2);
eq('① 予約の注文はできない', b.orders.filter(o=>o.status==='reserved').length, 0);
eq('① 販売可能数 645→485', b.computeAvailable('ORG100'), 485);

/* ── ② 在庫が足りない：取置と予約に分かれる ───────────────── */
b=build(100, 0);   // 在庫100・残す0 → 取置100
eq('② 取置 100（在庫ぶんだけ）', b.rtmHold('ORG100'), 100);
eq('② 予約(要輸入) 60', b.rtmNeed('ORG100'), 60);
b.rtmCommitOne('ORG100');
const held=b.orders.filter(o=>o.status==='held'), res=b.orders.filter(o=>o.status==='reserved');
eq('② 取り置きの合計 100', held.reduce((s,o)=>s+o.lines[0].bottles,0), 100);
eq('② 予約の合計 60',     res.reduce((s,o)=>s+o.lines[0].bottles,0), 60);
eq('★② 取置＋予約＝予約合計160（二重にならない）',
   held.concat(res).reduce((s,o)=>s+o.lines[0].bottles,0), 160);
eq('② 販売可能数 100→0', b.computeAvailable('ORG100'), 0);
eq('② 施設の割り当て：高山は取置100', (held.find(o=>o.custId==='f1')||{lines:[{bottles:0}]}).lines[0].bottles, 100);
eq('② 施設の割り当て：本社EC課は予約60', (res.find(o=>o.custId==='f2')||{lines:[{bottles:0}]}).lines[0].bottles, 60);

/* ── ③ 統合マスタの「予約」の列に、要輸入ぶんだけ出る ─────────── */
const Z=H.makeSandbox({}); H.runZaiko(Z.ctx);
const m=Z.box.OOS_ZAIKO.reservedByPid(b.orders,{lots:b.lots,defects:b.defects,holds:[]},b.PRODUCTS);
eq('★③ 予約の列は 60（160ではない＝二重になっていない）', m[1], 60);

/* ── ④ 登録済みの表示と、取り消し ───────────────────── */
eq('④ 登録済みの印', b.rtmAlloc('ORG100').reflected, true);
eq('④ 取置の記録 100', b.rtmAlloc('ORG100').reflHold, 100);
eq('④ 予約の記録 60',  b.rtmAlloc('ORG100').reflNeed, 60);
b.rtmRedo('ORG100');
eq('④ 取り消すと取り置きが消える', b.orders.filter(o=>o.status==='held').length, 0);
eq('④ 取り消すと予約も消える',     b.orders.filter(o=>o.status==='reserved').length, 0);
eq('④ 販売可能数が100に戻る', b.computeAvailable('ORG100'), 100);
eq('④ 登録済みの印が外れる', b.rtmAlloc('ORG100').reflected, false);

/* ── ⑤ 2回押しても二重に作らない ───────────────────── */
b=build(100, 0);
b.rtmCommitOne('ORG100');
const n1=b.orders.length;
b.rtmCommitOne('ORG100');
eq('⑤ もう一度押しても増えない', b.orders.length, n1);

/* ── ⑥ 本数が0なら何も作らない ─────────────────────── */
b=build(100, 0); b.RTM.q['ORG100']={f1:0,f2:0};
alerts.length=0;
b.rtmCommitOne('ORG100');
eq('⑥ 注文を作らない', b.orders.length, 0);
eq('⑥ 理由を知らせる', alerts.length>0, true);

/* ── ⑦ 確認画面に、取置と予約の両方が書いてある ───────────── */
b=build(100, 0); confirms.length=0;
b.rtmCommitOne('ORG100');
eq('⑦ 取り置きの本数が書いてある', confirms[0].indexOf('100本') >= 0, true);
eq('⑦ 予約の本数が書いてある',   confirms[0].indexOf('60本') >= 0, true);
eq('⑦ 販売可能数の変化が書いてある', confirms[0].indexOf('100 → 0') >= 0, true);
eq('⑦ 予約は在庫に効かないと書いてある', confirms[0].indexOf('販売可能数は減りません') >= 0, true);

console.log('===== RTのボタンを1つにまとめた =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
