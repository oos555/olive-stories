/* マスターN 検証プロトコル（master-n-rules の現行シナリオ 1〜16）を
   本番 master.html の本物の関数で流す。 */
const vm = require('vm');
const H = require('./harness');

const src = H.read('master.html');
const NAMES = ['findProduct','findProductBySku','nextId','addLog','isActiveDefect','moveToDiscard',
  'reservedByPidCache','computeStockNumbers','computeAvailable','lotStatusFor','bucketAdjustLots','defectAdjust',
  'discardHave','discardFrom','discardSrcLabel','discBackHave','discBackAll','renderDiscardDst',
  'discBackDstLabel','restoreFromDiscard','setBucketDirect','applyReport','importAllList','doImportAll','doImportAllApply',
  'buildHoldsFromOrders'];

let code = '';
code += H.cutVar(src, 'DISCARD_SRC') + '\n';
code += H.cutVar(src, 'DISC_BACK_DST') + '\n';
code += H.cutVar(src, 'discPan') + '\n';
NAMES.forEach(n => { code += H.cut(src, n) + '\n'; });

const stubs = {};
['renderInvTable','renderLotList','renderCatSummary','renderDefectGroups','renderInvLogs',
 'scheduleAutoSave','showSyncStatus','renderReportList','showImportUndoToast','refreshRestockBtn',
 'discPanUp','renderDiscardSrc','discApplyMode','saveOneProduct','syncToGAS','closeImportAllPanel']
 .forEach(n => { stubs[n] = function(){}; });

const { box, ctx } = H.makeSandbox(Object.assign(stubs, {
  lots: [], defects: [], holds: [], preorders: [], PRODUCTS: [], logs: [], invLogs: [],
  orders: [], customers: [], _resCache: null, idSeq: 1, invEditMode: true, lastImportAll: null, warnings: []
}));
H.runZaiko(ctx);
vm.runInContext(code, ctx);

/* ── テストの土台 ───────────────────────────────── */
let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(got === want){ pass++; }
  else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}
function reset(){
  box.PRODUCTS = [{ id:1, sku:'ORG100', name:'オルガニック100ml', boxQty:12 }];
  box.idSeq = 1;
  box.lots = [
    { id:'a', pid:1, lotCode:'A', expiry:'2027-01', stock:45, status:'new' },
    { id:'b', pid:1, lotCode:'B', expiry:'2026-01', stock:38, status:'old' },
    { id:'c', pid:1, lotCode:'-', expiry:'',        stock:1,  status:'hold_old' }
  ];
  box.defects = [
    { id:'d1', pid:1, level:'lv1', qty:2, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'cur', reportedAt:'2026-08-01' },
    { id:'d2', pid:1, level:'lv1', qty:1, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'old', reportedAt:'2026-08-01' }
  ];
  box.holds = [{ pid:1, qty:10 }];
  box.preorders = [];
  box.orders = [];        /* ★2026-08-18 予約は受注Ａの注文から数えるようになった */
  box._resCache = null;
}
/* 予約の数え直し（テストの中では setTimeout が動かないので、手で捨てる） */
const N = () => { box._resCache = null; return box.computeStockNumbers(1); };

/* ── 1. 基準の数 ───────────────────────────────── */
reset();
let n = N();
eq('1 現ロット 販売可能', n.cur.sellable, 35);
eq('1 現ロット 実在庫',   n.cur.stock,    47);
eq('1 旧ロット 販売可能', n.old.sellable, 38);
eq('1 旧ロット 実在庫',   n.old.stock,    40);
eq('1 合計 販売可能',     n.cur.sellable + n.old.sellable, 73);
eq('1 合計 実在庫',       n.stock,        87);

/* ── 2. 受注Aの取り置きを 0→10（今回の核心）───────── */
reset(); box.holds = [];
n = N(); eq('2 取置0のとき 販売可能', n.cur.sellable, 45); eq('2 取置0のとき 実在庫', n.cur.stock, 47);
box.holds = [{ pid:1, qty:10 }];
n = N(); eq('2 取置10のとき 販売可能', n.cur.sellable, 35); eq('2 取置10のとき 実在庫（変わらない）', n.cur.stock, 47);

/* ── 3. 旧ロットの不良報告（緑3本）を反映 ───────────── */
reset();
box.defects.push({ id:'r1', pid:1, level:'lv2', seal:'緑', qty:3, shippedQty:0, status:'open', source:'warehouse', reviewed:false, reportedAt:'2026-08-18' });
box.applyReport('r1', 'old');
n = N();
eq('3 旧 販売可能 38→35', n.old.sellable, 35);
eq('3 旧 不良 1→4',       n.old.defectQty, 4);
eq('3 旧 実在庫 40のまま', n.old.stock,    40);
eq('3 現 販売可能 不変',   n.cur.sellable, 35);
eq('3 現 実在庫 不変',     n.cur.stock,    47);

/* ── 4. 黒（廃棄）2本を反映 ───────────────────────── */
reset();
box.defects.push({ id:'r2', pid:1, level:'discard', seal:'黒', qty:2, shippedQty:0, status:'open', source:'warehouse', reviewed:false, discardSrc:'good', reportedAt:'2026-08-18' });
box.applyReport('r2', 'cur');
n = N();
eq('4 現 販売可能 35→33', n.cur.sellable, 33);
eq('4 現 実在庫 47→45',   n.cur.stock,    45);
eq('4 現 廃棄 2',         n.cur.discardQty, 2);

/* ── 5. 青（貼り替えればOK）を反映 → どの数字も動かない ── */
reset();
const before5 = JSON.stringify(N());
box.defects.push({ id:'r3', pid:1, level:'relabel', seal:'青', qty:5, shippedQty:0, status:'open', source:'warehouse', reviewed:false, reportedAt:'2026-08-18' });
box.applyReport('r3', 'cur');
eq('5 青は数字が動かない', JSON.stringify(N()), before5);

/* ── 7. 直接編集（良品から回す移動）──────────────────── */
reset();
box.setBucketDirect(1, 'old', 'lv1', 4);
n = N();
eq('7 旧 不良 1→4',        n.old.defectQty, 4);
eq('7 旧 販売可能 38→35',  n.old.sellable,  35);
eq('7 旧 実在庫 40のまま',  n.old.stock,     40);
box.setBucketDirect(1, 'old', 'lv1', 1);          // 打つ前の 1 に戻す
n = N();
eq('7 1に戻すと 旧 販売可能 38（復帰）', n.old.sellable, 38);
eq('7 1に戻すと 旧 実在庫 40（不変）',   n.old.stock,    40);
box.setBucketDirect(1, 'old', 'lv1', 0);          // さらに 0 にすると、元からあった1本も良品に戻る
n = N();
eq('7 0にすると 旧 販売可能 39', n.old.sellable, 39);
eq('7 0にすると 旧 実在庫 40（不変＝ルール通り）', n.old.stock, 40);

reset();
box.setBucketDirect(1, 'cur', 'lv2', 999);   // 棚の良品45を超える指定
n = N();
eq('7 棚を超える不良指定はブロック', n.cur.defMid, 0);
reset();
box.setBucketDirect(1, 'cur', 'hold', 999);
n = N();
eq('7 棚を超える取置指定はブロック', n.cur.manualHold, 0);

reset();
box.setBucketDirect(1, 'cur', 'hold', 5);
n = N();
eq('7 取置(手入力)5 → 販売可能 30', n.cur.sellable, 30);
eq('7 取置(手入力)5 → 実在庫 47のまま', n.cur.stock, 47);

/* ── 8. 同じ数を打ち直しても増えない（置き換え）────────── */
reset();
box.setBucketDirect(1, 'cur', 'lv1', 5);
box.setBucketDirect(1, 'cur', 'lv1', 5);
box.setBucketDirect(1, 'cur', 'lv1', 5);
n = N();
eq('8 同じ数を3回打っても 不良軽=5', n.cur.defLight, 5);
eq('8 同じ数を3回打っても 実在庫47', n.cur.stock, 47);

/* ── 9. 廃棄の出どころ ────────────────────────────── */
reset();
box.discardFrom(1, 'cur', 'good', 2);
n = N();
eq('9 良品から廃棄2 → 販売可能 33', n.cur.sellable, 33);
eq('9 良品から廃棄2 → 実在庫 45',   n.cur.stock,    45);
reset();
box.discardFrom(1, 'cur', 'lv1', 1);
n = N();
eq('9 不良軽から廃棄1 → 販売可能 35（動かない）', n.cur.sellable, 35);
eq('9 不良軽から廃棄1 → 実在庫 46',              n.cur.stock,    46);
eq('9 不良軽から廃棄1 → 不良軽 1',               n.cur.defLight, 1);

/* ── 10. 旧ロットから廃棄 → 現ロットは動かない ───────── */
reset();
box.discardFrom(1, 'old', 'good', 3);
n = N();
eq('10 旧 販売可能 35', n.old.sellable, 35);
eq('10 旧 実在庫 37',   n.old.stock,    37);
eq('10 現 販売可能 35（不変）', n.cur.sellable, 35);
eq('10 現 実在庫 47（不変）',   n.cur.stock,    47);

/* ── 11. 残りを超える廃棄指定 ─────────────────────── */
reset();
eq('11 不良軽(2本)から99本 → 2本だけ', box.discardFrom(1, 'cur', 'lv1', 99), 2);
reset();
eq('11 0本の出どころ(不良重)から1本 → 0本', box.discardFrom(1, 'cur', 'lv3', 1), 0);

/* ── 13-2. 廃棄から戻す ──────────────────────────── */
reset();
box.discardFrom(1, 'cur', 'good', 5);        // まず廃棄を5本つくる
let base = N();
box.restoreFromDiscard(1, 'cur', 'good', 2);
n = N();
eq('13-2 良品へ2本戻す → 販売可能 +2', n.cur.sellable, base.cur.sellable + 2);
eq('13-2 良品へ2本戻す → 実在庫 +2',   n.cur.stock,    base.cur.stock + 2);
eq('13-2 良品へ2本戻す → 廃棄 −2',     n.cur.discardQty, base.cur.discardQty - 2);
base = N();
box.restoreFromDiscard(1, 'cur', 'lv1', 1);
n = N();
eq('13-2 不良軽へ1本戻す → 販売可能そのまま', n.cur.sellable, base.cur.sellable);
eq('13-2 不良軽へ1本戻す → 実在庫 +1',        n.cur.stock,    base.cur.stock + 1);
eq('13-2 不良軽へ1本戻す → 不良軽 +1',        n.cur.defLight, base.cur.defLight + 1);
eq('13-2 不良軽へ1本戻す → 廃棄 −1',          n.cur.discardQty, base.cur.discardQty - 1);
const rest13 = N().cur.discardQty;                                    // いま廃棄に残っている本数
eq('13-2 廃棄の残りを超える指定は残り分だけ', box.restoreFromDiscard(1, 'cur', 'good', 999), rest13);
eq('13-2 そのあと廃棄は0', N().cur.discardQty, 0);
reset();
eq('13-2 廃棄0本のときは何も起きない', box.restoreFromDiscard(1, 'cur', 'good', 3), 0);
reset();
box.discardFrom(1, 'old', 'good', 4);
base = N();
box.restoreFromDiscard(1, 'old', 'good', 4);
n = N();
eq('13-2 旧から戻すと旧だけ動く（旧 販売可能）', n.old.sellable, base.old.sellable + 4);
eq('13-2 旧から戻すと現は不変（現 実在庫）',     n.cur.stock,    base.cur.stock);

/* ── 13-3. ⤴ 全部もどして0にする ────────────────── */
reset();
box.discardFrom(1, 'cur', 'good', 5);
box.discPan = { pid:1, lotKind:'cur', src:'', mode:'back', dst:'' };
box.discBackAll();
eq('13-3 押すと戻し先に「棚の良品」が入る', box.discPan.dst, 'good');
eq('13-3 廃棄の残り', box.discBackHave(), 5);
base = N();
box.restoreFromDiscard(1, 'cur', box.discPan.dst, box.discBackHave());
n = N();
eq('13-3 実行後 廃棄 0',        n.cur.discardQty, 0);
eq('13-3 実行後 販売可能 +5',   n.cur.sellable, base.cur.sellable + 5);
eq('13-3 実行後 実在庫 +5',     n.cur.stock,    base.cur.stock + 5);
reset();
box.discPan = { pid:1, lotKind:'cur', src:'', mode:'back', dst:'' };
box.discBackAll();
eq('13-3 廃棄0本のときは戻し先が入らない', box.discPan.dst, '');
eq('13-3 廃棄0本のときは何も動かない',    N().cur.stock, 47);

/* ── ★輸入予定を在庫に入れる（倍にならないこと）───────── */
reset();
box.lots.push({ id:'inc', pid:1, lotCode:'-', expiry:'', stock:24, status:'incoming' });
box.lots.push({ id:'dsc', pid:1, lotCode:'-', expiry:'', stock:3,  status:'discard' });
/* ★2026-08-18 予約は「受注Ａの予約の注文」から数える（前は preorders という別の表だった） */
box.orders = [{ id:'pre1', status:'reserved', notified:false, stockDeducted:false,
  lines:[{ productId:1, bottles:6, boxes:0, boxQty:1, condition:'normal' }] }];
box._resCache = null;
n = N();
eq('輸入 前 棚の良品 45',  n.cur.avail,    45);
eq('輸入 前 販売可能 35',  n.cur.sellable, 35);
eq('輸入 前 取り置き 10',  n.cur.holdQty,  10);
eq('輸入 前 実在庫 47',    n.cur.stock,    47);
eq('輸入 前 輸入予定 24',  n.incoming,     24);
const li = box.importAllList();
eq('輸入 一覧 フリー 18', li[0].free, 18);
eq('輸入 一覧 予約 6',    li[0].pre,  6);
/* ★2026-08-20 二重よけ（最新の読み直し）が入ったので、在庫を動かす本体を直接呼ぶ。
   読み直しは通信なのでテストでは動かせない。見張りが消えていないかは下で別に確かめる。 */
box.doImportAllApply(box.importAllList());
n = N();
eq('輸入 後 棚の良品 63',           n.cur.avail,    63);
eq('輸入 後 販売可能 53',           n.cur.sellable, 53);
eq('輸入 後 取り置き 16',           n.cur.holdQty,  16);
eq('★輸入 後 実在庫 71（95なら二重加算）', n.cur.stock, 71);
eq('輸入 後 輸入予定 0',            n.incoming,     0);
eq('輸入 後 廃棄 3（動かない）',     n.cur.discardQty, 3);
eq('輸入 後 不良 2（動かない）',     n.cur.defectQty,  2);

/* ── 15. 親を変えたら追随するか（取置10→20）───────── */
reset();
box.lots = [{ id:'a', pid:1, lotCode:'A', expiry:'2027-01', stock:45, status:'new' }];
box.defects = []; box.holds = [{ pid:1, qty:10 }];
eq('15 取置10 → 販売可能 35', box.computeAvailable('ORG100'), 35);
box.holds = [{ pid:1, qty:20 }];
eq('15 取置20 → 販売可能 25', box.computeAvailable('ORG100'), 25);

/* ── 販売可能はマイナスにならない ─────────────────── */
box.holds = [{ pid:1, qty:999 }];
eq('取置が在庫より多くても 販売可能 0', box.computeAvailable('ORG100'), 0);

/* ── 結果 ─────────────────────────────────────── */
console.log('===== マスターN 数字テスト =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
