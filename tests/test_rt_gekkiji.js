/* RT月次まとめ「この月の分を集計する」の見張り（2026-09-10）

   きっかけ：ひろみさん「午前中はちゃんと出てきてたのに、何も出てこなくなったよ」。
   調べたら、コードもデータも壊れていませんでした（本番のコード＋本番のデータで
   押したら、ちゃんと1枚出ました）。起きていたのは別のことで、
     ・請求書が0枚のとき、前は「受注が見つかりませんでした」としか出なかった
     ・だから【読み込めていない】のか【その月は発送が無かった】のか見分けられない
   というところでした。そこで、いつでも次の3つを画面に出すようにしました。
     ① 読み込めていないときは、赤い箱で「🔄 を押してください」と言う
     ② その月のRT・RTGCの受注は何件あるか
     ③ そのうち載せなかったのは何件で、なぜか（取り置き／予約／まだ送っていない）

   ★請求書に載せる判定は salesWasSentToWarehouse の1か所だけ。
     ここでも「書き写し」をしていないことを確かめます（過去に繰り返した事故）。

   本番 billing.html の本物の関数をそのまま切り出して動かす。保存は一切しない。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname, '..', 'billing.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(l + '  期待:' + w + '  実際:' + g); } }
function ok(l, g){ eq(l, !!g, true); }
function inc(l, text, needle, want){ eq(l, String(text).indexOf(needle) >= 0, want); }

/* ── にせ画面（innerHTML と value だけ覚える） ── */
const boxes = {};
function mkEl(id){
  return { id: id, value:'', innerHTML:'', textContent:'', style:{}, dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    appendChild(){}, setAttribute(){}, getAttribute(){return null;}, addEventListener(){},
    querySelector(){return null;}, querySelectorAll(){return [];},
    scrollIntoView(){}, focus(){}, click(){}, children:[], options:[] };
}
const doc = {
  getElementById(id){ if(!boxes[id]) boxes[id] = mkEl(id); return boxes[id]; },
  querySelector(){ return mkEl('q'); }, querySelectorAll(){ return []; },
  createElement(t){ return mkEl('new-' + t); }, addEventListener(){}, body: mkEl('body')
};

const VARS  = ['DEFAULT_PRICES', 'SALES_HIDE_INFO'];
const NAMES = ['findProduct', 'findProductBySku', 'defaultTaxRateForGroup', 'effectiveCustomerType',
  'lineTierType', 'priceForSku', 'taxRateForSku', 'orderAmount',
  'salesWasSentToWarehouse', 'salesExcludeReason', 'isSalesListTarget',
  'normCtype', 'normOrdersCtype',
  'rtmSetDefaultMonth', 'rtmRow', 'makeRtInvoiceNumber', 'runRtMonthly', 'renderRtMonthlyPreview'];
let code = 'var _rtMonthlyCtx = null;\n';
VARS.forEach(function(n){ code += H.cutVar(src, n) + '\n'; });
NAMES.forEach(function(n){ code += H.cut(src, n) + '\n'; });
/* esc は中に正規表現 /'/g があり共通の切り出し器が使えないので、その1行を丸ごと取る（本物のまま） */
const escLine = src.match(/function esc\(s\)\{[^\n]*/);
if(!escLine) throw new Error('関数が見つからない: esc');
code += escLine[0] + '\n';

const PRODUCTS = [
  { id:'p1', sku:'NOV750', name:'ノヴェッロ 750ml', boxQty:6, extras:{} },
  { id:'p2', sku:'CLA500', name:'クラシコ 500ml',   boxQty:12, extras:{} }
];
const PRICE = [
  { sku:'NOV750', rt:5000, general:6000, taxRate:0.08 },
  { sku:'CLA500', rt:3000, general:3600, taxRate:0.08 }
];
function mk(num, ym, day, ctype, status, extra){
  return Object.assign({ num: num, registeredAt: ym + '-' + day + 'T03:00:00.000Z', customerType: ctype,
    status: status, client:'テスト施設', recipientName:'テスト施設',
    lines:[{ productId:'p1', sku:'NOV750', bottles:10, boxes:0, boxQty:6 }] }, extra || {});
}
/* 2026-09 の顔ぶれ：発送1・notified1・取り置き2・予約1・キャンセル1・RTGC発送1・定価1 */
const ORDERS = [
  mk('RT-1','2026-09','01','RT','shipped',  { shippedAt:'2026-09-02' }),
  mk('RT-2','2026-09','04','RT','pending',  { notified:true }),
  mk('RT-3','2026-09','05','RT','held',     {}),
  mk('RT-4','2026-09','05','RT','held',     {}),
  mk('RT-5','2026-09','06','RT','reserved', {}),
  mk('RT-6','2026-09','07','RT','cancelled',{ notified:true }),
  mk('GC-1','2026-09','08','RTGC（ゴルフ）','shipped', { shippedAt:'2026-09-09', client:'○○ゴルフ倶楽部', recipientName:'○○ゴルフ倶楽部' }),
  mk('TK-1','2026-09','08','定価','shipped', { shippedAt:'2026-09-09' }),
  mk('RT-7','2026-08','20','RT','shipped',  { shippedAt:'2026-08-21' })
];

const made = H.makeSandbox({ document: doc });
const box = made.box, ctx = made.ctx;
box.PRODUCTS = PRODUCTS;   /* 売上Ｃは商品名簿を PRODUCTS で持っています */
box.products = PRODUCTS; box.priceMaster = PRICE; box.specialPrices = []; box.customers = [];
box.lots = []; box.defects = []; box.taxRate = 0.08;
box.orders = [];
vm.runInContext(code, ctx);
box.normOrdersCtype(ORDERS);

/* ══ ① 読み込めていないとき ══════════════════════════════ */
box.orders = [];
boxes['rtm-yearmonth'] = mkEl('rtm-yearmonth'); boxes['rtm-yearmonth'].value = '2026-09';
boxes['rtmonthly-preview'] = mkEl('rtmonthly-preview');
box.runRtMonthly();
const sora = boxes['rtmonthly-preview'].innerHTML;
ok('① 読み込めていないときも何か出る（黙って空にしない）', sora.length > 0);
inc('① 読み込めていないと分かる言い方', sora, 'まだ受注データを読み込めていません', true);
inc('① 直し方（🔄）も書いてある',        sora, '🔄', true);

/* ══ ② ふつうに集計できるとき ══════════════════════════ */
box.orders = ORDERS;
boxes['rtm-yearmonth'].value = '2026-09';
boxes['rtmonthly-preview'] = mkEl('rtmonthly-preview');
box.runRtMonthly();
const out = boxes['rtmonthly-preview'].innerHTML;
const c = box._rtMonthlyCtx;
eq('② 請求書は2枚（RTホテル1枚＋ゴルフ1枚）', c.invoices.length, 2);
eq('② RTホテルのまとめは1枚',               c.rtCount, 1);
eq('② ゴルフは施設ごとに1枚',               c.gcCount, 1);
eq('② RTホテルに入るのは発送した2件だけ',    c.invoices[0].rows.length, 2);
inc('② 取り置きの注文は入らない',   JSON.stringify(c.invoices), 'RT-3', false);
inc('② 予約の注文も入らない',       JSON.stringify(c.invoices), 'RT-5', false);
inc('② キャンセルは入らない',       JSON.stringify(c.invoices), 'RT-6', false);
inc('② 定価（RTでない）は入らない', JSON.stringify(c.invoices), 'TK-1', false);
inc('② 先月の分は入らない',         JSON.stringify(c.invoices), 'RT-7', false);

/* ══ ③ なぜこの件数なのかが画面に出る ══════════════════ */
eq('③ その月のRT・RTGCの受注は6件',        c.ymRtCount, 6);
eq('③ 載せたのは3件（RT2件＋ゴルフ1件）',   c.nosaiCount, 3);
eq('③ 取り置きで待っているのは2件',         c.machi.held, 2);
eq('③ 予約で待っているのは1件',             c.machi.reserved, 1);
inc('③ 画面に「受注：6件」が出る',          out, '6件', true);
inc('③ 画面に取り置きの理由が出る',          out, '📦 取り置き', true);
inc('③ 画面に予約の理由が出る',              out, '🗓 予約', true);
inc('③ 新しい流れの言い方（A列を🔵）',       out, 'A列を🔵', true);
inc('③ 古い言い方（出荷依頼書）は出ない',    out, '出荷依頼書', false);
inc('③ 決めた日（2026-09-07）を書いてある',  out, '2026-09-07', true);

/* ══ ④ その月に1件も無いとき ══════════════════════════ */
boxes['rtm-yearmonth'].value = '2026-07';
boxes['rtmonthly-preview'] = mkEl('rtmonthly-preview');
box.runRtMonthly();
const nashi = boxes['rtmonthly-preview'].innerHTML;
ok('④ 0枚でも何か出る', nashi.length > 0);
inc('④ 0枚のときも内訳の箱が出る',          nashi, 'のRT・RTGCの受注', true);
inc('④ 読み込めていない赤い箱は出さない',    nashi, 'まだ受注データを読み込めていません', false);

/* ══ ⑤ 判定を書き写していないか ══════════════════════ */
eq('⑤ salesWasSentToWarehouse の定義は1回だけ',
   (src.match(/function salesWasSentToWarehouse/g) || []).length, 1);
eq('⑤ RT月次も「発送した注文だけ」で絞っている',
   (src.match(/if\(!salesWasSentToWarehouse\(o\)\) return false;/g) || []).length, 1);
eq('⑤ 「notified || shippedAt」を他所に書き写していない',
   (src.match(/o\.notified \|\| o\.shippedAt/g) || []).length, 1);
inc('⑤ 古い絞り（キャンセル以外ぜんぶ）に戻っていない', src,
    "return o && o.status!=='cancelled' && String(o.registeredAt||'').slice(0,7)===ym;", false);

console.log('===== RT月次まとめ「この月の分を集計する」=====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(function(f){ console.log('  ' + f); }); }
process.exit(fail ? 1 : 0);
