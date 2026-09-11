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
  ['findProduct','findProductBySku','unitOfProduct','lineTotal','lineUnit','pdfNiSuruKa','pkgDocsIn','pkgOf','pkgOneLine','yukaImportOne']
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
  ['OOS_YUKA_SHEET','OOS_YC','OOS_YUKA_BTN_STOP','OOS_YUKA_BTN_GO'].forEach(function(n){ code += H.cutVar(gasSrc, n) + '\n'; });
  ['oosLastDataRow_','oosYukaImportOrder'].forEach(function(n){ code += H.cut(gasSrc, n) + '\n'; });
  vm.runInContext(code, ctx);
  const res = box.oosYukaImportOrder(payload);
  return { res: res, gyou: yuka.rows[0] || [] };
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

  /* 必ず枠が出ると書いたもの（倉庫ピックアップ料金・送料） */
  IK.kanarazuWaku().forEach(function(r){
    ok('③-1 書類に「' + r.na + '」の枠が必ず出る', String(html).indexOf(r.na) >= 0
       || (r.na === '倉庫ピックアップ料金' && String(html).indexOf('倉庫ピックアップ料金') >= 0));
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

  /* Ｃ　まだ決まっていない注文（2026-09-12より前の注文） */
  const hOld = doc({ warehouseFee:undefined, shippingFee:undefined });
  ok('④-16 決まっていない注文は、決めごとの250円で出る', hOld.indexOf('¥250') >= 0);
  ok('④-17 決まっていない注文は、決めごとの800円で出る', hOld.indexOf('¥800') >= 0);

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
    eq('⑨-1 250ml バラ3 → 「3本」',        qtys[0], '3本');
    eq('⑨-2 750ml バラ2 → 「2缶」',        qtys[1], '2缶');
    eq('⑨-3 3L バラ1 → 「1個」',           qtys[2], '1個');
    eq('⑨-4 250ml 箱1（6本入り）→ 「6本（1箱）」', qtys[3], '6本（1箱）');
    qtys.forEach(function(q, i){
      ok('⑨-5 ' + (i+1) + 'つ目に単位が入っている（' + q + '）', /[本缶個箱枚セット]/.test(q));
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
    const jun = ['商品','1箱入り数','1商品ごとの','扱い種別','バラ','箱','合計本数','状態'];
    eq('⑪-5 入力の見出しの並びが書類と同じ順', kotoba.join('／'), jun.join('／'));

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
       　単価が未登録のときは、書類（PDF）を見るときに出ます（⑱-8／㉒-11）。 */
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
    ok('⑬-3 「通常（3日以内に発送）」がある', lh.indexOf('通常（3日以内に発送）') >= 0);
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
    ok('⑬-25 日時指定で日付が空のときだけは止める',
       /_r\.lead==='scheduled' && !_r\.leadDate/.test(bof));

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
    ok('⑭-24 在庫の親が程度で振り分けていない', !/if\(d\.level==='lv1'\)\s+t\.defLight/.test(zsrc));
    ok('⑭-25 貼り直し・廃棄は不良に数えない判定が残っている',
       /d\.level==='relabel' \|\| d\.level==='discard'/.test(zsrc));
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
    ok('⑰-7 「請求書」に倉庫ピックアップ料金の枠が出る', hSei.indexOf('倉庫ピックアップ料金') >= 0);
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
     ⑱ 書類は【見てから貼る】／貼れていないとカードに出る
     ──────────────────────────────────────────────────────────────────
     ★2026-09-12 ひろみさん：
     　「自動でスプシに貼られる前に、アプリ上でチェックしたい。
     　　じゃないと、データーを何度もキャンセルすることも起きる」
     　「届いていなくても気が付けない」
     ★自動で貼る形に戻さないでください。
     ══════════════════════════════════════════════════════════════════ */
  (function(){
    /* 登録したときに、その場では貼らない */
    const reg = H.cut(idx, 'registerOrder').replace(/\/\*[\s\S]*?\*\//g, '');
    ok('⑱-1 登録のときに自動で貼っていない', !/nouhinAttachToOrder\s*\(/.test(reg));
    ok('⑱-2 登録のあとに書類を画面に出す',   /docCheckStart\s*\(/.test(reg));

    /* 見てから貼る画面がある */
    ok('⑱-3 書類を出す枠が画面にある', /id="doc-check"/.test(idx));
    ok('⑱-4 出す関数がある',           /function docCheckNext\s*\(/.test(idx));
    const nx = H.cut(idx, 'docCheckNext');
    ok('⑱-5 本物の書類を、その書類名で組み立てて見せている',
       /OOS_NOUHIN\.build\(o, nouhinDeps\(\), _mei\)/.test(nx));
    ok('⑱-6 ［この内容で発注書に貼る］がある', /この内容で発注書に貼る/.test(nx));
    ok('⑱-7 ［直す（貼らない）］がある',       /直す（貼らない）/.test(nx));
    ok('⑱-8 単価が未登録なら、そう出して貼らせない', /単価が登録されていない商品があるので/.test(nx));
    ok('⑱-9 押したときだけ、その書類名で貼る',
       /nouhinAttachToOrder\(q\.o, q\.mei\)/.test(H.cut(idx, 'docCheckOk')));
    ok('⑱-10 「直す」では貼らない', !/nouhinAttachToOrder/.test(H.cut(idx, 'docCheckSkip')));

    /* どの注文を出すか（バサラとRT伝票取込は出さない） */
    const ts = H.cut(idx, 'docCheckTaisho');
    ok('⑱-11 バサラは出さない',            /source === 'basara'/.test(ts));
    ok('⑱-12 RTの伝票取込は出さない',      /RT伝票取込/.test(ts));
    ok('⑱-13 もう貼ってあるものは出さない', /o\.nouhinDocUrl/.test(ts));
    ok('⑱-14 金額の載らない書類は出さない', /needsNouhin/.test(ts));

    /* カードの札 */
    const fd = H.cut(idx, 'docFudaHtml');
    ok('⑱-15 貼れていたら「貼れています」と出す',       /貼れています/.test(fd));
    ok('⑱-16 貼れていなければ「まだ貼れていません」',   /まだ貼れていません/.test(fd));
    /* ★2026-09-12 ひろみさんの文言：「PDFをスプシに貼る前に確認する」というボタン */
    ok('⑱-17 そのとき［PDFをスプシに貼る前に確認する］を出す',
       /PDFをスプシに貼る前に確認する/.test(fd));
    /* ★2枚えらんだら2枚とも札が出るか（1枚ぶんに戻さないための見張り） */
    ok('⑱-17b 札は書類の枚数ぶん出す', /OOS_NOUHIN\.shoruiList\(o\)/.test(fd) && /meis\.forEach/.test(fd));
    ok('⑱-18 書類が無い注文は「書類はありません」',     /金額の載る書類はありません/.test(fd));
    ok('⑱-19 貼れていたら「ひらく」が押せる',           /ひらく<\/a>/.test(fd));
    ok('⑱-20 理由も出す',                               /o\.nouhinDocNg/.test(fd));
    ok('⑱-21 カードに札を出している', /docFudaHtml\(o, _torikeshi\)/.test(H.cut(idx, 'renrakuBox')));

    /* 貼れなかった理由を注文に残している（1秒で消える字だけにしない） */
    const at = H.cut(idx, 'nouhinAttachToOrder');
    /* ★空にする1か所（貼れたとき）は数えません。理由を入れている所だけ数えます */
    eq('⑱-22 貼れなかった理由を3か所で残している',
       (at.match(/o\.nouhinDocNg\s*=\s*'[^']/g) || []).length
       + (at.match(/o\.nouhinDocNg\s*=\s*String/g) || []).length, 3);
    ok('⑱-23 貼れたら理由を消す', /o\.nouhinDocNg\s*=\s*''/.test(at));
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
    ok('⑲-2 数字に直そうとしていない（NaN防止）', /r\.soryoYen === 'betto' \? 'betto'/.test(idx));
    const nb = H.read('oos-nouhin.js');
    ok('⑲-3 書類の親が「別途」を見ている', /_shipBetto = \(String\(o\.shippingFee\) === 'betto'\)/.test(nb));
    ok('⑲-4 枠に「別途申し受けます」と出す', /_shipBetto \? '別途申し受けます'/.test(nb));
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
    ok('⑳-13 貼れた書類を1枚ずつ控える', /o\.nouhinDocs\[_mei\] = \{ url: d\.url/.test(idx));
    ok('⑳-14 ファイル名に書類の名前を入れる', /who \+ '_' \+ num \+ '_' \+ mei \+ '\.pdf'/.test(idx));
    ok('⑳-15 その書類が貼ってあるかを見る', /if\(o\.nouhinDocs\[_mei\]\) return;/.test(idx));

    /* ── ㉑ 発注書スプシの【2つの列】を使い分ける ──
       ★2026-09-12 ひろみさん：「よく見ろ！2つ書類を乗せるところはある」
       　V列（doc1）＝同梱書類 納品書 ／ W列（doc2）＝同梱書類 他あれば
       ★2枚ともV列に貼る形に戻さないでください（あとの1枚で上書きされます）。 */
    const at2 = H.cut(idx, 'nouhinAttachToOrder');
    ok('㉑-1 もう貼ってある枚数を見ている', /_sumi = Object\.keys\(o\.nouhinDocs \|\| \{\}\)\.length/.test(at2));
    ok('㉑-2 0枚目はV列、1枚目はW列',       /_nimaime = \(_sumi === 1\)/.test(at2));
    ok('㉑-3 V列へ貼る式がある',             /nouhinUrl: _nimaime \? '' : d\.url/.test(at2));
    ok('㉑-4 W列へ貼る式がある',             /hokaUrl:\s*_nimaime \? d\.url : ''/.test(at2));
    ok('㉑-5 hokaUrl を空で固定していない',  !/hokaUrl: '', hokaName: ''/.test(at2));
    ok('㉑-6 3枚目はスプシに貼らない（W列を上書きしない）', /if\(_sumi >= 2\)\{/.test(at2));
    /* 画面にも、どちらの列に入るか出しているか */
    /* ★コメントを先に落とします。落とさないと、決めごとを書いたコメント自身に当たります */
    const nx2 = H.cut(idx, 'docCheckNext').replace(/\/\*[\s\S]*?\*\//g, '');
    ok('㉑-7 押す前に「V列」と出す', /hairu = \(_sumiKazu === 0\) \? 'V列/.test(nx2));
    ok('㉑-8 押す前に「W列」と出す', /'W列「同梱書類 他あれば」'/.test(nx2));
    ok('㉑-8b 画面にその案内を出している', /発注書スプシの<\/b>' \+ esc\(hairu\)/.test(nx2) || /esc\(hairu\)/.test(nx2));
    /* GAS側が2列とも書けること（読むだけ） */
    if(gasSrc){
      const sl = H.cut(gasSrc, 'oosYukaSetDocLinks');
      ok('㉑-9 GASはV列に書ける',  /put\(OOS_YC\.doc1/.test(sl));
      ok('㉑-10 GASはW列に書ける', /put\(OOS_YC\.doc2/.test(sl));
      ok('㉑-11 空のURLなら そのマスを触らない', /if\(!String\(url\|\|''\)\.trim\(\)\) return '';/.test(sl));
    }

    /* ══════════════════════════════════════════════════════════════
       ㉒ 登録する【前】に、確認画面で書類を見られる
       ──────────────────────────────────────────────────────────────
       ★2026-09-12 ひろみさん：「どこでPDF開いてチェックできるの？？？？？」
       　それまでは【登録したあと】にしか出ませんでした。
       ★このボタンを消さないでください。
       ══════════════════════════════════════════════════════════════ */
    ok('㉒-1 確認画面に［書類（PDF）を見て確かめる］がある',
       /書類（PDF）を見て確かめる/.test(idx));
    ok('㉒-2 押すと docMaeMiru が動く', /onclick="docMaeMiru\(\)"/.test(idx));
    ok('㉒-3 出す枠がある',             /id="doc-check-mae"/.test(idx));
    const mm = H.cut(idx, 'docMaeMiru');
    ok('㉒-4 登録前の注文から作る',     /window\._pendingOrders/.test(mm));
    ok('㉒-5 書類の枚数ぶん並べる',     /OOS_NOUHIN\.shoruiList\(o\)/.test(mm));
    ok('㉒-6 書類が無いときはそう言う', /金額の載る書類はありません/.test(mm));
    const ms = H.cut(idx, 'docMaeShow');
    ok('㉒-7 その書類名で組み立てる',   /OOS_NOUHIN\.build\(o, nouhinDeps\(\), mei\)/.test(ms));
    ok('㉒-8 何枚目かを出す',           /枚目／全/.test(ms));
    ok('㉒-9 次の書類へ進める',         /次の書類/.test(ms));
    ok('㉒-10 前の書類へ戻れる',        /前の書類/.test(ms));
    ok('㉒-11 単価が無ければ そう言う', /単価が登録されていない商品があるので/.test(ms));
    /* ★ここでは【貼りません】（まだ登録していないため） */
    ok('㉒-12 登録前なので貼らない',
       !/nouhinAttachToOrder/.test(mm) && !/nouhinAttachToOrder/.test(ms));
    ok('㉒-13 まだ入っていないと書いてある', /まだ受注一覧にも発注書にも入っていません/.test(ms));
  })();

  /* ── ⑦ 封（この表が書き換わっていないか） ─────────────── */
  const fuuPath = path.join(__dirname, 'data', 'ゆくえ表の封.json');
  const ima = IK.fuu();
  if(!fs.existsSync(fuuPath)){
    fs.writeFileSync(fuuPath, JSON.stringify(ima, null, 2), 'utf8');
    console.log('（封をはじめて作りました：' + JSON.stringify(ima) + '）');
    pass++;
  } else {
    const hikae = JSON.parse(fs.readFileSync(fuuPath, 'utf8'));
    eq('⑦-1 ゆくえ表の行数が控えと同じ', ima.kazu, hikae.kazu);
    eq('⑦-2 ゆくえ表の封が控えと同じ（中身が書き換わっていない）', ima.fuu, hikae.fuu);
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
