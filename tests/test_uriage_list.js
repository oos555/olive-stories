/* 売上Ｃ「売上一覧に載せるタイミング」の見張り（2026-08-19 ひろみさん決定）

   決めたこと：売上一覧に出るのは【倉庫Ｄへ出荷依頼書を送った注文】だけ。
   取り置き・予約・まだ送っていない・🗑発注から消した・キャンセルは出さない。
   出荷済みは、送った印が無い古い注文でも必ず出す（過去の売上が消えないように）。
   二重登録のうたがいは、一覧に出す・出さないと関係なく注文ぜんぶを見る。

   きっかけ：消したはずのEC営業課と、室伏様の二重登録が売上一覧に残っていて、
   「間違って請求しかねない」（ひろみさん 2026-08-19）。
   承認済みモック：mock_売上C_売上一覧_2026-08-19.html

   本番 billing.html の本物の関数をそのまま切り出して動かす。保存は一切しない。 */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname, '..', 'billing.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }
function inc(l, text, needle, want){ eq(l, text.indexOf(needle) >= 0, want); }

const VARS  = ['DEFAULT_PRICES', 'SALES_HIDE_INFO', 'SALES_DUP_BADGE', 'SALES_TH', 'SALES_TD'];
const NAMES = ['findProduct', 'findProductBySku', 'defaultTaxRateForGroup', 'effectiveCustomerType',
  'lineTierType', 'priceForSku', 'taxRateForSku', 'orderAmount',
  'salesWasSentToWarehouse', 'salesExcludeReason', 'isSalesListTarget',
  'isRtOrder', 'rtSlipNoOf', 'salesDupKey', 'findSalesDuplicates', 'salesDupIds',
  'renderSalesDupAlert', 'renderSalesHiddenList'];
let code = '';
VARS.forEach(n => { code += H.cutVar(src, n) + '\n'; });
NAMES.forEach(n => { code += H.cut(src, n) + '\n'; });
/* esc は中に正規表現 /"/g があり共通の切り出し器が使えないので、その1行を丸ごと取る（本物のまま） */
const escLine = src.match(/function esc\(s\)\{[^\n]*/);
if(!escLine) throw new Error('関数が見つからない: esc');
code += escLine[0] + '\n';

const L = [{ productId:1, sku:'ORG250', bottles:1, boxes:0, boxQty:6, giftType:'none' }];
function o(over){
  return Object.assign({ id:'x', num:'TK-1', client:'客', recipientName:'客', customerType:'general',
    lines:L, status:'pending', notified:false, stockDeducted:false,
    registeredAt:'2026-08-19T10:00:00Z' }, over);
}
const ORDERS = [
  o({id:'A', num:'TK-20260819-9339', recipientName:'室伏 順子',   status:'pending', notified:true, notifiedAt:'2026-08-19T14:20:00Z', stockDeducted:true}),
  o({id:'B', num:'TK-20260819-7862', recipientName:'室伏 順子',   status:'pending', notified:false}),
  o({id:'C', num:'RT-20260819-3528', recipientName:'EC営業課',    status:'deleted', notified:true}),
  o({id:'D', num:'TK-20260819-1102', recipientName:'渡辺 明子',   status:'held'}),
  o({id:'E', num:'TK-20260817-6620', recipientName:'山本 千代',   status:'reserved', registeredAt:'2026-08-17T10:00:00Z'}),
  o({id:'F', num:'OS1-20260819-8815',recipientName:'グリーンフーズ', status:'pending', notified:false}),
  o({id:'G', num:'TK-20260812-3344', recipientName:'木村 由紀',   status:'cancelled', registeredAt:'2026-08-12T10:00:00Z'}),
  o({id:'H', num:'TK-20260818-4471', recipientName:'佐藤 めぐみ', status:'shipped', notified:false, shippedAt:'2026-08-18T09:00:00Z', registeredAt:'2026-08-18T10:00:00Z'}),
  o({id:'I', num:'TK-20260819-5555', recipientName:'両方送った',  status:'pending', notified:true, notifiedAt:'2026-08-19T11:00:00Z'}),
  o({id:'J', num:'TK-20260819-6666', recipientName:'両方送った',  status:'pending', notified:true, notifiedAt:'2026-08-19T11:05:00Z'}),
  o({id:'K', num:'TK-20260819-7777', recipientName:'両方未送信',  status:'pending', notified:false}),
  o({id:'L', num:'TK-20260819-8888', recipientName:'両方未送信',  status:'pending', notified:false}),
  /* ★RTは対象外。同じホテルが同じ日に同じ金額で何度も発注してくるのは正常（伝票番号で管理する） */
  o({id:'M', num:'RT-20260818-6432', recipientName:'東京ベイコート倶楽部', customerType:'rt', status:'pending', notified:false, registeredAt:'2026-08-18T10:00:00Z', note:'RT伝票取込 ／ 伝票番号 904211 ／ 納品予定日 2026-08-25'}),
  o({id:'N', num:'RT-20260818-5644', recipientName:'東京ベイコート倶楽部', customerType:'rt', status:'pending', notified:false, registeredAt:'2026-08-18T10:00:00Z', note:'RT伝票取込 ／ 伝票番号 904298 ／ 納品予定日 2026-08-26'}),
  /* 同じ伝票番号が2件 ＝ 本物の二重（取込を2回してしまった） */
  o({id:'S', num:'RT-20260818-1212', recipientName:'ラグーナベイコート倶楽部', customerType:'rt', status:'pending', notified:false, registeredAt:'2026-08-18T10:00:00Z', note:'RT伝票取込 ／ 伝票番号 277285 ／ 納品予定日 2026-08-25'}),
  o({id:'T', num:'RT-20260818-3434', recipientName:'ラグーナベイコート倶楽部', customerType:'rt', status:'pending', notified:false, registeredAt:'2026-08-18T10:00:00Z', note:'RT伝票取込 ／ 伝票番号 277285 ／ 納品予定日 2026-08-25'}),
  /* 注文番号が RTG- で始まるものも同じ扱い */
  o({id:'P', num:'RTG-20260818-1111', recipientName:'RTゴルフ場', status:'pending', notified:false, registeredAt:'2026-08-18T10:00:00Z'}),
  o({id:'Q', num:'RTG-20260818-2222', recipientName:'RTゴルフ場', status:'pending', notified:false, registeredAt:'2026-08-18T10:00:00Z'})
];

const boxes = {};
const { box } = H.makeSandbox({
  PRODUCTS: [{ id:1, sku:'ORG250', name:'オルガニック250ml', group:'oil', boxQty:12 }],
  priceMaster: [], monthlyClients: [], orders: ORDERS,
  document: { getElementById(id){ return (boxes[id] = boxes[id] || { innerHTML:'' }); } }
});
box.products = box.PRODUCTS;
require('vm').runInContext(code, require('vm').createContext(box));

/* ── ① 売上一覧に出るもの・出ないもの ── */
const shown = ORDERS.filter(box.isSalesListTarget).map(x => x.id);
eq('① 出るのは A(送信済) H(出荷済) I J だけ', shown.join(','), 'A,H,I,J');
eq('① B まだ倉庫へ送っていない → 出ない', box.isSalesListTarget(ORDERS[1]), false);
eq('① C 🗑発注から消した → 出ない',        box.isSalesListTarget(ORDERS[2]), false);
eq('① D 取り置き → 出ない',                box.isSalesListTarget(ORDERS[3]), false);
eq('① E 予約 → 出ない',                    box.isSalesListTarget(ORDERS[4]), false);
eq('① G キャンセル → 出ない',              box.isSalesListTarget(ORDERS[6]), false);
eq('① H 出荷済みは送った印が無くても出る',  box.isSalesListTarget(ORDERS[7]), true);

/* ── ② 出さない理由の名前 ── */
eq('② B の理由 unsent',    box.salesExcludeReason(ORDERS[1]), 'unsent');
eq('② C の理由 deleted',   box.salesExcludeReason(ORDERS[2]), 'deleted');
eq('② D の理由 held',      box.salesExcludeReason(ORDERS[3]), 'held');
eq('② E の理由 reserved',  box.salesExcludeReason(ORDERS[4]), 'reserved');
eq('② G の理由 cancelled', box.salesExcludeReason(ORDERS[6]), 'cancelled');
eq('② A は載せる（理由なし）', box.salesExcludeReason(ORDERS[0]), '');

/* ── ③ 表と数字がズレない ── */
const one = box.orderAmount(ORDERS[0]);
const grand = ORDERS.filter(box.isSalesListTarget).reduce((s, x) => s + box.orderAmount(x), 0);
eq('③ 1件の金額が0円ではない', one > 0, true);
eq('③ 合計＝出ている4件ぶん', grand, one * 4);
eq('③ 消した注文の金額は合計に入らない', grand < one * ORDERS.length, true);
const monthCount = ORDERS.filter(box.isSalesListTarget)
  .filter(x => String(x.registeredAt || '').slice(0, 7) === '2026-08').length;
eq('③ 今月の件数＝一覧の件数', monthCount, shown.length);

/* ── ④ 二重登録のうたがい ── */
eq('④ うたがいは4組（個人3組＋同じ伝票番号のRT1組）', box.findSalesDuplicates().length, 4);
const ids = box.salesDupIds();
eq('④ C（消した）は二重の相手に数えない', !!ids['C'], false);
eq('④ B は一覧に出ないが二重には出る',    !!ids['B'], true);
/* ★RTは対象外（2026-08-19 ひろみさん指示）：同じホテルが何度も発注してくるのは正常 */
eq('④ 伝票番号が違えば、同じホテル・同じ日・同じ金額でも出さない', (!!ids['M'] || !!ids['N']), false);
eq('④ 注文番号が RTG- で始まるものも対象外',                   (!!ids['P'] || !!ids['Q']), false);
eq('④ 伝票番号が違うRTは、別々の注文として扱う',              box.salesDupKey(ORDERS[12]) === box.salesDupKey(ORDERS[13]), false);
eq('④ 同じ伝票番号のRTは、二重として扱う',                    (!!ids['S'] && !!ids['T']), true);
eq('④ 伝票番号が読めないRTは判定しない',                      box.salesDupKey(ORDERS[16]), '');
eq('④ 伝票番号をメモから読み取れる',                          box.rtSlipNoOf(ORDERS[12]), '904211');
eq('④ 個人（TK）は今までどおり判定する',                      box.salesDupKey(ORDERS[1]).length > 0, true);

box.renderSalesDupAlert();
const dup = boxes['sales-dup-alert'].innerHTML;
inc('④ 片方だけ送信 → こちらを残します',        dup, 'こちらを残します', true);
inc('④ 片方だけ送信 → 受注Ａで消す案内',        dup, '👉 こちらを受注Ａで', true);
inc('④ 送った日時と送り先を出す',               dup, 'OOS出荷依頼グループ（倉庫）へ', true);
inc('④ 両方送信済み → 倉庫へ連絡の警告',        dup, '消す前に、必ず倉庫へ連絡してください', true);
inc('④ 両方未送信 → どちらを消してもよい',      dup, 'どちらを消してもかまいません', true);
inc('④ 消した注文は二重に出さない',             dup, 'RT-20260819-3528', false);
inc('④ 件数を見出しに出す',                     dup, '二重登録のうたがいが 4件あります', true);
inc('④ RTの見出しは伝票番号で書く',            dup, '伝票番号 277285', true);
inc('④ 伝票番号が違うホテルは出ない',          dup, '東京ベイコート倶楽部', false);

/* ── ⑤ 出していないものの一覧（消えたと思わせない） ── */
box.renderSalesHiddenList();
const hid = boxes['sales-hidden-list'].innerHTML;
inc('⑤ 出していないのは14件',           hid, '出していないもの（14件）', true);
inc('⑤ 消した注文も理由つきで残る',     hid, '🗑 発注から消した', true);
inc('⑤ 取り置きの直し方',               hid, '出荷依頼書を作って倉庫へ送ったとき', true);
inc('⑤ 未送信の直し方',                 hid, '「② 倉庫へ送る」を押したとき', true);
inc('⑤ 消した注文は「出ません」',       hid, '出ません（消した注文です）', true);
inc('⑤ 二重の相手には印が付く',         hid, '⚠ 二重のうたがい', true);
inc('⑤ 一覧に出ている A は入らない',    hid, 'TK-20260819-9339', false);

/* ── ⑥ 何も無いときは何も出さない ── */
box.orders = [];
box.renderSalesDupAlert(); box.renderSalesHiddenList();
eq('⑥ うたがいが無ければ空', boxes['sales-dup-alert'].innerHTML, '');
eq('⑥ 全部出ていれば空',     boxes['sales-hidden-list'].innerHTML, '');
box.orders = ORDERS;

/* ── ⑦ 判定を書き写していないか（同じ条件が他所に増えていないか） ── */
const oldFilter = (src.match(/orders\.filter\(o=>o\.status!=='cancelled'\)/g) || []).length;
eq('⑦ 古い「キャンセル以外ぜんぶ」が売上一覧まわりに残っていない', oldFilter, 0);
eq('⑦ 判定 isSalesListTarget は1回だけ定義',
   (src.match(/function isSalesListTarget/g) || []).length, 1);

console.log('===== 売上一覧に載せるタイミング =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
