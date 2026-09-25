/* ══════════════════════════════════════════════════════════════════════════
   見張り：項目のゆくえ（oos-ikisaki.js）を【実物】と突き合わせる
   2026-09-12 作成（ひろみさん指示）

   ★「ゆくえ表に書いてあること」と「実際に動くもの」が合っているかだけを見ます。
   ★表そのものが間違っていたら、間違ったまま通ります。だから表はひろみさんが点検し、
     点検したあとは【封】をします（⑦）。封があると、私が表を勝手に変えたら落ちます。

   見るもの
     ① 発注書の列の名前と数     … tests/data/発注書の見出し_実物.json と照合
     ② ①へ行くと書いた項目     … 本物の yukaImportOne → 本物の oosYukaImportOrder を動かして、その列に届くか
     ③ ②へ出ると書いた項目     … 本物の OOS_NOUHIN.build() のHTMLに出ているか
     ④ 人がえらんだ値          … 注文に保存されているか
     ⑤ ×と書いた項目           … 勝手にどこかへ出ていないか
     ⑥ 商品5つ目以降           … 備考欄に入っているか
     ⑦ 封                      … 表が書き換わっていないか

   GASのファイルは公開リポジトリに置きません。手元に無ければ②⑥は飛ばします。
   ══════════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const os = require('os');
const H = require('./harness');
const IK = require('../oos-ikisaki.js');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(l + '  期待:' + w + '  実際:' + g); } }
function ok(l, g){ eq(l, !!g, true); }
function notEmpty(l, v){ if(String(v == null ? '' : v).trim() !== '') pass++; else { fail++; fails.push(l + '  期待:何か入っている  実際:空'); } }

/* ── GASの置き場所（test_gas.js と同じ作法） ───────────────────── */
function readGasSource(){
  const cands = [
    path.join(__dirname, 'gas', 'コード.js'),
    path.join(os.homedir(), 'OneDrive', 'ドキュメント', 'olive-stories-gas', 'コード.js')
  ];
  for(const c of cands){ if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); }
  return null;
}
const gasSrc = readGasSource();
const idx = H.read('index.html');
const pickupSrc = H.read('pickup.html');

/* ══════════════════════════════════════════════════════════════════════
   ① 発注書の列の名前と数　←　実物の控えと照合
   ══════════════════════════════════════════════════════════════════════ */
const snapPath = path.join(__dirname, 'data', '発注書の見出し_実物.json');
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
const jitsubutsu = {};                 /* 列番号 → 見出し */
snap.data.headers.forEach(function(line){
  const m = String(line).match(/^(\d+)列目 … (.*)$/);
  if(m) jitsubutsu[Number(m[1])] = m[2];
});
const jitsuKazu = Object.keys(jitsubutsu).length;

eq('①-1 実物の列の数とゆくえ表の行数が同じ', IK.SOUKO_RETSU.length, jitsuKazu);
eq('①-2 実物の列の数（控え）', jitsuKazu, snap.data.cols);

IK.SOUKO_RETSU.forEach(function(r, i){
  eq('①-3 ゆくえ表の' + (i+1) + '行目の列番号が連番', r.retsu, i + 1);
  eq('①-4 ' + r.retsu + '列目の見出しが実物と同じ', r.midashi, jitsubutsu[r.retsu] === undefined ? '（実物に無い列）' : jitsubutsu[r.retsu]);
});
/* 逆向き：実物にあるのに表に無い列がないか */
Object.keys(jitsubutsu).forEach(function(k){
  const n = Number(k);
  ok('①-5 ' + n + '列目（' + jitsubutsu[n] + '）がゆくえ表に載っている',
     IK.SOUKO_RETSU.some(function(r){ return r.retsu === n; }));
});

/* ══════════════════════════════════════════════════════════════════════
   試しの注文（4商品・時間指定あり・送り主あり・備考あり）
   ══════════════════════════════════════════════════════════════════════ */
function testOrder(extra){
  const o = {
    id:'O-TEST-1', num:'TK-20260912-01', status:'ordered', source:'manual',
    client:'安保 千尋', custId:'C-1', customerType:'wholesale1',
    recipientName:'宮西 杏奈', isCompany:true, companyName:'株式会社ミヤニシ',
    deptName:'総務部', positionName:'課長', personName:'宮西 杏奈',
    zip:'150-0001', addr:'東京都渋谷区1-1-1', tel:'03-1111-2222',
    leadType:'scheduled', leadDate:'2026/09/20', delivTime:'午前中',
    senderName:'株式会社オリーブオイル・ストーリーズ', senderZip:'106-0032',
    senderAddr:'東京都港区六本木1-1-1', senderTel:'03-9999-8888',
    note:'のしは不要です', bunrui:'9月の卸', kokyakuMemo:'いつもありがとうございます',
    enclosedDoc:'納品書兼請求書', includePamphlet:false, pkg:'new',
    warehouseFee:0, shippingFee:0,
    lines:[
      { productId:2,  productName:'オルガニック 250ml', boxQty:20, giftType:'normal', bottles:3, boxes:0, condition:'normal', memo:'こわれもの注意' },
      { productId:4,  productName:'オルガニック 750ml', boxQty:12, giftType:'normal', bottles:2, boxes:0, condition:'normal', memo:'' },
      { productId:19, productName:'プリモフルット 3L',  boxQty:4,  giftType:'normal', bottles:1, boxes:0, condition:'normal', memo:'' },
      { productId:23, productName:'アグルミ 250ml',     boxQty:6,  giftType:'normal', bottles:0, boxes:1, condition:'normal', memo:'' }
    ]
  };
  return Object.assign(o, extra || {});
}

/* ══════════════════════════════════════════════════════════════════════
   ② ①へ行くと書いた項目が、本当にその列に届くか
      本物の yukaImportOne（受注Ａ）→ 本物の oosYukaImportOrder（GAS）
   ══════════════════════════════════════════════════════════════════════ */

/* 受注Ａの本物 yukaImportOne を動かして、GASへ送る中身を取り出す */
async function okuruNakami(order){
  const sent = [];
  const { box, ctx } = H.makeSandbox({
    fetch(url, opt){
      try{ sent.push(JSON.parse(opt.body)); }catch(e){}
      return Promise.resolve({ json(){ return Promise.resolve({ status:'ok', key:'K-TEST' }); } });
    },
    alert(){}, confirm(){ return true; }
  });
  /* ★2026-09-12 書類の決めごと（単位の親）を入れます。
     これが無いと、受注Ａの unitOfProduct が古い動き（「本」だけ）に戻り、
     750ml が「2本」と出ます。本物のアプリは index.html が読み込んでいます。
     ★この1行を消さないでください。
     （土台 harness.js には入れていません。入れると、金額の合計を
     　ピックアップ料金・送料なしで数えている既存の見張り2本が落ちます。
     　それは【別に報告ずみの件】で、勝手に直しません） */
  vm.runInContext(H.read('oos-shorui-kimari.js'), ctx);
  let code = '';
  code += H.cutVar(idx, 'PRODUCTS') + '\n';
  code += 'var GAS_URL = "x";\n';
  code += 'var orders = [];\n';
  /* ★2026-09-12 hizukeDake を足しました。
     　お届け日（leadDate）はスプシを通ると時刻つきに化けるので、
     　倉庫へ送る前に日付だけにそろえます。yukaImportOne がこれを呼びます。
     ★入れ忘れると『受注Ａが発注書へ送る中身を取り出せた』が落ちます
     　（実際に2026-09-12に落ちて、この見張りが止めてくれました）。 */
  ['hizukeDake','findProduct','findProductBySku','unitOfProduct','lineTotal','lineUnit','pdfNiSuruKa','pkgDocsIn','pkgOf','pkgOneLine','yukaImportOne']
    .forEach(function(n){ code += H.cut(idx, n) + '\n'; });
  /* 画面まわりの身代わり（送る中身には関係しません） */
  code += 'function fetchOrderFresh(){ return Promise.resolve(null); }\n';
  code += 'function renderList(){}\nfunction syncOrdersToGAS(){}\nfunction showSyncStatus(){}\n';
  vm.runInContext(code, ctx);
  box.orders.push(order);
  await box.yukaImportOne(order.id);
  const hit = sent.filter(function(b){ return b && b.action === 'yukaImportOrder'; });
  return hit.length ? hit[0].order : null;
}

/* GASの本物 oosYukaImportOrder を動かして、発注書の1行を作る */
function makeSheet(width){
  const s = { rows:[], width:width,
    getName(){ return '発注書'; },
    getLastRow(){ return this.rows.length + 1; },
    getLastColumn(){ return this.width; },
    getRange(r, c, nr, nc){
      const self = this;
      return {
        getValues(){ const out=[]; for(let i=0;i<(nr||1);i++){ const rw=self.rows[r-2+i]||[]; out.push(rw.slice(c-1, c-1+(nc||1))); } return out; },
        getDisplayValues(){ const out=[]; for(let i=0;i<(nr||1);i++){ const rw=self.rows[r-2+i]||[]; const line=[]; for(let j=0;j<(nc||1);j++){ const v=rw[c-1+j]; line.push(v==null?'':String(v)); } out.push(line); } return out; },
        getValue(){ const rw=self.rows[r-2]||[]; return rw[c-1]; },
        setValue(v){ if(!self.rows[r-2]) self.rows[r-2]=[]; self.rows[r-2][c-1]=v; return this; },
        setValues(vv){ for(let i=0;i<vv.length;i++){ if(!self.rows[r-2+i]) self.rows[r-2+i]=[]; for(let j=0;j<vv[i].length;j++) self.rows[r-2+i][c-1+j]=vv[i][j]; } return this; },
        insertCheckboxes(){ return this; }, removeCheckboxes(){ return this; },
        setDataValidation(){ return this; }, setNote(){ return this; }, getNote(){ return ''; },
        setBackground(){ return this; }, setFontColor(){ return this; }, setFontWeight(){ return this; },
        setFontSize(){ return this; }, setWrap(){ return this; },
        setHorizontalAlignment(){ return this; }, setVerticalAlignment(){ return this; },
        setNumberFormat(){ return this; }, clearContent(){ return this; }
      };
    },
    setColumnWidth(){}, setFrozenRows(){}, hideColumns(){}
  };
  return s;
}

function hacchuushoGyou(payload){
  if(!gasSrc) return null;
  const yuka = makeSheet(32);
  const box = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Boolean, parseInt, parseFloat, isNaN,
    Logger:{ log(){} },
    SpreadsheetApp:{ newDataValidation(){ const o={ requireValueInList(){return o;}, setAllowInvalid(){return o;}, build(){return {};} }; return o; } },
    oosYukaFile_(){ return { getSheetByName(n){ return n === '発注書' ? yuka : null; } }; },
    oosKeyColByHeader_(){ return 28; }
  };
  box.globalThis = box;
  const ctx = vm.createContext(box);
  let code = '';
  /* ★2026-09-13 A列の3つ目【↩️ アプリに差し戻す】も砂場に入れます。
     入れ忘れると本物の関数が動かせず、見張りが空回りします（見張りの砂場に親を入れる決まり）。 */
  ['OOS_YUKA_SHEET','OOS_YC','OOS_YUKA_BTN_STOP','OOS_YUKA_BTN_GO','OOS_YUKA_BTN_BACK'].forEach(function(n){ code += H.cutVar(gasSrc, n) + '\n'; });
  /* ★2026-09-24 注文番号は B列（oosYukaBangouText_）。砂場にも入れます */
  ['oosLastDataRow_','oosYukaBangouText_','oosYukaBangouOf_','oosYukaImportOrder'].forEach(function(n){ code += H.cut(gasSrc, n) + '\n'; });
  vm.runInContext(code, ctx);
  const res = box.oosYukaImportOrder(payload);
  return { res: res, gyou: yuka.rows[0] || [], box: box };
}

/* ══════════════════════════════════════════════════════════════════════
   ③④⑤⑥⑦　（②のあと、まとめて走らせます）
   ══════════════════════════════════════════════════════════════════════ */
(async function(){

  /* ── ② ─────────────────────────────────────────────── */
  const payload = await okuruNakami(testOrder());
  ok('②-0 受注Ａが発注書へ送る中身を取り出せた', !!payload);

  if(payload && gasSrc){
    const out = hacchuushoGyou(payload);
    eq('②-1 発注書に1行できた', out && out.res && out.res.status, 'ok');
    const gyou = (out && out.gyou) || [];
    /* ゆくえ表で「①へ行く」と書いた列ぜんぶ。その列に値が届いているか */
    IK.soukoIkuRetsu().forEach(function(r){
      /* 受注Ａからは入らないと書いてある列（倉庫・GAS・人が書く）はここでは見ません */
      if(r.dare && (r.dare.indexOf('倉庫') === 0 || r.dare.indexOf('本部') === 0)) return;
      notEmpty('②-2 ' + r.retsu + '列目「' + r.midashi + '」に値が届く（表：' + r.juchuA + '）', gyou[r.retsu - 1]);
    });
    /* ★2026-09-24 ひろみさん「TK-…は伝票番号だから B列に。備考欄に入っちゃってると混乱する」（本物の関数で確かめる） */
    eq('②-3 B列（伝票番号）の1行目に注文番号が入る', String(gyou[1] || '').split(/\r?\n/)[0], String(payload.num));
    eq('②-3 備考欄（U列）に注文番号を書かない', String(gyou[20] || '').indexOf(String(payload.num)) < 0, true);
    eq('②-3 同じ注文をもう一度送っても二重に入らない（B列の番号で気づく）', (out.box.oosYukaImportOrder(payload) || {}).status, 'dup');
  } else if(!gasSrc){
    console.log('（GASのファイルが手元にないので ② と ⑥ は飛ばしました）');
  }

  /* ── ③ 書類に出ると書いた項目が、本物のHTMLに出ているか ───── */
  /* ★本物の親を【そのまま】砂場で動かします（require では動きません。window が要るため）。
     oos-shorui-kimari.js も必ず入れます。入れないと単位と「必ず枠」が別の動きになります。 */
  function mkEl(){ return { style:{}, setAttribute(){}, appendChild(){}, classList:{add(){},remove(){}} }; }
  const dbox = { console, Math, Date, JSON, parseInt, parseFloat, isNaN, String, Number,
    Object, Array, Boolean, RegExp, Error,
    document:{ getElementById(){ return null; }, createElement(){ return mkEl(); },
               head:{ appendChild(){} }, body:{ appendChild(){}, removeChild(){} } } };
  dbox.window = dbox; dbox.globalThis = dbox;
  const dctx = vm.createContext(dbox);
  ['oos-zei.js','oos-kakaku.js','oos-shorui-kimari.js','oos-doc.js','oos-nouhin.js'].forEach(function(f){
    vm.runInContext(H.read(f), dctx);
  });
  vm.runInContext(H.cutVar(idx, 'PRODUCTS'), dctx);
  const prods = dbox.PRODUCTS;
  const priceMaster = [
    { sku:'ORG250', priceGeneral:4200, priceWholesale1:3800, priceWholesale2:3400, taxRate:8 },
    { sku:'ORG750', priceGeneral:8400, priceWholesale1:7588, priceWholesale2:6800, taxRate:8 },
    { sku:'PRI3L',  priceGeneral:13000, priceWholesale1:12000, priceWholesale2:11000, taxRate:8 },
    { sku:'AGR250', priceGeneral:5400, priceWholesale1:4960, priceWholesale2:4400, taxRate:8 }
  ];
  dbox.__d = { products: prods, priceMaster: priceMaster, defaults: null };
  dbox.__o = testOrder();
  const html = vm.runInContext('OOS_NOUHIN.build(__o, __d)', dctx);
  ok('③-0 書類（納品書兼請求書）が作れた', html && html.length > 500);

  /* 必ず枠が出ると書いたもの（倉庫ピッキング手数料・送料） */
  IK.kanarazuWaku().forEach(function(r){
    ok('③-1 書類に「' + r.na + '」の枠が必ず出る', String(html).indexOf(r.na) >= 0
       || (r.na === '倉庫ピッキング手数料' && String(html).indexOf('倉庫ピッキング手数料') >= 0));
  });
  /* Ａ表で「書類に出る」と書いた列のうち、値そのものが出るもの */
  ok('③-2 書類にお届け先の氏名が出る', String(html).indexOf('宮西 杏奈') >= 0);
  ok('③-3 書類に1箱入り数が出る（20）', /1箱入り数/.test(String(html)));
  ok('③-4 書類に単価が出る', /単価/.test(String(html)));
  ok('③-5 書類に合計本数が出る', /合計本数/.test(String(html)));

  /* ── ④ 人がえらんだ値が、注文に保存されているか ───────────── */
  /* ★ここは文字で確かめています（画面の操作は見張りでは動かせないため）。
     「ボタンの値を読む関数を呼んでいて、その結果を注文に入れている」ことを見ます。 */
  ok('④-1 ボタンの値を読む関数がある（pickupYenIn）', /function\s+pickupYenIn\s*\(/.test(idx));
  ok('④-2 ボタンの値を読む関数がある（soryoYenIn）',  /function\s+soryoYenIn\s*\(/.test(idx));
  /* ★ここは「数をかぞえる」だけでは弱すぎました（2026-09-12 の破壊テストで分かりました）。
     つなぎの式そのものを見ます。★ゆるめないでください。 */
  ok('④-3 えらんだピックアップ料金を届け先から読んでいる',
     /pickupYen\s*:\s*pickupYenIn\s*\(\s*card\s*\)/.test(idx));
  ok('④-4 えらんだ送料を届け先から読んでいる',
     /soryoYen\s*:\s*soryoYenIn\s*\(\s*card\s*\)/.test(idx));
  ok('④-5 注文の warehouseFee に、えらんだ値が入る',
     /warehouseFee\s*:\s*\(\s*r\.pickupYen/.test(idx));
  ok('④-6 注文の shippingFee に、えらんだ値が入る（税込に直して）',
     /shippingFee\s*:\s*\(\s*r\.soryoYen/.test(idx) && /RATE_SERVICE/.test(idx));
  ok('④-7 書類は warehouseFee を読んでいる', /o\.warehouseFee/.test(H.read('oos-nouhin.js')));
  ok('④-8 書類は shippingFee を読んでいる',  /o\.shippingFee/.test(H.read('oos-nouhin.js')));
  /* ★関数の定義そのものに当たってしまう書き方では見張りになりません
     （2026-09-12 の破壊テストで分かりました）。呼んで、その数で止めているかを見ます。 */
  ok('④-9 えらぶまで登録できない見張りがある（関数がある）',
     /function\s+findCardsWithoutFees\s*\(\s*\)\s*\{/.test(idx));
  ok('④-9b えらぶまで登録できない見張りがある（呼んで使っている）',
     /=\s*findCardsWithoutFees\s*\(\s*\)\s*;/.test(idx));
  ok('④-9c えらんでいなければ、そこで止めている',
     /missingFees\.length[\s\S]{0,900}?return;/.test(idx));

  /* ══════════════════════════════════════════════════════════════════
     ④-10〜 　「0円」と「まだ決まっていない」が、書類で別あつかいか
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 の破壊テストで、ここを見ていないことが分かりました。
     　`parseInt(...) || 0` に戻されても、どの見張りも落ちませんでした。
     　手で計算した金額そのものを書いて、戻されたら落ちるようにします。
     　試しの注文は【卸①・バラ3本・東京】なので、決めごとの自動計算では
     　ピックアップ料金 250円・送料 880円（税込）＝税抜800円 になります。
     ══════════════════════════════════════════════════════════════════ */
  function doc(extra){ dbox.__o = testOrder(extra); return String(vm.runInContext('OOS_NOUHIN.build(__o, __d)', dctx)); }

  /* Ａ　人が【無料サービス】をえらんだ注文（0円） */
  const h0 = doc({ warehouseFee:0, shippingFee:0 });
  ok('④-10 無料をえらんだら、書類に「無料サービス」が出る', (h0.match(/無料サービス/g) || []).length >= 2);
  ok('④-11 無料をえらんだら、自動計算の250円に上書きされない', h0.indexOf('¥250') < 0);
  ok('④-12 無料をえらんだら、自動計算の800円に上書きされない', h0.indexOf('¥800') < 0);
  ok('④-13 無料をえらんだら「送料は別途申し受けます」と書かない', h0.indexOf('送料は別途申し受けます') < 0);

  /* Ｂ　人が 700円・送料800円（税抜）をえらんだ注文 */
  const h7 = doc({ warehouseFee:700, shippingFee:880 });
  ok('④-14 えらんだピックアップ料金 700円が書類に出る', h7.indexOf('¥700') >= 0);
  ok('④-15 えらんだ送料 800円（税抜）が書類に出る',     h7.indexOf('¥800') >= 0);

  /* Ｃ　まだ決まっていない注文（人がまだ料金を押していない注文） */
  /* ══════════════════════════════════════════════════════════════════
     ★2026-09-12 決めごとが変わりました（ひろみさん）。
     ──────────────────────────────────────────────────────────────────
     ひろみさん：「無料にしてる送料、なんで金額足してるんだよ」
     　　　　　　「無料の意味はわかってる？800円は有料だよ。全然違うんだよ」
     前：料金を【えらんでいない】注文には、決めごとから送料880円・
     　　ピックアップ料金250円/700円を【勝手に入れて】いた。
     今：【えらんでいないものは、金額を入れない】。枠は「別途申し受けます」。
     
     ★3つはまったく別ものです：
     　・「無料サービス」を押した → 0円。枠に「無料サービス」。足さない。
     　・何も押していない　　　　 → 未定。枠に「別途申し受けます」。足さない。
     　・「800円」を押した　　　　→ 800円＋税。枠に金額。足す。
     ★「決まっていない注文は決めごとから出す」に戻さないでください。
     ══════════════════════════════════════════════════════════════════ */
  const hOld = doc({ warehouseFee:undefined, shippingFee:undefined });
  ok('④-16 決まっていない注文に、勝手にピックアップ料金を足さない', hOld.indexOf('¥250') < 0 && hOld.indexOf('¥700') < 0);
  ok('④-17 決まっていない注文に、勝手に送料を足さない',             hOld.indexOf('¥800') < 0 && hOld.indexOf('¥1,000') < 0);
  ok('④-18 決まっていない注文の枠は「別途申し受けます」',           hOld.indexOf('別途申し受けます') >= 0);
  ok('④-19 決まっていない注文の枠に「無料サービス」とは書かない',   hOld.indexOf('無料サービス') < 0);

  /* ── ⑤ ×と書いた項目が、勝手にどこかへ出ていないか ─────────── */
  IK.DOKO_NIMO.forEach(function(r){
    if(r.souko === false && payload){
      /* 発注書へ送る中身に混ざっていないか（商品1行ごとのメモなど） */
      const body = JSON.stringify(payload);
      if(r.juchuA === 'lines[].memo'){
        ok('⑤-1 「' + r.na + '」は発注書へ送っていない', body.indexOf('こわれもの注意') < 0);
      }
    }
    if(r.shorui === false && r.juchuA === 'lines[].memo'){
      ok('⑤-2 「' + r.na + '」は書類に出していない', String(html).indexOf('こわれもの注意') < 0);
    }
    if(r.soukoD === false && r.juchuA === 'lines[].memo'){
      /* ★倉庫Ｄ（pickup.html）のピッキング一覧に出ていないか。
         決めごと「倉庫Ｄはシンプルに」（2026-09-10）で📝メモは外したはずです。 */
      ok('⑤-3 「' + r.na + '」は倉庫Ｄの画面に出していない', !/l\.memo\s*\?/.test(pickupSrc));
    }
  });

  /* ── ⑥ 商品5つ目以降は備考欄に入るか ──────────────────── */
  if(gasSrc){
    const o6 = testOrder();
    o6.lines = o6.lines.concat([
      { productId:8,  productName:'メメジック 250ml', boxQty:20, giftType:'normal', bottles:1, boxes:0, condition:'normal', memo:'' },
      { productId:14, productName:'シェフズブレンド 250ml', boxQty:20, giftType:'normal', bottles:1, boxes:0, condition:'normal', memo:'' }
    ]);
    o6.id = 'O-TEST-6';
    const p6 = await okuruNakami(o6);
    const out6 = hacchuushoGyou(p6);
    const g6 = (out6 && out6.gyou) || [];
    ok('⑥-1 商品は4つまで列に入る（4つ目が入っている）', String(g6[9] || '').trim() !== '');
    ok('⑥-2 5つ目以降は備考欄に入る', String(g6[20] || '').indexOf('ほかの商品') >= 0);
    ok('⑥-3 5つ目の商品名が備考欄にある', String(g6[20] || '').indexOf('メメジック 250ml') >= 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     ⑧ 単位（本・缶・個）は1か所で決まっているか
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ここで穴が1つ見つかりました。
     　発注書へ送る単位は商品マスタの「単位」欄だけを見ていて、
     　書類は新しい決めごと（ml で決める）を見ていたため、
     　【倉庫は「2」・書類は「2缶」】と食い違っていました。
     ★受注Ａが自分で判定する形に戻さないでください。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    vm.runInContext(H.cut(idx, 'unitOfProduct'), dctx);
    const shirabe = ['オルガニック 250ml','オルガニック 750ml','オルガニック 2L',
                     'プリモフルット 3L','アグルミ 3L','カサアルバート 5L'];
    prods.filter(function(p){ return shirabe.indexOf(p.name) >= 0; }).forEach(function(p){
      dbox.__p = p;
      const soukoHe = vm.runInContext('unitOfProduct(__p)', dctx);      /* 発注書へ送る単位 */
      const shoruiHe = vm.runInContext('OOS_SHORUI.taniOf(__p)', dctx); /* 書類に出る単位 */
      eq('⑧ ' + p.name + ' の単位が 発注書と書類で同じ', soukoHe, shoruiHe);
    });
    ok('⑧-2 受注Ａの単位は親（oos-shorui-kimari.js）を呼んでいる',
       /OOS_SHORUI[\s\S]{0,40}taniOf/.test(H.cut(idx, 'unitOfProduct')));
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑨ 発注書の「数」の列には、単位を【いつも】書くか
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん「本もつけて」
     　それまでは「本」だけ省いていたので、倉庫が見る列に
     　「3」と「2缶」が混ざっていました。
     ★「本」を省く形に戻さないでください。
     ══════════════════════════════════════════════════════════════════ */
  if(payload){
    const qtys = (payload.items || []).map(function(it){ return String(it.qty || ''); });
    eq('⑨-0 試しの注文の商品は4つ', qtys.length, 4);
    /* 試しの注文：250ml バラ3／750ml バラ2／3L バラ1／250ml 箱1（20本入り） */
    /* ★2026-09-13 ひろみさん指示で 100・250・500ml は【瓶】になりました（前は本） */
    eq('⑨-1 250ml バラ3 → 「3瓶」',        qtys[0], '3瓶');
    eq('⑨-2 750ml バラ2 → 「2缶」',        qtys[1], '2缶');
    eq('⑨-3 3L バラ1 → 「1個」',           qtys[2], '1個');
    eq('⑨-4 250ml 箱1（6本入り）→ 「6瓶（1箱）」', qtys[3], '6瓶（1箱）');
    qtys.forEach(function(q, i){
      ok('⑨-5 ' + (i+1) + 'つ目に単位が入っている（' + q + '）', /[本瓶缶個箱枚冊]|セット/.test(q));
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     ⑩ 無料サンプルは0円／有償サンプルは区分どおり
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん決定。それまでは「サンプル(無償)」をえらんでも
     　納品書に通常の単価で金額が載っていました（どこにも0円にする仕組みが無かった）。
     ★0円にするのは oos-kakaku.js の1か所だけ。アプリに書き写さないでください。
     　試しの注文は【卸①】なので、オルガニック250ml の卸①単価は 3,800円です。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    const KAK = vm.runInContext('OOS_KAKAKU', dctx);
    const o = { customerType:'wholesale1' };
    const muryou = { giftType:'sample_free', boxes:0 };
    const yushou = { giftType:'sample_paid', boxes:0 };
    const futsuu = { giftType:'normal',      boxes:0 };
    eq('⑩-1 無料サンプルの単価は0円', KAK.unitPriceForLine(o, muryou, 'ORG250', priceMaster, null), 0);
    eq('⑩-2 有償サンプルは区分どおり（卸①3,800円）', KAK.unitPriceForLine(o, yushou, 'ORG250', priceMaster, null), 3800);
    eq('⑩-3 通常も区分どおり（卸①3,800円）',        KAK.unitPriceForLine(o, futsuu, 'ORG250', priceMaster, null), 3800);
    ok('⑩-4 無料サンプルの見分けが親にある', typeof KAK.muryouSampleKa === 'function');

    /* 書類のほうでも0円になるか（本物の納品書を作って見ます） */
    const oS = testOrder();
    oS.lines = [
      { productId:2, productName:'オルガニック 250ml', boxQty:20, giftType:'sample_free', bottles:2, boxes:0, condition:'normal', memo:'' },
      { productId:4, productName:'オルガニック 750ml', boxQty:12, giftType:'normal',      bottles:1, boxes:0, condition:'normal', memo:'' }
    ];
    dbox.__o = oS;
    const hS = String(vm.runInContext('OOS_NOUHIN.build(__o, __d)', dctx));
    ok('⑩-5 書類に無料サンプルの行が出る', hS.indexOf('オルガニック 250ml') >= 0);
    ok('⑩-6 書類で無料サンプルに3,800円を載せていない', hS.indexOf('¥3,800') < 0);
    ok('⑩-7 書類で通常の行は7,588円が載る', hS.indexOf('¥7,588') >= 0);
    /* 無料サンプルだけの注文でも、納品書が作れること（単価未登録あつかいにしない） */
    const oS2 = testOrder();
    oS2.lines = [{ productId:28, productName:'カサアルバート 5L', boxQty:4, giftType:'sample_free', bottles:1, boxes:0, condition:'normal', memo:'' }];
    ok('⑩-8 単価が名簿に無い商品でも、無料サンプルなら作れる',
       (vm.runInContext('OOS_NOUHIN.missingPrices(__o2, __d)', (dbox.__o2 = oS2, dctx)) || []).length === 0);
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑪ 受注Ａの入力の列（承認済みモック「mock_受注Ａの入力項目_第3版」のとおり）
     ──────────────────────────────────────────────────────────────────
     ★足さない・消さない・並べ替えない・言い換えない。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    /* 見出しの言葉（書類と同じ言葉） */
    const h = idx.slice(idx.indexOf('<div class="order-line-header">'), idx.indexOf('<div data-role="lines">'));
    /* ★2026-09-12 ひろみさん：「種別」→「1商品ごとの扱い種別」。
       上の「この顧客の価格区分」と混ざらないように、どちらに付くものかを名前に入れました。 */
    /* ★2026-09-12（夜）ひろみさん：「単価と金額の読み込みが長すぎる。
       　ここの表示、いらない。PDFで確認できるから」
       　単価と金額の列は【外しました】。金額は書類（PDF）で確かめます。
       ★この2つを見出しに戻さないでください。 */
    ['商品','1箱入り数','1商品ごとの','扱い種別','バラ','箱','合計本数','状態'].forEach(function(w){
      ok('⑪-1 入力の見出しに「' + w + '」がある', h.indexOf(w) >= 0);
    });
    ok('⑪-1b お客様の区分の名前が「この顧客の価格区分」', idx.indexOf('>この顧客の価格区分<') >= 0);
    ok('⑪-2 入力の見出しに「（参考）」がある', h.indexOf('（参考）') >= 0);
    ok('⑪-3 入力の見出しに「メモ」を戻していない', h.indexOf('メモ') < 0);
    ok('⑪-4 入力の見出しに「本数」という古い言葉を残していない', h.indexOf('>本数<') < 0);
    /* 並び順（書類と同じ順で出てくるか）
       ★「箱」は「1箱入り数」の中にも出てくるので、文字の位置では見られません。
       　見出しの【文字の並び】を取り出して、順番どおりかを見ます。 */
    /* 見出しはJSの文字をつないで作っているので、つなぎの ' と + は捨てます。
       ★コメント（/* … *\/）も先に落とします。落とさないと見出しの言葉として数えてしまいます
       　（2026-09-12 に実際に起きました）。 */
    const kotoba = (h.replace(/\/\*[\s\S]*?\*\//g, '').match(/>([^<>]+)</g) || [])
      .map(function(s){ return s.slice(1, -1).replace(/['"+\s]/g, ''); })
      .filter(function(s){ return s && s !== '（参考）' && s !== '（税抜）'; });
    /* ★2026-09-13 ひろみさん指示で【取置分／予約分】の列が増えました（いちばん右・✕の手前）。
       　取り置き・予約を選んだときだけ見えます（通常発送では見えません）。
       　「一人の人が、アグルミを取り置き、オルガニックを予約という場合がある」
       ★この列を消さないでください。消すと、混ざった注文が作れなくなります。 */
    const jun = ['商品','1箱入り数','1商品ごとの','扱い種別','バラ','箱','合計本数','状態','取置分／','予約分'];
    eq('⑪-5 入力の見出しの並びが書類と同じ順', kotoba.join('／'), jun.join('／'));
    ok('⑪-5b 取置分／予約分の列は、取り置き・予約のときだけ出す（class=ol-machi）',
       h.indexOf('class="ol-machi"') >= 0);
    ok('⑪-5c 記号（絵文字）ではなく ≪取置分≫≪予約分≫ の3文字でそろえる',
       idx.indexOf('≪取置分≫') >= 0 && idx.indexOf('≪予約分≫') >= 0);

    /* 読むだけの4つ（入力欄ではなく div） */
    const gyou = H.cut(idx, 'addRecipientLine');
    /* ★単価（tanka）と金額（kingaku）は外しました。読むだけの欄はこの2つです */
    ['hakoIri','goukei'].forEach(function(r){
      ok('⑪-6 ' + r + ' は読むだけ（div）', new RegExp('<div class="ol-[^"]*" data-role="' + r + '"').test(gyou));
    });
    ok('⑪-7 メモの入力欄（text）は出していない', !/type="text"[^>]*data-role="memo"/.test(gyou));
    ok('⑪-8 古い注文のメモを消さないように、見えない入れものは残している',
       /type="hidden" data-role="memo"/.test(gyou));

    /* ★2026-09-12（夜）単価・金額を外したので、⑪-9〜⑪-13（単価の出し方）は
       【捨てました】。金額は書類（PDF）で確かめます（⑱・㉒ が見ています）。 */
    const yomi = H.cut(idx, 'refreshLineYomi');
    ok('⑪-9 入力行に単価の計算を残していない', !/OOS_KAKAKU\.unitPriceForLine/.test(yomi));
    ok('⑪-10 単価の判定を画面に書き写していない',
       !/priceWholesale1|priceGeneral|priceRT/.test(yomi));
    ok('⑪-11 単位は親を通して取っている（lineUnit）', /lineUnit\s*\(/.test(yomi));
    /* ★2026-09-12（夜）単価の欄そのものが無くなったので、ここは【捨てました】。
       　単価が未登録のときは、書類（PDF）を見るときに出ます（⑱-8／⑱-31）。 */
    ok('⑪-12 入力行に「未登録」の文字を残していない', !/未登録/.test(yomi));
    ok('⑪-13 入力行に「出せません」の文字を残していない', !/出せません/.test(yomi));
    ok('⑪-14 区分を変えたら書き直す', /refreshLineYomi/.test(H.cut(idx, 'onCtypeChange')));
    ok('⑪-15 種別を変えたら書き直す', /updateCardGiftSummary/.test(H.cut(idx, 'onRecipientLineGiftChange')));
    ok('⑪-16 数や箱を入れたら書き直す', /refreshLineYomi\s*\(\s*cardId\s*\)/.test(H.cut(idx, 'updateCardGiftSummary')));

    /* 列の数（CSS）が10列になっているか */
    const css = (idx.match(/\.order-line\{display:grid;grid-template-columns:([^;]+);/) || [])[1] || '';
    eq('⑪-17 入力行は8列（単価・金額を外した）', css.trim().split(/\s+/).length, 8);
    const cssH = (idx.match(/\.order-line-header\{display:grid;grid-template-columns:([^;]+);/) || [])[1] || '';
    eq('⑪-18 見出しも10列（行とそろっている）', cssH.trim(), css.trim());

    /* 種別の名前 */
    ok('⑪-19 種別は「無料サンプル」', /sample_free:'無料サンプル'/.test(idx));
    ok('⑪-20 種別は「有償サンプル」', /sample_paid:'有償サンプル'/.test(idx));
    ok('⑪-21 倉庫Ｄも同じ名前（写しをそろえた）',
       /sample_free:'無料サンプル'/.test(pickupSrc) && /sample_paid:'有償サンプル'/.test(pickupSrc));
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑫ 1商品ごとの扱い種別　えらべるのは5つだけ／名前のぬけが無いか
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん「種別から卸①②を外せばスッキリじゃない？」
     　本番の全注文79件で w1・w2 は1回も使われていませんでした（調べてから外しました）。
     ★えらべる一覧に w1・w2 を戻さないでください。
     ★名前の表（GIFT_TYPE_LABEL）からは消さないでください。
     　消すと、古い注文を開いたときに画面に「undefined」と出ます。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    const gbox = { console }; gbox.globalThis = gbox;
    const gctx = vm.createContext(gbox);
    vm.runInContext(H.cutVar(idx, 'GIFT_TYPE_LABEL'), gctx);
    vm.runInContext(H.cutVar(idx, 'GIFT_TYPE_ERABERU'), gctx);
    vm.runInContext(H.cut(idx, 'giftOptionsHtml'), gctx);

    /* えらべるのは5つだけ */
    eq('⑫-1 えらべる扱い種別は5つ', gbox.GIFT_TYPE_ERABERU.length, 5);
    eq('⑫-2 えらべる中身', gbox.GIFT_TYPE_ERABERU.join('／'),
       ['normal','gift','simple','sample_free','sample_paid'].join('／'));
    const html5 = gbox.giftOptionsHtml(false);
    ok('⑫-3 えらべる一覧に「卸①価格」を出していない', html5.indexOf('卸①価格') < 0);
    ok('⑫-4 えらべる一覧に「卸②価格」を出していない', html5.indexOf('卸②価格') < 0);
    ok('⑫-5 えらべる一覧に「―」（自動の行の印）を出していない', html5.indexOf('>―<') < 0);
    ok('⑫-6 えらべる一覧に「無料サンプル」がある', html5.indexOf('無料サンプル') >= 0);
    ok('⑫-7 えらべる一覧に「有償サンプル」がある', html5.indexOf('有償サンプル') >= 0);
    /* ★2026-09-24 ひろみさん「ユアストーリーのギフトとかを…サンプルで渡すときもある。
       　通常ギフトを選択はするんだけれども、無料サンプル・有償サンプルに変えたりする」
       ★セットを「ギフト」1つだけ（選べない）に戻さないでください。 */
    const hSet = gbox.giftOptionsHtml(true);
    eq('⑫-13 セットで選べるのは ギフト／無料サンプル／有償サンプル',
       (hSet.match(/value="([^"]+)"/g) || []).map(x => x.slice(7, -1)).join('／'), 'gift／sample_free／sample_paid');
    ok('⑫-13 セットは最初「ギフト」（いちばん上）', /^<option value="gift"/.test(hSet));
    /* ★⑫-14・⑫-15 は本物の関数を身代わりの行で動かして確かめます（文字さがしにしない・張りぼて点検 ①） */
    {
      const _S = H.makeSandbox({});
      const setP = { id:9, name:'your story 100ml×3本セット', isSet:true, boxQty:3, components:[] };
      const mk = (v) => ({ value:v, innerHTML:'', disabled:true, setAttribute(){}, children:[] });
      const row = { f:{ product:mk('9'), gift:mk(''), bottles:mk('3'), boxes:mk('0'), condition:mk('kizu'), memo:mk(''), machiKind:mk('') },
        querySelector(sel){ const m = String(sel).match(/data-role=(\w+)/); return m ? (this.f[m[1]] || null) : null; } };
      const lines = { children:[row] };
      const card = { querySelector(sel){ return /lines/.test(sel) ? lines : null; } };
      _S.box.document = { getElementById(id){ return id === 'L1' ? row : card; } };
      ['giftOptionsHtml','onRecipientLineProductChange','getRecipientLines'].forEach(n => vm.runInContext(H.cut(idx, n), _S.ctx));
      vm.runInContext(H.cutVar(idx, 'GIFT_TYPE_LABEL') + ';' + H.cutVar(idx, 'GIFT_TYPE_ERABERU') + ';', _S.ctx);
      _S.box.findProduct = (id) => String(id) === '9' ? setP : null;
      ['updateCardGiftSummary','updateRecycleLock','refreshLineCondition'].forEach(n => _S.box[n] = function(){});
      _S.box.machiModeKa = () => false;
      _S.box.onRecipientLineProductChange('C1', 'L1');
      ok('⑫-14 セットを選んでも種別を灰色（選べない）にしない（動かして確かめる）', row.f.gift.disabled === false);
      row.f.gift.value = 'sample_free';
      const gl = _S.box.getRecipientLines('C1')[0] || {};
      eq('⑫-15 登録のとき、セットの種別は選んだもの（無料サンプル）を使う', gl.giftType, 'sample_free');
      row.f.gift.value = '';
      eq('⑫-15 空なら今までどおりギフト', (_S.box.getRecipientLines('C1')[0] || {}).giftType, 'gift');
      /* 状態：多少傷アリOK は、在庫では正規（normal）＋目印 kizuOk */
      eq('⑫-16 多少傷アリOK は在庫では「正規」として登録する', gl.condition, 'normal');
      eq('⑫-16 多少傷アリOK の目印が付く', gl.kizuOk, true);
    }

    /* 古い注文に卸①価格が入っていたら、その1つだけは見せる（勝手に変えない） */
    const hOld = gbox.giftOptionsHtml(false, 'w1');
    ok('⑫-8 古い注文の「卸①価格」は、その注文では見せる', hOld.indexOf('卸①価格') >= 0);
    ok('⑫-9 そのとき選ばれたままになっている', /value="w1"\s*selected/.test(hOld));

    /* 名前のぬけ（画面に undefined が出ないか） */
    const L = gbox.GIFT_TYPE_LABEL;
    ['normal','none','gift','simple','sample_free','sample_paid','w1','w2'].forEach(function(k){
      ok('⑫-10 「' + k + '」に名前がある（undefined と出ない）', typeof L[k] === 'string' && L[k] !== '');
    });
    eq('⑫-11 none の名前は「―」', L['none'], '―');
    /* 倉庫Ｄの写しも同じか（名前がちがうと同じ注文が別の言葉で出ます） */
    const pbox = { console }; pbox.globalThis = pbox;
    const pctx = vm.createContext(pbox);
    vm.runInContext(H.cutVar(pickupSrc, 'GIFT_TYPE_LABEL'), pctx);
    ['normal','none','sample_free','sample_paid','w1','w2'].forEach(function(k){
      eq('⑫-12 倉庫Ｄの「' + k + '」の名前が受注Ａと同じ', pbox.GIFT_TYPE_LABEL[k], L[k]);
    });
    /* 本番で使われている種別ぜんぶに名前があるか（2026-09-12に実データで調べた5種類） */
    ['normal','none','sample_free','gift'].forEach(function(k){
      ok('⑫-13 本番で使われている「' + k + '」に名前がある', !!L[k]);
    });
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑬ 発送区分は3つ／希望到着日は自由／状態は3つ
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん指示。
     　「通常（3日以内に発送）、急ぎ（明日発送希望）、日時指定 だけにして」
     　「希望到着日（お届け日指定）は、自由に選べるようにして制限外して」
     　「状態もシンプルに。正規、旧ロット、不良品だけで」
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    /* ── 発送区分 ── */
    const lbox = { console }; lbox.globalThis = lbox;
    const lctx = vm.createContext(lbox);
    vm.runInContext(H.cutVar(idx, 'LEAD_LABEL'), lctx);
    vm.runInContext(H.cutVar(idx, 'LEAD_ERABERU'), lctx);
    vm.runInContext(H.cut(idx, 'leadOptionsHtml'), lctx);
    eq('⑬-1 えらべる発送区分は3つ', lbox.LEAD_ERABERU.length, 3);
    eq('⑬-2 えらべる中身', lbox.LEAD_ERABERU.join('／'), 'normal／urgent／scheduled');
    const lh = lbox.leadOptionsHtml();
    /* ★2026-09-17 ひろみさん指示で文言を変えました：
       　「普通の場合は【今日を含め3日以内に発送してください】にしてください、に変えて」
       　倉庫さんが備考で読む文です。「3日以内」だけだと、今日を入れるのか
       　明日からなのかが人によって変わるので、はっきり書きます。
       ★見張りを消さずに、新しい文言に書き直しています。 */
    ok('⑬-3 「通常（今日を含め3日以内に発送してください）」がある',
       lh.indexOf('通常（今日を含め3日以内に発送してください）') >= 0);
    ok('⑬-4 「急ぎ（明日発送希望）」がある', lh.indexOf('急ぎ（明日発送希望）') >= 0);
    ok('⑬-5 「日時指定」がある',             lh.indexOf('日時指定') >= 0);
    ok('⑬-6 「不良在庫出荷」を出していない', lh.indexOf('不良在庫出荷') < 0);
    ok('⑬-7 「特別注意」を出していない',     lh.indexOf('特別注意') < 0);
    /* 本番に7件ある「特別注意」の注文を開いても、値が消えないか */
    const lh2 = lbox.leadOptionsHtml('caution');
    ok('⑬-8 古い注文の「特別注意」は、その注文では見せる', lh2.indexOf('特別注意') >= 0);
    ok('⑬-9 そのとき選ばれたままになっている', /value="caution"\s+selected/.test(lh2));
    ok('⑬-10 古い注文を開くとき、えらび一覧を作り直してから入れている',
       /leadSel\.innerHTML\s*=\s*leadOptionsHtml\(\s*o\.leadType\s*\)/.test(idx));

    /* ── 希望到着日：制限を外したか ── */
    const dmin = H.cut(idx, 'applyDeliveryMin');
    ok('⑬-11 カレンダーの下限（min）を付けていない', !/input\.min\s*=/.test(dmin));
    ok('⑬-12 min を外している',                       /removeAttribute\(\s*'min'\s*\)/.test(dmin));
    ok('⑬-13 書いた日を黙って消していない',           !/input\.value\s*=\s*''/.test(dmin));
    ok('⑬-14 最短お届け日は案内として出している',      /最短お届け日/.test(dmin));
    /* ★2026-09-12 ひろみさん「この見張りを取り除いて。急ぎで出す場合にお届け日程が書けない」
       最短より前の日でも、確認（はい／いいえ）を出さずにそのまま進みます。
       ★この確認を書き戻さないでください。 */
    /* ★コメントを先に落とします。落とさないと、決めごとを書いたコメント自身に
       　当たってしまいます（2026-09-12 に実際に起きました）。 */
    const bof = H.cut(idx, 'buildOrdersFromForm').replace(/\/\*[\s\S]*?\*\//g, '');
    ok('⑬-23 最短より前の日でも確認を出さない',
       bof.indexOf('倉庫が間に合わないことがあります') < 0);
    ok('⑬-24 そのための confirm も残っていない',
       !/confirm\([\s\S]{0,200}最短お届け日/.test(bof));
    /* ★2026-09-12 実装の1行を文字で探すのをやめました。
       　書き方を少し変えるだけで落ちるので、正しく直せなくなります。
       　いまは【止める条件が書いてあるか】を、意味で見ます。 */
    ok('⑬-25 日時指定で日付が空のときだけは止める',
       /scheduled/.test(bof) && /leadDate/.test(bof)
       && !/confirm/.test(bof.replace(/\/\*[\s\S]*?\*\//g, '')));

    /* ── 状態：3つか ──
       ★2026-09-12 ひろみさん：「出来てない見張りは捨てないと、
       　どの見張りが動いてるかで、また不安定になるのでは？」
       ここにあった ⑬-15〜⑬-19（コードの文字を探すだけの5項目）は【捨てました】。
       同じ決めごとを tests/test_apps.js の ② が【本物の関数を動かして】確かめています。
       　・選択肢が3つであること
       　・正規／旧ロット（残◯）／不良品（残◯）の3つが出ること
       　・程度（軽・中・重）を出していないこと
       　・残0のものは選べないこと（実際に0にして確かめています）
       そちらのほうが強い見張りです。2か所で見張ると、どちらが本物か分からなくなります。
       ★ここに書き戻さないでください。 */
    const lab = H.cut(idx, 'condLabelOfLine');
    ok('⑬-20 名前も「不良品」ひとつ', /'不良品'/.test(lab) && !/不良・/.test(lab));
    ok('⑬-21 倉庫Ｄの札も「不良品」ひとつ',
       /不良品<\/span>/.test(H.cut(pickupSrc, 'condBadgeHtml')));
    /* 分けないと決めたので、「出どころが分からない」の印はもう付けない */
    ok('⑬-22 不良の出どころ不明の印を、もう付けていない',
       !/o\.defectSrcUnknown\s*=\s*true/.test(H.cut(idx, 'deductStockForOrder')));
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑭ 不良品はひとつ（統合マスタＮの在庫表・在庫の親）
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 承認済みモック「mock_不良品をひとつにする」のとおり。
     ひろみさん：「登録側は不良品と廃棄は欲しい」
     　　　　　　「貼り直しはもう良品とみとめよう。倉庫がそこまで細かく管理できない」
     ★軽・中・重の3つに戻さないでください。
     ★数は1本も変わりません（3つを足して1つにするだけ）。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    /* ★在庫の親は window が要るので、砂場で動かします（require では動きません） */
    const zctx = H.makeSandbox({});
    H.runZaiko(zctx.ctx);
    const Z = zctx.box.OOS_ZAIKO;
    const data = {
      lots: [ {pid:1, status:'new', stock:120}, {pid:1, status:'old', stock:20} ],
      defects: [
        {pid:1, level:'lv1', qty:2, shippedQty:0, status:'pending', reviewed:true, lotKind:'cur'},
        {pid:1, level:'lv2', qty:3, shippedQty:0, status:'pending', reviewed:true, lotKind:'cur'},
        {pid:1, level:'lv3', qty:1, shippedQty:0, status:'pending', reviewed:true, lotKind:'cur'},
        {pid:1, level:'lv2', qty:4, shippedQty:0, status:'pending', reviewed:true, lotKind:'old'},
        /* 貼り直しと廃棄は【良品】あつかい＝不良に数えない */
        {pid:1, level:'relabel', qty:9, shippedQty:0, status:'pending', reviewed:true, lotKind:'cur'},
        {pid:1, level:'discard', qty:7, shippedQty:0, status:'pending', reviewed:true, lotKind:'cur'}
      ],
      holds: []
    };
    const n = Z.numbers(1, data);
    eq('⑭-1 現ロットの不良品は 2+3+1 ＝ 6', n.cur.defectQty, 6);
    eq('⑭-2 旧ロットの不良品は 4',           n.old.defectQty, 4);
    eq('⑭-3 合わせて 10',                    n.defectQty, 10);
    /* 古い名前を足しても、二重に数えない */
    eq('⑭-4 古い名前を足しても同じ数（現）', n.cur.defLight + n.cur.defMid + n.cur.defHeavy, 6);
    eq('⑭-5 古い名前を足しても同じ数（旧）', n.old.defLight + n.old.defMid + n.old.defHeavy, 4);
    /* 貼り直し・廃棄は良品のまま（不良に入れない） */
    eq('⑭-6 貼り直しは不良に数えない（9本足しても10のまま）', n.defectQty, 10);
    eq('⑭-7 棚の良品は120のまま', n.cur.avail, 120);
    /* 程度をどう聞かれても、その ロット の不良品ぜんぶを見る
       （shortages ＝「在庫がたりるか」を見る本物の窓口から確かめます） */
    const P = [{id:1, sku:'X', name:'ためし商品'}];
    function tarinai(lv, lk, hoshii){
      const ords = [{ id:'o1', status:'ordered',
        lines:[{ productId:1, bottles:hoshii, boxes:0, boxQty:1,
                 condition:'defect', defectLevel:lv, defectLotKind:lk }] }];
      const r = Z.shortages(ords[0], data, P) || [];
      return r.length ? r[0].short : 0;
    }
    eq('⑭-8 不良品6本に対して7本ほしい → たりない1（軽と聞かれても）', tarinai('lv1','cur',7), 1);
    eq('⑭-9 重と聞かれても同じ（6本あるので6本はたりる）',            tarinai('lv3','cur',6), 0);
    eq('⑭-10 旧ロットは4本。5本ほしい → たりない1',                  tarinai('lv2','old',5), 1);
    /* 実在庫は 棚の良品＋不良品＋手入力の取置 */
    eq('⑭-11 現ロットの実在庫は 120+6 ＝ 126', n.cur.stock, 126);

    /* 画面の作り */
    const mst = H.read('master.html');
    ok('⑭-12 在庫表の不良は1列（見出しが「不良品」）', /不良品 <span class="help-ic"/.test(mst));
    ok('⑭-13 見出しに「軽」「中」「重」を出していない',
       !/<th style="text-align:right">軽<\/th>/.test(mst));
    ok('⑭-14 不良のマスは1つ（c-d2・c-d3 を使っていない）',
       mst.indexOf('class="c-d2"') < 0 && mst.indexOf('class="c-d3"') < 0);
    ok('⑭-15 マスに出すのは不良品ぜんぶの数', /editNumCell\(p\.id,kind,'lv1',side\.defectQty/.test(mst));
    ok('⑭-16 廃棄のえらびは「不良品から」1つ', /label:'不良品から'/.test(mst));
    ok('⑭-17 廃棄から戻すのは「不良品に戻す」1つ', /label:'不良品に戻す'/.test(mst));
    ok('⑭-18 「不良・軽から」を残していない', mst.indexOf("label:'不良・軽から'") < 0);
    ok('⑭-19 数を動かすえらび一覧は3つ', /var order = \['new','old','lv1'\];/.test(mst));
    ok('⑭-20 登録のえらびは「不良品」と「廃棄」', /lv1:.*label:'不良品'/.test(mst) && /discard:.*label:'廃棄'/.test(mst));
    ok('⑭-21 貼り直しは「良品」と書いてある', /relabel:.*label:'貼り直し（良品）'/.test(mst));
    ok('⑭-22 「緑・レベル1」を残していない', mst.indexOf('緑・レベル1') < 0);
    const stk = H.read('stock.html');
    ok('⑭-23 stock.html も同じ（緑・レベル1を残していない）', stk.indexOf('緑・レベル1') < 0);
    /* 在庫の親：振り分けに戻っていないか */
    const zsrc = H.read('oos-zaiko.js');
    /* ★2026-09-12 実装の1行を文字で探すのをやめ、【動かして数を見ます】。
       　ひろみさん決定（2026-09-12）：不良品は程度で分けない。1つにまとめる。
       　貼り直し・廃棄は不良に数えない。
       ★数を直に書いています。式に直さないでください。 */
    (function(){
      var _S = H.makeSandbox({});
      try { vm.runInContext(zsrc, _S.ctx); } catch (e) {}
      var _Z = _S.box.OOS_ZAIKO;
      ok('⑭-24 在庫の親（OOS_ZAIKO）が動く', !!_Z);
      if (_Z && typeof _Z.defectTotals === 'function') {
        /* 軽2・中3・重4 ＝ 不良は9個（程度で分けない） */
        var _d = [{ pid:1, level:'lv1', qty:2, lot:'cur' },
                  { pid:1, level:'lv2', qty:3, lot:'cur' },
                  { pid:1, level:'lv3', qty:4, lot:'cur' },
                  { pid:1, level:'relabel', qty:5, lot:'cur' },
                  { pid:1, level:'discard', qty:6, lot:'cur' }];
        try {
          var _t = _Z.defectTotals(_d, 1);
          ok('⑭-24 程度で分けず、不良は9個にまとめる', _t && (_t.cur ? _t.cur.defectQty : _t.defectQty) === 9);
        } catch (e) {
          ok('⑭-24 不良の数え方を動かせる（窓口の名前が変わったかも）', false);
        }
      } else {
        /* 窓口の名前が分からないときは、せめて言葉が残っているかを見る */
        ok('⑭-25 貼り直し・廃棄を分ける言葉が残っている',
           zsrc.indexOf('relabel') >= 0 && zsrc.indexOf('discard') >= 0);
      }
    })();
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑮ 読み込み中に「未登録」と嘘をつかない／届いたら計算し直す
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさんの指摘：「どこみてんの？登録すでにおわってる。」
     　価格マスタがまだ届いていないのに【未登録】と赤で出していました。
     　しかも、届いたあとに計算し直していなかったので、そのまま止まっていました。
     ★「読込中…」の見分けと、届いたあとの計算し直しを消さないでください。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    /* ══════════════════════════════════════════════════════════════
       ★2026-09-12（夜）ひろみさん決定で【単価と金額の列そのものを外しました】。
       　「単価と金額の読み込みが長すぎる。ここの表示、いらない。PDFで確認できるから」
       　これに合わせて、ここにあった ⑮-1〜⑮-5h（読込中・未登録・待つ仕組み）は
       　【捨てました】。見張る物がもう画面にありません。
       　金額は書類（PDF）で確かめます（⑱・㉒ が見ています）。
       ★単価・金額の列を戻すなら、まずひろみさんに相談してからです。
       ══════════════════════════════════════════════════════════════ */
    const yomi = H.cut(idx, 'refreshLineYomi');
    ok('⑮-1 入力行に単価を出していない',   !/data-role=tanka/.test(yomi));
    ok('⑮-2 入力行に金額を出していない',   !/data-role=kingaku/.test(yomi));
    ok('⑮-3 価格データを待っていない',     !/priceMaster/.test(yomi));
    ok('⑮-3b 待つ仕組みも残っていない',    !/yomiMachiStart/.test(idx));
    ok('⑮-3c 見出しに「単価」を出していない',
       idx.slice(idx.indexOf('<div class="order-line-header">'), idx.indexOf('<div data-role="lines">')).indexOf('単価') < 0);
    ok('⑮-3d 見出しに「金額」を出していない',
       idx.slice(idx.indexOf('<div class="order-line-header">'), idx.indexOf('<div data-role="lines">')).indexOf('金額') < 0);
    /* 残した2つ（1箱入り数・合計本数）は、名簿だけで出せます */
    ok('⑮-4 （参考）1箱入り数は出す', /data-role=hakoIri/.test(yomi));
    ok('⑮-5 合計本数は出す',          /data-role=goukei/.test(yomi));

    /* ══════════════════════════════════════════════════════════════
       ⑮-6 「状態」のえらび一覧も、在庫が届いたら作り直す
       ──────────────────────────────────────────────────────────────
       ★2026-09-12 ひろみさん：「旧ロットはすでに登録してる！在庫もあるはず。
       　なぜ選べない？」
       　在庫が届く前に作っていたので、旧ロットも不良品も（残0）のまま固まっていました。
       　（実データ：メメジック500ml の旧ロットは19本）
       ★作り直しを消さないでください。
       ★在庫が届いていないうちは作り直さないこと（人がえらんだ値を消さないため）。
       ══════════════════════════════════════════════════════════════ */
    ok('⑮-6 在庫が届いたら「状態」も作り直す', /refreshLineCondition\(row\)/.test(yomi));
    ok('⑮-6b 届いていないうちは作り直さない',
       /typeof lots !== 'undefined' && lots && lots\.length[\s\S]{0,120}refreshLineCondition\(row\)/.test(yomi));
    /* ★2026-09-12（夜）⑮-6c「待つときは価格と在庫の両方を見る」は【捨てました】。
       　単価の列を外したので、待つ仕組みごと無くなりました。 */
    /* 本物の関数で、在庫の有無で答えが変わることを確かめる */
    (function(){
      const zc = H.makeSandbox({});
      H.runZaiko(zc.ctx);
      vm.runInContext(H.cutVar(idx, 'PRODUCTS'), zc.ctx);
      vm.runInContext(H.cutVar(idx, 'DEFECT_LEVELS'), zc.ctx);
      ['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
       'lotStockFor','defectStockFor','condAvail','condRemainFor','conditionOptionsHtml']
        .forEach(function(n){ vm.runInContext(H.cut(idx, n), zc.ctx); });
      zc.box.defects = []; zc.box.holds = []; zc.box.orders = [];
      zc.box.__p = 9;   /* メメジック 500ml */
      /* ★2026-09-12 ひろみさん決定：残りの数は出さない・いつでも選べる。
         　「ずっと在庫0表示だった」「その括弧 残りゼロ だけを取り除けばいいだけじゃない?」
         　在庫が届いていてもいなくても、同じ3つが出て、どれも選べます。
         ★（残◯）や disabled を書き戻さないでください。 */
      zc.box.lots = [];
      const h0 = vm.runInContext("conditionOptionsHtml(__p, 'normal')", zc.ctx);
      zc.box.lots = [{ pid:9, status:'old', stock:19 }];
      const h1 = vm.runInContext("conditionOptionsHtml(__p, 'normal')", zc.ctx);
      ok('⑮-6d 在庫が届く前も 3つ出て どれも選べる', h0.indexOf('>旧ロット<') >= 0 && !/disabled/.test(h0));
      ok('⑮-6e 在庫が届いたあとも同じ',             h1.indexOf('>旧ロット<') >= 0 && !/disabled/.test(h1));
      ok('⑮-6f 残りの数を出していない',             !/（残\d/.test(h0) && !/（残\d/.test(h1));
      /* ★2026-09-12 ひろみさんがえらんだ「旧ロット」が、勝手に「正規」へ
         　戻されていました（残0だから、という理由で）。
         　在庫が届く前は何もかも0に見えるので、えらんだそばから戻っていました。
         ★この戻す処理を書き戻さないでください。いちばん困る壊れ方です。 */
      const rc = H.cut(idx, 'refreshLineCondition');
      ok('⑮-6g 残0でも 正規へ勝手に戻さない',
         !/condRemainFor\([^)]*\)\s*<=\s*0\)\s*cur\s*=\s*'normal'/.test(rc));
      ok('⑮-6h えらんだ値をそのまま入れ直している', /condSel\.value = cur;/.test(rc));
    })();

    /* 本物の値段の表で、本物の親に聞く（ひろみさんが見た商品そのもの） */
    const KAK = vm.runInContext('OOS_KAKAKU', dctx);
    const PM = [{ sku:'MEM500', productName:'メメジック 500ml',
                  priceGeneral:9121, priceWholesale1:6884, priceWholesale2:5473,
                  priceRT:6884, priceBasara:6228, priceSpecial:0, priceDefect:0, priceOldLot:5473 }];
    const line = { giftType:'normal', boxes:0 };
    eq('⑮-6 メメジック500ml 定価は ¥9,121', KAK.unitPriceForLine({customerType:'general'},    line, 'MEM500', PM, null), 9121);
    eq('⑮-7 卸①は ¥6,884',                 KAK.unitPriceForLine({customerType:'wholesale1'}, line, 'MEM500', PM, null), 6884);
    eq('⑮-8 卸②は ¥5,473',                 KAK.unitPriceForLine({customerType:'wholesale2'}, line, 'MEM500', PM, null), 5473);
    eq('⑮-9 RTは ¥6,884',                   KAK.unitPriceForLine({customerType:'rt'},         line, 'MEM500', PM, null), 6884);
    eq('⑮-10 バサラは ¥6,228',              KAK.unitPriceForLine({customerType:'basara'},     line, 'MEM500', PM, null), 6228);
    /* 表が空のときは 0 が返る＝「未登録」と出してはいけない場面 */
    eq('⑮-11 値段の表が空なら 0 が返る（ここで未登録と言ってはいけない）',
       KAK.unitPriceForLine({customerType:'general'}, line, 'MEM500', [], null), 0);
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑯ データの窓口（Ｄ表）が、GASの本物と合っているか
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん：「loadAll は注文だけ、価格は loadAllData でした。
     　これどちらか消さなくていいの？また起きない？」
     　→ どちらも消せません（両方たくさん使われています）。
     　　問題は名前です。`loadAll` は「全部」に読めるのに、返すのは注文だけ。
     　　私はここで間違えて「本番の不良在庫は0件」と誤って報告しました（実際は21件）。
     ★だからＤ表に書いて、GASの本物と突き合わせます。
     　GASの中身が変わったら、この見張りが落ちます。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    const D = IK.DATA_MADOGUCHI || [];
    eq('⑯-0 Ｄ表に窓口が3つ書いてある', D.length, 3);
    ['loadAll','loadAllData','loadBundleForOrders'].forEach(function(n){
      ok('⑯-1 Ｄ表に「'+n+'」が載っている', D.some(function(r){ return r.na === n; }));
    });
    if(!gasSrc){ console.log('（GASのファイルが手元にないので ⑯ の突き合わせは飛ばしました）'); return; }

    /* loadAll は【注文だけ】を返す（価格マスタを返さない） */
    const la = H.cut(gasSrc, 'loadAll');
    ok('⑯-2 loadAll は orders を返す',            /result\s*=\s*\{orders:\[\]\}/.test(la));
    ok('⑯-3 loadAll は価格マスタを返さない',      la.indexOf('priceMaster') < 0);
    ok('⑯-4 loadAll は在庫ロットを返さない',      la.indexOf("readSheet('在庫データ'") < 0);
    ok('⑯-5 loadAll は不良在庫を返さない',        la.indexOf("readSheet('不良在庫データ'") < 0);

    /* loadAllData は 価格マスタ・在庫・不良在庫 を返す */
    const lad = H.cut(gasSrc, 'loadAllData');
    ok('⑯-6 loadAllData は価格マスタを返す',      /result\.priceMaster\s*=/.test(lad));
    ok('⑯-7 loadAllData は在庫ロットを返す',      /result\.lots\s*=/.test(lad));
    ok('⑯-8 loadAllData は不良在庫を返す',        /result\.defects\s*=/.test(lad));
    ok('⑯-9 loadAllData は注文を返さない',        !/result\.orders\s*=/.test(lad));

    /* Ｄ表に書いた「入っていないもの」が、本当に入っていないか */
    const laRow  = D.filter(function(r){ return r.na === 'loadAll'; })[0] || {};
    const ladRow = D.filter(function(r){ return r.na === 'loadAllData'; })[0] || {};
    ok('⑯-10 Ｄ表に「loadAll は注文だけ」と書いてある',    /注文だけ/.test(laRow.kaesu || ''));
    ok('⑯-11 Ｄ表に「価格マスタは入っていない」と書いてある', /価格マスタ/.test(laRow.nai || ''));
    ok('⑯-12 Ｄ表に「loadAllData に価格マスタ」と書いてある', /価格マスタ/.test(ladRow.kaesu || ''));

    /* 受注Ａは、価格を loadAll から取ろうとしていないか */
    ok('⑯-13 受注Ａは価格マスタを loadAllData 側から受け取っている',
       /if\(Array\.isArray\(d\.priceMaster\)/.test(idx));
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑰ 金額が載る6種類は、ぜんぶPDFを作って発注書のリンク列に入れる
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん：「同梱書類のところのPDFが添付されないんだけど」
     　同梱書類に「請求書」をえらんだ注文で、PDFが1枚も作られていませんでした。
     　「納品書」という字が入っているかだけで決めていたためです。
     ★「納品書という字が入っているか」に戻さないでください。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    const NOU = vm.runInContext('OOS_NOUHIN', dctx);
    const KIM = vm.runInContext('OOS_SHORUI', dctx);
    /* 決めごとに書いてある「数字が載る6種類」は、ぜんぶ作る */
    ['納品書兼請求書','納品書兼領収書','RT発注伝票＋納品書','納品書','請求書','領収書'].forEach(function(nm){
      ok('⑰-1 「'+nm+'」はPDFを作る', NOU.needsNouhin({ enclosedDoc: nm }) === true);
      ok('⑰-2 「'+nm+'」は金額が載る（決めごと）', KIM.sujiGaNoruKa(nm) === true);
    });
    /* 数字が載らないものは作らない */
    ['パンフレット','その他','なし'].forEach(function(nm){
      ok('⑰-3 「'+nm+'」はPDFを作らない', NOU.needsNouhin({ enclosedDoc: nm }) === false);
    });
    ok('⑰-4 同梱書類が空のときは作る（既定は納品書兼請求書）', NOU.needsNouhin({ enclosedDoc: '' }) === true);
    /* 実際に「請求書」でHTMLが作れて、金額が載るか */
    const oSei = testOrder({ enclosedDoc:'請求書' });
    dbox.__o = oSei;
    const hSei = String(vm.runInContext('OOS_NOUHIN.build(__o, __d)', dctx));
    ok('⑰-5 「請求書」で書類が作れる', hSei.length > 500);
    ok('⑰-6 「請求書」に金額が載る',   hSei.indexOf('¥') >= 0);
    ok('⑰-7 「請求書」に倉庫ピッキング手数料の枠が出る', hSei.indexOf('倉庫ピッキング手数料') >= 0);
    /* 発注書のリンク列（22列目）の振り分けも、決めごとに聞いているか */
    ok('⑰-8 発注書の列分けは決めごとの親に聞いている',
       /function pdfNiSuruKa/.test(idx) && /OOS_SHORUI\.sujiGaNoruKa/.test(H.cut(idx, 'pdfNiSuruKa')));
    ok('⑰-9 「納品書という字が入っているか」で分けていない',
       idx.indexOf("filter(function(d){ return d.indexOf('納品書')>=0; })") < 0);
    /* ★2026-09-12 判断は shoruiList の1か所にまとめました（2枚とも作るため）。
       needsNouhin はその一覧の数を見るだけです。★写しを作らないでください。 */
    ok('⑰-10 PDFを作るかどうかは shoruiList の1か所で決めている',
       /KIM && KIM\.sujiGaNoruKa \? KIM\.sujiGaNoruKa\(nm\)/.test(H.read('oos-nouhin.js'))
       && /return shoruiList\(o\)\.length > 0;/.test(H.read('oos-nouhin.js')));
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑱ 書類は【見てから貼る】（登録前・登録後・あとから）／貼れていないとカードに出る
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん：
     　「自動でスプシに貼られる前に、アプリ上でチェックしたい。
     　　じゃないと、データーを何度もキャンセルすることも起きる」
     　「届いていなくても気が付けない」
     　「どこでPDF開いてチェックできるの？？？？？」
     　「RTの取り込みからのオーダーも…PDFの納品書も確認できたり…」

     見る機会は3回（全部ここで見張ります。別の番号に分けないでください）
     　① 登録する前　… 確認画面の［📄 書類（PDF）を見て確かめる］（貼らない）
     　② 登録したあと… 書類が出る →［この内容で発注書に貼る］／［直す］
     　③ あとから　　… 受注一覧のカードの［PDFをスプシに貼る前に確認する］
     RTの伝票取込だけは、書類の作り方がちがいます（rtDeliveryNoteHtml）。
     ★自動で貼る形に戻さないでください。
     ★同じ決めごとを、別の番号でもう一度書かないでください（2026-09-12 ひろみさん指摘）。
     ══════════════════════════════════════════════════════════════════ */
  await (async function(){
    /* 登録したときに、その場では貼らない */
    const reg = H.cut(idx, 'registerOrder').replace(/\/\*[\s\S]*?\*\//g, '');
    ok('⑱-1 登録のときに自動で貼っていない', !/nouhinAttachToOrder\s*\(/.test(reg));
    /* ★2026-09-13 承認モック（流れがそのままボタン）：書類を見るのは【登録の前】。
       　登録したあとに自動で出すのはやめました（同じものを2回見ることになるため）。
       　かわりに、見ていない書類があれば登録を止めます。 */
    ok('⑱-2 見ていない書類があると登録を止める', /先に書類（PDF）を見て確かめてください/.test(reg));
    ok('⑱-2b 登録のあとに自動では出さない', !/docCheckStart\s*\(/.test(reg));

    /* 見てから貼る画面がある */
    ok('⑱-3 書類を出す枠が画面にある', /id="doc-check"/.test(idx));
    ok('⑱-4 出す関数がある',           /function docCheckNext\s*\(/.test(idx));
    const nx = H.cut(idx, 'docCheckNext');
    ok('⑱-5 本物の書類を、その書類名で組み立てて見せている',
       /OOS_NOUHIN\.build\(o, nouhinDeps\(\), _mei\)/.test(nx));
    /* ★2026-09-13 承認モック mocks/mock_shorui_susu_2026-09-13.html
       　ひろみさん：「PDFの画面のボタンは、戻って直す／この内容でOK の２つにして」
       　この画面では【貼りません】。貼るのはカードの大きいボタン（docHari）です。 */
    ok('⑱-6 ［この内容でOK］がある',   /この内容でOK ▶/.test(nx));
    ok('⑱-7 ［戻って直す］がある',     /◀ 戻って直す/.test(nx));
    ok('⑱-7b ボタンは2つだけ（ここでは貼らない）', !/発注書に貼る<\/button>/.test(nx));
    ok('⑱-8 単価が未登録なら、そう出して貼らせない', /単価が登録されていない商品があるので/.test(nx));
    ok('⑱-9 貼るのはカードのボタンだけ（その書類名で貼る）',
       /nouhinAttachToOrder\(o, mei\)/.test(H.cut(idx, 'docHari')));
    ok('⑱-9b「この内容でOK」は見た印だけ（貼らない）',
       !/nouhinAttachToOrder/.test(H.cut(idx, 'docCheckOk')) && /docKakuninSuru/.test(H.cut(idx, 'docCheckOk')));
    ok('⑱-10 「戻って直す」では貼らない・注文にも触らない',
       !/nouhinAttachToOrder|reopenOrderForEdit|deleteOrderSoft/.test(H.cut(idx, 'docCheckModoru')));

    /* どの注文を出すか（バサラとRT伝票取込は出さない） */
    const ts = H.cut(idx, 'docCheckTaisho');
    /* ★2026-09-12 文字さがしをやめ、実物を動かして確かめます。 */
    (function(){
      var _S = H.makeSandbox({});
      var _ug = true;
      /* ★2026-09-12（夜）docCheckTaisho は【発注書のV列】を見るようになりました。
         　砂場にその部品を入れないと、本物とちがうものを測ってしまいます。
         ★docHareteruKa を外さないでください。 */
      ['docHareteruKa', 'docCheckTaisho', 'rtKubunKa', 'rtDenpyoOrderKa'].forEach(function (n) {
        try { vm.runInContext(H.cut(idx, n), _S.ctx); } catch (e) { _ug = false; }
      });
      /* 発注書をまだ読んでいない状態＝何も貼れていない、として確かめます */
      try { vm.runInContext('var docVretsu = {};', _S.ctx); } catch (e) { _ug = false; }
      ok('⑱-11 見分ける仕掛けを動かせる', _ug);
      if (_ug && typeof _S.box.docCheckTaisho === 'function') {
        ok('⑱-11 バサラは【見てから貼る】に出さない',
           _S.box.docCheckTaisho({ source:'basara', customerType:'卸バサラスター', enclosedDoc:'納品書兼請求書' }) === false);
        ok('⑱-11 ふつうの注文は出す',
           _S.box.docCheckTaisho({ source:'', customerType:'定価', enclosedDoc:'納品書兼請求書' }) === true);
        /* ══════════════════════════════════════════════════════════════
           ★2026-09-24 ⑱-13 を書き直しました（張りぼてだったため）。
           　もとは「docCheckTaisho の中に o.nouhinDocUrl という字があるか」を
           　見ていました。nouhinDocUrl は 2026-09-12 に捨てた写しの名前です。
           　本物のコードにはもう無く、「この名前に戻さないでください」という
           　【注意書きの文字】に当たって合格していました（名前と中身が真逆）。
           → 発注書のV列に貼ってある状態を作って、本当に出さないかを動かして見ます。
           ★文字さがしに戻さないでください。 */
        var _lbl = '📄 ' + _S.box.OOS_NOUHIN.docTitleOf('納品書兼請求書') + '（ひらく）';
        vm.runInContext('docVretsu = ' + JSON.stringify({ K13: [{ '文字': _lbl, 'リンク': 'https://x/13' }] }) + ';', _S.ctx);
        ok('⑱-13 もう発注書のV列に貼ってある書類は、もう一度出さない（動かして確かめる）',
           _S.box.docCheckTaisho({ source:'', customerType:'定価', enclosedDoc:'納品書兼請求書', yukaKey:'K13' }) === false);
        vm.runInContext('docVretsu = {};', _S.ctx);
      }
    })();
    /* ★2026-09-12（夜）RTも【見てから貼る】に入れました（ひろみさん指示）。
       　それまでは登録した瞬間に自動で貼られ、見る機会がありませんでした。
       ★RTを対象から外す形に戻さないでください。 */
    ok('⑱-12 RTの伝票取込も出す（外していない）', !/RT伝票取込/.test(ts));
    ok('⑱-14 金額の載らない書類は出さない', /needsNouhin/.test(ts));

    /* カードの札 */
    const fd = H.cut(idx, 'docFudaHtml');
    /* ★2026-09-13 承認モック：札は3つの形だけ
       　① まだ確認していません ② 確認しました＋大きい貼るボタン ③ 📎 添付PDF①（押すと開く） */
    ok('⑱-15 貼れたら「📎 添付PDF①」で出す',        /📎 添付PDF/.test(fd));
    /* ★2026-09-13 承認モック：札は【貼れた書類の📎の行】だけ。
       　「見る」「貼る」は流れバー（nagareCardHtml）が受け持ちます。 */
    const nb = H.cut(idx, 'nagareCardHtml');
    ok('⑱-16 まだ見ていない書類は「いまここ」で出す', /押すとPDFが開きます/.test(nb));
    /* ★2026-09-24 ⑱-16b（④の文字があるか）は外しました。
       　⑱-70〜 で、本物のカードを描いて「④が押せるか」を見ています。 */
    /* ★2026-09-12 ひろみさんの文言：「PDFをスプシに貼る前に確認する」というボタン */
    /* ★2026-09-12（夜）ひろみさん：「PDFを開いて一度確認すると
       　スプシに貼るボタンが出ます　にして！！　そしたらみんな迷わない」 */
    ok('⑱-17 カードからも書類を開ける', /docCheckOne\(/.test(nb));
    /* ★2026-09-24 ⑱-17c（⑤の文字があるか）は ⑱-70〜 にまとめました（動かして確かめます） */
    /* ★2枚えらんだら2枚とも札が出るか（1枚ぶんに戻さないための見張り） */
    ok('⑱-17b 札は書類の枚数ぶん出す', /OOS_NOUHIN\.shoruiList\(o\)/.test(fd) && /meis\.forEach/.test(fd));
    ok('⑱-18 書類が無い注文は「書類はありません」',     /金額の載る書類はありません/.test(fd));
    ok('⑱-19 貼れていたら押すと開く',                   /target="_blank"/.test(fd));
    ok('⑱-20 理由も出す',                               /o\.nouhinDocNg/.test(fd));
    ok('⑱-21 カードに札を出している', /docFudaHtml\(o, _torikeshi\)/.test(H.cut(idx, 'renrakuBox')));

    /* 貼れなかった理由を注文に残している（1秒で消える字だけにしない） */
    const at = H.cut(idx, 'nouhinAttachToOrder');
    /* ★空にする1か所（貼れたとき）は数えません。理由を入れている所だけ数えます
       ★2026-09-13 3→5か所。足したのは
         ④ ふだ（転記キー）が付かないまま貼ろうとしたとき
         ⑤ 発注書が not-ok を返したとき（「行が見つかりません」など）
       どちらも前は【黙って帰る／1秒の帯だけ】で、理由が残りませんでした。 */
    eq('⑱-22 貼れなかった理由を5か所で残している',
       (at.match(/o\.nouhinDocNg\s*=\s*'[^']/g) || []).length
       + (at.match(/o\.nouhinDocNg\s*=\s*String/g) || []).length, 5);
    ok('⑱-23 貼れたら理由を消す', /o\.nouhinDocNg\s*=\s*''/.test(at));
    /* ══ ⑱-24〜 2026-09-13：「発注書にPDFのリンクが飛ばない」の手当て ══
       ひろみさん：「受注Aで登録しても、このスプシにまたPDFのリンクが飛ばない！！！」
       実測：登録の2.5秒後に確認画面が出るのに、発注書に行ができるのは10秒〜。
       　　　ふだ（転記キー）が無いまま押すと、黙って帰っていた。
       ★この3つを外さないでください。外すと、また「押したのに何も起きない」に戻ります。 */
    ok('⑱-24 ふだが無ければ、付くまで待つ', /await docFudaMachi\(o\)/.test(at));
    ok('⑱-25 待つ係がいる', /async function docFudaMachi/.test(idx));
    /* ★2026-09-13 ［いま作って貼る］は廃止。貼る場所は【カードの大きいボタン】1つだけ */
    ok('⑱-26 貼る係は docHari の1つだけ', /async function docHari/.test(idx) && !/async function docIma/.test(idx));
    /* ★2026-09-24 ⑱-27（④のボタンの文字があるか）は ⑱-16b と同じことを見ていたので外しました。⑱-70〜 へ */
    ok('⑱-28 行が見つからないときは、次にすることを書く', /行が見つかりません/.test(at));

      /* ══ 2026-09-13 ひろみさん指示（3つ）══════════════════════════
       ・添付書類の行に「※単価確認：統合マスタNの『価格リスト』」を入れる
       ・「その他（自分で書く）」を選んだら、その書類のPDFを入れられるようにする
       　（パンフレットを除いて、発注書のV列は最大2つまで＝GAS側の SAIDAI=2 が守る）
       ★この3つを外さないでください。 */
    ok('⑱-32 添付書類の行に単価確認の一言がある',
       /※単価確認：統合マスタNの『価格リスト』/.test(H.cut(idx, 'nagareMaeRender')) &&
       /※単価確認：統合マスタNの『価格リスト』/.test(H.cut(idx, 'nagareCardHtml')));
    ok('⑱-33 その他のPDFを入れる口がある', /data-role=otherPdfFile/.test(idx) && /async function otherPdfHairu/.test(idx));
    ok('⑱-34 入れたPDFはドライブに保存する', /action:'saveExtraDoc'/.test(H.cut(idx, 'otherPdfHairu')));
    ok('⑱-35 注文にPDFを持たせる', /otherDocUrl:/.test(idx));
    /* ══════════════════════════════════════════════════════════════════
       ⑱-70〜 受注一覧のカードを【本物の関数で描いて】確かめる（2026-09-24）
       ──────────────────────────────────────────────────────────────────
       ひろみさん：「受注登録をして、納品書とかがスプレッドシートに貼り付かないの」
       本番で見たこと：9/22のShopify 4件（同梱書類＝「その他」＋自分で入れたPDF）が、
       　発注書に行はできているのに、V列が空のままだった。
       原因：カードの④が「金額の載る書類が無い」＝最初から ✅ で【押せなかった】。
       　貼る係（docHariZenbu → docHariOther）は正しかったのに、呼ぶボタンが出ていない。
       見張りが見逃した理由：⑱-16b・⑱-27・⑱-36・⑱-37 は【文字があるか】だけを見ていた。
       　「docHariZenbu という字がある」ので合格。その他だけの注文は誰も試していなかった。
       → 4つを外して、ここにまとめました。★文字さがしに戻さないでください。
       ══════════════════════════════════════════════════════════════════ */
    await (async function(){
      const _S = H.makeSandbox({});
      let _ug = true;
      ['esc','nagareSt','nagareNokori','nagareWaku','nagareCardHtml','docHareteruKa',
       'docKakuninKa','docKakuninSuru','docOtherHattaKa','docZenbuHattaKa','docFudaHtml','docHariZenbu'
      ].forEach(function(n){ try { vm.runInContext(H.cut(idx, n), _S.ctx); } catch (e) { _ug = false; } });
      try {
        vm.runInContext('var docVretsu = {}; var docKakuninMap = {}; var DOC_MARU = ["①","②","③","④","⑤"];'
          + 'var OOS_HACCHUSHO_URL = "https://x/hacchusho"; var orders = []; var __yobi = [];'
          + 'function docHari(id, mei){ __yobi.push("docHari:" + mei); }'
          + 'function docHariOther(o){ __yobi.push("docHariOther"); }'
          + 'function showSyncStatus(){}'
          + 'function renderList(){ __yobi.push("renderList"); }', _S.ctx);
      } catch (e) { _ug = false; }
      ok('⑱-70 カードを描く仕掛けを、本物のまま動かせる', _ug);
      if (!_ug) return;
      const B = _S.box;
      const V = function(m){ vm.runInContext('docVretsu = ' + JSON.stringify(m) + ';', _S.ctx); };
      const oshiteru  = function(h, id){ return h.indexOf('onclick="docHariZenbu(\'' + id + '\')"') >= 0; };
      const goAkeru   = function(h){ return /onclick="window\.open\(OOS_HACCHUSHO_URL/.test(h); };
      const nouLbl = '📄 ' + B.OOS_NOUHIN.docTitleOf('納品書兼請求書') + '（ひらく）';

      /* A. 納品書兼請求書だけ（いちばん普通の注文） */
      const a = { id:'a', yukaKey:'KA', enclosedDoc:'納品書兼請求書' };
      V({});
      ok('⑱-71 納品書：見る前は④を押せない', !oshiteru(B.nagareCardHtml(a), 'a'));
      B.docKakuninSuru(a, '納品書兼請求書');
      ok('⑱-72 納品書：見たら④が押せる',       oshiteru(B.nagareCardHtml(a), 'a'));
      ok('⑱-72 納品書：④が終わるまで⑤は開かない', !goAkeru(B.nagareCardHtml(a)));
      V({ KA:[{ '文字':nouLbl, 'リンク':'https://x/a' }] });
      ok('⑱-73 納品書：貼れたら④は✅（もう押さない）', !oshiteru(B.nagareCardHtml(a), 'a'));
      ok('⑱-73 納品書：貼れたら⑤で発注書スプシを開ける（アプリから🔵にはしない）', goAkeru(B.nagareCardHtml(a)));

      /* B. 「その他」＋自分で入れたPDFだけ（9/22のShopifyの形・今回の穴） */
      const b = { id:'b', yukaKey:'KB', enclosedDoc:'その他 ＋  ＋ ',
                  otherDocUrl:'https://x/other-b', otherDocName:'#1026児玉恵美子様.pdf' };
      V({});
      ok('⑱-74 その他だけ：まだ貼れていなければ④が押せる', oshiteru(B.nagareCardHtml(b), 'b'));
      ok('⑱-74 その他だけ：④が終わるまで⑤は開かない',       !goAkeru(B.nagareCardHtml(b)));
      ok('⑱-75 その他だけ：札に「まだ発注書に貼れていません」とPDFの名前が出る',
         /まだ発注書に貼れていません/.test(B.docFudaHtml(b)) && /#1026児玉恵美子様\.pdf/.test(B.docFudaHtml(b)));
      vm.runInContext('orders = [' + JSON.stringify(b) + ']; __yobi = [];', _S.ctx);
      await vm.runInContext('docHariZenbu("b")', _S.ctx);
      ok('⑱-76 その他だけ：④を押すと、その他のPDFを貼る係が動く', B.__yobi[0] === 'docHariOther');
      /* ★2026-09-24 本番で私（Claude）が押して確かめたら、発注書には貼れているのに
         　カードが「④ いまここ」のままでした（描き直しを呼んでいなかった）。
         　これでは「貼れていない」と見えて、また押し直すことになります。 */
      ok('⑱-76 その他だけ：貼ったあと、カードを描き直す（「④ いまここ」のまま残さない）',
         B.__yobi.indexOf('renderList') > B.__yobi.indexOf('docHariOther'));
      V({ KB:[{ '文字':'📄 #1026児玉恵美子様.pdf（ひらく）', 'リンク':'https://x/other-b' }] });
      ok('⑱-77 その他だけ：貼れたら④は✅、⑤で発注書スプシを開ける',
         !oshiteru(B.nagareCardHtml(b), 'b') && goAkeru(B.nagareCardHtml(b)));
      ok('⑱-77 その他だけ：貼れたら札は「📎 添付PDF（その他）」',
         /📎 添付PDF（その他）/.test(B.docFudaHtml(b)) && !/まだ発注書に貼れていません/.test(B.docFudaHtml(b)));

      /* C. 納品書 ＋ その他（納品書だけ先に貼れた） */
      const c = { id:'c', yukaKey:'KC', enclosedDoc:'納品書兼請求書 ＋ その他',
                  otherDocUrl:'https://x/other-c', otherDocName:'c.pdf' };
      B.docKakuninSuru(c, '納品書兼請求書');
      V({ KC:[{ '文字':nouLbl, 'リンク':'https://x/c' }] });
      ok('⑱-78 納品書＋その他：その他が残っていれば④はまだ押せる', oshiteru(B.nagareCardHtml(c), 'c'));

      /* D. 書類なし */
      const d = { id:'d', yukaKey:'KD', enclosedDoc:'なし' };
      V({});
      ok('⑱-79 書類なし：④は✅「金額の載る書類はありません」、⑤は開ける',
         !oshiteru(B.nagareCardHtml(d), 'd') && /金額の載る書類はありません/.test(B.nagareCardHtml(d)) && goAkeru(B.nagareCardHtml(d)));
    })();

    /* ══════════════════════════════════════════════════════════════════
       ⑱-80〜 通常発送の確認画面：RTと同じ「見る → ☑ → 1つのボタン」（2026-09-24）
       ──────────────────────────────────────────────────────────────────
       承認モック：mocks/mock_受注A書類をその場で確認_2026-09-24.html
       決まったこと：見積書は入れない／🖨️と📎を全部開くまで☑は押せない／
       　PDFはRTと同じくファイルとして開く（OOS_DOC.downloadPdf）／文言はモックのまま
       本物の関数を動かして、押せる・押せない・結果の文言を確かめます。★文字さがしに戻さないでください。
       ══════════════════════════════════════════════════════════════════ */
    await (async function(){
      const els = {};
      function mkEl(id){ return els[id] || (els[id] = { id:id, innerHTML:'', style:{}, textContent:'', disabled:false,
        insertAdjacentHTML(p, h){ this.innerHTML += h; }, remove(){ delete els[id]; }, querySelector(){ return null; } }); }
      const kiroku = { pdf:[], open:[], reg:[], hari:[], other:[] };
      const doc = { getElementById: mkEl, createElement(){ return { style:{}, innerHTML:'', querySelector(){ return null; } }; },
                    body:{ appendChild(){}, removeChild(){} } };
      const _S = H.makeSandbox({ document: doc, alert(){}, open(u){ kiroku.open.push(u); } });
      let _ug = true;
      ['esc','docKakuninKa','docKakuninSuru','docHareteruKa','docOtherHattaKa','docZenbuHattaKa','rtKubunKa','rtDenpyoOrderKa',
       'nagareSt','nagareNokori','nagareWaku','nagareMaeRender',
       'juchuMaeMitaKa','juchuMaeRender','juchuKakuninChk','juchuPdfHiraku','juchuIkkiSay','juchuIkkiIma',
       'juchuIkkiHaru','juchuIkkiKekka','juchuIkkiGo','juchuIkkiRock_','juchuMaeRender0_','zaikoYomiNaosu'
      ].forEach(function(n){ try { vm.runInContext(H.cut(idx, n), _S.ctx); } catch (e) { _ug = false; console.log('切り出せない:', n, e.message); } });
      _S.box.__kiroku = kiroku;
      try {
        vm.runInContext('var docVretsu = {}; var docKakuninMap = {}; var DOC_MARU = ["①","②","③","④","⑤"];'
          + 'var juchuMaeKumi = []; var juchuMaeChk = false; var juchuIkkiChu = false; var juchuMaeListRef = null;'
          + 'var orders = []; var __zaikoTarinai = []; var __hariOk = true;'
          + 'OOS_NOUHIN = Object.assign({}, OOS_NOUHIN, { build: function(){ return "<div>書類</div>"; }, missingPrices: function(){ return []; } });'
          + 'var OOS_DOC = { downloadPdf: async function(el, nm){ __kiroku.pdf.push(nm); } };'
          + 'function nouhinDeps(){ return {}; } function nouhinFileName(o, m){ return m + ".pdf"; } function rtNouhinHtml(){ return ""; }'
          + 'var GAS_URL = "x"; var gasSyncEnabled = true; function bust(u){ return u; }'
          + 'var lots = [{ id:"L0", pid:1, status:"new", stock:5 }]; var defects = []; var holds = []; var preorders = [];'
          + 'var __fresh = null; var __yonda = 0;'
          + 'fetch = async function(){ __yonda++; return { json: async function(){ return __fresh ? { status:"ok", data:{ lots:__fresh, defects:[], holds:[], preorders:[] } } : { status:"error" }; } }; };'
          + 'function checkStockShortage(){ return (!lots.some(function(l){ return l.pid === 38 && l.stock > 0; }) && __kappu) ? [{ name:"カップオイル 13g グリーンブーケ（オルガニック）", need:3, avail:0 }] : __zaikoTarinai; }'
          + 'var __kappu = false;'
          + 'function registerOrder(opt){ __kiroku.reg.push(opt); (window._pendingOrders||[]).forEach(function(o){ o.yukaKey = "K-" + o.id; o.num = "TK-" + o.id; orders.push(o); }); }'
          + 'async function docFudaMachi(){ return true; }'
          + 'async function nouhinAttachToOrder(o, m){ __kiroku.hari.push(m); if(__hariOk){ (docVretsu[o.yukaKey] = docVretsu[o.yukaKey] || []).push({ "文字":"📄 " + OOS_NOUHIN.docTitleOf(m) + "（ひらく）", "リンク":"u-" + m }); } else { o.nouhinDocNg = "テストの失敗"; } }'
          + 'async function docHariOther(o){ __kiroku.other.push(o.id); if(__hariOk){ (docVretsu[o.yukaKey] = docVretsu[o.yukaKey] || []).push({ "文字":"x", "リンク":o.otherDocUrl }); } }'
          + 'async function docVretsuYomu(){ return docVretsu; }'
          + 'function renderList(){} function syncOrdersToGAS(){} function showSyncStatus(){} function oosShippai(){}', _S.ctx);
      } catch (e) { _ug = false; console.log(e); }
      ok('⑱-80 新しい確認画面を、本物の関数のまま動かせる', _ug);
      if (!_ug) return;
      const B = _S.box;
      const box = () => mkEl('nagare-mae').innerHTML;
      const chkOff = () => /id="juchu-confirm-chk"[^>]* disabled/.test(box());
      const btnOn  = () => /<button id="juchu-ikki-btn" onclick/.test(box());
      const log = () => mkEl('juchu-ikki-log').innerHTML;

      /* A. 納品書兼請求書 ＋ その他のPDF */
      const a = { id:'p1', status:'pending', enclosedDoc:'納品書兼請求書 ＋ その他', otherDocUrl:'https://x/o1', otherDocName:'o1.pdf' };
      B._pendingOrders = [a];
      B.nagareMaeRender();
      ok('⑱-81 🖨️ の文言（モックどおり）', box().indexOf('🖨️ 納品書兼請求書をPDFで取り出す（確認・印刷・保存）') >= 0);
      ok('⑱-81 📎 の文言（モックどおり）', box().indexOf('📎 その他のPDF（o1.pdf）を開いて確認する') >= 0);
      ok('⑱-81 黄色い枠の見出し・☑・戻る・ボタンの文言（モックどおり）',
         box().indexOf('⚠️ 注文の内容と書類を確認しましたか？') >= 0
         && box().indexOf('注文の内容と、作られる書類が合っていることを確認しました') >= 0
         && box().indexOf('◀ 戻って直す') >= 0
         && box().indexOf('✅ この内容で登録して、発注書まで送る（書類も貼ります）') >= 0);
      ok('⑱-81 見積書は出さない', box().indexOf('見積') < 0);
      ok('⑱-82 開く前は ☑ を押せない・ボタンも押せない', chkOff() && !btnOn());
      B.juchuKakuninChk(true);
      ok('⑱-82 開く前に ☑ を押そうとしても、ボタンは押せないまま', !btnOn());
      await B.juchuPdfHiraku(0);
      ok('⑱-83 🖨️ は RT と同じ OOS_DOC.downloadPdf で PDFファイルとして開く', kiroku.pdf[0] === '納品書兼請求書.pdf');
      ok('⑱-83 1つだけ開いても、まだ ☑ は押せない（📎が残っている）', chkOff());
      await B.juchuPdfHiraku(1);
      ok('⑱-83 📎 はそのPDFを開く', kiroku.open[0] === 'https://x/o1');
      ok('⑱-84 全部開いたら ☑ を押せる', !chkOff() && !btnOn());
      B.juchuKakuninChk(true);
      ok('⑱-84 ☑ を押したらボタンが押せる（青）', btnOn() && /background:#2563eb/.test(box()));

      /* 押す：登録 → 貼る → 読み直し */
      await B.juchuIkkiGo();
      ok('⑱-85 登録は registerOrder を「画面を移らない」呼び方で1回だけ', kiroku.reg.length === 1 && kiroku.reg[0] && kiroku.reg[0].ikki === true);
      ok('⑱-85 納品書とその他のPDFを貼る', kiroku.hari[0] === '納品書兼請求書' && kiroku.other[0] === 'p1');
      ok('⑱-86 うまくいったときの文言（モックどおり）',
         log().indexOf('✅ 登録しました') >= 0 && log().indexOf('（発注書を読み直して確かめました）。') >= 0
         && log().indexOf('※ 倉庫へは、まだ何も行きません。発注書のA列を🔵にしたときだけです（今までどおり）。') >= 0);
      ok('⑱-87 登録が済んだら ☑ とボタンを押せなくする（二重登録の防止）',
         B._pendingOrders === null && mkEl('juchu-confirm-chk').disabled === true && mkEl('juchu-ikki-btn').disabled === true);
      await B.juchuIkkiGo();
      ok('⑱-87 もう一度押しても二重に登録しない', kiroku.reg.length === 1);

      /* B. 貼れなかったとき */
      vm.runInContext('__hariOk = false; docVretsu = {};', _S.ctx);
      const b = { id:'p2', status:'pending', enclosedDoc:'納品書' };
      B._pendingOrders = [b]; B.nagareMaeRender(); await B.juchuPdfHiraku(0); B.juchuKakuninChk(true);
      await B.juchuIkkiGo();
      ok('⑱-88 貼れなかったときは理由と［📄 書類を貼り直す］（モックどおり）',
         log().indexOf('⚠️ 発注書に貼れませんでした：テストの失敗') >= 0 && log().indexOf('📄 書類を貼り直す') >= 0
         && log().indexOf('登録は取り消していません') >= 0);

      /* C. 書類なし・在庫が足りないとき */
      vm.runInContext('__hariOk = true; __zaikoTarinai = [{ name:"オルガニック 250ml", need:3, avail:1 }];', _S.ctx);
      const c = { id:'p3', status:'pending', enclosedDoc:'なし' };
      B._pendingOrders = [c]; B.nagareMaeRender();
      ok('⑱-89 書類が無い注文は 🖨️ の段が出ず、☑ はすぐ押せる', box().indexOf('🖨️') < 0 && !chkOff());
      B.juchuKakuninChk(true);
      const regMae = kiroku.reg.length;
      await B.juchuIkkiGo();
      ok('⑱-90 在庫が足りなければ登録せずに止める（RTと同じ文言）',
         kiroku.reg.length === regMae && log().indexOf('⛔ <b>登録していません。</b>在庫が足りません。') >= 0
         && log().indexOf('オルガニック 250ml … 必要 3本 ／ 販売可能 1本（2本たりません）') >= 0);

      /* D. 取り置き・予約は今までの流れのまま */
      vm.runInContext('__zaikoTarinai = [];', _S.ctx);
      B._pendingOrders = [{ id:'w1', status:'held', enclosedDoc:'なし' }]; B.nagareMaeRender();
      ok('⑱-91 取り置き・予約は今までの流れ（③ 受注一覧に登録する）', box().indexOf('受注一覧に登録する') >= 0 && box().indexOf('juchu-ikki-btn') < 0);

      /* ── ⑱-92 開いたままの画面の在庫が古くても、押したときに読み直して進める（2026-09-24） ──
         ひろみさん「在庫を入れたのにいつまでもこの表示が消えず、前に進めない」
         実測：統合マスタＮにはカップオイル3種 各100個、受注Ａの画面は開いたときの0個のまま。 */
      vm.runInContext('__kappu = true; __fresh = null;', _S.ctx);
      const kp = { id:'p9', status:'pending', enclosedDoc:'なし' };
      B._pendingOrders = [kp]; B.nagareMaeRender(); B.juchuKakuninChk(true);
      const reg0 = kiroku.reg.length;
      await B.juchuIkkiGo();
      ok('⑱-92 読み直せなければ、今までどおり止める（在庫が足りません）',
         kiroku.reg.length === reg0 && log().indexOf('在庫が足りません') >= 0);
      vm.runInContext('__fresh = [{ id:"CUP-A", pid:38, status:"new", stock:100 }];', _S.ctx);
      B._pendingOrders = [{ id:'p10', status:'pending', enclosedDoc:'なし' }]; B.nagareMaeRender(); B.juchuKakuninChk(true);
      await B.juchuIkkiGo();
      ok('⑱-92 押したときに在庫を読み直している', B.__yonda >= 2);
      ok('⑱-92 統合マスタＮで入れた在庫が見えて、登録まで進む', kiroku.reg.length === reg0 + 1 && log().indexOf('在庫が足りません') < 0);
      ok('⑱-92 画面の在庫も新しくなる（新しいロットから引ける）', B.lots.some(function(l){ return l.id === 'CUP-A'; }));
    })();
    /* ══ ⑱-95 お客様へのひとこと・倉庫への連絡（2026-09-25 ひろみさん確定） ══ */
    await (async function(){
      { const pN = idx.indexOf('<input type="text" data-role="note"'), lb = idx.lastIndexOf('<label>', pN);
        ok('⑱-95 備考の名前は「倉庫への連絡（任意）」', pN > 0 && idx.slice(lb, pN).indexOf('倉庫への連絡') >= 0 && idx.slice(lb, pN).indexOf('備考') < 0); }
      ok('⑱-95 お客様へのひとことは最大100文字（それ以上は打てない）', /<textarea data-role="okyakuMsg" maxlength="100"/.test(idx) && /<textarea id="rt-okyaku-msg" maxlength="100"/.test(idx));
      const _S = H.makeSandbox({});
      vm.runInContext(H.cut(idx, 'okyakuMsgKazoeru'), _S.ctx);
      const kazu = { textContent:'', style:{} };
      const el = { value:'い'.repeat(120), closest(){ return { querySelector(){ return kazu; } }; } };
      _S.box.okyakuMsgKazoeru(el);
      ok('⑱-95 貼り付けで100文字を超えても、100文字で止める', el.value.length === 100 && kazu.textContent === '100 / 100文字');
      ok('⑱-95 お客様へのひとことは発注書（倉庫）へ送らない', H.cut(idx, 'yukaImportOne').indexOf('okyakuMsg') < 0);
    })();

    /* ══ ⑱-96 発送不要（請求書のみ）／あとから領収書（2026-09-25 承認モック第3版・第4版：売上に入れる／入れない・キャンセル）══
       本物の関数を動かして、押せる・押せない・どこへ行くか・在庫を確かめます。
       ★新しい見張りファイルは作らず、受注Ａの流れの見張り（ここ）に入れました。 */
    await (async function(){
      const els = {};
      function mkEl(id){ return els[id] || (els[id] = { id:id, innerHTML:'', style:{}, textContent:'', disabled:false, value:'',
        insertAdjacentHTML(p, h){ this.innerHTML += h; }, querySelector(){ return null; } }); }
      const kiroku = { post:[], reg:[], heras:0, yuka:0, dl:[] };
      let _mem = '';
      const _S = H.makeSandbox({ document:{ getElementById: mkEl, createElement(){ return { style:{}, click(){} }; }, body:{ appendChild(){}, removeChild(){} } },
        localStorage:{ getItem(){ return _mem; }, setItem(k, v){ _mem = v; }, removeItem(){} } });
      let _ug = true;
      ['esc','docKakuninKa','docKakuninSuru','nagareMaeRender','noshipShirushi','noshipMaeRender','noshipPdfMiru','noshipSay','noshipGo',
       'noshipNokosuHitotsu','noshipCardHtml','sakuseishaIma','sakuseishaOku','sakuseishaSelHtml','hakkouTeishutsu','hakkouBaseName',
       'hakkouKingaku','hakkouNokosu','nagareCardHtml','renrakuBox','ryoshuSoroe','ryoshuMe','ryoshuHizuke','ryoshuMark','ryoshuSagasu','registerOrder',
       'noshipMCyomu','noshipTsukijimeKa','noshipUriageHtml','noshipUriageErabu','noshipDame','noshipBtnJotai','noshipCancel','noshipCancelKiroku','noshipHonsu','noshipHizukeJikan','cancelOrder','lineTotal'
      ].forEach(function(n){ try { vm.runInContext(H.cut(idx, n), _S.ctx); } catch (e) { _ug = false; console.log('切り出せない:', n, e.message); } });
      _S.box.__k = kiroku;
      try {
        vm.runInContext('var docKakuninMap = {}; var OOS_SAKUSEI_KEY = "k"; var noshipMita = false, noshipGoChu = false, noshipListRef = null; var ryoshuKouho = [];'
          + 'var noshipUriage = "", noshipRiyu = ""; var noshipMC = [{ company:"株式会社バサラスター" }], noshipMCyomi = false, noshipMCng = false;'
          + 'function buildStockDeltas(){ return []; } function undoStockForOrder(o){ __k.modoshi = (__k.modoshi || 0) + 1; o.stockDeducted = false; } function persistStockDeltas(){} function yukaCancelMark(){}'
          + 'var orders = []; var customers = []; var ordersLoaded = true; var GAS_URL = "x";'
          + 'function noshipDocErabi(){ return "請求書"; } function noshipZaikoErabi(){ return __zaiko; } var __zaiko = "";'
          + 'async function nouhinBuildPdfB64(o, m){ return "QUJD"; } function hakkouPdfHiraku(b, n){ __k.dl.push(n); }'
          + 'function nouhinDeps(){ return {}; } function nouhinFileName(o, m){ return m + ".pdf"; }'
          + 'fetch = async function(u, opt){ var b = JSON.parse(opt.body); __k.post.push(b); return { json: async function(){ return { status:"ok", url:"https://drive/x", name:b.baseName + ".pdf", dropbox:"鍵待ち" }; } }; };'
          + 'async function zaikoYomiNaosu(){} function checkStockShortage(){ return []; } function zaikoYometeruKa(){ return true; }'
          + 'function applyStockDeductOnSend(o){ __k.heras++; o.stockDeducted = true; } function persistStockDeduct(){}'
          + 'function yukaImportOne(){ __k.yuka++; } function yoyakuListAddOne(){ __k.yuka++; }'
          + 'function rtSlipAutoCut(){} function logGiftIfApplicable(){} function clearForm(){} function updateSummary(){} function renderSlipSelect(){}'
          + 'function renderList(){} function syncOrdersToGAS(){} function showSyncStatus(){} function oosShippai(){} function renderHoldPreLists(){}'
          + 'OOS_NOUHIN = Object.assign({}, OOS_NOUHIN, { build: function(){ return \'<span class="lbl">ご請求金額（税込）</span><span class="amt">¥32,400</span>\'; }, missingPrices: function(){ return []; } });', _S.ctx);
      } catch (e) { _ug = false; console.log(e); }
      ok('⑱-96 発送不要の流れを、本物の関数のまま動かせる', _ug);
      if (!_ug) return;
      const B = _S.box;
      ok('⑱-96 登録の種類に「発送不要（請求書のみ）」がある', idx.indexOf('<option value="noship">発送不要（請求書のみ）</option>') >= 0);
      ok('⑱-96 「在庫は？」ははじめ、どちらも選ばれていない', !/name="noship-zaiko" value="\w+" checked/.test(idx));

      const mk = (id, extra) => B.noshipShirushi([Object.assign({ id:id, num:'TK-20260925-5521', client:'山田商店', recipientName:'山田商店', lines:[] }, extra || {})])[0];
      /* A. 在庫は減らさない */
      B._pendingOrders = [mk('n1')];
      ok('⑱-97 印：status は shipped（売上一覧に載る）・同梱は選んだ書類だけ', B._pendingOrders[0].status === 'shipped' && B._pendingOrders[0].noShip === true && B._pendingOrders[0].enclosedDoc === '請求書' && B._pendingOrders[0].includePamphlet === false);
      B.nagareMaeRender();
      const box = () => mkEl('nagare-mae').innerHTML;
      const btnOn = () => /<button id="noship-go-btn" onclick/.test(box());
      ok('⑱-97 倉庫へは行かない流れ（🔵倉庫へ に線）・通常発送のボタンは出ない', box().indexOf('🔵倉庫へ') >= 0 && box().indexOf('line-through') >= 0 && box().indexOf('juchu-ikki-btn') < 0);
      ok('⑱-97 書類を見る前・売上を選ぶ前・在庫を選ぶ前・作成者を選ぶ前は②を押せない', !btnOn() && box().indexOf('①で書類を見てください') >= 0 && box().indexOf('売上に入れるか入れないかをえらんでください') >= 0 && box().indexOf('「在庫は？」をえらんでください') >= 0 && box().indexOf('作成者をえらんでください') >= 0);
      ok('⑱-97 月締めでないお客様には「月締めの対象の取引先です」を出さない（売上の選択は誰にでも出す）', box().indexOf('月締めの対象の取引先です') < 0 && box().indexOf('売上に入れますか？') >= 0);
      await B.noshipGo();
      ok('⑱-97 押せない状態で呼ばれても登録しない', B.orders.length === 0 && kiroku.post.length === 0);
      await B.noshipPdfMiru();
      B._pendingOrders[0].noShipZaiko = 'herasanai'; B.sakuseishaOku('ゆか'); B.noshipMaeRender();
      ok('⑱-97 売上を選ぶまでは、ほかが揃っても押せない', !btnOn());
      B.noshipUriageErabu('irenai');
      ok('⑱-97 「売上に入れない」は理由を書くまで押せない', !btnOn() && box().indexOf('入れない理由（必ず書く）') >= 0);
      B.noshipRiyu = '請求書をなくされたため出し直し'; B.noshipMaeRender();
      ok('⑱-97 見て・選んで・理由を書いたら②を押せる', btnOn());
      await B.noshipGo();
      const p = kiroku.post[0] || { row:{} };
      ok('⑱-98 ②で登録し、発行記録へ1回だけ送る', B.orders.length === 1 && kiroku.post.length === 1 && p.action === 'oosHakkouSave');
      ok('⑱-98 発注書（倉庫スプシ）へも取り置き・予約リストへも送らない', kiroku.yuka === 0);
      ok('⑱-98 「減らさない」なら在庫は動かない', kiroku.heras === 0 && p.row.zaiko === '減らさない');
      eq('⑱-98 PDFの名前は 伝票番号＿書類の種類＿提出先', p.baseName, 'TK-20260925-5521_請求書_山田商店様');
      ok('⑱-98 行の中身（種類・番号・提出先・金額・作成者）', p.row.shurui === '請求書' && p.row.bangou === 'TK-20260925-5521' && p.row.teishutsu === '山田商店様' && p.row.kingaku === 32400 && p.row.sakusei === 'ゆか' && B.orders[0].orderTotal === 32400);
      ok('⑱-98 売上に入れない印と理由が注文に付き、発行記録のメモにも入る', B.orders[0].uriageIrenai === true && B.orders[0].uriageIrenaiRiyu === '請求書をなくされたため出し直し' && p.row.memo === '売上に入れない（理由：請求書をなくされたため出し直し）');
      ok('⑱-98 登録後はボタンを押せない（二重登録を防ぐ）', B._pendingOrders === null && mkEl('noship-go-btn').textContent === '✅ 登録しました');
      /* ★受注一覧のカードの入口（renrakuBox）で確かめる。［📥 発注書に送る］が出ると、請求書だけの注文が倉庫へ流れる */
      const _kado = (function(){ try { return B.renrakuBox(B.orders[0], {}); } catch (e) { return ''; } })();
      ok('⑱-98 カードは発行記録の札だけ（［📥 発注書に送る］を出さない）', _kado.indexOf('✅ 発行記録に残しました') >= 0 && _kado.indexOf('yukaImportOne') < 0);
      const _p0 = kiroku.post.length;
      /* 本物の yukaImportOne を別の名前で入れて呼ぶ（登録のときに呼ばれないかは、下の身代わりで数えています） */
      vm.runInContext(H.cut(idx, 'yukaImportOne').replace('async function yukaImportOne(', 'async function __honmonoYukaImportOne('), _S.ctx);
      let _tomatta = true;   /* 止めが無いと先へ進み、発注書へ送る処理（ここでは用意していない）で落ちる */
      try { await B.__honmonoYukaImportOne(B.orders[0].id); } catch (e) { _tomatta = false; }
      ok('⑱-98 ほかの道から発注書へ送ろうとしても止まる', _tomatta && kiroku.post.length === _p0);
      /* 第4版：キャンセル（減らさない請求 → 在庫は動かない） */
      await B.noshipCancel(B.orders[0].id);
      const _c1 = kiroku.post[kiroku.post.length - 1] || {};
      ok('⑱-98 キャンセル：注文は取り消し・在庫は戻さない・発行記録のメモに「在庫：動いていません」', B.orders[0].status === 'cancelled' && !kiroku.modoshi && _c1.action === 'oosHakkouCancel' && _c1.bangou === 'TK-20260925-5521' && /キャンセル（ゆか）在庫：動いていません$/.test(_c1.memo));
      ok('⑱-98 キャンセルしたカードは灰色で、在庫がどうなったかを出す（もう一度キャンセルは出ない）', B.noshipCardHtml(B.orders[0]).indexOf('❌ キャンセルしました') >= 0 && B.noshipCardHtml(B.orders[0]).indexOf('在庫：動いていません') >= 0 && B.noshipCardHtml(B.orders[0]).indexOf('noshipCancel(') < 0);
      /* B. 在庫を減らす・RTの番号 */
      B.noshipMita = false;
      B._pendingOrders = [mk('n2', { num:'RT-20260925-1111', client:'ホテルＡ 御中', customerType:'rt', lines:[{ bottles:2, boxes:0, boxQty:6 }] })];
      B._pendingOrders[0].noShipZaiko = 'heras';
      B.nagareMaeRender();
      ok('⑱-99 月締め（RT）には「月締めの対象の取引先です…二重請求」を出す', box().indexOf('月締めの対象の取引先です。本当に請求書を作りますか？') >= 0 && box().indexOf('二重請求になる可能性') >= 0);
      ok('⑱-99 前の注文で選んだ「売上に入れない」は持ち越さない', !btnOn() && box().indexOf('売上に入れるか入れないかをえらんでください') >= 0);
      await B.noshipPdfMiru(); B.noshipUriageErabu('ireru'); await B.noshipGo();
      const _p2 = kiroku.post.filter(x => x.action === 'oosHakkouSave')[1] || { row:{} };
      ok('⑱-99 「減らす」なら在庫を1回だけ減らす', kiroku.heras === 1 && _p2.row.zaiko === '減らした');
      ok('⑱-99 RTは記号を外した番号・御中はそのまま', _p2.baseName === '20260925-1111_請求書_ホテルＡ 御中');
      ok('⑱-99 月締めで売上に入れるときは、メモに「月締めの取引先・売上に入れる」', _p2.row.memo === '月締めの取引先・売上に入れる' && B.orders[1].uriageIrenai === false);
      ok('⑱-99 それでも発注書へは送らない', kiroku.yuka === 0);
      await B.noshipCancel(B.orders[1].id);
      const _c2 = kiroku.post[kiroku.post.length - 1] || {};
      ok('⑱-99 キャンセル：減らした在庫を1回だけ戻し、メモに「在庫：2本戻しました」', B.orders[1].status === 'cancelled' && kiroku.modoshi === 1 && /在庫：2本戻しました$/.test(_c2.memo) && _c2.bangou === '20260925-1111');

      /* C. あとから領収書のさがす窓口 */
      B.orders = [
        { id:'r1', num:'TK-20260910-4182', client:'山田商店', recipientName:'山田商店', registeredAt:'2026-09-10', paymentConfirmed:true, paidAt:'2026-09-20T01:00:00Z', shippedAt:'2026-09-12T01:00:00Z' },
        { id:'r2', num:'OS2-20260915-2210', client:'ヤマダキッチン', registeredAt:'2026-09-15', paymentConfirmed:false },
        { id:'r3', num:'TK-20260801-0931', client:'山本商店', recipientName:'山田 花子', registeredAt:'2026-08-01', paymentConfirmed:true },
        { id:'r4', num:'TK-20260902-0001', client:'山田商店', registeredAt:'2026-09-02', status:'cancelled', paymentConfirmed:true }
      ];
      const kekka = () => { B.ryoshuSagasu(); return mkEl('ryoshu-kekka').innerHTML; };
      mkEl('ryoshu-q').value = '山田';
      const k1 = kekka();
      ok('⑱-100 一部だけで出る・お届け先の名前でも出る・キャンセルは出ない・新しい順', B.ryoshuKouho.map(o => o.id).join(',') === 'r1,r3');
      mkEl('ryoshu-q').value = 'やまだ';
      const k2 = kekka();
      ok('⑱-100 ひらがな「やまだ」でカタカナ「ヤマダ」が出る', B.ryoshuKouho.map(o => o.id).join(',') === 'r2' && k2.indexOf('入金✓がまだ') >= 0);
      mkEl('ryoshu-q').value = '４１８２'; kekka();
      ok('⑱-100 伝票番号の下4けた（全角でも）で出る', B.ryoshuKouho.length === 1 && B.ryoshuKouho[0].id === 'r1');
      ok('⑱-100 入金✓のある注文は［🧾 領収書を出す］を押せる', k1.indexOf('onclick="ryoshuMiru(0)"') >= 0);
      ok('⑱-100 領収書は発行記録へ「領収書（あとから）」で残し、新しく受注登録しない', H.cut(idx, 'ryoshuDasu').indexOf("'領収書（あとから）'") >= 0 && H.cut(idx, 'ryoshuDasu').indexOf('registerOrder') < 0);
    })();


    /* ══ ⑱-101 保存は1本ずつ順番に（2026-09-25 検証で見つけた穴）══
       保存＝「サーバーを読む → 変更を重ねる → まるごと書き直す」。続けて呼ぶと、あとの保存が
       前の保存の書き終わる前に読み、入れたばかりの注文を手元の一覧から落としたり、古い写しで書き直したりした。
       本物の syncOrdersToGAS を、時間のかかる身代わりのサーバーで動かして確かめます。 */
    await (async function(){
      const _S = H.makeSandbox({});
      let _ug = true;
      ['syncOrdersToGAS','syncOrdersToGASHontai_'].forEach(function(n){ try { vm.runInContext(H.cut(idx, n), _S.ctx); } catch (e) { _ug = false; console.log('切り出せない:', n, e.message); } });
      try {
        vm.runInContext('var __oosSyncKyu = Promise.resolve(); var __oosSyncMachi = {};'
          + 'var gasSyncEnabled = true; var GAS_URL = "x"; function bust(u){ return u; } function renderList(){} function showSyncStatus(){} function honbuMirrorPing(){}'
          + 'var __srv = [{ id:"old", v:1 }]; var __log = [];'
          + 'function __matsu(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }'
          + 'fetch = async function(u, opt){ if(opt && opt.method === "POST"){ var b = JSON.parse(opt.body); __log.push("書く"); await __matsu(30); __srv = JSON.parse(JSON.stringify(b.orders)); return { json: async function(){ return { status:"ok" }; } }; }'
          + '  __log.push("読む"); var kopi = JSON.parse(JSON.stringify(__srv)); await __matsu(20); return { json: async function(){ return { status:"ok", data:{ orders: kopi } }; } }; };'
          + 'var orders = [{ id:"old", v:1 }];', Object.assign(_S.ctx, { setTimeout: setTimeout }));
      } catch (e) { _ug = false; console.log(e); }
      ok('⑱-101 本物の保存を身代わりのサーバーで動かせる', _ug);
      if (!_ug) return;
      const B = _S.box;
      const A = { id:'A', hakkou:null }, Bo = { id:'B', hakkou:null };
      B.orders.push(A, Bo);
      const p1 = B.syncOrdersToGAS([A, Bo]);          /* 登録したときの保存 */
      A.hakkou = { url:'a' }; const p2 = B.syncOrdersToGAS([A]);    /* 発行記録のあと（前の保存を待たずに呼ぶ） */
      Bo.hakkou = { url:'b' }; const p3 = B.syncOrdersToGAS([Bo]);
      await Promise.all([p1, p2, p3]);
      eq('⑱-101 読む・書くが1本ずつ交互（前の書き込みが終わってから次を読む）', B.__log.join(','), '読む,書く,読む,書く,読む,書く');
      const srv = {}; B.__srv.forEach(function(o){ srv[o.id] = o; });
      ok('⑱-101 サーバーに A も B も残り、どちらの印も古い写しで消されない', srv.A && srv.B && srv.old && srv.A.hakkou && srv.B.hakkou);
      ok('⑱-101 手元の一覧にも A と B が残る', B.orders.some(function(o){ return o.id === 'A'; }) && B.orders.some(function(o){ return o.id === 'B'; }));
      /* 手元にまだサーバーへ届いていない注文があっても、別の保存で一覧から落とさない */
      const C = { id:'C' }; B.orders.push(C);
      await B.syncOrdersToGAS([A]);
      ok('⑱-101 まだ保存していない手元の注文を、別の保存で一覧から落とさない', B.orders.some(function(o){ return o.id === 'C'; }));
    })();
  /* ── ① 登録する【前】の下見（もと㉒。同じ決めごとなのでここに入れました）── */
    /* ★2026-09-13 承認モック：バラバラのボタンをやめ、流れバーの中から開きます */
    const nm2 = H.cut(idx, 'nagareMaeRender');
    /* ★2026-09-24 通常発送は ⑱-80〜 の新しい画面（RTと同じ）。⑱-52〜59 は【取り置き・予約】の今までの流れを見ています。 */
    ok('⑱-51 確認画面に流れバーを出す', /id="nagare-mae"/.test(idx) && /nagareMaeRender\(\)/.test(idx));
    ok('⑱-52 （取り置き・予約の流れ）流れバーの①②から docMaeMiru が動く', /docMaeMiru\(/.test(nm2));
    ok('⑱-52b （取り置き・予約の流れ）見終わるまで③［受注一覧に登録する］は押せない',
       /st-lock', '③', '受注一覧に登録する/.test(nm2) && /registerOrder\(\)/.test(nm2));
    ok('⑱-53 （取り置き・予約の流れ）出す枠がある',             /id="doc-check-mae"/.test(idx));
    const mm = H.cut(idx, 'docMaeMiru');
    const ms = H.cut(idx, 'docMaeShow');
    ok('⑱-54 （取り置き・予約の流れ）登録前の注文から作る',     /window\._pendingOrders/.test(mm));
    ok('⑱-55 （取り置き・予約の流れ）書類の枚数ぶん並べる',     /OOS_NOUHIN\.shoruiList\(o\)/.test(mm));
    ok('⑱-56 （取り置き・予約の流れ）何枚目かを出す',           /枚目／全/.test(ms));
    /* ★2026-09-13 承認モック：ボタンは2つだけ。次の書類は「この内容でOK」で自動で開きます */
    ok('⑱-57 （取り置き・予約の流れ）ボタンは2つだけ（戻って直す／この内容でOK）',
       /◀ 戻って直す/.test(ms) && /この内容でOK ▶/.test(ms) && ms.indexOf('docMaeSusumu(') < 0);
    ok('⑱-58 （取り置き・予約の流れ）登録前なので貼らない',
       !/nouhinAttachToOrder/.test(mm) && !/nouhinAttachToOrder/.test(ms));
    ok('⑱-59 （取り置き・予約の流れ）まだ入っていないと書いてある', /まだ受注一覧にも発注書にも入っていません/.test(ms));

    /* ── RTの伝票取込だけ、書類の作り方がちがう ── */
    ok('⑱-61 RTかどうかを見分ける所がある', /function rtDenpyoOrderKa\s*\(/.test(idx));
    const rk = H.cut(idx, 'rtDenpyoOrderKa');
    /* ══════════════════════════════════════════════════════════════════
       ★2026-09-12 ここは【まちがった書き方を固定していた見張り】でした。
       ──────────────────────────────────────────────────────────────────
       前は「=== 'rt' || === 'rtgc' と書いてあること」を求めていました。
       ところが区分は【日本語】で保存されています（実データ："RT" 49件）。
       英語で直接くらべると、RTの注文でも いつも false になります。
       つまり、この見張りが穴のある書き方を守っていました。
       → 書き方を見るのをやめ、【実際に動かして見分けられるか】を見ます。
       ★文字さがしに戻さないでください。 */
    ok('⑱-62 伝票取込の印を見ている', /RT伝票取込/.test(rk));
    {
      const _S = H.makeSandbox({});
      let _ugoku = true;
      ['rtKubunKa', 'rtDenpyoOrderKa'].forEach(function (n) {
        try { vm.runInContext(H.cut(idx, n), _S.ctx); } catch (e) { _ugoku = false; }
      });
      ok('⑱-62 見分ける仕掛けを切り出して動かせる', _ugoku);
      if (_ugoku) {
        /* ★実データに入っている【日本語】の値で確かめます */
        ok('⑱-62 日本語の「RT」をRTと見分ける',
           _S.box.rtKubunKa('RT') === true);
        ok('⑱-62 日本語の「RTGC（ゴルフ）」もRTと見分ける',
           _S.box.rtKubunKa('RTGC（ゴルフ）') === true);
        ok('⑱-62 英語の rt / rtgc も見分ける（昔のデータ）',
           _S.box.rtKubunKa('rt') === true && _S.box.rtKubunKa('rtgc') === true);
        ok('⑱-62 「定価」をRTと取りちがえない',
           _S.box.rtKubunKa('定価') === false);
        /* ★伝票から作ったRTだけが、伝票の道へ行くこと */
        ok('⑱-62 RTで伝票から作った注文は、伝票の道へ',
           _S.box.rtDenpyoOrderKa({ customerType: 'RT', note: 'RT伝票取込 2026-09-12' }) === true);
        ok('⑱-62 RTでも伝票でない注文は、書類の親の道へ',
           _S.box.rtDenpyoOrderKa({ customerType: 'RT', note: 'aaaaa' }) === false);
        ok('⑱-62 一般の注文は、伝票の道へ行かない',
           _S.box.rtDenpyoOrderKa({ customerType: '定価', note: 'RT伝票取込' }) === false);
      }
    }
    /* ══════════════════════════════════════════════════════════════════
       ★2026-09-17 ひろみさん指示で、この2つを【反対に】書き直しました。
       　もとは「RTは rtDeliveryNoteHtml（古い写し）から作る」「親を使っていない」
       　という見張りでした。2026-09-10に「納品書は親に集約・写しを作らない」と
       　決めたのに、RTの写しだけ消し残っていたためです。

       　2026-09-17、本物のPDFを開いて分かったこと：
       　　・🖨️ で取り出すPDF … 親　　会社の住所＝南青山2-2-15 ✅
       　　・発注書に貼るPDF … 古い写し　会社の住所＝**立川市柴崎町** ❌
       　同じ注文なのに、倉庫に渡る納品書だけ住所がちがっていました。

       ひろみさん「古い写し（rtDeliveryNoteHtml）を捨てて、全部親の
       　　　　　　oos-nouhin.js に一本化します。そうしてください」
       ★消さずに、新しい決めごとに書き直しています（見張りは減らしません）。
       くわしい見張りは tests/test_rt_nouhin_ippon.js にあります。
       ══════════════════════════════════════════════════════════════════ */
    const rn = H.cut(idx, 'rtNouhinHtml');
    ok('⑱-63 RTの納品書も【親＝OOS_NOUHIN】から作る', /OOS_NOUHIN\.build\(/.test(rn));
    ok('⑱-64 RTで古い写し（rtDeliveryNoteHtml）を呼んでいない',
       !/rtDeliveryNoteHtml\(\)/.test(rn.replace(/\/\*[\s\S]*?\*\//g, '')));
    ok('⑱-65 登録前の確認でRTを見せ分けている',
       /rtDenpyoOrderKa\(o\)[\s\S]{0,80}rtNouhinHtml\(\)/.test(ms));
    ok('⑱-66 登録後の画面でもRTを見せ分けている',
       /rtDenpyoOrderKa\(o\)[\s\S]{0,80}rtNouhinHtml\(\)/.test(nx));
    ok('⑱-67 RTは rtAttachDocsToOrder で貼る', /rtAttachDocsToOrder\(o\)/.test(H.cut(idx, 'docHari')));
    ok('⑱-68 登録の瞬間にRTを自動で貼っていない', !/rtAttachDocsToOrder/.test(reg));
    const arf = H.cut(idx, 'applyRtToOrderForm');
    ok('⑱-69 RTも同じ受注フォームを使う（日付・状態・種別が同じに効く）',
       /addRecipient\(\)/.test(arf) && /recipient-card/.test(arf));
  })();

  /* ══════════════════════════════════════════════════════════════════
     ⑲⑳ 送料「別途申し受けます」／書類を2枚えらんだら2枚とも作る
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん：
     　「送料は別途申し受けます。も選べるようにして！見積の時に使う可能性大」
     　「納品書と請求書、2枚作った場合は2枚ともチェックできるように。
     　　作成した書類だけでいい」
     ★2枚えらんでも1枚しか作られていませんでした（2026-09-12に見つけた穴）。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    /* ── ⑲ 送料の「別途申し受けます」── */
    ok('⑲-1 送料のえらび一覧に「別途申し受けます」がある', /label:'別途申し受けます',\s*yen:'betto'/.test(idx));
    /* ★2026-09-12 実装の1行を文字で探すのをやめ、【動かして答えを見ます】。
       　決めごとの親（OOS_SHORUI.ryokinJotai）が betto を見分けること、
       　書類に「別途申し受けます」と出て、合計に入らないことを見ます。 */
    const nb = H.read('oos-nouhin.js');
    (function(){
      var _K = H.makeSandbox({}).box.OOS_SHORUI;
      ok('⑲-2 親が「別途」を見分ける', _K && _K.ryokinJotai('betto').jotai === 'betto');
      ok('⑲-2 「別途」を数にしない（NaNにならない）', _K && _K.ryokinJotai('betto').yen === 0);
      ok('⑲-3 親の言葉が「別途申し受けます」', _K && _K.ryokinKotoba('betto') === '別途申し受けます');
    })();
    /* ★2026-09-12 文字さがしをやめ、実物を動かして枠の中身を見ます。
       　文字さがしだと、書き方を少し変えただけで落ち、中身が正しいかは分かりません。 */
    ok('⑲-4 別途をえらんだら枠に「別途申し受けます」と出る',
       doc({ warehouseFee:0, shippingFee:'betto' }).indexOf('別途申し受けます') >= 0);
    ok('⑲-5 別途をえらんだら送料の金額は足さない',
       doc({ warehouseFee:0, shippingFee:'betto' }).indexOf('¥800') < 0);
    ok('⑲-5 備考の一言も必ず出す',           /_shipBetto \|\| \(_shipIncl <= 0/.test(nb));
    function doc2(fee){
      dbox.__o = testOrder({ warehouseFee:0, shippingFee:fee });
      return String(vm.runInContext('OOS_NOUHIN.build(__o, __d)', dctx));
    }
    const hB = doc2('betto');
    ok('⑲-6 別途をえらぶと 枠に「別途申し受けます」', hB.indexOf('別途申し受けます') >= 0);
    ok('⑲-7 別途をえらぶと 備考の一言も出る', hB.indexOf('上記の金額に送料は含まれておりません') >= 0);
    ok('⑲-8 別途は 送料の金額を出さない',     hB.indexOf('¥800') < 0);
    const h0 = doc2(0);
    ok('⑲-9 無料をえらんだら「無料サービス」',  h0.indexOf('無料サービス') >= 0);
    ok('⑲-10 無料のときに「別途」と書かない',   h0.indexOf('別途申し受けます') < 0);

    /* ── ⑳ 2枚とも作る ── */
    const NOU = vm.runInContext('OOS_NOUHIN', dctx);
    eq('⑳-1 「納品書」なら1枚',            NOU.shoruiList({enclosedDoc:'納品書'}).join('／'), '納品書');
    eq('⑳-2 「納品書 ＋ 請求書」なら2枚',   NOU.shoruiList({enclosedDoc:'納品書 ＋ 請求書'}).join('／'), '納品書／請求書');
    eq('⑳-3 「納品書兼請求書 ＋ 領収書」なら2枚',
       NOU.shoruiList({enclosedDoc:'納品書兼請求書 ＋ 領収書'}).join('／'), '納品書兼請求書／領収書');
    eq('⑳-4 パンフレットは数えない',        NOU.shoruiList({enclosedDoc:'請求書 ＋ パンフレット'}).join('／'), '請求書');
    eq('⑳-5 「パンフレット」だけなら0枚',   NOU.shoruiList({enclosedDoc:'パンフレット'}).length, 0);
    eq('⑳-6 「なし」なら0枚',              NOU.shoruiList({enclosedDoc:'なし'}).length, 0);
    eq('⑳-7 空なら既定の1枚',              NOU.shoruiList({enclosedDoc:''}).join('／'), '納品書兼請求書');
    dbox.__o = testOrder({ enclosedDoc:'納品書 ＋ 請求書' });
    dbox.__m1 = '納品書'; dbox.__m2 = '請求書';
    const d1 = String(vm.runInContext('OOS_NOUHIN.build(__o, __d, __m1)', dctx));
    const d2 = String(vm.runInContext('OOS_NOUHIN.build(__o, __d, __m2)', dctx));
    ok('⑳-8 1枚目に「納品書」が出る', d1.indexOf('納品書') >= 0);
    ok('⑳-9 2枚目に「請求書」が出る', d2.indexOf('請求書') >= 0);
    ok('⑳-10 2枚は中身がちがう',      d1 !== d2);
    ok('⑳-11 どちらにも金額が出る',   d1.indexOf('¥') >= 0 && d2.indexOf('¥') >= 0);
    ok('⑳-12 待ち行列は「注文＋書類名」', /docCheckQueue\.push\(\{ o:o, mei:mei \}\)/.test(idx));
    /* ★2026-09-12（夜）貼れたかどうかの【親】は 発注書のV列になりました。
       　アプリは写しを持ちません（写しが消えたのが、この日の事故です）。 */
    ok('⑳-13 アプリは書類の写しを持たない', idx.indexOf('o.nouhinDocs[') < 0);
    ok('⑳-14 ファイル名に書類の名前を入れる', /who \+ '_' \+ num \+ '_' \+ mei \+ '\.pdf'/.test(idx));
    ok('⑳-15 その書類が貼ってあるかは【発注書】で見る', /if\(docHareteruKa\(o, _mei\)\) return;/.test(idx));

    /* ══════════════════════════════════════════════════════════════════
       ㉑ 書類のPDFリンクは【V列だけ】（最大2種類）
       ──────────────────────────────────────────────────────────────────
       ★2026-09-12（夜）ひろみさん確定
       　「V列に2つまでPDF貼れる？ Wはパンフレットの指示にしたほうがいいかな」
       　「PDFは最大2種類まで、でいいと思う」

       前：1枚目をV列、2枚目をW列に入れていた。
       　　W列は「同梱書類 他あれば」で、パンフレット等の指示が入る列。
       　　2枚目を貼ると、その指示が消えていた。

       ★ここは前、実装の書き方を文字で求める見張りが【11項目】ありました。
       　書き方を少し変えるだけで落ちるうえ、決めごとが変わると全部が古くなります。
       　→ 本物の GAS の関数を動かして、決めごとそのものを1項目で確かめます。
       ★項目を増やさないでください。ここ1つで足ります。
       ══════════════════════════════════════════════════════════════════ */
    if(gasSrc){
      var mase = [];                       /* ニセのスプレッドシートの1マス */
      var richNow = null;
      function mkRich(text, links){ return {
        getText(){ return text; },
        getRuns(){ return links.map(function(x){ return { getText(){ return x.t; }, getLinkUrl(){ return x.u; } }; }); },
        getLinkUrl(){ return links.length === 1 ? links[0].u : null; } }; }
      var rng = {
        getRichTextValue(){ return richNow; },
        setRichTextValue(v){ richNow = v; mase.push('rich'); return this; },
        setValue(v){ richNow = mkRich(String(v), []); mase.push('plain'); return this; },
        getDisplayValue(){ return richNow ? richNow.getText() : ''; }
      };
      var sawatta = [];
      var shBako = { getRange(r, c){ sawatta.push(c); return rng; } };
      var bldLinks = [];
      var G = H.makeSandbox({});
      G.box.SpreadsheetApp = {
        newRichTextValue(){
          var t = '', ls = [];
          var b = { setText(x){ t = String(x); return b; },
                    setLinkUrl(a, z, u){ ls.push({ t: t.slice(a, z), u: u }); return b; },
                    build(){ bldLinks = ls.slice(); return mkRich(t, ls); } };
          return b;
        }
      };
      G.box.OOS_YC = { doc1: 22, doc2: 23 };
      G.box.oosYukaFile_ = function(){ return { getSheetByName(){ return shBako; } }; };
      G.box.OOS_YUKA_SHEET = '発注書';
      G.box.oosKeyColByHeader_ = function(){ return 33; };
      G.box.oosFindRowByKey_ = function(){ return 7; };
      vm.runInContext(H.cut(gasSrc, 'oosYukaSetDocLinks'), G.ctx);

      /* 1枚目を貼る → 2枚目を貼る → もう一度1枚目を貼る（二重にならないか） */
      G.box.__p = { key:'K1', docs:[{ name:'📄 納品書（ひらく）', url:'https://x/1' }] };
      vm.runInContext('oosYukaSetDocLinks(__p)', G.ctx);
      G.box.__p = { key:'K1', docs:[{ name:'📄 請求書（ひらく）', url:'https://x/2' }] };
      vm.runInContext('oosYukaSetDocLinks(__p)', G.ctx);
      var nikai = bldLinks.slice();
      G.box.__p = { key:'K1', docs:[{ name:'📄 納品書（ひらく）', url:'https://x/1' }] };
      vm.runInContext('oosYukaSetDocLinks(__p)', G.ctx);
      var sankai = bldLinks.slice();
      /* 3種類目は入らない（最大2種類） */
      G.box.__p = { key:'K1', docs:[{ name:'📄 領収書（ひらく）', url:'https://x/3' }] };
      vm.runInContext('oosYukaSetDocLinks(__p)', G.ctx);
      var yonkai = bldLinks.slice();

      ok('㉑ 書類のリンクはV列だけに2種類まで入り、二重にならず、W列は触らない' +
         '　（V列に入った数：' + yonkai.length + '／触った列：' + [...new Set(sawatta)].join('・') + '）',
         nikai.length === 2 &&
         sankai.length === 2 &&
         yonkai.length === 2 &&
         yonkai[0].u === 'https://x/1' && yonkai[1].u === 'https://x/2' &&
         sawatta.indexOf(23) < 0);
    }

  })();

  /* ── ⑦ 封（この表が書き換わっていないか） ───────────────
     ★2026-09-16 封を押し直しました。
     　理由：ひろみさん指示「倉庫ピッキング手数料にして」で、ゆくえ表の言葉を
     　　　　「倉庫ピックアップ料金」→「倉庫ピッキング手数料」に変えたためです。
     　確かめたこと：**行数も文字数も変わっていません**（53行・5877文字のまま）。
     　　　　　　　　＝ 同じ長さの言葉に置き換えただけで、項目は1つも増減していません。
     ★封が合わないときは、勝手に押し直さないでください。
     　まず「行数・文字数が変わっていないか」を見て、理由をここに書き残してから押し直します。 */
  const fuuPath = path.join(__dirname, 'data', 'ゆくえ表の封.json');
  const ima = IK.fuu();
  if(!fs.existsSync(fuuPath)){
    fs.writeFileSync(fuuPath, JSON.stringify(ima, null, 2), 'utf8');
    console.log('（封をはじめて作りました：' + JSON.stringify(ima) + '）');
    pass++;
  } else {
    const hikae = JSON.parse(fs.readFileSync(fuuPath, 'utf8'));
    eq('⑦-1 ゆくえ表の行数が控えと同じ', ima.kazu, hikae.kazu);
    /* ★2026-09-16 ひろみさん「また起きるんじゃないの？」
       　封（fuu）だけだと、私が押し直せば何でも通ってしまいます。
       　**文字数も控えと見くらべます。** 言葉の入れ替えなら文字数は変わりません。
       　項目が増えた・減った・中身が変わったときは、ここで必ず落ちます。
       ★この行を消さないでください。封の押し直しを見張る、いちばん大事な1行です。 */
    eq('⑦-1b ゆくえ表の文字数が控えと同じ', ima.moji, hikae.moji);
    eq('⑦-2 ゆくえ表の封が控えと同じ（中身が書き換わっていない）', ima.fuu, hikae.fuu);
    /* ★封を押し直したときは、いつ・なぜ押したかを控えに残します（oshinaoshi）。
       　残っていない押し直しは、あとから理由が分からなくなります。 */
    ok('⑦-3 封を押し直した記録が残っている',
       !hikae.oshinaoshi || Array.isArray(hikae.oshinaoshi),
       '（押し直したら oshinaoshi に「日付と理由」を足してください）');
  }

  /* ── しめ ───────────────────────────────────────── */
  console.log('');
  console.log('===== 🧭 項目のゆくえ（①発注書 ②書類 ③倉庫Ｄ／2026-09-12）=====');
  console.log('PASS ' + pass + ' / FAIL ' + fail);
  if(fails.length){
    console.log('');
    console.log('落ちたところ：');
    fails.forEach(function(f){ console.log('  ✗ ' + f); });
  }
  if(fail) process.exitCode = 1;
})();
