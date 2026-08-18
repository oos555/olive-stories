/* 予約の数え方（2026-08-18 親 oos-zaiko.js に移した）を、本物の関数で試す。
   ・親が数える予約 ＝ ①reserved の注文（RT含む）＋ ②在庫が足りなくて待っている注文
   ・統合マスタＮの「予約」の列が、その親と同じ数になるか
   本番のデータには触らない。 */
const vm = require('vm');
const fs = require('fs');
const H = require('./harness');
const msrc = fs.readFileSync(require('path').join(__dirname,'..','master.html'), 'utf8');

let pass=0, fail=0; const fails=[];
function eq(l,g,w){ if(String(g)===String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

const PRODUCTS=[
  {id:1,sku:'ORG250',name:'オルガニック250ml',boxQty:12},
  {id:2,sku:'MEM500',name:'メメジック500ml',boxQty:12},
  {id:9,sku:'SET-A',name:'ギフトA',isSet:true,components:[{sku:'ORG250',qty:2}]}
];
const LOTS=[
  {pid:1,status:'new',stock:0},      // ORG250 は 0本
  {pid:2,status:'new',stock:10},     // MEM500 は 10本
  {pid:2,status:'old',stock:3}
];
const DEFECTS=[];
const DATA={lots:LOTS,defects:DEFECTS,holds:[]};

const Z=H.makeSandbox({}); H.runZaiko(Z.ctx); const OZ=Z.box.OOS_ZAIKO;
const line=(pid,n,cond)=>({productId:pid,bottles:n,boxes:0,boxQty:1,condition:cond||'normal'});
const O=(over)=>Object.assign({id:'x',status:'pending',notified:false,stockDeducted:false,lines:[line(1,1)]},over||{});

/* ── ① ふつうの予約 ─────────────────────────────── */
let m=OZ.reservedByPid([O({id:'a',status:'reserved',lines:[line(2,4)]})],DATA,PRODUCTS);
eq('① 予約の注文が数に入る（MEM500 4本）', m[2], 4);
eq('① 関係ない商品は0', m[1]||0, 0);

/* ── ② RTの予約（rtmOwned）も数に入る ───────────────── */
m=OZ.reservedByPid([O({id:'rt',status:'reserved',rtmOwned:true,rtmKind:'reserved',lines:[line(2,6)]})],DATA,PRODUCTS);
eq('② RTの予約も数に入る（6本）', m[2], 6);

/* ── ③ 在庫が足りなくて待っている注文も数に入る ─────────── */
m=OZ.reservedByPid([O({id:'w',lines:[line(1,3)]})],DATA,PRODUCTS);   // ORG250 は在庫0
eq('③ 在庫待ちの注文も数に入る（ORG250 3本）', m[1], 3);

/* ── ④ 足りている注文は数に入らない ─────────────────── */
m=OZ.reservedByPid([O({id:'ok',lines:[line(2,3)]})],DATA,PRODUCTS);  // MEM500 は10本ある
eq('④ 足りている注文は予約に数えない', m[2]||0, 0);

/* ── ⑤ 対象外の注文は数に入らない ─────────────────── */
[['倉庫へ送信済み',{notified:true}],['在庫を確保ずみ',{stockDeducted:true}],
 ['キャンセル',{status:'cancelled'}],['発注取り消し',{status:'deleted'}],['出荷済み',{status:'shipped'}]]
 .forEach(function(x){
   const mm=OZ.reservedByPid([O(Object.assign({lines:[line(1,5)]},x[1]))],DATA,PRODUCTS);
   eq('⑤ '+x[0]+' は数えない', mm[1]||0, 0);
 });

/* ── ⑥ セット商品は中身に展開して数える ───────────────── */
m=OZ.reservedByPid([O({id:'s',status:'reserved',lines:[line(9,2)]})],DATA,PRODUCTS);
eq('⑥ セット2個 → 中身ORG250が4本', m[1], 4);

/* ── ⑦ 複数の注文が足し合わされる ───────────────────── */
m=OZ.reservedByPid([
  O({id:'a',status:'reserved',lines:[line(1,2)]}),
  O({id:'b',status:'reserved',lines:[line(1,3)]}),
  O({id:'c',lines:[line(1,4)]})                       // 在庫0なので在庫待ち
],DATA,PRODUCTS);
eq('⑦ 2+3+4=9本', m[1], 9);

/* ── ⑧ 不良・旧ロット指定でも「足りない」を見る ─────────── */
const D2={lots:[{pid:2,status:'new',stock:10},{pid:2,status:'old',stock:1}],defects:[],holds:[]};
m=OZ.reservedByPid([O({id:'o1',lines:[Object.assign(line(2,3),{condition:'old'})]})],D2,PRODUCTS);
eq('⑧ 旧ロット1本しかない → 在庫待ちで3本を予約に数える', m[2], 3);
m=OZ.reservedByPid([O({id:'o2',lines:[Object.assign(line(2,1),{condition:'old'})]})],D2,PRODUCTS);
eq('⑧ 旧ロットが足りていれば数えない', m[2]||0, 0);

/* ── ⑨ 統合マスタＮの「予約」の列が、親と同じ数になるか ───── */
const STUB={};
['renderInvTable','renderLotList','renderCatSummary','renderDefectGroups','renderInvLogs','scheduleAutoSave',
 'showSyncStatus','renderReportList','addLog'].forEach(n=>STUB[n]=function(){});
const {box,ctx}=H.makeSandbox(Object.assign({},STUB,{
  PRODUCTS:PRODUCTS, lots:LOTS, defects:DEFECTS, holds:[], preorders:[{pid:1,qty:999}],  // 昔の表は残っていても無視される
  orders:[ O({id:'a',status:'reserved',lines:[line(2,4)]}),
           O({id:'w',lines:[line(1,3)]}),
           O({id:'rt',status:'reserved',rtmOwned:true,lines:[line(1,2)]}) ],
  invLogs:[], idSeq:1, invEditMode:true, setTimeout:function(){ return 0; }, _resCache:null
}));
H.runZaiko(ctx);
['findProduct','findProductBySku','isActiveDefect','reservedByPidCache','computeStockNumbers'].forEach(n=>vm.runInContext(H.cut(msrc,n),ctx));
const oyaMap = OZ.reservedByPid(box.orders, {lots:LOTS,defects:DEFECTS,holds:[]}, PRODUCTS);
eq('⑨ ORG250：統合マスタの予約 = 親の数', box.computeStockNumbers(1).preQty, oyaMap[1]);
eq('⑨ MEM500：統合マスタの予約 = 親の数', box.computeStockNumbers(2).preQty, oyaMap[2]);
eq('⑨ ORG250 は 3+2=5本', box.computeStockNumbers(1).preQty, 5);
eq('⑨ MEM500 は 4本',     box.computeStockNumbers(2).preQty, 4);
eq('⑨ 昔の予約の表（preorders 999本）は もう見ていない', box.computeStockNumbers(1).preQty !== 999, true);

/* ── ⑩ 予約は在庫に効かない（販売可能・実在庫は動かない）───── */
const n2=box.computeStockNumbers(2);
eq('⑩ MEM500 の販売可能は10のまま', n2.cur.sellable, 10);
eq('⑩ MEM500 の実在庫は10のまま',   n2.cur.stock, 10);

console.log('===== 予約の数え方（親＝oos-zaiko.js）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
