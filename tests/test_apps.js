/* ① 受注A・倉庫D・請求C・マスターN が同じ販売可能数を出すか
   ② 不良品の出荷が「選んだ程度×現/旧」からだけ減るか
   ③ 注文番号が重複しないか
   ── すべて本番ファイルの本物の関数で流す。 */
const vm = require('vm');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(got === want) pass++;
  else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}

/* ── 共通の在庫データ（4アプリに同じものを渡す）──────────── */
function DATA(){
  return {
    PRODUCTS: [
      { id:1, sku:'ORG100', name:'オルガニック100ml', boxQty:12 },
      { id:2, sku:'ORG250', name:'オルガニック250ml', boxQty:12 },
      { id:9, sku:'SET-A',  name:'ギフトセットA', isSet:true, components:[{sku:'ORG100',qty:2},{sku:'ORG250',qty:1}] }
    ],
    lots: [
      { id:'a', pid:1, expiry:'2027-01', stock:45, status:'new' },
      { id:'b', pid:1, expiry:'2026-01', stock:38, status:'old' },
      { id:'c', pid:1, expiry:'',        stock:1,  status:'hold_old' },
      { id:'d', pid:1, expiry:'',        stock:3,  status:'discard' },
      { id:'e', pid:2, expiry:'2027-01', stock:20, status:'new' }
    ],
    defects: [
      { id:'d1', pid:1, level:'lv1', qty:2, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'cur', reportedAt:'2026-08-01' },
      { id:'d2', pid:1, level:'lv1', qty:1, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'old', reportedAt:'2026-08-02' },
      { id:'d3', pid:1, level:'lv3', qty:3, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'cur', reportedAt:'2026-08-03' },
      { id:'d4', pid:1, level:'lv3', qty:3, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'old', reportedAt:'2026-08-04' },
      { id:'d5', pid:1, level:'lv2', qty:4, shippedQty:0, status:'open', source:'warehouse', reviewed:false, lotKind:'cur', reportedAt:'2026-08-05' }
    ],
    holds: [{ pid:1, qty:10 }]
  };
}
const STUB = {};
['renderInvTable','renderLotList','renderCatSummary','renderDefectGroups','renderInvLogs','scheduleAutoSave',
 'showSyncStatus','renderReportList','renderList','updateSummary','syncOrdersToGAS','saveAllDataToGAS',
 'renderStockList','renderOrders','showToast','renderBilling','esc','addLog']
 .forEach(n => { STUB[n] = function(){ return ''; }; });

function build(file, names, extra){
  const src = H.read(file);
  let code = '';
  names.forEach(n => { try{ code += H.cut(src, n) + '\n'; }catch(e){ code += `/* ${n} 見つからず */\n`; } });
  const d = DATA();
  const { box, ctx } = H.makeSandbox(Object.assign({}, STUB, {
    lots: d.lots, defects: d.defects, holds: d.holds, PRODUCTS: d.PRODUCTS, products: d.PRODUCTS,
    preorders: [], orders: [], invLogs: [], logs: [], _resCache: null, idSeq: 1, invEditMode: true
  }, extra || {}));
  H.runZaiko(ctx);
  vm.runInContext(code, ctx);
  box.__ctx = ctx;
  return box;
}

/* ═══ ① 4アプリの突き合わせ ═══════════════════════════ */
const M = build('master.html', ['findProduct','findProductBySku','isActiveDefect','reservedByPidCache','computeStockNumbers','computeAvailable']);
/* 受注Aは holds を持たず、取り置き注文（status='held'）から毎回作り直す。同じ10本になる注文を渡す */
const A = build('index.html',  ['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable'],
  { orders: [{ id:'o1', status:'held', lines:[{ productId:1, bottles:10, boxes:0 }] }] });
const D = build('pickup.html', ['stockNumbersFor']);
const B = build('billing.html',['computeStockNumbersB']);

eq('① 受注Aの取り置きが注文から10本できている', A.buildHoldsForZaiko()[0].qty, 10);
['ORG100','ORG250','SET-A'].forEach(function(sku){
  const want = M.computeAvailable(sku);
  eq(`① ${sku} 受注A = マスターN（${want}）`, A.computeAvailable(sku), want);
});
const mn = M.computeStockNumbers(1);
const dn = D.stockNumbersFor(1, D.lots, D.defects, D.holds);
const bn = B.computeStockNumbersB(1, B.holds);
eq('① 倉庫D 販売可能 = マスターN', dn.sellable, mn.sellable);
eq('① 倉庫D 実在庫   = マスターN', dn.stock,    mn.stock);
eq('① 請求C 販売可能 = マスターN', bn.sellable, mn.sellable);
eq('① 請求C 実在庫   = マスターN', bn.stock,    mn.stock);
eq('① マスターN 現ロット販売可能', mn.cur.sellable, 35);
eq('① マスターN 実在庫（現+旧）',  mn.stock, (45+2+3) + (38+1+3+1));
eq('① 廃棄3本は実在庫に入っていない', mn.cur.discardQty, 3);

/* 親を変えたら4アプリとも追随するか（取置10→20） */
[M, D, B].forEach(function(app){ app.holds.length = 0; app.holds.push({ pid:1, qty:20 }); });
A.orders[0].lines[0].bottles = 20;
eq('① 取置20に変えたら 受注A 25',    A.computeAvailable('ORG100'), 25);
eq('① 取置20に変えたら マスターN 25', M.computeAvailable('ORG100'), 25);
eq('① 取置20に変えたら 倉庫D 25',    D.stockNumbersFor(1, D.lots, D.defects, D.holds).sellable, 25);
eq('① 取置20に変えたら 請求C 25',    B.computeStockNumbersB(1, B.holds).sellable, 25);

/* ═══ ② 不良品の出荷（程度×現/旧 からだけ減る）═══════════ */
function freshA(){
  const b = build('index.html', ['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
    'deductFromDefects','lotStockFor','defectStockFor','condAvail','defectBuckets','condRemainFor','conditionOptionsHtml'],
    { orders: [] });
  vm.runInContext(H.cutVar(H.read('index.html'), 'DEFECT_LEVELS'), b.__ctx);
  return b;
}
function pic(app){
  const g = {};
  app.defects.forEach(function(d){
    if(!app.isActiveDefect(d)) return;
    const lv = d.level==='lv1' ? 'lv1' : (d.level==='lv3' ? 'lv3' : 'lv2');
    const lk = d.lotKind==='old' ? 'old' : 'cur';
    g[lv+'|'+lk] = (g[lv+'|'+lk]||0) + ((d.qty||0)-(d.shippedQty||0));
  });
  return g;
}
let a = freshA();
eq('② 減らす前 軽(現)', pic(a)['lv1|cur'], 2);
eq('② 減らす前 重(現)', pic(a)['lv3|cur'], 3);
eq('② 減らす前 重(旧)', pic(a)['lv3|old'], 3);

a = freshA();
a.deductFromDefects(1, 2, [], 'lv1', 'cur');           // 軽（現ロット）から2本
let g = pic(a);
eq('② 軽(現)2本出荷 → 軽(現) 0', g['lv1|cur']||0, 0);
eq('② 軽(現)2本出荷 → 重(現) 3のまま', g['lv3|cur'], 3);
eq('② 軽(現)2本出荷 → 重(旧) 3のまま', g['lv3|old'], 3);
eq('② 軽(現)2本出荷 → 軽(旧) 1のまま', g['lv1|old'], 1);

a = freshA();
a.deductFromDefects(1, 2, [], 'lv3', 'old');           // 重（旧ロット）から2本
g = pic(a);
eq('② 重(旧)2本出荷 → 重(旧) 1', g['lv3|old'], 1);
eq('② 重(旧)2本出荷 → 重(現) 3のまま', g['lv3|cur'], 3);
eq('② 重(旧)2本出荷 → 軽(現) 2のまま', g['lv1|cur'], 2);

a = freshA();
a.deductFromDefects(1, 99, [], 'lv1', 'cur');          // 在庫より多く指定
g = pic(a);
eq('② 残りを超える指定でも 他の程度には手を出さない（重(現)）', g['lv3|cur'], 3);
eq('② 残りを超える指定でも 他のロットには手を出さない（軽(旧)）', g['lv1|old'], 1);

/* 未反映（倉庫報告 reviewed=false）の不良は出荷対象に出ない */
a = freshA();
eq('② 未反映の中(現)は数に入らない', (pic(a)['lv2|cur']||0), 0);

/* 選択肢は8つ・0本は選べない */
a = freshA();
const html = a.conditionOptionsHtml(1, 'normal');
const opts = (html.match(/<option/g) || []).length;
const dis  = (html.match(/disabled/g) || []).length;
eq('② 状態の選択肢は8つ', opts, 8);
eq('② 0本の選択肢は選べない（中・現／中・旧／軽・旧以外…）', dis > 0, true);

/* ═══ ③ 注文番号が重複しないか（3,000本）═══════════════ */
const src = H.read('index.html');
const O = H.makeSandbox({ orders: [] });
['todayYmd','orderNumCode'].forEach(function(n){ vm.runInContext(H.cut(src, n), O.ctx); });
vm.runInContext(H.cut(src, 'nextOrderNum'), O.ctx);
eq('③ 暗号表 バサラ=BA', O.box.orderNumCode('basara'), 'BA');
eq('③ 暗号表 定価=TK',   O.box.orderNumCode('general'), 'TK');
eq('③ 暗号表 不良特価=FT', O.box.orderNumCode('defectprice'), 'FT');
const seen = new Set(); let dup = 0; let badFmt = 0;
for(let i = 0; i < 3000; i++){
  const num = O.box.nextOrderNum(0, 'basara');
  if(!/^BA-\d{8}-\d{4}$/.test(num)) badFmt++;
  if(seen.has(num)) dup++;
  seen.add(num);
  O.box.orders.push({ num: num });
}
eq('③ 注文番号の形（暗号-日付-ランダム4桁）が崩れた数', badFmt, 0);
eq('③ 3,000本つくって重複した数', dup, 0);

/* お客様の注文ページ（order.html）も同じ形か */
/* お客様の注文ページ（order.html）。
   ここは番号を作る瞬間には他の注文が見えないので、作るところでは重複を防げない。
   決まり（すでにある番号と同じなら引き直す）は【保存の直前】に効く（reissueNumIfTaken）。
   だから、実際に走る順番どおり「作る → 保存直前に引き直す」で測る。 */
const fsMod = require('fs');
const orderSrc = fsMod.readFileSync(require('path').join(__dirname,'..','order.html'), 'utf8');
const O2 = H.makeSandbox({ PAYLOAD: { customer: { type:'general' } }, ORDER_NUM: '' });
try{
  ['orderNumCode','genOrderNum','reissueNumIfTaken'].forEach(n => vm.runInContext(H.cut(orderSrc, n), O2.ctx));
  const saved = []; let d2 = 0, b2 = 0;
  for(let i = 0; i < 3000; i++){
    const ord = { id:'o'+i, num: O2.box.genOrderNum() };
    O2.box.reissueNumIfTaken(ord, saved);              // ★保存直前の引き直し
    if(!/^TK-\d{8}-\d{4}$/.test(ord.num)) b2++;
    if(saved.some(s => s.num === ord.num)) d2++;
    saved.push(ord);
  }
  eq('③ order.html の形が崩れた数', b2, 0);
  eq('③ order.html で重複した数（3,000本）', d2, 0);
}catch(e){ fails.push('③ order.html を動かせず: ' + e.message); fail++; }

/* ══════════════════════════════════════════════════════════════════════
   ④ 同梱書類の既定は「納品書兼請求書」か（★2026-08-19 ひろみさん指示）

   ひろみさんの言葉:「納品書兼請求書を同梱したい。前に作ったのに、また消えてる」
   原因は、既定値が「納品書」のままだったこと。新規登録・画面のリセット・編集で開いたとき、
   いずれも「納品書」に戻るので、納品書兼請求書の指定が上書きされて消えていた。
   ★「納品書」に戻さないでください。バサラだけは「なし」（2026-08-18 決定）。
   ══════════════════════════════════════════════════════════════════════ */
const idxSrc = H.read('index.html');

eq('④ 登録画面で最初からチェックが入っているのは「納品書兼請求書」',
   /value="納品書兼請求書"[^>]*checked>/.test(idxSrc), true);
eq('④ 「納品書」には最初からチェックを入れない',
   /value="納品書"[^>]*checked>/.test(idxSrc), false);
eq('④ 画面をまっさらに戻したときも「納品書兼請求書」',
   idxSrc.indexOf("x.checked = (x.value==='納品書兼請求書' && !x.getAttribute('data-doc'))") >= 0, true);
eq('④ 受注を編集で開いたとき、空なら「納品書兼請求書」',
   idxSrc.indexOf("var enc = o.enclosedDoc || '納品書兼請求書';") >= 0, true);
eq('④ バサラのカード編集は、空なら「なし」',
   idxSrc.indexOf("o.enclosedDoc || (isBasaraOrder(o) ? 'なし' : '納品書兼請求書')") >= 0, true);
eq('④ バサラのメール取込は「同梱書類なし」を選んだ形',
   idxSrc.indexOf("cb.checked = (cb.getAttribute('data-doc')==='none')") >= 0, true);
eq('④ 出荷依頼書の表示も、空なら「納品書兼請求書」',
   idxSrc.indexOf("const encDoc = o.enclosedDoc || (_isBasara ? 'なし' : '納品書兼請求書');") >= 0, true);
/* ★2026-08-19 LINEを送る前に同梱書類の中身を確認できること（ひろみさん指示） */
const pkSrc = H.read('pickup.html');
eq('④ 受注Ａに「中身を見る」ボタンがある', idxSrc.indexOf('の中身を見る</button>') >= 0, true);
eq('④ そのボタンは倉庫Ｄの確認画面を開く', idxSrc.indexOf("'?id=' + encodeURIComponent(orderId) + '&doc=1'") >= 0, true);
eq('④ 書類なしのときはボタンを出さない', idxSrc.indexOf("if(encDoc && encDoc !== 'なし'){") >= 0, true);
eq('④ 倉庫Ｄに確認だけの画面がある', pkSrc.indexOf('function renderDocPreview()') >= 0, true);
const _docFn = pkSrc.slice(pkSrc.indexOf('function renderDocPreview()'), pkSrc.indexOf('function renderAlreadyShipped()'));
eq('④ 確認画面は倉庫と同じ関数で書類を描く', _docFn.indexOf('buildInvoiceHtml(o)') >= 0, true);
eq('④ 確認画面には梱包完了ボタンを出さない', _docFn.indexOf('completeOrder') < 0, true);

eq('④ 倉庫Ｄでも、空なら「納品書兼請求書」を印刷する',
   H.read('pickup.html').indexOf("const encDoc = o.enclosedDoc || '納品書兼請求書';") >= 0, true);

/* ══════════════════════════════════════════════════════════════════════
   ⑤ お客様にお渡しする書類（★2026-08-19 ひろみさん指示）

   ・表題は、受注Ａで選んだ同梱書類の名前をそのまま出す（「納品書」で固定しない）
   ・請求書・領収書を兼ねるときは【金額】と【お振込先】を入れる
   ・印刷は【A4 縦 1枚】（landscape 固定に戻すと倉庫の印刷代が倍になる）
   ・体裁は見積・請求書Ｍで決めたもの（oos-doc.js）を使う
   ══════════════════════════════════════════════════════════════════════ */
const pkSrc2 = H.read('pickup.html');
const docSrc = H.read('oos-doc.js');

eq('⑤ 印刷はA4縦', pkSrc2.indexOf('@page{size:A4 portrait') >= 0, true);
/* ★2026-08-19 ブラウザが勝手に足す【日付・ページ名・URL】を印刷に出さない
   （お客様に倉庫アプリのURLが渡ってしまうため）。紙の余白は0にして、書類側のpaddingで作る */
eq('⑤ 紙の余白は0（ヘッダー・フッターを出さないため）', pkSrc2.indexOf('@page{size:A4 portrait;margin:0}') >= 0, true);
eq('⑤ 余白は書類側のpaddingで作る', H.read('oos-doc.js').indexOf('padding:11mm 12mm!important') >= 0, true);
eq('⑤ 本文は11pt', pkSrc2.indexOf('.invoice-doc{font-size:11pt}') >= 0, true);
/* ★2026-08-19 QRコードは出さない（ひろみさん「QRはつけてない」）／
   印刷用の詰めは oos-doc.js のいちばん最後に置く（pickup.html 側だと上書きされて2枚になる） */
eq('⑤ QRコードを出さない', pkSrc2.indexOf('id="gift-qr"') < 0, true);
/* ★2026-08-19 RT発注伝票のPDFを倉庫Ｄからも印刷できること（メールだけでなくアプリでも） */
eq("⑤ 発注伝票PDFをDriveに保存している", idxSrc.indexOf("function rtSaveSlipToDrive()") >= 0, true);
eq("⑤ 伝票を読み取ったあと保存を呼んでいる", idxSrc.indexOf("rtSaveSlipToDrive();") >= 0, true);
eq("⑤ 倉庫Ｄのボタン名がRT発注伝票になっている", pkSrc2.indexOf("RT発注伝票（PDF）を開いて印刷する") >= 0, true);
/* ★2026-08-19 ゆかさん報告：RT取込から受注登録に移すと商品が1品に減っていた。
   伝票にある商品を【全部】渡すこと。★1品目だけに戻さないでください */
eq("⑤ RT取込は商品を全部渡す（1品目だけにしない）",
   idxSrc.indexOf("const rtLines = (p.lines || []).filter(") >= 0, true);
eq("⑤ 2品目からは行を足して入れる",
   idxSrc.indexOf("if(i > 0 && typeof addRecipientLine === 'function') addRecipientLine(card.id);") >= 0, true);
eq("⑤ p.lines[0] だけを見る書き方が残っていない",
   idxSrc.indexOf("const ln = p.lines[0] || {};") < 0, true);
/* ★2026-08-19 出荷依頼書の選択に、倉庫へ送信ずみの受注を出さない（ひろみさん指示） */
eq("⑤ 出荷依頼書の選択は未送信だけ", idxSrc.indexOf("o.status==='pending' && !o.notified") >= 0, true);
eq("⑤ 送信ずみを全部出す書き方が残っていない", idxSrc.indexOf("const pending = orders.filter(o=>o.status==='pending');") < 0, true);
eq("⑤ 何件待っているか画面に出す", idxSrc.indexOf("まだ倉庫へ送っていない受注：") >= 0, true);
/* ★2026-08-19 ゆかさん要望：RT取込の②で商品を何品でも足せること */
eq("⑤ RT取込に「＋ 商品を追加」がある", idxSrc.indexOf("＋ 商品を追加") >= 0, true);
eq("⑤ 商品行は番号で作る（1品固定でない）", idxSrc.indexOf("function rtLineRowHtml(ln, i)") >= 0, true);
eq("⑤ 増やす・減らすがある", idxSrc.indexOf("function rtAddLine()") >= 0 && idxSrc.indexOf("function rtRemoveLine(i)") >= 0, true);

/* ══════════════════════════════════════════════════════════════════════
   ⑥ RTの流れ（★2026-08-19 ゆかさんの設計提案どおり）
     ① まず計算する … 商品・本数・単価・送料（明細の親）
     ② 発注伝票を取り込む … お届け先・伝票番号・納品日だけを読む
     納品書 … ①の明細＋送料 ＋ ②の宛先
   ══════════════════════════════════════════════════════════════════════ */
eq('⑥ ①の明細を②へ引き継ぐ道具がある', idxSrc.indexOf('function rtPullFromCalc(silent)') >= 0, true);
eq('⑥ 送料も一緒に引き継ぐ', idxSrc.indexOf('rtParsed.shipFee = rtCalcShipFee();') >= 0, true);
eq('⑥ 伝票を読んだら①の明細を自動で入れる', idxSrc.indexOf('if(_calc.length){ rtParsed.lines = _calc;') >= 0, true);
eq('⑥ 納品書に送料の行を出す', idxSrc.indexOf("rows += '<tr><td class=\"d-tekiyo\">送料</td>") >= 0, true);
eq('⑥ 送料は10%対象で数える', idxSrc.indexOf('rateSub[10] = (rateSub[10]||0) + _sf;') >= 0, true);
eq('⑥ ①から来たことを②の画面に出す', idxSrc.indexOf('①「まず計算する」の明細をそのまま入れています') >= 0, true);
eq('⑥ 倉庫Ｄの伝票は1か所だけ（①と③に分けない）',
   (pkSrc2.match(/RT発注伝票（PDF）を開いて印刷する/g)||[]).length === 1, true);
eq('⑥ PDFが無い注文にはメールを見るよう案内する',
   pkSrc2.indexOf('本部から届いたメールの添付を印刷してください') >= 0, true);

/* ①→② の引き継ぎを、本物の関数で動かして確かめる */
try{
  function calcRow(pid, qty, price){
    return { querySelector: function(sel){
      if(sel === '.rtc-prod') return { value: String(pid) };
      if(sel === '.rtc-qty')  return { value: String(qty) };
      if(sel === '.rtc-price') return { value: String(price) };
      return null; } };
  }
  var CALC = [], SHIP = 0;
  var dom = {
    getElementById: function(id){
      if(id === 'rtc-shipping') return { value: String(SHIP) };
      return { value:'', style:{}, innerHTML:'', textContent:'', appendChild:function(){}, querySelector:function(){ return null; } };
    },
    querySelectorAll: function(sel){ return sel.indexOf('rtc-rows') >= 0 ? CALC : []; },
    querySelector: function(){ return null; },
    createElement: function(){ return { style:{}, innerHTML:'', appendChild:function(){}, querySelector:function(){ return null; } }; },
    body:{ appendChild:function(){}, removeChild:function(){}, style:{} }, addEventListener:function(){}
  };
  var R = H.makeSandbox({ document: dom, alert: function(){} });
  vm.runInContext(H.cutVar(idxSrc, 'PRODUCTS'), R.ctx);
  vm.runInContext('function esc(s){ return String(s==null?"":s); } function productOptionsHtml(){ return ""; } function showSyncStatus(){} function renderRtPreview(){} var rtParsed = null; var RT_SEAL_IMG = "";', R.ctx);
  ['_rtLineRate','rtCalcLines','rtCalcShipFee','rtPullFromCalc','rtDeliveryNoteHtml'].forEach(function(n){ vm.runInContext(H.cut(idxSrc, n), R.ctx); });
  var pr = R.box.PRODUCTS.filter(function(p){ return !p.isSet; });
  CALC = [ calcRow(pr[0].id, 20, 7110), calcRow(pr[1].id, 10, 2613) ];
  SHIP = 3906;
  eq('⑥ ①から②へ引き継げる', R.box.rtPullFromCalc(true), true);
  eq('⑥ 商品が2品とも入る', R.box.rtParsed.lines.length, 2);
  eq('⑥ 本数がそのまま入る', R.box.rtParsed.lines[0].bottles, 20);
  eq('⑥ 単価がそのまま入る', R.box.rtParsed.lines[0].unitPrice, 7110);
  eq('⑥ 送料がそのまま入る', R.box.rtParsed.shipFee, 3906);
  R.box.rtParsed.recipientName = 'テストホテル'; R.box.rtParsed.slipNo = '360774'; R.box.rtParsed.nouhinNo = '360774';
  var note = R.box.rtDeliveryNoteHtml();
  eq('⑥ 納品書に1品目が載る', note.indexOf(pr[0].name) >= 0, true);
  eq('⑥ 納品書に2品目が載る', note.indexOf(pr[1].name) >= 0, true);
  eq('⑥ 納品書に送料が載る', note.indexOf('>送料<') >= 0 && note.indexOf('3,906') >= 0, true);
  /* ★2026-08-24 ひろみさん確定：消費税の端数は【切り捨て】。
     ①「まず計算する」のアイポーター逆算と、納品書の合計を1円もずらさないため。
     ★ここを Math.round に戻さないでください。 */
  var y8 = 20*7110 + 10*2613;
  var total = y8 + Math.floor(y8*0.08) + 3906 + Math.floor(3906*0.10);
  eq('⑥ 合計が 商品＋8% ＋ 送料＋10% になる', note.indexOf(total.toLocaleString()) >= 0, true);
  CALC = []; SHIP = 0;
  R.box.rtParsed.lines = [{ productId:pr[0].id, productName:pr[0].name, bottles:5, unitPrice:1000, matched:true, taxRate:8 }];
  eq('⑥ ①が空のときは②の中身をこわさない', R.box.rtPullFromCalc(true), false);
  eq('⑥ そのとき明細も消えない', R.box.rtParsed.lines.length, 1);
}catch(e){ fails.push('⑥ RTの流れを動かせませんでした: ' + e.message); fail++; }
eq("⑤ 何品渡したか画面に出す",
   idxSrc.indexOf("（商品 ' + rtLines.length + ' 品）") >= 0, true);
/* ★版の番号を上げ忘れない（今日いちばんの反省） */
/* ★2026-08-20 ここは日付を決め打ちしていたため、日が変わるたびに落ちて他の見張りが読めなくなった。
   すぐ下の「version.json と pickup.html の版が一致」で版の上げ忘れは捕まえられるので、この行はやめた。
   ★版の見張り自体を消したわけではありません（下の行が本体です）。 */
eq("⑤ version.json と pickup.html の版が一致", JSON.parse(H.read("version.json")).pages["pickup.html"] === (/name="oos-version" content="([^"]+)"/.exec(pkSrc2)||[])[1], true);
eq("⑤ version.json と index.html の版が一致", JSON.parse(H.read("version.json")).pages["index.html"] === (/name="oos-version" content="([^"]+)"/.exec(idxSrc)||[])[1], true);
eq('⑤ 印刷用の詰めが体裁ファイルの最後にある', H.read('oos-doc.js').indexOf('const PRINT_TIGHT') >= 0, true);
/* ★2026-08-19 実機で164通り刷って分かったこと：商品が多いと2枚になっていた。
   商品の数で3段階に詰める仕掛けを入れ、11品までA4縦1枚に収まることを実機で確認。
   ★この3段階を消すと2枚に戻ります */
eq('⑤ 商品が多いときの詰めが3段階ある',
   H.read('oos-doc.js').indexOf('.doc-dense1') >= 0 && H.read('oos-doc.js').indexOf('.doc-dense2') >= 0 && H.read('oos-doc.js').indexOf('.doc-dense3') >= 0, true);
eq('⑤ 品数で詰め方を切り替えている', H.read('oos-doc.js').indexOf('items.length >= 11') >= 0, true);
eq('⑤ 12品以上は2枚になると先に知らせる', pkSrc2.indexOf('A4で2枚</b>になります') >= 0, true);
eq('⑤ 外枠を出さない', H.read('oos-doc.js').indexOf('const NOFRAME') >= 0, true);
/* ★2026-08-19 書類をPDFファイルとして保存できること（ひろみさん「ダウンロードできるスタイルに」） */
eq('⑤ PDFで保存するボタンがある', pkSrc2.indexOf('📥 PDFで保存する') >= 0, true);
eq('⑤ PDFにする道具を読み込んでいる', pkSrc2.indexOf('jspdf.umd.min.js') >= 0 && pkSrc2.indexOf('html2canvas.min.js') >= 0, true);
eq('⑤ PDFの作り方はＭと同じ（A4縦1枚に収める）', H.read('oos-doc.js').indexOf('async function downloadPdf(el, filename)') >= 0, true);
eq('⑤ 横向き固定に戻っていない', /@page\{size:A4 landscape;margin:0\}\s*\n/.test(pkSrc2), false);
eq('⑤ のしのときだけ横にする', pkSrc2.indexOf("_land.textContent = '@page{size:A4 landscape;margin:0}'") >= 0, true);
eq('⑤ 共有の体裁ファイルを読んでいる', pkSrc2.indexOf('oos-doc.js?v=') >= 0, true);
eq('⑤ 体裁ファイルがある（Ｍと同じ見た目）', docSrc.indexOf('.doc2-title') >= 0 && docSrc.indexOf('.doc2-grand') >= 0, true);
eq('⑤ 会社の登録番号が入っている', docSrc.indexOf('T9012801020687') >= 0, true);
eq('⑤ お振込先を持っている', docSrc.indexOf('三井住友銀行') >= 0, true);
eq('⑤ 表題は選んだ書類名から作る', pkSrc2.indexOf("String(o.enclosedDoc).split(' ＋ ')[0]") >= 0, true);
eq('⑤ 請求書・領収書のときだけ金額を入れる',
   pkSrc2.indexOf("return d.indexOf('請求書') >= 0 || d.indexOf('領収書') >= 0;") >= 0, true);
eq('⑤ 単価の出し方は売上Ｃと同じ（写し）',
   pkSrc2.indexOf("const map = { general:'priceGeneral', wholesale1:'priceWholesale1', wholesale2:'priceWholesale2', rt:'priceRT', rtgc:'priceRT', basara:'priceBasara', special:'priceSpecial', defectprice:'priceDefect' };") >= 0
   && H.read('billing.html').indexOf("const map = { general:'priceGeneral', wholesale1:'priceWholesale1', wholesale2:'priceWholesale2', rt:'priceRT', rtgc:'priceRT', basara:'priceBasara', special:'priceSpecial', defectprice:'priceDefect' };") >= 0, true);
eq('⑤ 箱数での卸②昇格も売上Ｃと同じ',
   pkSrc2.indexOf('const BULK_UPGRADE_BOXES = 6;') >= 0 && H.read('billing.html').indexOf('const BULK_UPGRADE_BOXES = 6;') >= 0, true);

/* 本物の関数で「納品書兼請求書」を1枚作ってみる */
try{
  const D = H.makeSandbox({});
  vm.runInContext(docSrc, D.ctx);
  vm.runInContext(H.cutVar(pkSrc2, 'PRODUCTS'), D.ctx);
  vm.runInContext(H.cutVar(pkSrc2, 'CTYPE_BADGE'), D.ctx);
  vm.runInContext("var COMPANY_WEBSITE='x'; var COMPANY_EMAIL='y'; var PRICE_MASTER=[];", D.ctx);
  vm.runInContext(H.cutVar(pkSrc2, 'BULK_UPGRADE_BOXES'), D.ctx);
  vm.runInContext(H.cutVar(pkSrc2, 'OOS_DOC_NAMES'), D.ctx);
  ['esc','findProduct','lineTotal','recipientAddressBlock','findProductBySku','defaultTaxRateForGroup',
   'taxRateForSku','effectiveCustomerType','lineTierType','priceForSku','docTitleOf','docNumberOf','docSlipNoOf','docDeliveryDateOf','invoiceNeedsAmount','buildInvoiceHtml']
    .forEach(n => vm.runInContext(H.cut(pkSrc2, n), D.ctx));
  vm.runInContext("PRICE_MASTER = [{sku:'MEM2L', priceGeneral:24300, taxRate:0.08}];", D.ctx);
  const pid = (D.box.PRODUCTS.find(p => p.sku === 'MEM2L') || {}).id;
  const ord = { id:'t1', num:'TK-1', recipientName:'テスト 花子', client:'テスト 花子',
    customerType:'general', zip:'100-0001', addr:'東京都', tel:'03-0000-0000',
    enclosedDoc:'納品書兼請求書',
    lines:[{ productId:pid, productName:'メメジック 2L', bottles:1, boxes:0, boxQty:1 }] };
  const h = D.box.buildInvoiceHtml(ord);
  eq('⑤ 表題が「納品書兼請求書」になる', /class="doc2-title">納品書兼請求書</.test(h), true);
  eq('⑤ 単価が出る（24,300円）', h.indexOf('¥24,300') >= 0, true);
  eq('⑤ 消費税8%が出る（1,944円）', h.indexOf('¥1,944') >= 0, true);
  eq('⑤ 合計（税込）が出る（26,244円）', h.indexOf('¥26,244') >= 0, true);
  eq('⑤ お振込先が出る', h.indexOf('お振込先') >= 0, true);
  /* ★2026-08-19 個人のお客様は三菱UFJ（ナカムラヒロミ）。会社は三井住友。★入れ替えない */
  eq('⑤ 個人のお客様の振込先は三菱UFJ', h.indexOf('三菱UFJ銀行') >= 0, true);
  eq('⑤ 個人のお客様に三井住友を出さない', h.indexOf('三井住友') < 0, true);
  const hK = D.box.buildInvoiceHtml(Object.assign({}, ord, {isCompany:true, companyName:'テスト株式会社', enclosedDoc:'納品書兼請求書'}));
  eq('⑤ 会社のお客様の振込先は三井住友', hK.indexOf('三井住友銀行') >= 0, true);
  eq('⑤ 内訳（消費税・合計）は右に寄せる', H.read('oos-doc.js').indexOf('.doc2-breakdown{display:flex;justify-content:flex-end') >= 0, true);
  ord.enclosedDoc = '納品書';
  const h2 = D.box.buildInvoiceHtml(ord);
  eq('⑤ 「納品書」のときは表題も納品書', /class="doc2-title">納品書</.test(h2), true);
  eq('⑤ 「納品書」のときは金額を出さない', h2.indexOf('ご請求金額') < 0, true);
  eq('⑤ 「納品書」のときはお振込先を出さない', h2.indexOf('お振込先') < 0, true);

  /* ══════════════════════════════════════════════════════════════════
     ★2026-08-19 ひろみさん指示（最重要）
     「納品書は、納品書です。RTは私たちの隠語だから使ったら絶対にダメ」
     お客様にお渡しする書類に、社内の言葉が1文字でも出たら FAIL にします。
     ══════════════════════════════════════════════════════════════════ */
  var NGWORDS = ['RT','RTGC','卸','バサラ','不良','特価','特別提供','定価','アイポーター','TK-','BA-','OS1','OS2','FT-','IT-'];
  var DOCCASES = [
    { name:'RT（伝票取込）', o:{ customerType:'rt', num:'RT-20260819-3528', enclosedDoc:'RT発注伝票＋納品書',
        note:'RT伝票取込 ／ 伝票番号 360774 ／ 納品予定日 2026/8/25', isCompany:true,
        companyName:'リゾートトラスト㈱', deptName:'EC営業課' }, title:'納品書' },
    { name:'一般', o:{ customerType:'general', num:'TK-20260819-7862', enclosedDoc:'納品書兼請求書', note:'' }, title:'納品書兼請求書' },
    { name:'バサラ', o:{ customerType:'basara', num:'BA-20260819-1234', enclosedDoc:'納品書', note:'バサラ（楽天）自動取込' }, title:'納品書' },
    { name:'卸①', o:{ customerType:'wholesale1', num:'OS1-20260819-0001', enclosedDoc:'納品書兼請求書', note:'' }, title:'納品書兼請求書' },
    { name:'不良特価', o:{ customerType:'defectprice', num:'FT-20260819-0002', enclosedDoc:'請求書', note:'' }, title:'請求書' },
    { name:'RTGC', o:{ customerType:'rtgc', num:'RTG-20260819-0003', enclosedDoc:'RT発注伝票＋納品書', note:'伝票番号 999888 ／ 納品予定日 2026/9/1' }, title:'納品書' }
  ];
  DOCCASES.forEach(function(c){
    var order = Object.assign({}, ord, c.o);
    var html = D.box.buildInvoiceHtml(order);
    var text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
    var hit = NGWORDS.filter(function(w){ return text.indexOf(w) >= 0; });
    eq('⑦ ' + c.name + ' の書類に社内の言葉が出ない' + (hit.length ? '（' + hit.join('・') + '）' : ''), hit.length, 0);
    eq('⑦ ' + c.name + ' の表題は「' + c.title + '」', (/class="doc2-title">([^<]*)</.exec(html)||[])[1], c.title);
  });
  /* 伝票から来た注文は、納品日と伝票番号を出す（ゆかさん指摘） */
  var hRtSlip = D.box.buildInvoiceHtml(Object.assign({}, ord, DOCCASES[0].o));
  eq('⑦ 伝票の注文は【納品日】を出す', hRtSlip.indexOf('納品日：2026/8/25') >= 0, true);
  eq('⑦ 伝票の注文は【伝票番号】を出す', hRtSlip.indexOf('伝票番号：360774') >= 0, true);
  eq('⑦ 社内の注文番号（RT-…）を出さない', hRtSlip.indexOf('RT-20260819') < 0, true);
  eq('⑦ 区分バッジ（卸●など）を書類に入れない', hRtSlip.indexOf('badge-ctype') < 0, true);

  /* ★2026-08-19 ひろみさんと決めた文言・置き場所。★書き換えないでください */
  eq('⑤ ※印の断り書きは合計のすぐ下にある',
     /合計（税込）[\s\S]{0,200}※印は軽減税率対象商品です/.test(h), true);
  eq('⑤ 「キャンセル・変更について」は入れない', h.indexOf('キャンセル・変更について') < 0, true);
  eq('⑤ 破損の連絡は到着後3日以内', h.indexOf('到着後3日以内') >= 0, true);
  eq('⑤ 「お客様が商品を廃棄された後」と書く', h.indexOf('およびお客様が商品を廃棄された後のご連絡') >= 0, true);
  eq('⑤ 「食品のため承れません」と書く', h.indexOf('破損以外のお客様都合による変更は、食品のため承れません') >= 0, true);
  eq('⑤ 「破損による返品の際は」と書く', h.indexOf('破損による返品の際は') >= 0, true);
  eq('⑤ ギフトの案内は決めた文言', h.indexOf('大切な人にお贈りする最高のギフトをご用意しています') >= 0, true);
  eq('⑤ 休業日の一文は入れない', h.indexOf('お休みをいただいております') < 0, true);
  eq('⑤ 一般のお客様には印鑑（社判）を出さない', h.indexOf('alt="社判"') < 0, true);
  /* ★2026-08-19 ひろみさん指示：卸のお客様には社印が必須 */
  const hOroshi = D.box.buildInvoiceHtml(Object.assign({}, ord, {customerType:"wholesale1", enclosedDoc:"納品書兼請求書"}));
  eq("⑤ 卸のお客様には社印を押す", hOroshi.indexOf("alt=\"社判\"") >= 0, true);
  const hRt = D.box.buildInvoiceHtml(Object.assign({}, ord, {customerType:"rt", enclosedDoc:"納品書兼請求書"}));
  eq("⑤ RTのお客様にも社印を押す", hRt.indexOf("alt=\"社判\"") >= 0, true);
  /* ★2026-08-19 ゆかさん報告：納品書に振込先を出さない／RTは三井住友（法人） */
  eq("⑤ RTの納品書にお振込先を出さない",
     D.box.buildInvoiceHtml(Object.assign({}, ord, {customerType:"rt", enclosedDoc:"RT発注伝票＋納品書"})).indexOf("お振込先") < 0, true);
  eq("⑤ RTでも金額は出す（RTのお約束）",
     D.box.buildInvoiceHtml(Object.assign({}, ord, {customerType:"rt", enclosedDoc:"RT発注伝票＋納品書"})).indexOf("合計（税込）") >= 0, true);
  eq("⑤ RTの請求書は三井住友（法人口座）",
     D.box.buildInvoiceHtml(Object.assign({}, ord, {customerType:"rt", enclosedDoc:"納品書兼請求書"})).indexOf("三井住友銀行") >= 0, true);
  eq("⑤ RTの請求書に三菱UFJを出さない",
     D.box.buildInvoiceHtml(Object.assign({}, ord, {customerType:"rt", enclosedDoc:"納品書兼請求書"})).indexOf("三菱UFJ") < 0, true);
  eq('⑤ お振込先に色の背景を付けない（倉庫が白黒で刷れるように）',
     H.read('oos-doc.js').indexOf('class="invoice-doc-note" style="background:#f7f5f0"') < 0, true);
}catch(e){ fails.push('⑤ 書類を作れませんでした: ' + e.message); fail++; }

console.log('===== 4アプリ突き合わせ／不良出荷／注文番号 =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
