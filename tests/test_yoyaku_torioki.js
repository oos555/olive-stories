/* 「一気に在庫へ入れる」を押したとき、全部そろった予約が取り置きに変わるか。
   2026-08-18 ひろみさん確定。承認済みモック mocks/mock_master_yoyaku_to_torioki_2026-08-18.html
   ・「このボタンがきっかけとなって一緒に変わっていけばいい。二つも三つもボタンを増やす必要ないんじゃない?」
   ・「注文分けると管理番号も変わるし、ばらばらに届くと問い合わせが来ちゃう」→ 注文は分けない
   ・受注Ａには知らせるだけの青い帯（押すボタンは付けない）
   本番のファイルから本物の関数を切り出して動かす。本番のデータには一切書き込まない。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const src = H.read('master.html');
const idx = H.read('index.html');

let pass = 0, fail = 0; const fails = [];
function eq(l, got, want){ if(String(got) === String(want)) pass++; else { fail++; fails.push(`${l}  期待:${want}  実際:${got}`); } }
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

/* ══════ 統合マスタＮ側 ══════ */
const NAMES = ['findProduct','findProductBySku','nextId','addLog','isActiveDefect',
  'reservedByPidCache','computeStockNumbers','computeAvailable','lotStatusFor','bucketAdjustLots',
  'importAllList','doImportAll','undoImportAll','undoImportConv','buildHoldsFromOrders',
  'impSimLots','impPreLeft','impReservedOrders','impHoldsWith','impNeedsOf',
  'impConvertPlan','impApplyConvert','impOrderWho','impOrderLines'];

let code = '';
NAMES.forEach(function(n){
  try{ code += H.cut(src, n) + '\n'; }
  catch(e){ fail++; fails.push('★ 関数が消えています（統合マスタ）: ' + n); }
});

const savedItems = [];      /* GASへ送ったはずの中身をここに受ける（本番には送らない） */
const stubs = {};
['renderInvTable','renderLotList','renderCatSummary','renderDefectGroups','renderInvLogs',
 'scheduleAutoSave','showSyncStatus','showImportUndoToast','refreshRestockBtn',
 'closeImportAllPanel','renderImportConvPanel','saveOneProduct','syncToGAS']
 .forEach(function(n){ stubs[n] = function(){}; });
stubs.impSaveOrderStatus = function(items){ savedItems.push(items); };
stubs.esc = function(s){ return String(s == null ? '' : s); };

const { box, ctx } = H.makeSandbox(Object.assign(stubs, {
  lots: [], defects: [], holds: [], preorders: [], PRODUCTS: [], logs: [], invLogs: [],
  orders: [], customers: [], _resCache: null, idSeq: 1, invEditMode: true,
  lastImportAll: null, lastImportConv: [], warnings: [], GAS_URL: 'about:blank'
}));
H.runZaiko(ctx);
try{ vm.runInContext(code, ctx); }catch(e){ fail++; fails.push('★ 統合マスタの関数が動きません: ' + e.message); }

/* モックと同じ場面をつくる
   オルガニック250ml：棚の良品100／輸入予定100（予約80・フリー20）
   予約は 田中様60本 と 佐藤様（オルガニック20本＋プリモ500ml 12本） */
function setup(){
  box.PRODUCTS = [
    { id:1, sku:'ORG250', name:'オルガニック 250ml', boxQty:20 },
    { id:2, sku:'PRI500', name:'プリモ 500ml',      boxQty:6  }
  ];
  box.idSeq = 1;
  box.lots = [
    { id:'L1', pid:1, lotCode:'A', expiry:'2027-01', stock:100, status:'new' },
    { id:'L2', pid:1, lotCode:'-', expiry:'',        stock:100, status:'incoming' }
  ];
  box.defects = [];
  box.orders = [
    { id:'O-tanaka', num:'TK-1', recipientName:'田中 花子', status:'reserved', expectedDate:'2026-08-25',
      lines:[{ productId:1, productName:'オルガニック 250ml', bottles:60, boxes:0, boxQty:20 }] },
    { id:'O-sato', num:'TK-2', recipientName:'佐藤 美咲', status:'reserved', expectedDate:'2026-09-01',
      lines:[{ productId:1, productName:'オルガニック 250ml', bottles:20, boxes:0, boxQty:20 },
             { productId:2, productName:'プリモ 500ml',      bottles:12, boxes:0, boxQty:6  }] }
  ];
  box._resCache = null;
  box.holds = box.buildHoldsFromOrders();
  box.lastImportAll = null; box.lastImportConv = [];
  savedItems.length = 0;
}
function n1(){ box._resCache = null; return box.computeStockNumbers(1); }

/* ── ① 押す前の数字（モックの「押す前」の行） ─────────────── */
setup();
let a = n1();
eq('①押す前 棚の良品',   a.cur.avail,   100);
eq('①押す前 販売可能数', a.cur.sellable, 100);
eq('①押す前 実在庫',     a.stock,        100);
eq('①押す前 取置',       a.cur.holdQty,  0);
eq('①押す前 輸入予定',   a.incoming,     100);
eq('①押す前 予約',       a.preQty,       80);

/* ── ② 誰が取り置きになるか（在庫は1本も動かさない） ────────── */
setup();
const plan = box.impConvertPlan();
eq('②取り置きに変わる件数', plan.go.length,   1);
eq('②予約のまま残る件数',   plan.stay.length, 1);
eq('②取り置きになるのは田中様', (plan.go[0]||{}).o && plan.go[0].o.id, 'O-tanaka');
eq('②予約のまま残るのは佐藤様', (plan.stay[0]||{}).o && plan.stay[0].o.id, 'O-sato');
eq('②佐藤様が残る理由の商品', ((plan.stay[0]||{}).short||[{}])[0].sku, 'PRI500');
eq('②佐藤様のたりない本数',   ((plan.stay[0]||{}).short||[{}])[0].short, 12);
eq('②田中様は よけた箱から60本 引っ越す', (plan.go[0].moves[0]||{}).qty, 60);
/* ★下見をしただけで在庫が動いていないこと */
let b = n1();
eq('②下見だけでは棚の良品が動かない', b.cur.avail,  100);
eq('②下見だけでは輸入予定が動かない', b.incoming,   100);
eq('②下見だけでは予約が動かない',     b.preQty,     80);

/* ── ③ 押したあとの数字（モックの「押したあと」の行） ────────── */
setup();
box.doImportAll();
let c = n1();
eq('③押したあと 棚の良品',   c.cur.avail,    180);
eq('③押したあと 販売可能数', c.cur.sellable, 120);
eq('③押したあと 実在庫',     c.stock,        200);
eq('③押したあと 取置',       c.cur.holdQty,  80);
eq('③押したあと 輸入予定',   c.incoming,     0);
eq('③押したあと 予約',       c.preQty,       20);
eq('③田中様は取り置きになった', box.orders[0].status, 'held');
eq('③田中様の送る目安は入荷予定日', box.orders[0].holdUntilDate, '2026-08-25');
eq('③佐藤様は予約のまま',       box.orders[1].status, 'reserved');
/* ★2026-08-17に決めた動きと数字が同じであること */
eq('③販売可能はフリーの20だけ増える', c.cur.sellable - 100, 20);
eq('③実在庫は予定の100だけ増える',   c.stock - 100,        100);
eq('③取置は予約の80',                 c.cur.holdQty,        80);
/* ★取置の中身：田中様の取り置き60（注文にひもづく）＋ よけた箱20（佐藤様待ち） */
eq('③取置のうち 注文にひもづく分', c.cur.autoHold,   60);
eq('③取置のうち よけた箱',         c.cur.manualHold, 20);

/* ── ④ GASへ送るのは「その注文だけ」 ──────────────────── */
eq('④送ったのは1件だけ', (savedItems[0]||[]).length, 1);
eq('④送った注文のID',    ((savedItems[0]||[])[0]||{}).id, 'O-tanaka');
eq('④送った状態',        ((savedItems[0]||[])[0]||{}).status, 'held');
eq('④送った送る目安',    ((savedItems[0]||[])[0]||{}).holdUntilDate, '2026-08-25');
ok('④★統合マスタは saveOrders（全消し）を呼ばない', src.indexOf("action:'saveOrders'") < 0 && src.indexOf('action: \'saveOrders\'') < 0);
ok('④その行だけ書き換える入り口を使っている', src.indexOf("action:'setOrderStatusOnly'") >= 0);

/* ── ⑤ 取り消すと、在庫も札も元どおり ───────────────────── */
box.undoImportAll();
let d = n1();
eq('⑤取り消し後 棚の良品',   d.cur.avail,    100);
eq('⑤取り消し後 販売可能数', d.cur.sellable, 100);
eq('⑤取り消し後 実在庫',     d.stock,        100);
eq('⑤取り消し後 取置',       d.cur.holdQty,  0);
eq('⑤取り消し後 輸入予定',   d.incoming,     100);
eq('⑤取り消し後 予約',       d.preQty,       80);
eq('⑤田中様は予約に戻る',    box.orders[0].status, 'reserved');

/* ── ⑥ 注文は分けない（一部だけ足りても丸ごと予約のまま） ────── */
setup();
box.orders = [ box.orders[1] ];   /* 佐藤様だけ */
box._resCache = null; box.holds = box.buildHoldsFromOrders();
const plan6 = box.impConvertPlan();
eq('⑥一部だけ足りない注文は取り置きにしない', plan6.go.length,   0);
eq('⑥まるごと予約のまま',                     plan6.stay.length, 1);

/* ── ⑦ 在庫が1件分しかないときは、1件だけ変える（二重に押さえない） ── */
setup();
box.lots = [
  { id:'L1', pid:1, lotCode:'A', expiry:'2027-01', stock:0, status:'new' },
  { id:'L2', pid:1, lotCode:'-', expiry:'',        stock:60, status:'incoming' }
];
box.orders = [
  { id:'O-a', num:'TK-1', recipientName:'あ', status:'reserved',
    lines:[{ productId:1, productName:'オルガニック 250ml', bottles:60, boxes:0, boxQty:20 }] },
  { id:'O-b', num:'TK-2', recipientName:'い', status:'reserved',
    lines:[{ productId:1, productName:'オルガニック 250ml', bottles:60, boxes:0, boxQty:20 }] }
];
box._resCache = null; box.holds = box.buildHoldsFromOrders();
const plan7 = box.impConvertPlan();
eq('⑦在庫が60本しかないので取り置きは1件だけ', plan7.go.length,   1);
eq('⑦もう1件は予約のまま',                     plan7.stay.length, 1);
eq('⑦先に入った注文が優先',                    plan7.go[0].o.id,  'O-a');

/* ══════ 受注Ａ側（知らせるだけの青い帯） ══════ */
const INAMES = ['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
  'lotStockFor','defectStockFor','condAvail','defectBuckets','condValueOfLine','condLabelOfLine','condRemainFor',
  'shortagesNow','lineTotal','yoyakuArrivedList','renderYoyakuArrivedBar'];
let icode = '';
INAMES.forEach(function(n){
  try{ icode += H.cut(idx, n) + '\n'; }
  catch(e){ fail++; fails.push('★ 関数が消えています（受注Ａ）: ' + n); }
});
function juchuBox(lots, orders, loaded){
  const r = H.makeSandbox({
    PRODUCTS: [{ id:1, sku:'ORG250', name:'オルガニック 250ml', boxQty:20 }],
    lots: lots, defects: [], holds: [], orders: orders,
    ordersLoaded: (loaded === undefined ? true : loaded),
    esc: function(s){ return String(s == null ? '' : s); }
  });
  H.runZaiko(r.ctx);
  try{ vm.runInContext(H.cutVar(idx, 'DEFECT_LEVELS'), r.ctx); }catch(e){}
  vm.runInContext(icode, r.ctx);
  return r.box;
}
const resOrder = { id:'X1', num:'TK-9', status:'reserved',
  lines:[{ productId:1, productName:'オルガニック 250ml', bottles:10, boxes:0, boxQty:20 }] };

let jb = juchuBox([{ id:'a', pid:1, status:'new', stock:100 }], [resOrder]);
eq('⑧在庫がそろっていれば1件と数える', jb.yoyakuArrivedList([resOrder]).length, 1);
ok('⑧青い帯が出る', jb.renderYoyakuArrivedBar([resOrder]).indexOf('入荷ずみの予約が 1件 あります') >= 0);
ok('⑧★押すボタンは付けない', jb.renderYoyakuArrivedBar([resOrder]).indexOf('<button') < 0);

jb = juchuBox([{ id:'a', pid:1, status:'new', stock:0 }], [resOrder]);
eq('⑧在庫が無ければ数えない', jb.yoyakuArrivedList([resOrder]).length, 0);
eq('⑧そのときは帯を出さない', jb.renderYoyakuArrivedBar([resOrder]), '');

jb = juchuBox([{ id:'a', pid:1, status:'new', stock:100 }], [resOrder], false);
eq('⑧読み込み中は数えない（「ありません」と言わない）', jb.yoyakuArrivedList([resOrder]).length, 0);

const heldOrder = { id:'X2', num:'TK-8', status:'held',
  lines:[{ productId:1, productName:'オルガニック 250ml', bottles:10, boxes:0, boxQty:20 }] };
jb = juchuBox([{ id:'a', pid:1, status:'new', stock:100 }], [heldOrder]);
eq('⑧すでに取り置きの注文は数えない', jb.yoyakuArrivedList([heldOrder]).length, 0);

/* ══════ ⑨ 画面の決めごと（消えたら気づけるように） ══════ */
ok('⑨確認パネルに予約の枠がある',      src.indexOf('imp-conv') >= 0);
ok('⑨「あわせて…取り置きに変わります」', src.indexOf('あわせて、この予約が「取り置き」に変わります') >= 0);
ok('⑨「予約のまま」の書き方',           src.indexOf('⏸ 予約のまま') >= 0);
ok('⑨ボタンは増やしていない（押す口は1つ）',
   (src.match(/onclick="doImportAll\(\)"/g) || []).length === 1);
ok('⑨受注Ａの帯の文言', idx.indexOf('入荷ずみの予約が') >= 0);
ok('⑨承認済みモックがある',
   fs.existsSync(path.join(__dirname, '..', 'mocks', 'mock_master_yoyaku_to_torioki_2026-08-18.html')));

/* ══════ ⑨-2 名簿の「種類」（2026-08-18 ひろみさん指示） ══════
   オイル以外の【売り物】（ザクロソースなど）を登録できる種類。
   「その他の備品」は備品なので、売り物とは別。★消さないでください */
ok('⑨-2 その他オイル以外の商品がある', src.indexOf("{ code:'ETC',  label:'🍯 その他オイル以外の商品' }") >= 0);
ok('⑨-2 オイルのすぐ下にある',
   src.indexOf("label:'🫒 オイル'") < src.indexOf("label:'🍯 その他オイル以外の商品'") &&
   src.indexOf("label:'🍯 その他オイル以外の商品'") < src.indexOf("label:'📦 箱・ギフトボックス'"));
ok('⑨-2 いままでの4つも残っている',
   src.indexOf("label:'🫒 オイル'") >= 0 && src.indexOf("label:'📦 箱・ギフトボックス'") >= 0 &&
   src.indexOf("label:'🛍 紙袋'") >= 0 && src.indexOf("label:'🧰 その他の備品'") >= 0);

/* ══════ ⑨-3 容器のルール（2026-08-18 ひろみさん確認） ══════
   ★容器は農園ごとに違う。ひろみさん「これはトルコ産においては、です。
     それぞれの農園によって違います」→ 分からない農園に勝手なルールを当てない。
   トルコ産：100〜500ml＝遮光瓶／750ml＝デザイン缶／2L＝デザイン缶／5L＝缶
   イタリアの3L：プリモ・アグリ・アルモニア とも【缶】（bag in box はやめた） */
(function(){
  var ccode = '';
  ['containerVolumeMl','containerFor','originOf','meiboFieldOf'].forEach(function(n){
    try{ ccode += H.cut(src, n) + '\n'; }catch(e){ fail++; fails.push('★ 関数が消えています: ' + n); }
  });
  var spec = { ORG100:{origin:'トルコ'}, ORG250:{origin:'トルコ'}, ORG500:{origin:'トルコ'},
               ORG750:{origin:'トルコ'}, ORG2L:{origin:'トルコ'},  ORG5L:{origin:'トルコ'},
               MEM750:{origin:'トルコ'}, MEM2L:{origin:'トルコ'},
               PRI250:{origin:'イタリア'}, PRI3L:{origin:'イタリア'},
               AGR3L:{origin:'イタリア'},  ARM3L:{origin:'イタリア'},
               ARM500:{origin:'イタリア'}, CAS5L:{origin:'イタリア'} };
  var r = H.makeSandbox({ PRODUCT_SPEC:spec, mIsSet:function(){ return false; } });
  r.box.window.PRODUCT_SPEC = spec;
  try{ vm.runInContext(ccode, r.ctx); }catch(e){ fail++; fails.push('★ 容器のルールが動きません: ' + e.message); }
  /* 容器の欄に生産地が紛れ込んでいる状態から、直すと何になるか */
  function cont(sku, group){
    var o = spec[sku].origin;
    return r.box.containerFor({ sku:sku, group:group, container:o });
  }
  eq('⑨-3 トルコ 100ml',  cont('ORG100','オルガニック'), '遮光瓶');
  eq('⑨-3 トルコ 250ml',  cont('ORG250','オルガニック'), '遮光瓶');
  eq('⑨-3 トルコ 500ml',  cont('ORG500','オルガニック'), '遮光瓶');
  eq('⑨-3 トルコ 750ml',  cont('ORG750','オルガニック'), 'デザイン缶');
  eq('⑨-3 トルコ 2L',     cont('ORG2L','オルガニック'),  'デザイン缶');
  eq('⑨-3 トルコ 5L',     cont('ORG5L','オルガニック'),  '缶');
  eq('⑨-3 メメジック 750ml', cont('MEM750','メメジック'), 'デザイン缶');
  eq('⑨-3 メメジック 2L',    cont('MEM2L','メメジック'),  'デザイン缶');
  eq('⑨-3 プリモ 3L',   cont('PRI3L','プリモ'),     '缶');
  eq('⑨-3 アグリ 3L',   cont('AGR3L','アグリ'),     '缶');
  eq('⑨-3 ★アルモニア 3L（bag in box はやめた）', cont('ARM3L','アルモニア'), '缶');
  ok('⑨-3 ★コードから bag in box が消えている', src.indexOf("return 'bag in box'") < 0);
  /* ★人が手で入れた容器は書き換えない（生産地と同じときだけ「混入」とみなす） */
  eq('⑨-3 手で入れた容器はそのまま',
     r.box.containerFor({ sku:'ORG750', group:'オルガニック', container:'特別な缶' }), '特別な缶');
  eq('⑨-3 ザクロソースの遮光瓶もそのまま',
     r.box.containerFor({ sku:'ETC-001', group:'その他', container:'遮光瓶' }), '遮光瓶');
})();
ok('⑨-3 容器を直すとき、空の生産地も戻す', src.indexOf('origin: (p.origin || originOf(p) ||') >= 0);

/* ══════ ⑩ GAS側（手元にあるときだけ） ══════ */
const gasPath = path.join(__dirname, '..', '..', 'olive-stories-gas', 'コード.js');
if(fs.existsSync(gasPath)){
  const gas = fs.readFileSync(gasPath, 'utf8');
  ok('⑩setOrderStatusOnly がある', gas.indexOf('function setOrderStatusOnly') >= 0);
  ok('⑩doPost につながっている',   gas.indexOf("action === 'setOrderStatusOnly'") >= 0);
  const fn = gas.slice(gas.indexOf('function setOrderStatusOnly'));
  const body = fn.slice(0, fn.indexOf('\n}') + 2);
  ok('⑩★シートを全部消していない', body.indexOf('clearContents') < 0);
  ok('⑩書き換えるのはステータス列だけ', body.indexOf('COL_STATUS') >= 0);
  ok('⑩★公開ファイルにパスワードを書かせない形', body.indexOf('COST_DATA_PASSWORD') < 0);
} else {
  console.log('（GASのファイルが手元にないので ⑩ は飛ばしました）');
}

/* ── 結果 ─────────────────────────────────────── */
console.log('\n予約→取り置き  PASS ' + pass + ' / FAIL ' + fail);
if(fails.length){ console.log('\n--- 直すところ ---'); fails.forEach(function(f){ console.log('  ★ ' + f); }); }
process.exit(fail ? 1 : 0);
