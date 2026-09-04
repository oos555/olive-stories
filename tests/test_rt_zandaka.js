/* 🏛 RT予約の残高一覧（第4弾・2026-09-04）の数字テスト。
   承認済みモック：mocks/RT予約おためし版_2026-09-02.html
   本物の関数（rtbData / rtbLedgerCut / rtbLedgerAdd ほか）を index.html から
   そのまま切り出して動かす。在庫の式は書いていないこと・✂️が既存エンジンを
   呼ぶだけであることも見張る。 */
const vm = require('vm');
const H = require('./harness');
const idx = H.read('index.html');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}
function has(label, hay, needle){
  if(String(hay).indexOf(needle) >= 0) pass++; else { fail++; fails.push(`${label}  「${needle}」が見つかりません`); }
}

/* ── 砂場：本物の関数＋作り物のデータ ── */
const PRODUCTS = [
  { id:1, sku:'ORG500', name:'オルガニック 500ml', boxQty:12 },
  { id:2, sku:'MEM250', name:'メネジック 250ml', boxQty:24 },
  { id:3, sku:'YS100', name:'your story 100ml×3本セット', isSet:true, components:[{sku:'ORG500',qty:1}] },
  { id:4, sku:'CHF100', name:'シェフズブレンド 100ml', boxQty:36 }
];
function makeOrders(){
  return [
    // 日光：取り置き（単品の注文＝rtm形）
    { id:'o1', num:'RT-1', status:'held', custId:'F1', customerType:'rt', rtmOwned:true, rtmKind:'held', rtmSku:'ORG500', rtmFac:'F1',
      lines:[{productId:1, productName:'オルガニック 500ml', bottles:100, boxes:0, boxQty:12}] },
    // 日光：予約（複数行の注文＝取り込み画面が作る形）
    { id:'o2', num:'RT-2', status:'reserved', custId:'F1', customerType:'rt', rtmOwned:true, rtmKind:'reserved',
      lines:[{productId:2, productName:'メネジック 250ml', bottles:10, boxes:0, boxQty:24},
             {productId:4, productName:'シェフズブレンド 100ml', bottles:5, boxes:0, boxQty:36}] },
    // 日光：手で登録した取り置き（rtm印なし・ゆかちゃんの春予約と同じ形）
    { id:'o3', num:'RT-3', status:'held', custId:'F1', customerType:'rt',
      lines:[{productId:2, productName:'メネジック 250ml', bottles:80, boxes:0, boxQty:24}] },
    // 蓼科：取り置き
    { id:'o4', num:'RT-4', status:'held', custId:'F2', customerType:'rt', rtmOwned:true, rtmKind:'held', rtmSku:'CHF100', rtmFac:'F2',
      lines:[{productId:4, productName:'シェフズブレンド 100ml', bottles:50, boxes:0, boxQty:36}] },
    // 鳴門：切り出し済み（✂️の印つき・出荷待ち）
    { id:'o5', num:'RT-5', status:'pending', custId:'F3', customerType:'rt', rtCut:{fac:'F3', dest:'本館', at:'x'},
      lines:[{productId:1, productName:'オルガニック 500ml', bottles:60, boxes:0, boxQty:12}] },
    // キャンセル済み（数えない）
    { id:'o6', num:'RT-6', status:'cancelled', custId:'F1', customerType:'rt', rtCut:{fac:'F1'},
      lines:[{productId:1, productName:'オルガニック 500ml', bottles:999, boxes:0, boxQty:12}] },
    // 昔の注文（保存の載せ忘れでcustIdが消えている）→ お客様名から取引先を特定する救済（2026-09-04）
    { id:'o7', num:'RT-7', status:'held', custId:'', client:'日光 様', customerType:'rt',
      lines:[{productId:4, productName:'シェフズブレンド 100ml', bottles:5, boxes:0, boxQty:36}] }
  ];
}
function makeBox(){
  const box = {
    PRODUCTS: PRODUCTS,
    orders: makeOrders(),
    customers: [ {id:'F1', name:'日光 様', type:'rt', series:'RT全体'}, {id:'F2', name:'蓼科 様', type:'rt', series:'RT全体'}, {id:'F3', name:'鳴門 様', type:'rt', series:'RT全体'} ],
    findProduct(id){ return PRODUCTS.find(p=>p.id===id)||null; },
    findProductBySku(s){ return PRODUCTS.find(p=>p.sku===s)||null; },
    rtmAllFacilities(){ return box.customers.map(c=>({id:String(c.id), name:c.name})); },
    rtmFacName(id){ const c=box.customers.find(x=>String(x.id)===String(id)); return c?c.name:String(id); },
    generateOrderId(){ return 'new-'+(++box.__seq); },
    nextOrderNum(){ return 'RT-NEW-'+box.__seq; },
    __seq: 0,
    Date, JSON, String, Number, Math, Array, Object
  };
  box.__logs = [];
  box.rtbLog = function(fac, txt){ box.__logs.push([fac, txt]); };
  box.syncOrdersToGAS = function(){};
  const ctx = vm.createContext(box);
  ['lineTotal','unitOfProduct','lineUnit','rtbCidOf','rtbSkuOf','rtbUnit','rtbProdName','rtbFacilities','rtbData','rtbFacSkus','rtbTotals','rtbFacDone','rtbLedgerCut','rtbLedgerAdd','rtSlipAutoCut']
    .forEach(function(name){ vm.runInContext(H.cut(idx, name), ctx); });
  return box;
}

/* ── ① 集計：全部、注文からの足し算で出る ── */
{
  const G = makeBox();
  const d = G.rtbData();
  eq('①日光のORG500＝🔒100', d.data['F1']['ORG500'].held, 100);
  eq('①日光のMEM250＝🔒80（手登録）＋✈️10（取り込み形）', [d.data['F1']['MEM250'].held, d.data['F1']['MEM250'].wait], [80,10]);
  eq('①日光のCHF100＝✈️5', d.data['F1']['CHF100'].wait, 5);
  eq('①蓼科のCHF100＝🔒50', d.data['F2']['CHF100'].held, 50);
  eq('①鳴門のORG500＝✂️発送済60', d.data['F3']['ORG500'].sent, 60);
  eq('①キャンセルは数えない', d.data['F1']['ORG500'].sent, 0);
  eq('①鳴門は「すべて発送済み」', G.rtbFacDone(d.data['F3']), true);
  eq('①日光はまだ', G.rtbFacDone(d.data['F1']), false);
  eq('①custIdが消えた昔の注文も、お客様名から日光に数えられる（🔒CHF100+5）', d.data['F1']['CHF100'].held, 5);
  const tt = G.rtbTotals(d.data['F1']);
  eq('①日光の合計＝100+80+10+5+5', tt.hon, 200);
}

/* ── ② 台帳から引く：単品の注文から先に・複数注文にまたがってもOK・空は畳む ── */
{
  const G = makeBox();
  const r = G.rtbLedgerCut('F1', 'MEM250', 'held', 80);   // 手登録の80本をぜんぶ引く
  eq('②80本引けた（残りなし）', r.left, 0);
  const o3 = G.orders.find(o=>o.id==='o3');
  eq('②空になった注文は畳まれる（キャンセル扱い＋印）', [o3.status, !!o3.rtbZeroed], ['cancelled', true]);
  const d = G.rtbData();
  eq('②引いた後の🔒は0', d.data['F1']['MEM250'].held, 0);
  eq('②✈️はそのまま', d.data['F1']['MEM250'].wait, 10);
}
{
  const G = makeBox();
  const r = G.rtbLedgerCut('F1', 'ORG500', 'held', 30);   // 100本から30本
  eq('②部分引きの残り', r.left, 0);
  eq('②注文の本数が70に', G.orders.find(o=>o.id==='o1').lines[0].bottles, 70);
}
{
  const G = makeBox();
  const r = G.rtbLedgerCut('F1', 'ORG500', 'held', 150);  // 足りない分は left に残る
  eq('②足りないときは引けた分だけ（left=50）', r.left, 50);
}

/* ── ③ 台帳に足す：既存の単品注文に足す／無ければ1件つくる ── */
{
  const G = makeBox();
  const o = G.rtbLedgerAdd('F1', 'ORG500', 'held', 20, 'テスト');
  eq('③既存の単品注文に足される（100→120）', [o.id, o.lines[0].bottles], ['o1', 120]);
  const o2 = G.rtbLedgerAdd('F2', 'MEM250', 'reserved', 15, 'テスト');
  eq('③無ければ新しく1件（予約・rtm形）', [o2.status, o2.rtmOwned, o2.rtmSku, String(o2.custId)], ['reserved', true, 'MEM250', 'F2']);
  eq('③新しい注文の本数', G.rtbData().data['F2']['MEM250'].wait, 15);
}

/* ── ④ 🔁回す：引いて→足す。全体の🔒合計は変わらない（持ち主が変わるだけ） ── */
{
  const G = makeBox();
  const before = G.rtbData();
  const heldBefore = before.data['F1']['ORG500'].held + ((before.data['F2']['ORG500']||{held:0}).held);
  G.rtbLedgerCut('F1', 'ORG500', 'held', 20);
  G.rtbLedgerAdd('F2', 'ORG500', 'held', 20, 'テスト');
  const after = G.rtbData();
  eq('④日光 100→80', after.data['F1']['ORG500'].held, 80);
  eq('④蓼科 0→20', after.data['F2']['ORG500'].held, 20);
  eq('④🔒の合計は不変', after.data['F1']['ORG500'].held + after.data['F2']['ORG500'].held, heldBefore);
}

/* ── ④2 伝票取込からの自動切り出し（2026-09-04 ひろみさん承認：発送は伝票→②取込に統一） ── */
function slipOrder(over){
  return Object.assign({ id:'slip1', num:'RT-S1', status:'pending', customerType:'rt',
    client:'日光 様', custId:'F1', recipientName:'日光 商品部',
    note:'RT伝票取込 ／ 伝票番号 12345 ／ 納品先 商品部',
    lines:[{productId:1, productName:'オルガニック 500ml', bottles:40, boxes:0, boxQty:12}] }, over||{});
}
{
  const G = makeBox();
  const o = slipOrder();
  G.rtSlipAutoCut([o]);
  G.orders.push(o);
  const d = G.rtbData();
  eq('④2 🔒100→60に自動で切り出し', d.data['F1']['ORG500'].held, 60);
  eq('④2 ✂️発送済に40が積まれる', d.data['F1']['ORG500'].sent, 40);
  eq('④2 rtCutの印（施設・伝票番号）', [o.rtCut && o.rtCut.fac, o.rtCut && o.rtCut.slipNo], ['F1','12345']);
  eq('④2 総数は変わらない（60+40=100）', d.data['F1']['ORG500'].held + d.data['F1']['ORG500'].sent, 100);
  eq('④2 📜に伝票番号つきで記録', G.__logs.length===1 && G.__logs[0][1].indexOf('12345')>=0, true);
  G.rtSlipAutoCut([o]);
  eq('④2 もう一度呼んでも二重には引かない', G.rtbData().data['F1']['ORG500'].held, 60);
}
{
  const G = makeBox();
  const o = slipOrder({note:'ふつうのメモ（伝票取込ではない）'});
  G.rtSlipAutoCut([o]);
  eq('④2 伝票取込でない注文は引かない', G.rtbData().data['F1']['ORG500'].held, 100);
  eq('④2 印も付かない', !!o.rtCut, false);
}
{
  const G = makeBox();
  const o = slipOrder({client:'蓼科 様', custId:'F2'});   // 蓼科にORG500の🔒は無い
  G.rtSlipAutoCut([o]);
  eq('④2 🔒残高が無い施設は何もしない（ふつうの注文として登録）', !!o.rtCut, false);
}
{
  const G = makeBox();
  const o = slipOrder({lines:[{productId:1, productName:'オルガニック 500ml', bottles:120, boxes:0, boxQty:12}]});
  G.rtSlipAutoCut([o]);
  eq('④2 残高を超える分は残高からは引かない（100だけ切り出し）', ((G.rtbData().data['F1']||{})['ORG500']||{held:0}).held, 0);
  eq('④2 それでも印は付く', !!o.rtCut, true);
}
{
  const G = makeBox();
  const o = slipOrder({status:'held'});
  G.rtSlipAutoCut([o]);
  eq('④2 取り置き登録は対象外', G.rtbData().data['F1']['ORG500'].held, 100);
}

/* ── ⑤ 決めごとの見張り（ソースの文言） ── */
/* ★2026-09-04 ひろみさん決定：発送は伝票→②取込に統一。✂️ボタンは画面から外した（関数は残置） */
eq('⑤✂️ボタンは残高一覧に出ていない', idx.indexOf('onclick="rtbOpenCut()"') < 0, true);
has('⑤登録時に自動切り出しが呼ばれる', H.cut(idx,'registerOrder'), 'rtSlipAutoCut(list)');
const cutSrc = H.cut(idx, 'rtbApplyCut');
has('⑤✂️は既存の変換（在庫が減る決められた場所）を呼ぶだけ', cutSrc, 'convertToShipping(o.id)');
eq('⑤✂️の中で在庫の減算を直接書いていない', /applyStockDeductOnSend|persistStockDeduct/.test(cutSrc), false);
has('⑤在庫ガードで止まったら台帳へ戻す', cutSrc, '✂️は中止しました（在庫が足りません）');
const addSrc = H.cut(idx, 'rtbApplyAdd');
has('⑤➕は出どころメモ必須', addSrc, '出どころメモ（電話・メールなど）を入れてください');
const mvSrc = H.cut(idx, 'rtbApplyMove');
has('⑤⚖️は理由メモ必須', mvSrc, '理由メモを入れてください');
const xfSrc = H.cut(idx, 'rtbApplyXfer');
has('⑤🔁も理由メモ必須', xfSrc, '理由メモを入れてください');
has('⑤ボタンは青（家ルール）', idx, '.rtb-btn{border-radius:8px;padding:8px 14px;font-size:13px;font-weight:bold;border:none;background:#0c447c');
has('⑤予約総数は足し算で出す（検算は必ず✓）', H.cut(idx, 'rtbData'), 'sent:0, held:0, wait:0');
has('⑤📜は共有ログ（GASのRT残高ログ）', H.cut(idx, 'rtbLog'), "action:'rtbLogAdd'");
const gasPath = require('path').join(require('os').homedir(),'OneDrive','ドキュメント','olive-stories-gas','コード.js');
if(require('fs').existsSync(gasPath)){
  const gasSrc = require('fs').readFileSync(gasPath,'utf8');
  has('⑤GASのログは読む/足すだけ（在庫を触らない）', H.cut(gasSrc,'oosRtbLogAdd'), 'appendRow');
  eq('⑤GASのログ関数に在庫の言葉が無い', /在庫データ|basaraComputeStock_/.test(H.cut(gasSrc,'oosRtbLogAdd')+H.cut(gasSrc,'oosRtbLogList')), false);
}

console.log('===== 🏛 RT予約の残高一覧（第4弾）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
