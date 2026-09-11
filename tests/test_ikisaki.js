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
  ['findProduct','findProductBySku','unitOfProduct','lineTotal','lineUnit','pkgDocsIn','pkgOf','pkgOneLine','yukaImportOne']
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
    ['商品','1箱入り数','単価','1商品ごとの','扱い種別','バラ','箱','合計本数','金額','状態'].forEach(function(w){
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
    const jun = ['商品','1箱入り数','単価','1商品ごとの','扱い種別','バラ','箱','合計本数','金額','状態'];
    eq('⑪-5 入力の見出しの並びが書類と同じ順', kotoba.join('／'), jun.join('／'));

    /* 読むだけの4つ（入力欄ではなく div） */
    const gyou = H.cut(idx, 'addRecipientLine');
    ['hakoIri','tanka','goukei','kingaku'].forEach(function(r){
      ok('⑪-6 ' + r + ' は読むだけ（div）', new RegExp('<div class="ol-[^"]*" data-role="' + r + '"').test(gyou));
    });
    ok('⑪-7 メモの入力欄（text）は出していない', !/type="text"[^>]*data-role="memo"/.test(gyou));
    ok('⑪-8 古い注文のメモを消さないように、見えない入れものは残している',
       /type="hidden" data-role="memo"/.test(gyou));

    /* 単価は親を呼ぶだけ（写しを作っていないか） */
    const yomi = H.cut(idx, 'refreshLineYomi');
    ok('⑪-9 単価は親（OOS_KAKAKU）を呼んでいる', /OOS_KAKAKU\.unitPriceForLine/.test(yomi));
    ok('⑪-10 単価の判定を画面に書き写していない',
       !/priceWholesale1|priceGeneral|priceRT/.test(yomi));
    ok('⑪-11 単位は親を通して取っている（lineUnit）', /lineUnit\s*\(/.test(yomi));
    /* ★「未登録」という文字があるかだけでは弱すぎます（お知らせ文にも出てくるため。
       　2026-09-12 の破壊テストで分かりました）。単価の欄に入れているかを見ます。 */
    ok('⑪-12 単価が無いときは、単価の欄に「未登録」と入れる',
       /tk\.textContent\s*=\s*'未登録'/.test(yomi));
    ok('⑪-12b そのとき赤い見た目にする', /tk\.className\s*=\s*'ol-tanka mi'/.test(yomi));
    ok('⑪-12c そのとき ¥0 と出していない', !/tk\.textContent\s*=\s*'¥0'/.test(yomi));
    ok('⑪-13 金額の欄に「出せません」と入れる',
       /kg\.textContent\s*=\s*'出せません'/.test(yomi));
    ok('⑪-14 区分を変えたら書き直す', /refreshLineYomi/.test(H.cut(idx, 'onCtypeChange')));
    ok('⑪-15 種別を変えたら書き直す', /updateCardGiftSummary/.test(H.cut(idx, 'onRecipientLineGiftChange')));
    ok('⑪-16 数や箱を入れたら書き直す', /refreshLineYomi\s*\(\s*cardId\s*\)/.test(H.cut(idx, 'updateCardGiftSummary')));

    /* 列の数（CSS）が10列になっているか */
    const css = (idx.match(/\.order-line\{display:grid;grid-template-columns:([^;]+);/) || [])[1] || '';
    eq('⑪-17 入力行は10列', css.trim().split(/\s+/).length, 10);
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

    /* ── 状態：3つか ── */
    const cond = H.cut(idx, 'conditionOptionsHtml');
    ok('⑬-15 状態は「正規」',   /'正規'/.test(cond));
    ok('⑬-16 状態は「旧ロット」', /旧ロット（残/.test(cond));
    ok('⑬-17 状態は「不良品」',  /不良品（残/.test(cond));
    ok('⑬-18 程度（DEFECT_LEVELS）で分けていない', !/DEFECT_LEVELS/.test(cond));
    ok('⑬-19 現ロット／旧ロットで不良を分けていない', !/'cur','現ロット'/.test(cond));
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
    const yomi = H.cut(idx, 'refreshLineYomi');
    ok('⑮-1 価格マスタが届いていないかを見ている', /priceMaster\s*&&\s*priceMaster\.length/.test(yomi));
    ok('⑮-2 そのときは「読込中…」と出す', /読込中…/.test(yomi));
    ok('⑮-3 そのときに「未登録」と出していない',
       /読込中…[\s\S]{0,200}?\}\s*else if\s*\(muryou\)/.test(yomi));
    /* 届いたあとに計算し直しているか（2か所：まとめ読みのあと・名簿が届いたあと） */
    ok('⑮-4 データが届いたら入力行を計算し直す（まとめ読み）',
       /refreshLineYomi\(c\.id\)/.test(H.cut(idx, 'loadInitialData')));
    ok('⑮-5 名簿が届いたら入力行を計算し直す',
       /refreshLineYomi\(c\.id\)/.test(H.cut(idx, 'applyLoadedProducts')));

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
