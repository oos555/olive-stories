/* 備品（紙袋・ギフト箱）も在庫として数えるか、本物の関数で試す。
   2026-08-18 ひろみさん承認（オレンジ／倉庫は止めない／統合マスタの予約列には出さない）
   本番のデータには触らない。保存もしない。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname,'..','index.html'), 'utf8');

let pass=0, fail=0; const fails=[];
function eq(l,g,w){ if(String(g)===String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

const NAMES=['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
  'rtmIsSupplySku','rtmDerived','rtmStock','rtmProdName','rtmFacName','rtmSupplyList',
  'rtmBuildSupplyHeld','rtmReflectSupplies','rtmRedoSupplies','rtmCancelHeldOrders','lineTotal'];
let code=''; NAMES.forEach(n=>{ code += H.cut(src,n)+'\n'; });
const STUB={}; const alerts=[]; const confirms=[];
['rtmRender','rtmPushHist','renderHoldPreLists','syncOrdersToGAS','showSyncStatus','esc',
 'generateOrderId','nextOrderNum','rtPriceOf','renderList','updateSummary'].forEach(n=>STUB[n]=function(){ return ''; });
STUB.generateOrderId=function(){ return 'id'+(Math.random()+''); };
STUB.nextOrderNum=function(){ return 'RT-TEST'; };
STUB.esc=function(s){ return String(s==null?'':s); };

/* セット：ギフトA ＝ オイル2本 ＋ 紙袋1枚 */
function build(bagStock){
  const PRODUCTS=[
    {id:1,sku:'ORG250',name:'オルガニック250ml',boxQty:12,group:'オイル'},
    {id:33,sku:'BAG002',name:'紙袋 黒 大',boxQty:1,group:'ギフト箱・備品'},
    {id:9,sku:'SET-A',name:'ギフトA',isSet:true,group:'セット',components:[{sku:'ORG250',qty:2},{sku:'BAG002',qty:1}]}
  ];
  const RTM={ cols:['f1','f2'], q:{ 'SET-A':{ f1:30, f2:20 } }, alloc:{}, hist:[], supRefl:{} };
  const {box,ctx}=H.makeSandbox(Object.assign({},STUB,{
    PRODUCTS:PRODUCTS,
    lots:[{id:'o',pid:1,status:'new',stock:500},{id:'b',pid:33,status:'new',stock:bagStock}],
    defects:[], orders:[], holds:[],
    customers:[{id:'f1',name:'高山',series:'RT全体',type:'rt'},{id:'f2',name:'本社EC課',series:'RT全体',type:'rt'}],
    RTM:RTM, rtmS:function(){ return RTM; }, rtmSave:function(){},
    alert:function(m){ alerts.push(m); }, confirm:function(m){ confirms.push(m); return true; }
  }));
  H.runZaiko(ctx); vm.runInContext(code,ctx);
  return box;
}

/* ── ① セットから備品の必要数が出るか ───────────────── */
let b=build(100);
let l=b.rtmSupplyList();
eq('① 備品が1つ出る', l.length, 1);
eq('① 商品名', l[0].name, '紙袋 黒 大');
eq('① 必要数は 30+20=50', l[0].need, 50);
eq('① 施設ごとの内訳（高山30）', l[0].per.f1, 30);
eq('① 施設ごとの内訳（本社EC課20）', l[0].per.f2, 20);
eq('① 在庫100', l[0].stock, 100);
eq('① 足りている', l[0].short, 0);

/* ── ② 在庫が足りないと「たりない本数」が出る ───────────── */
b=build(48);
l=b.rtmSupplyList();
eq('② 在庫48 → 2本たりない', l[0].short, 2);

/* ── ③ 在庫を押さえると、販売可能数が減る ───────────────── */
b=build(100);
eq('③ 押さえる前の販売可能数', b.computeAvailable('BAG002'), 100);
alerts.length=0; confirms.length=0;
b.rtmReflectSupplies();
eq('③ 確認の画面を出す', confirms.length, 1);
eq('③ 確認に本数が出る', confirms[0].indexOf('50本') >= 0, true);
eq('③ 押さえたあとの販売可能数 100→50', b.computeAvailable('BAG002'), 50);
eq('③ 受注Ａに取り置きができる（施設ごとに2件）', b.orders.filter(o=>o.status==='held').length, 2);
eq('③ 取り置きは高山30本', (b.orders.find(o=>o.custId==='f1')||{}).lines[0].bottles, 30);
eq('③ 取り置きは本社EC課20本', (b.orders.find(o=>o.custId==='f2')||{}).lines[0].bottles, 20);
eq('③ RTの印がつく', b.orders[0].rtmOwned, true);
eq('③ 商品の印がつく', b.orders[0].rtmSku, 'BAG002');
eq('③ 記録に残る', b.RTM.supRefl['BAG002'], 50);

/* ── ④ 押さえたあとの表示 ───────────────────────── */
l=b.rtmSupplyList();
eq('④ 押さえ済みと出る', l[0].refl, 50);
eq('④ たりない本数は0になる', l[0].short, 0);

/* ── ⑤ 取り消すと在庫が戻る ─────────────────────── */
b.rtmRedoSupplies();
eq('⑤ 販売可能数が100に戻る', b.computeAvailable('BAG002'), 100);
eq('⑤ 取り置きはキャンセル扱い', b.orders.filter(o=>o.status==='held').length, 0);
eq('⑤ 記録も消える', Object.keys(b.RTM.supRefl).length, 0);

/* ── ⑥ 在庫が足りないときは、ある分だけ押さえる ───────────── */
b=build(30);
alerts.length=0; confirms.length=0;
b.rtmReflectSupplies();
eq('⑥ 在庫30本ぶんだけ押さえる', b.computeAvailable('BAG002'), 0);
eq('⑥ 足りないことを確認画面に書く', confirms[0].indexOf('在庫がありません') >= 0, true);
eq('⑥ 取り置きの合計は30本',
   b.orders.filter(o=>o.status==='held').reduce((s,o)=>s+o.lines[0].bottles,0), 30);

/* ── ⑦ 在庫0なら押さえない ─────────────────────── */
b=build(0);
alerts.length=0;
b.rtmReflectSupplies();
eq('⑦ 在庫0なら何も作らない', b.orders.length, 0);
eq('⑦ 理由を知らせる', alerts.length > 0, true);

/* ── ⑧ 備品は【統合マスタの予約列に出さない】（ひろみさん決定）───── */
b=build(100);
const Z=H.makeSandbox({}); H.runZaiko(Z.ctx);
b.rtmReflectSupplies();
const m=Z.box.OOS_ZAIKO.reservedByPid(b.orders,{lots:b.lots,defects:b.defects,holds:[]},b.PRODUCTS);
eq('⑧ 備品は予約に数えない（取り置きなので）', m[33]||0, 0);
eq('⑧ オイルも予約には入らない', m[1]||0, 0);

console.log('===== 備品も在庫として数える =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
