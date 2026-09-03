/* 在庫が足りない注文の扱い（2026-08-18 承認済みモック第2版）を、本物の関数で試す。
   本番のデータには触らない。保存もしない。 */
const vm = require('vm');
const fs = require('fs');
const H = require('./harness');
const src = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');

let pass=0, fail=0; const fails=[];
function eq(l,g,w){ if(String(g)===String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

const NAMES=['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
 'lotStockFor','defectStockFor','condAvail','defectBuckets','condValueOfLine','condLabelOfLine','condRemainFor',
 'shortagesNow','orderShortages','isZaikoMachi','isSentButNotDeducted','zaikoMachiQty',
 'deductFromLots','deductFromDefects','deductStockForOrder','restoreStockForOrder',
 'applyStockDeductOnSend','undoStockForOrder','lineTotal','unitOfProduct','lineUnit','convertToShipping','deductNowForOrder'];
let code=''; NAMES.forEach(n=>{ code += H.cut(src,n)+'\n'; });
const STUB={}; const alerts=[];
['renderList','updateSummary','syncOrdersToGAS','showSyncStatus','persistStockDeduct','addLog','esc',
 'scheduleAutoSave','renderSlipSelect','gotoSlip','renderHoldPreLists'].forEach(n=>STUB[n]=function(){ return ''; });

function fresh(){
  const {box,ctx}=H.makeSandbox(Object.assign({},STUB,{
    PRODUCTS:[
      {id:1,sku:'ORG250',name:'オルガニック250ml',boxQty:12},
      {id:2,sku:'MEM500',name:'メメジック500ml',boxQty:12},
      {id:9,sku:'SET-A',name:'ギフトA',isSet:true,components:[{sku:'ORG250',qty:2}]}
    ],
    lots:[
      {id:'O-cur',pid:1,status:'new',expiry:'2027-01',stock:0},     // ORG250 は 0本
      {id:'M-cur',pid:2,status:'new',expiry:'2027-01',stock:10},    // MEM500 は 10本
      {id:'M-old',pid:2,status:'old',expiry:'2026-06',stock:3}
    ],
    defects:[
      {id:'D1',pid:2,qty:2,shippedQty:0,level:'lv1',status:'pending',reviewed:true,lotKind:'cur',processedAt:'2026-08-01'}
    ],
    orders:[], holds:[], idSeq:1,
    alert:function(m){ alerts.push(m); }, confirm:function(){ return true; }
  }));
  H.runZaiko(ctx);
  vm.runInContext(H.cutVar(src,'DEFECT_LEVELS'),ctx);
  vm.runInContext(code,ctx);
  return box;
}
const ord=(over)=>Object.assign({id:'x',num:'BA-1',status:'pending',notified:false,stockDeducted:false,stockLog:[],
  lines:[{productId:1,bottles:1,boxes:0,boxQty:1,condition:'normal'}]},over||{});

/* ── ① 在庫が足りているとき ─────────────────────────── */
let b=fresh();
let o=ord({lines:[{productId:2,bottles:5,boxes:0,boxQty:1,condition:'normal'}]});
b.orders.push(o);
eq('① 足りていれば 在庫待ちではない', b.isZaikoMachi(o), false);
eq('① 足りない行の数 0', b.orderShortages(o).length, 0);

/* ── ② 在庫0のとき ─────────────────────────────── */
b=fresh(); o=ord(); b.orders.push(o);
let sh=b.orderShortages(o);
eq('② 在庫待ちになる', b.isZaikoMachi(o), true);
eq('② 足りない行は1つ', sh.length, 1);
eq('② 商品名', sh[0].name, 'オルガニック250ml');
eq('② 必要', sh[0].need, 1);
eq('② いま', sh[0].have, 0);
eq('② たりない', sh[0].short, 1);
eq('② 予約数に数える本数', b.zaikoMachiQty(o), 1);

/* ── ③ 同じ商品が2行 → 合算して見る ───────────────── */
b=fresh(); o=ord({lines:[
  {productId:2,bottles:6,boxes:0,boxQty:1,condition:'normal'},
  {productId:2,bottles:6,boxes:0,boxQty:1,condition:'normal'}]});
b.orders.push(o);
sh=b.orderShortages(o);
eq('③ 6+6=12本 必要／在庫10本 → 足りない', sh.length, 1);
eq('③ 必要 12', sh[0].need, 12);
eq('③ たりない 2', sh[0].short, 2);

/* ── ④ 旧ロット・不良（程度×ロット）でも見る ─────────── */
b=fresh(); o=ord({lines:[{productId:2,bottles:5,boxes:0,boxQty:1,condition:'old'}]});
b.orders.push(o);
sh=b.orderShortages(o);
eq('④ 旧ロット3本しかない → たりない 2', sh[0].short, 2);
eq('④ 名前に「旧ロット」が出る', sh[0].label, '旧ロット');
b=fresh(); o=ord({lines:[{productId:2,bottles:3,boxes:0,boxQty:1,condition:'defect',defectLevel:'lv1',defectLotKind:'cur'}]});
b.orders.push(o);
sh=b.orderShortages(o);
eq('④ 不良・軽（現）2本しかない → たりない 1', sh[0].short, 1);
eq('④ 名前に程度とロットが出る', sh[0].label, '不良・軽（現ロット）');
b=fresh(); o=ord({lines:[{productId:2,bottles:1,boxes:0,boxQty:1,condition:'defect',defectLevel:'lv3',defectLotKind:'old'}]});
b.orders.push(o);
eq('④ 不良・重（旧）は0本 → 在庫待ち', b.isZaikoMachi(o), true);

/* ── ⑤ セット商品も親に聞いて判定する ───────────────── */
b=fresh(); o=ord({lines:[{productId:9,bottles:1,boxes:0,boxQty:1,condition:'normal'}]});
b.orders.push(o);
eq('⑤ セットの中身(ORG250)が0本 → 在庫待ち', b.isZaikoMachi(o), true);

/* ── ⑥ 対象外の注文には出さない ─────────────────── */
b=fresh();
eq('⑥ 倉庫へ送信済み', b.isZaikoMachi(ord({notified:true})), false);
eq('⑥ すでに在庫を引いてある', b.isZaikoMachi(ord({stockDeducted:true})), false);
eq('⑥ キャンセル', b.isZaikoMachi(ord({status:'cancelled'})), false);
eq('⑥ 発注取り消し', b.isZaikoMachi(ord({status:'deleted'})), false);
eq('⑥ 予約（取り置き・予約タブの本来の予約）', b.isZaikoMachi(ord({status:'reserved'})), false);

/* ── ⑦ 在庫が入れば ひとりでに消える ───────────────── */
b=fresh(); o=ord(); b.orders.push(o);
eq('⑦ 入荷前は在庫待ち', b.isZaikoMachi(o), true);
b.lots[0].stock = 5;
eq('⑦ 入荷したら 在庫待ちでなくなる', b.isZaikoMachi(o), false);
eq('⑦ 保存項目は増やしていない（注文に新しい印が付いていない）',
   Object.keys(o).filter(k=>k.indexOf('zaiko')===0).length, 0);

/* ── ⑧ 出荷依頼書へ：足りないと止まる／足りると通る ───── */
b=fresh();
o=ord({id:'r1',status:'reserved'}); b.orders.push(o);
alerts.length=0;
b.convertToShipping('r1');
eq('⑧ 足りないと 出荷依頼書へ移せない（状態そのまま）', o.status, 'reserved');
eq('⑧ 引いた印も付かない', o.stockDeducted, false);
eq('⑧ 理由を知らせる', alerts.length>0, true);
b.lots[0].stock = 5;
b.convertToShipping('r1');
eq('⑧ 在庫が入れば移せる', o.status, 'pending');
eq('⑧ そのとき在庫が引かれる', o.stockDeducted, true);
eq('⑧ 棚が 5→4', b.lots[0].stock, 4);

/* ── ⑨ 送ったのに引いていない注文を見つける ─────────── */
b=fresh();
eq('⑨ 送信済みで引いていない → 見つける', b.isSentButNotDeducted(ord({notified:true,stockDeducted:false})), true);
eq('⑨ 送信済みで引いてある → 出さない',   b.isSentButNotDeducted(ord({notified:true,stockDeducted:true})), false);
eq('⑨ 未送信 → 出さない',                 b.isSentButNotDeducted(ord({notified:false,stockDeducted:false})), false);
eq('⑨ キャンセル → 出さない',             b.isSentButNotDeducted(ord({notified:true,status:'cancelled'})), false);

/* ── ⑩ あとから「在庫を引く」 ───────────────────── */
b=fresh();
o=ord({id:'s1',notified:true}); b.orders.push(o);
alerts.length=0;
b.deductNowForOrder('s1');
eq('⑩ まだ足りないときは引かない', o.stockDeducted, false);
eq('⑩ 足りないことを知らせる', alerts.length>0, true);
b.lots[0].stock = 3;
b.deductNowForOrder('s1');
eq('⑩ 在庫が入れば引ける', o.stockDeducted, true);
eq('⑩ 棚が 3→2', b.lots[0].stock, 2);
eq('⑩ 赤い注意が消える', b.isSentButNotDeducted(o), false);
b.deductNowForOrder('s1');
eq('⑩ もう一度押しても二重に引かない', b.lots[0].stock, 2);

/* ── ⑪ 「選んだ分をまとめて」も守られているか ─────────────
      ここは convertToShipping を通らない別の道。2026-08-18 に守りを足した。 */
{
  const {box,ctx}=H.makeSandbox(Object.assign({},STUB,{
    PRODUCTS:[{id:1,sku:'ORG250',name:'オルガニック250ml',boxQty:12},
              {id:2,sku:'MEM500',name:'メメジック500ml',boxQty:12}],
    lots:[{id:'O',pid:1,status:'new',expiry:'2027-01',stock:0},
          {id:'M',pid:2,status:'new',expiry:'2027-01',stock:10}],
    defects:[], orders:[], holds:[], idSeq:1,
    alert:function(m){ alerts.push(m); }, confirm:function(){ return true; },
    persistStockDeduct:function(){}, renderSlipSelect:function(){}, gotoSlip:function(){}
  }));
  H.runZaiko(ctx); vm.runInContext(H.cutVar(src,'DEFECT_LEVELS'),ctx); vm.runInContext(code,ctx);
  vm.runInContext(H.cut(src,'convertSelectedHoldToShipping'), ctx);
  const ng={id:'ng',num:'BA-NG',status:'reserved',notified:false,stockDeducted:false,stockLog:[],
    lines:[{productId:1,bottles:1,boxes:0,boxQty:1,condition:'normal'}]};      // 在庫0
  const ok={id:'ok',num:'BA-OK',status:'reserved',notified:false,stockDeducted:false,stockLog:[],
    lines:[{productId:2,bottles:3,boxes:0,boxQty:1,condition:'normal'}]};      // 在庫10
  box.orders.push(ng, ok);
  // 画面の身代わり：2件ともチェックが入っている状態
  box.document = { querySelectorAll:function(){ return [{value:'ng'},{value:'ok'}]; },
                   getElementById:function(){ return null; } };
  alerts.length=0;
  box.convertSelectedHoldToShipping();
  eq('⑪ 在庫0の注文は 出荷の列に入らない', ng.status, 'reserved');
  eq('⑪ 在庫0の注文に「引いた印」が付かない', ng.stockDeducted, false);
  eq('⑪ 足りているほうは進む', ok.status, 'pending');
  eq('⑪ 足りているほうは在庫が引かれる', ok.stockDeducted, true);
  eq('⑪ 棚が 10→7', box.lots[1].stock, 7);
  eq('⑪ 進めなかったことを知らせる', alerts.length>0, true);
}

console.log('===== 在庫が足りない注文の扱い =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
