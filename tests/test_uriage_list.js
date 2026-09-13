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
  'renderSalesDupAlert', 'renderSalesHiddenList',
  /* ★2026-09-13 バサラの扱い（ひろみさん指示） */
  'isBasaraOrder', 'isMonthlyConsolidated', 'isPaymentOverdueOneMonth'];
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
/* ★2026-09-10 言い方を新しい流れに合わせました。
   ひろみさん：「もう出荷依頼書を使っていないから、ルートとルールを変える必要がある」
   いまは【発注書（倉庫＆OOS発送連絡スプシ）のA列を🔵にしたとき】に倉庫へ行き、売上に載ります。
   ★古い言い方（出荷依頼書・「② 倉庫へ送る」）に戻さないでください。 */
inc('⑤ 取り置きの直し方（新しい流れ）',   hid, '発注書へ送って、A列を🔵にしたとき', true);
inc('⑤ 未送信の直し方（新しい流れ）',     hid, '発注書のA列を🔵にしたとき', true);
inc('⑤ 古い言い方が残っていない',         hid, '出荷依頼書', false);
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

/* ══ ⑧ 読み込みが終わる前に「該当する受注がありません」と出さない ═══════════
   ★2026-09-13 ひろみさん指示。ひろみさんの言葉：
   「該当する受注がありませんって表示になっているので、そうじゃなくて、
   　読み込み中とか、そういう言葉に直してください。じゃないと、
   　全部消えてるってどうしても人は思ってしまうので、それを避けるためです」
   親は受注Ａ（index.html）の同じ文言。★「0件」「ありません」を先に出さないこと。 */
(function(){
  const vm = require('vm');
  const { box, ctx } = H.makeSandbox({});
  vm.runInContext('var salesLoadState = "loading";', ctx);
  vm.runInContext(H.cut(src, 'salesEmptyRow'), ctx);
  const f = box.salesEmptyRow;
  inc('⑧ 読み込み中は「読み込み中です」と出す', f(), '読み込み中です', true);
  inc('⑧ 読み込み中に「該当する受注がありません」と出さない', f(), '該当する受注がありません', false);
  inc('⑧ 「消えたわけではありません」と添える', f(), '消えたわけではありません', true);
  vm.runInContext('salesLoadState = "error";', ctx);
  inc('⑧ 読めなかったときは「読み込めませんでした」', f(), '読み込めませんでした', true);
  inc('⑧ 読めなかったときも「該当する受注がありません」と言わない', f(), '該当する受注がありません', false);
  vm.runInContext('salesLoadState = "ok";', ctx);
  inc('⑧ 読み終わって本当に0件のときだけ「該当する受注がありません」', f(), '該当する受注がありません', true);
  /* 画面を開いた直後の表（まっさらや0件を先に見せない） */
  const tbody = src.match(/<tbody id="invoice-tbl-body">([\s\S]*?)<\/tbody>/);
  eq('⑧ 画面を開いた直後の表にも「読み込み中です」と書いてある',
     !!(tbody && tbody[1].indexOf('読み込み中です') >= 0), true);
  /* 空っぽのときの1行は、この1か所だけで決める（同じ文言をあちこちに書き写さない） */
  eq('⑧ 空っぽの行は salesEmptyRow() の1か所から', (src.match(/\|\| salesEmptyRow\(\);/g)||[]).length, 1);
  eq('⑧ 画面に出す「該当する受注がありません」は1か所だけ（説明の文はのぞく）',
     (src.match(/>該当する受注がありません</g)||[]).length, 1);
  inc('⑧ 読めたときだけ数字を出す', src, "const _loadingNow = (salesLoadState !== 'ok');", true);
  inc('⑧ 読み込み中は「今月の購入」も「…」', src, "_setTxt('s-month-count', _loadingNow ? '…' : mCount+'件');", true);
  inc('⑧ 読み込み中は「未入金」も「…」', src, "_setTxt('s-unpaid-all', _loadingNow ? '…' : unpaidAllCount+'件');", true);
})();

/* ══ ⑨ バサラは【バサラスプシで完結】（2026-09-13 ひろみさん指示）═══════════
   ひろみさんの言葉：「バサラも、入金の列、未入金ではなく【月次まとめ予定】に変えて。
   　バサラ案件は、入金済チェックも【バサラスプシで完結】の表示にして。野々山さんもそれに合わせて」
   ★売上Ｃでバサラの入金チェックをしない・1ヶ月超未入金の赤いお知らせにも出さない。 */
(function(){
  var B = box.isBasaraOrder, M = box.isMonthlyConsolidated, O = box.isPaymentOverdueOneMonth;
  eq('⑨ 区分が卸バサラスターならバサラ', B({ customerType:'basara' }), true);
  eq('⑨ 日本語の区分でもバサラ',         B({ customerType:'卸バサラスター' }), true);
  eq('⑨ 注文番号が BA- でもバサラ',      B({ num:'BA-20260812-7735' }), true);
  eq('⑨ バサラ発注シートから来た注文もバサラ', B({ source:'basara' }), true);
  eq('⑨ RTはバサラではない',             B({ customerType:'rt', num:'RT-20260904-4150' }), false);
  eq('⑨ 定価はバサラではない',           B({ customerType:'general', num:'TK-20260827-002' }), false);
  eq('⑨ バサラは「月次まとめ予定」側',   M({ customerType:'basara' }), true);
  eq('⑨ RTも今までどおり「月次まとめ予定」側', M({ customerType:'rt' }), true);
  eq('⑨ 定価は今までどおりチェック側',   M({ customerType:'general' }), false);
  /* 野々山さん（BA-）が、1ヶ月超未入金の赤いお知らせに出ない */
  var nonoyama = { num:'BA-20260812-7735', registeredAt:'2026-08-12T10:00:00Z', paymentConfirmed:false };
  eq('⑨ 野々山さん（BA-）は1ヶ月超未入金に出さない', O(nonoyama), false);
  var ippan = { num:'TK-20260812-1111', registeredAt:'2026-08-12T10:00:00Z', paymentConfirmed:false };
  eq('⑨ バサラ以外は今までどおり出す', O(ippan), true);
  /* 画面の文言（入金済みチェックの列） */
  inc('⑨ 「バサラスプシで完結」と出す', src, 'バサラスプシで完結', true);
  inc('⑨ まとめ側で確認（RT・卸）も残っている', src, 'まとめ側で確認', true);
})();

console.log('===== 売上一覧に載せるタイミング =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
