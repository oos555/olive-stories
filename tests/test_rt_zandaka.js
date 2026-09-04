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
  /* ★2026-09-04 集約：rtbFacRev（金額）・rtbSetDerived（緑の内訳メモ）・rtmPrice（統合マスタNの単価）も本物のまま動かす */
  box.rtPriceOf = function(p){ return ({ORG500:3800, MEM250:3800, CHF100:3200, YS100:8000})[p&&p.sku] || 0; };
  const ctx = vm.createContext(box);
  ['lineTotal','unitOfProduct','lineUnit','rtbCidOf','rtbSkuOf','rtbUnit','rtbProdName','rtbFacilities','rtbData','rtbFacSkus','rtbTotals','rtbFacDone','rtbFacRev','rtbSetDerived','rtmPrice','rtbLedgerCut','rtbLedgerAdd','rtSlipAutoCut']
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
/* ★2026-09-04 RT編②：伝票取込の注文は登録と同時に自動でゆかスプシへ（📥と同じ関数・押し忘れよけ） */
has('⑤登録時に自動でゆかスプシへ（RT伝票取込）', H.cut(idx,'registerOrder'), 'yukaImportOne(o.id)');
has('⑤自動取込はRTの伝票取込だけ', H.cut(idx,'registerOrder'), "customerType==='rt' && /RT伝票取込/");
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


/* ── ⑥ RTまとめ（2026-09-04 ひろみさん「この見たまんまの形に」）──
   承認済みモック：おためし版_RTコントロール集約_2026-09-04.html ／ おためし版_受注Aの取り置きタブ_2026-09-04.html
   ・「🏨 施設ごとの予約」（商品×施設のマトリクス表・✎✕）は廃止＝サブタブを出さない
   ・引っ越し①金額の合計 ②✎の数直し→3ボタンに一本化 ③緑の内訳メモ
   ・RTの行は「RT以外の取り置き・予約」に二度と出さない */
eq('⑥マトリクスのサブタブは出ていない（廃止）', /id="hsub-rt"[^>]*style="display:none"/.test(idx), true);
has('⑥RT行は一覧に出さない（取り置き）', H.cut(idx,'renderHoldPreLists'), "!o.rtmOwned && o.customerType!=='rt'");
has('⑥RT行は一覧に出さない（予約）', idx, "o.status==='reserved' && !o.rtmOwned && o.customerType!=='rt'");
has('⑥期限アラートからもRTを外す', H.cut(idx,'renderHoldPreAlerts'), "o.customerType!=='rt'");
/* ★2026-09-04夜 ひろみさん指示でタブ名を「RT専用取り置き・予約」に変更（案内の指し先も同じ名前に） */
has('⑥案内の1行（モックの文言・タブ名は新しい名前）', idx, '🏛 RTの取り置き・予約は、ここには出ません → 上の「RTの在庫と予約のコントロール」で。スプシで見るときは「RT専用取り置き・予約」タブ。');
has('⑥【引っ越し①】一覧の頭に金額の合計', H.cut(idx,'rtbRender'), '💰 予約金額（単価×本数・税抜）：');
has('⑥【引っ越し①】施設の行にも金額', H.cut(idx,'rtbRender'), "rtmYen(rtbFacRev(rows))");
has('⑥【引っ越し①】カードの見出しにも金額（税抜）', H.cut(idx,'rtbCardHtml'), '（税抜）');
has('⑥【引っ越し①】金額は統合マスタNの単価（新しい式を書かない）', H.cut(idx,'rtbFacRev'), 'rtmPrice(sku)');
has('⑥【引っ越し②】✎の数直しは廃止・3ボタンに一本化', H.cut(idx,'rtbCardHtml'), '✎で数を直す操作は廃止 → 数の増減はぜんぶ上の3ボタンで（必ず📜に記録が残る）');
has('⑥【引っ越し③】緑の内訳メモ（単品＋ギフト箱＝合計）', H.cut(idx,'rtbCardHtml'), '🌿 単品（お客様に伝える）');
has('⑥【引っ越し③】内訳はセットの中身から数える', H.cut(idx,'rtbSetDerived'), 'p.isSet');
has('⑥商品名の下にRT卸単価', H.cut(idx,'rtbCardHtml'), 'RT卸 ');
eq('⑥金額の計算に在庫の式を書いていない', /computeAvailable|applyStockDeduct/.test(H.cut(idx,'rtbFacRev')+H.cut(idx,'rtbSetDerived')), false);
/* 数字：日光（F1）＝ORG500 100本・MEM250 90本（10+80）・CHF100 10本（✈️5＋🔒5）
   金額＝100×3800 ＋ 90×3800 ＋ 10×3200 ＝ 380000+342000+32000 ＝ 754,000円 */
{
  const G = makeBox();
  const rows = G.rtbData().data['F1'];
  eq('⑥金額＝総数×単価（日光＝754,000円）', G.rtbFacRev(rows), 754000);
  eq('⑥蓼科＝50×3200＝160,000円', G.rtbFacRev(G.rtbData().data['F2']), 160000);
  eq('⑥発送済みも金額に入る（鳴門＝60×3800）', G.rtbFacRev(G.rtbData().data['F3']), 228000);
}
{
  /* 緑の内訳メモ：YS100（中身＝ORG500×1）を日光に20個 → ORG500は単品100本＋ギフト20本＝120本 */
  const G = makeBox();
  G.orders.push({ id:'o8', num:'RT-8', status:'held', custId:'F1', customerType:'rt',
    lines:[{productId:3, productName:'your story 100ml×2本セット', bottles:20, boxes:0, boxQty:1}] });
  const rows = G.rtbData().data['F1'];
  const dv = G.rtbSetDerived(rows, 'ORG500');
  eq('⑥【引っ越し③】ギフト箱に入っている本数を数える', dv.total, 20);
  eq('⑥【引っ越し③】どのセットから来たかも出す', dv.list.length, 1);
  eq('⑥【引っ越し③】単品の行の数（100本）は変わらない', rows['ORG500'].held, 100);
}

/* ── ⑦ スプシ側「RT専用取り置き・予約」タブ（横並びカード・モック正本の見た目） ── */
if(require('fs').existsSync(gasPath)){
  const g = require('fs').readFileSync(gasPath,'utf8');
  const w = H.cut(g,'oosRtControlWrite_');
  /* ★2026-09-04夜 ひろみさん指示のタブ名。名前は1か所（定数）で決め、前の名前のタブは自動で改名する */
  has('⑦タブの名前は「RT専用取り置き・予約」', g, "var OOS_RTC_SHEET = 'RT専用取り置き・予約';");
  has('⑦前の名前（🏛RTコントロール）のタブは自動で新しい名前になる', H.cut(g,'oosRtcSheet_'), 'old.setName(OOS_RTC_SHEET)');
  has('⑦タブの中の見出しも新しい名前', w, '🏛 RT専用取り置き・予約（読むだけの鏡・操作は受注Ａの🏛コントロール画面で）');
  has('⑦施設もくじ（左端・押すと飛ぶ）', w, '📑 施設もくじ');
  has('⑦もくじはHYPERLINKで飛ぶ', w, 'HYPERLINK("#gid=');
  has('⑦カードの列（商品／総数／✂️済／✈️待ち／🔒取置／⏰見張り）', w, "['商品（コード品名）','総数','✂️済','✈️待ち','🔒取置','⏰見張り']");
  has('⑦商品の列はモックと同じ横長（265px）', w, '[265,55,50,55,55,150]');
  has('⑦カードの帯は紫（モックの色）', w, "'#4a3f8c'");
  has('⑦🔒の列は緑・✈️の列はオレンジ（モックの色）', w, "'#e8f5e9'");
  has('⑦⏰の🟡は色だけ（LINEは送らない）', w, '🟡 ');
  /* ひろみさん「見張りの連絡ラインはひとまずいらない」→ 送る道具を1つも呼んでいないことを見張る
     （説明のコメントに「LINE連絡はしない」と書いてあるのは可。呼び出しが無いことを見る） */
  eq('⑦⏰でLINEを送っていない（ひろみさん指示）', /oosLineBroadcast|oosLinePush|sendLine|MailApp|UrlFetchApp/.test(w), false);
  has('⑦🧾伝票の履歴は1セル1情報（商品/本数/伝票番号/宛先/日付）', w, "['🧾 伝票の履歴','本数','伝票番号','宛先','日付','']");
  has('⑦見張りの日数は仮の決め（変えられるように定数）', g, 'var OOS_RTC_WAIT_DAYS');
  has('⑦読むだけの鏡（操作は受注Ａ）', H.cut(g,'oosRtControlSetup'), '読むだけの鏡です（操作は受注Ａの🏛コントロール画面で）');
  has('⑦古いRT残高一覧は（旧）に改名', H.cut(g,'oosRtControlSetup'), '（旧）RT残高一覧');
  has('⑦取り置き・予約シートからRTの行を外す', H.cut(g,'oosHonbuSync'), "hasRtc && (o.customerType==='rt' || o.customerType==='RT')");
  has('⑦毎時の鏡でRTコントロールも描き直す', H.cut(g,'oosHonbuSync'), 'oosRtControlWrite_(srtc');
  has('⑦入口（1回だけ実行）がルートにある', g, "action === 'rtControlSetup'");
  eq('⑦鏡は在庫を触らない（書き込みは自分のタブだけ）', /applyStockDeduct|在庫データ.*setValues/.test(w), false);
}

console.log('===== 🏛 RT予約の残高一覧（第4弾）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
