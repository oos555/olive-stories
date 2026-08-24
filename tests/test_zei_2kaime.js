/* 消費税・第2回点検で直したところの見張り（2026-08-24 新設）

   1回目（test_zeiritsu.js）で「紙袋が8%」を直したあと、
   ひろみさんの「ほかの角度から、消費税の抜け・もれ・間違いを探して」で
   さらに見つかった分です。ここで直したことが消えていないかを見張ります。

   ★決めごと（2026-08-24 ひろみさん確定・変更禁止）
     Ｂ 倉庫ピッキング手数料は【税抜】。お客様の注文ページで消費税10%を必ず足す
       （卸①② 250円→275円／RT 700円→770円）
     Ｄ 倉庫Ｄの納品書兼請求書に、送料と倉庫手数料の行を出す
       ・送料は税込で持っているので、書類では税抜に割り戻して10%で出す
       ・金額を持っていない注文は「送料は別途申し受けます」と書く（黙って0円にしない）
       ・そのために、ＧＡＳが送料・手数料を捨てないようにした
     Ｅ 売上Ｃの請求書に ※印（軽減税率対象である旨）を入れる
       ・「オープン価格」の注記は ◆ に変える（※の意味がぶつかるため）
     Ｆ 特別見積書（見積Ｍ）の消費税を 8% と 10% に分ける
     Ｇ 価格表（売上Ｃ・見積Ｍ）の金額に「税抜」と明記する

   ★直していないこと（ひろみさんの判断で「今は触らない」）
     Ａ 消費税の端数処理が「1行ごと」になっている件（税理士さんに確認してから）
        → だから、ここでは 1行ごと丸め（Math.round）を前提に金額を確かめています */
const fs = require('fs');
const vm = require('vm');
const R = require('path').join(__dirname, '..') + '/';
const H = require('./harness');
const GAS_PATH = require('path').join(R, '..', 'olive-stories-gas', 'コード.js');

let ok = 0, ng = 0; const bad = [];
function t(name, got, want){ if(String(got) === String(want)) ok++; else { ng++; bad.push(name + '　期待:' + want + '　実際:' + got); } }

/* ── Ｂ お客様の注文ページ：手数料の消費税10% ── */
console.log('\n■ Ｂ 注文ページの倉庫ピッキング手数料に消費税10%');
const ordSrc = fs.readFileSync(R + 'order.html', 'utf8');
t('Ｂ 手数料の消費税を計算している', /var feeTax = Math\.round\(fee \* 0\.10\);/.test(ordSrc), true);
t('Ｂ お支払い合計に手数料の消費税が入っている',
  ordSrc.indexOf('subExcl + tax + fee + feeTax + giftBoxFee + ship') >= 0, true);
{
  const OB = H.makeSandbox({});
  vm.runInContext(H.cut(ordSrc, 'feeFor'), OB.ctx);
  const withTax = function(type){ const f = OB.box.feeFor(type, true); return f + Math.round(f * 0.10); };
  t('Ｂ 卸① バラ出荷 250円 → 税込275円', withTax('wholesale1'), 275);
  t('Ｂ 卸② バラ出荷 250円 → 税込275円', withTax('wholesale2'), 275);
  t('Ｂ RT  バラ出荷 700円 → 税込770円', withTax('rt'), 770);
  t('Ｂ 一般は手数料なし（0円のまま）', withTax('general'), 0);
  t('Ｂ ケース割れが無ければ手数料は0円', OB.box.feeFor('rt', false), 0);
}

/* ── Ｄ 倉庫Ｄの納品書に送料・手数料の行 ── */
console.log('\n■ Ｄ 倉庫Ｄの納品書に送料・倉庫手数料');
{
  const pkSrc = fs.readFileSync(R + 'pickup.html', 'utf8');
  const box = H.makeSandbox({}).box;
  box.document = { createElement: function(){ return { style:{}, textContent:'', appendChild:function(){}, getBoundingClientRect:function(){ return {}; } }; },
                   head:{ appendChild:function(){} }, getElementById: function(){ return null; }, querySelectorAll: function(){ return []; } };
  const ctx = vm.createContext(box);
  vm.runInContext(fs.readFileSync(R + 'oos-doc.js', 'utf8'), ctx);
  ['docTitleOf','docNumberOf','docSlipNoOf','docDeliveryDateOf','invoiceNeedsAmount','buildInvoiceHtml',
   'priceForSku','lineTierType','taxRateForSku','effectiveCustomerType','defaultTaxRateForGroup',
   'findProductBySku','recipientAddressBlock'].forEach(function(fn){
    try{ vm.runInContext(H.cut(pkSrc, fn), ctx); }catch(e){}
  });
  ['OOS_DOC_NAMES','CTYPE_BADGE','COMPANY_WEBSITE','COMPANY_EMAIL','BULK_UPGRADE_BOXES'].forEach(function(v){
    try{ vm.runInContext(H.cutVar(pkSrc, v), ctx); }catch(e){}
  });
  box.PRODUCTS = [{ id:1, sku:'ORG250', name:'オルガニック 250ml', boxQty:20, group:'オルガニック' }];
  box.PRICE_MASTER = [{ sku:'ORG250', priceGeneral:4750 }];
  box.findProduct = function(id){ return box.PRODUCTS.find(function(p){ return String(p.id) === String(id); }); };
  box.esc = function(s){ return String(s == null ? '' : s); };
  box.lineTotal = function(l){ return (l.bottles||0) + (l.boxes||0)*(l.boxQty||1); };

  const baseOrder = { id:'x', num:'TK-20260824-1111', client:'テスト', customerType:'general',
                      enclosedDoc:'納品書兼請求書', recipientName:'テスト', zip:'', addr:'', tel:'',
                      lines:[{ productId:1, productName:'オルガニック 250ml', bottles:2, boxes:0, boxQty:20 }] };
  const h1 = box.buildInvoiceHtml(Object.assign({}, baseOrder, { shippingFee:880, warehouseFee:250 }));
  t('Ｄ 納品書に送料の行が出る', h1.indexOf('送料') >= 0, true);
  t('Ｄ 送料は税抜800円で出る（税込880を割り戻す）', h1.indexOf('800') >= 0, true);
  t('Ｄ 倉庫ピッキング手数料の行が出る', h1.indexOf('倉庫ピッキング手数料') >= 0, true);
  const goods = 4750 * 2;
  const want = goods + Math.round(goods*0.08) + 250 + 25 + 800 + 80;
  t('Ｄ 合計＝商品＋8% ＋（手数料＋送料）＋10%', h1.indexOf(want.toLocaleString()) >= 0, true);
  t('Ｄ 10%対象の内訳が出る', h1.indexOf('10%対象') >= 0, true);

  const h2 = box.buildInvoiceHtml(Object.assign({}, baseOrder, { shippingFee:'', warehouseFee:'' }));
  t('Ｄ 送料が無い注文は「別途申し受けます」と出る', h2.indexOf('送料は別途申し受けます') >= 0, true);
  t('Ｄ そのとき送料の行は出さない（0円と誤解させない）', h2.indexOf('>送料<') >= 0, false);
  t('Ｄ そのとき合計は商品だけ', h2.indexOf((goods + Math.round(goods*0.08)).toLocaleString()) >= 0, true);

  const h3 = box.buildInvoiceHtml(Object.assign({}, baseOrder, { shippingFee:1100, warehouseFee:0 }));
  t('Ｄ 北海道・沖縄の送料 税込1,100 → 税抜1,000で出る', h3.indexOf('1,000') >= 0, true);
  t('Ｄ 手数料0円のときは手数料の行を出さない', h3.indexOf('倉庫ピッキング手数料') >= 0, false);
}

/* ── ＧＡＳが送料・手数料を捨てていないか ── */
console.log('\n■ ＧＡＳが送料・手数料を保存するか');
if(fs.existsSync(GAS_PATH)){
  const g = fs.readFileSync(GAS_PATH, 'utf8');
  ['shippingFee','warehouseFee','shippingZone','orderTotal'].forEach(function(k){
    t('ＧＡＳが ' + k + ' を保存する', g.indexOf(k + ': (o.' + k) >= 0 || g.indexOf(k + ': o.' + k) >= 0, true);
    t('ＧＡＳが ' + k + ' を読み戻す', g.indexOf(k + ': (extra.' + k) >= 0 || g.indexOf(k + ': extra.' + k) >= 0, true);
  });
} else {
  console.log('　（ＧＡＳのフォルダが見つからないので、この項目はとばしました）');
}

/* ── Ｅ 売上Ｃの請求書に ※印 ── */
console.log('\n■ Ｅ 売上Ｃの請求書に ※印（軽減税率対象である旨）');
{
  const b = fs.readFileSync(R + 'billing.html', 'utf8');
  t('Ｅ 明細に ※印 を付けている', b.indexOf("var taxMark = (OOS_ZEI.isReduced(it.taxRate) ? ' ※' : '');") >= 0, true);
  t('Ｅ ※印の説明文がある', b.indexOf('※印は軽減税率対象商品です。') >= 0, true);
  t('Ｅ オープン価格の注記は ◆ に変えた', b.indexOf('◆「オープン価格」は販売最低価格の目安です。') >= 0, true);
  t('Ｅ オープン価格の注記が ※ に戻っていない', b.indexOf('※「オープン価格」') >= 0, false);
}

/* ── Ｆ 特別見積書を8%/10%に分ける ── */
console.log('\n■ Ｆ 特別見積書の消費税を8%と10%に分ける');
{
  const m = fs.readFileSync(R + 'mitsumori.html', 'utf8');
  t('Ｆ 8%対象の行を出す', m.indexOf('8%対象（軽減税率※・税抜）') >= 0, true);
  t('Ｆ 10%対象の行を出す（3種類の書類ぶん）', m.split('10%対象（税抜）').length - 1 >= 3, true);
  t('Ｆ 特別見積書に ※印 の説明がある', m.indexOf('※印は軽減税率対象商品です。') >= 0, true);
}

/* ── Ｇ 価格表に「税抜」 ── */
console.log('\n■ Ｇ 価格表に「税抜」と書く');
['billing.html','mitsumori.html'].forEach(function(f){
  const s = fs.readFileSync(R + f, 'utf8');
  t('Ｇ ' + f + ' 卸の価格表の見出しが（税抜）',
    s.indexOf('<th style="width:18%">上代（税抜）</th>') >= 0, true);
  t('Ｇ ' + f + ' 定価・特価の見出しが（税抜）',
    s.indexOf('<th style="width:20%">定価（税抜）</th>') >= 0, true);
  t('Ｇ ' + f + ' 税抜の但し書きがある',
    s.indexOf('※記載の金額はすべて<strong>税抜</strong>です。') >= 0, true);
});

/* ── 画面の説明文 ── */
console.log('\n■ 画面の説明文が「食品8%」になっているか');
t('説明 受注Ａ', fs.readFileSync(R + 'index.html','utf8').indexOf('・食品＝オイル・ざくろソース（軽減税率 8%）') >= 0, true);
t('説明 注文ページ', fs.readFileSync(R + 'order.html','utf8').indexOf('消費税（食品8%／それ以外10%）') >= 0, true);
t('説明 業務の流れ', fs.readFileSync(R + 'gyomu_flow.html','utf8').indexOf('消費税（食品8%／それ以外は全部10%）') >= 0, true);
t('説明 業務の流れが親（oos-zei.js）を指している',
  fs.readFileSync(R + 'gyomu_flow.html','utf8').indexOf('oos-zei.js') >= 0, true);

/* ── 親を直したときに「古い式が使われ続ける」のを防ぐ ──
   2026-08-24 の見回りで見つかった穴。
   アプリは <script src="oos-zei.js?v=20260824"> のように ?v= を付けて読んでいます。
   oos-zei.js を直したのに ?v= を上げ忘れると、ブラウザは前に取っておいた
   【古い式】を使い続けます。画面は普通に動くので誰も気づけません。
   （ひろみさんが何度も遭った「直したのに古いまま」「戻ったように見える」の正体）
   ★そこで「oos-zei.js が名乗っている版」と「?v=」が同じかを毎回見張ります。
   ★親を直したら、oos-zei.js の VERSION と、4アプリの ?v= の両方を同じ日付にしてください。 */
console.log('\n■ 親を直したとき、古い式が残らないか（?v= の見張り）');
{
  const zei = fs.readFileSync(R + 'oos-zei.js', 'utf8');
  const m = /VERSION = '([^']+)'/.exec(zei);
  t('親が版を名乗っている', !!m, true);
  const nanoru = m ? m[1].replace(/-/g, '') : '';   // 2026-08-24 → 20260824
  const APPS = ['index.html','billing.html','mitsumori.html','pickup.html'];
  const tsuketa = [];
  APPS.forEach(function(f){
    const s = fs.readFileSync(R + f, 'utf8');
    const mm = /src="oos-zei\.js\?v=([0-9]+)"/.exec(s);
    t(f + ' が ?v= を付けて親を読んでいる', !!mm, true);
    if(mm) tsuketa.push(mm[1]);
    t(f + ' の ?v= が親の版と同じ（' + nanoru + '）', mm ? mm[1] : '(なし)', nanoru);
  });
  t('4アプリの ?v= が全部そろっている',
    tsuketa.length === APPS.length && tsuketa.every(function(v){ return v === tsuketa[0]; }), true);

  /* 共通書類（oos-doc.js）も同じ考え方。倉庫Ｄだけが読んでいます */
  const pk = fs.readFileSync(R + 'pickup.html', 'utf8');
  t('倉庫Ｄが oos-doc.js を ?v= 付きで読んでいる', /src="oos-doc\.js\?v=[0-9a-z]+"/.test(pk), true);
  t('倉庫Ｄは 親（oos-zei.js）を 書類（oos-doc.js）より先に読んでいる',
    pk.indexOf('src="oos-zei.js') < pk.indexOf('src="oos-doc.js'), true);
}

/* ── まとめ ── */
console.log('\n===== 消費税・第2回点検 =====');
console.log('PASS ' + ok + ' / FAIL ' + ng);
if(ng){ console.log('--- FAIL の中身 ---'); bad.forEach(function(b){ console.log('  ' + b); }); process.exit(1); }
