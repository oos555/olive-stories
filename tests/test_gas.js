/* GAS だけは oos-zaiko.js を読めないので、同じ計算のコピーが1つ残っている。
   その GAS の本物の関数（basaraComputeStock_）に、oos-zaiko.js と同じデータを与えて
   同じ販売可能数が出るかを突き合わせる。GASには一切書き込まない（読むだけ）。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

/* GASのファイルは【公開リポジトリに置きません】（パスワードとLINEのIDが入っているため）。
   手元の作業フォルダにあれば読み、無ければこのテストは飛ばします。
   置き場所：%USERPROFILE%\OneDrive\ドキュメント\olive-stories-gas\コード.js（clasp pull で作られます） */
function readGasSource(){
  const os = require('os');
  const cands = [
    path.join(__dirname, 'gas', 'コード.js'),
    path.join(os.homedir(), 'OneDrive', 'ドキュメント', 'olive-stories-gas', 'コード.js')
  ];
  for(const c of cands){ if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); }
  console.log('（GASのファイルが手元にないので、このテストは飛ばしました）');
  console.log('　clasp pull で olive-stories-gas に取ってくると走ります。');
  process.exit(0);
}
const gasSrc = readGasSource();

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(got === want) pass++;
  else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

/* ── 両方に同じデータを渡す ─────────────────────────── */
const PRODUCTS = [
  { id:1, sku:'ORG100', name:'オルガニック100ml', boxQty:12 },
  { id:2, sku:'ORG250', name:'オルガニック250ml', boxQty:12 },
  { id:9, sku:'SET-A',  name:'ギフトセットA', isSet:true, components:[{sku:'ORG100',qty:2},{sku:'ORG250',qty:1}] }
];
const LOTS = [
  { pid:1, stock:45, status:'new' },
  { pid:1, stock:38, status:'old' },
  { pid:1, stock:1,  status:'hold_old' },
  { pid:1, stock:3,  status:'discard' },
  { pid:1, stock:9,  status:'incoming' },
  { pid:1, stock:2,  status:'hold' },
  { pid:2, stock:20, status:'new' },
  { pid:2, stock:4,  status:'discard_old' }
];
const DEFECTS = [
  { pid:1, level:'lv1', qty:2, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'cur' },
  { pid:1, level:'lv3', qty:3, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'old' },
  { pid:1, level:'lv2', qty:4, shippedQty:0, status:'open', source:'warehouse', reviewed:false, lotKind:'cur' },
  { pid:2, level:'lv1', qty:1, shippedQty:0, status:'resolved', source:'staff', reviewed:true, lotKind:'cur' }
];
const HELD_ORDERS = [
  { lines: [{ productId:1, bottles:10, boxes:0 }] },
  { lines: [{ productId:9, bottles:2,  boxes:0 }] }   // セット2個 → ORG100を4本・ORG250を2本おさえる
];

/* ── ①【親】oos-zaiko.js の答え ─────────────────────── */
const Z = H.makeSandbox({});
H.runZaiko(Z.ctx);
const holdsForZaiko = (function(){
  const m = {};
  HELD_ORDERS.forEach(function(o){
    o.lines.forEach(function(l){
      const p = PRODUCTS.find(x => x.id === l.productId);
      const qty = (l.bottles||0) + (l.boxes||0)*(l.boxQty||p.boxQty||1);
      if(p.isSet){ p.components.forEach(function(c){ const cp = PRODUCTS.find(x=>x.sku===c.sku); m[cp.id] = (m[cp.id]||0) + qty*(c.qty||1); }); }
      else { m[p.id] = (m[p.id]||0) + qty; }
    });
  });
  return Object.keys(m).map(k => ({ pid: parseInt(k), qty: m[k] }));
})();
const zData = { lots: LOTS, defects: DEFECTS, holds: holdsForZaiko };
const oya = {};
['ORG100','ORG250','SET-A'].forEach(s => { oya[s] = Z.box.OOS_ZAIKO.availableForSku(s, zData, PRODUCTS); });

/* ── ②【GAS】本物の basaraComputeStock_ を、シートの身代わりで動かす ── */
const sheetStub = {
  getSheetByName(name){
    if(name !== '受注データ') return null;
    return {
      getLastRow(){ return HELD_ORDERS.length + 1; },
      getRange(){ return { getValues(){
        return HELD_ORDERS.map(function(o){
          const r = new Array(20).fill('');
          r[0] = 'id'; r[11] = 'held'; r[19] = JSON.stringify({ lines: o.lines });
          return r;
        });
      } }; }
    };
  }
};
const G = H.makeSandbox({
  SpreadsheetApp: { openById(){ return sheetStub; } },
  SHEET_ID_MAIN: 'x',
  loadProducts(){ return { products: PRODUCTS }; },
  readSheetGlobal(ss, name){
    if(name === '在庫データ')     return LOTS.map(l => ({ pid:l.pid, stock:l.stock, status:l.status }));
    if(name === '不良在庫データ') return DEFECTS.map(d => Object.assign({}, d));
    return [];
  },
  Logger: { log(){} }
});
vm.runInContext(H.cut(gasSrc, 'basaraComputeStock_'), G.ctx);
const calc = G.box.basaraComputeStock_();

['ORG100','ORG250','SET-A'].forEach(function(s){
  eq(`GAS と oos-zaiko.js の販売可能数が一致（${s}）`, calc.available(s), oya[s]);
});
eq('参考：ORG100 の販売可能数', oya['ORG100'], 45 - (10 + 4));
eq('参考：ORG250 の販売可能数', oya['ORG250'], 20 - 2);
eq('参考：SET-A の販売可能数（中身の少ないほう）', oya['SET-A'], Math.min(Math.floor((45-14)/2), 20-2));

/* 取り置きを増やしたら両方とも同じだけ減るか */
HELD_ORDERS[0].lines[0].bottles = 30;
const holds2 = holdsForZaiko.map(h => h.pid === 1 ? { pid:1, qty: h.qty + 20 } : h);
const oya2 = Z.box.OOS_ZAIKO.availableForSku('ORG100', { lots: LOTS, defects: DEFECTS, holds: holds2 }, PRODUCTS);
const calc2 = G.box.basaraComputeStock_();
eq('取り置きを増やしても GAS と親が一致', calc2.available('ORG100'), oya2);
eq('参考：ORG100 は 45−34 = 11', oya2, 11);

/* 取り置きが在庫より多いとき、両方とも 0 で止まるか（マイナスにしない） */
HELD_ORDERS[0].lines[0].bottles = 999;
const holds3 = [{ pid:1, qty:1003 }, { pid:2, qty:2 }];
const oya3 = Z.box.OOS_ZAIKO.availableForSku('ORG100', { lots: LOTS, defects: DEFECTS, holds: holds3 }, PRODUCTS);
const calc3 = G.box.basaraComputeStock_();
eq('取り置き過多でも GAS と親が一致（0で止まる）', calc3.available('ORG100'), oya3);
eq('参考：0 で止まる', oya3, 0);

/* ══════════════════════════════════════════════════════════════════════
   📌 受注の「印」が、保存→読み戻しで消えないか（2026-09-12）
   ──────────────────────────────────────────────────────────────────────
   ★ひろみさん：「なぜそういうことが起きているのか、見張りがまたいくつもいないか、
   　見張りをつけてばかりだと、それがまたバグになるでしょ。
   　見張りは少なく、機能を持たせて更新して」

   起きていたこと：同じ項目名を【3か所】に書かないといけない作りだった。
   　①アプリが o.◯◯ に入れる ②GASの extra に書く ③GASの loadAll で戻す
   1つでも忘れると、画面を開き直したときに黙って消える。
   2026-09-12 に数えたら【9件】こわれていた：
   　保存されていない … nouhinDocs／nouhinDocNg／deletedAt／paymentConfirmedAt／rtmCancelled
   　読み戻していない … bunrui／nouhinDocUrl／nouhinDocName／yoyakuList
   実害：中村先生の注文は、発注書にちゃんと貼れているのに
   　　　アプリでは「まだ貼れていません」と出つづけていた。

   直し方（見張りではなく、作りを直した）：
   　GASの保存と読み戻しを【まるごと】にした（oosOrderExtraAll_ / oosOrderKasaneru_）。
   　もう、新しい印を足しても どこにも書き足さなくてよい。

   ★この見張りは【1項目】で、その「書き足さなくてよい」をたしかめます。
   　わざと知らない名前の印を混ぜて、そのまま戻ってくるかを見ます。
   　これが通っているかぎり、印ごとの見張りを増やす必要はありません。
   ★項目を増やさないでください。ここ1つで足ります。
   ══════════════════════════════════════════════════════════════════════ */
{
  function gasCut(name){
    const at = gasSrc.indexOf('function ' + name + '(');
    if (at < 0) throw new Error('GASに関数がありません: ' + name);
    let i = gasSrc.indexOf('{', at), d = 0;
    for (let j = i; j < gasSrc.length; j++){
      if (gasSrc[j] === '{') d++;
      else if (gasSrc[j] === '}'){ d--; if (d === 0) return gasSrc.slice(at, j + 1); }
    }
    throw new Error('閉じかっこが見つかりません: ' + name);
  }
  /* ニセのスプレッドシート（覚えるだけ・本番には一切書きません） */
  let hyou = [];
  function mkRange(r, c, nr, nc){
    const nasi = function(){ return this; };
    return {
      setValues(v){ for (let i = 0; i < v.length; i++) hyou[r - 2 + i] = v[i].slice(); return this; },
      getValues(){ const o = []; for (let i = 0; i < nr; i++) o.push((hyou[r - 2 + i] || []).slice(0, nc)); return o; },
      getDisplayValues(){ return this.getValues().map(x => x.map(y => String(y == null ? '' : y))); },
      setValue: nasi, setFontWeight: nasi, setFontColor: nasi, setBackground: nasi, setWrap: nasi,
      setNote: nasi, setHorizontalAlignment: nasi, setVerticalAlignment: nasi, setFontSize: nasi,
      clearContent: nasi, insertCheckboxes: nasi, removeCheckboxes: nasi, setDataValidation: nasi,
      clearDataValidations: nasi, setNumberFormat: nasi, setHorizontalAlignments: nasi, setNotes: nasi,
      protect(){ return { setDescription: nasi, removeEditors: nasi, addEditor: nasi, setWarningOnly: nasi }; }
    };
  }
  const nasi2 = function(){ return this; };
  const sheet = {
    getName(){ return '受注データ'; },
    getLastRow(){ return hyou.length + 1; },
    getLastColumn(){ return 20; },
    getMaxRows(){ return hyou.length + 1; },
    getRange(r, c, nr, nc){ return mkRange(r, c, nr || 1, nc || 1); },
    getDataRange(){ return mkRange(2, 1, hyou.length, 20); },
    clear(){ hyou = []; return this; },
    clearContents(){ hyou = []; return this; },
    appendRow(r){ hyou.push(r); },
    deleteRows: nasi2, setFrozenRows: nasi2, setColumnWidth: nasi2
  };
  const ss = { getSheetByName(){ return sheet; }, insertSheet(){ return sheet; }, getName(){ return 'にせ'; } };
  const bako = { console, JSON, String, Number, Object, Array, Math, Date, RegExp, Error, Boolean,
    parseInt, parseFloat, isNaN,
    SpreadsheetApp: { openById(){ return ss; }, flush(){} },
    SHEET_ID_MAIN: 'x', SHEET_ID_OPS: 'x',
    Utilities: { formatDate(){ return ''; } },
    Logger: { log(){} },
    PropertiesService: { getScriptProperties(){ return { getProperty(){ return ''; } }; } } };
  bako.globalThis = bako;
  const ct = vm.createContext(bako);
  const retsuAt = gasSrc.indexOf('var OOS_ORDER_RETSU =');
  vm.runInContext(gasSrc.slice(retsuAt, gasSrc.indexOf('];', retsuAt) + 2), ct);
  ['oosOrderExtraAll_', 'oosOrderKasaneru_', 'oosOrderGyou_', 'saveOrdersMain', 'saveOrders', 'loadAll']   /* ★2026-10-09 行の作り方は oosOrderGyou_ に切り出した */
    .forEach(function(n){ vm.runInContext(gasCut(n), ct); });

  const moto = {
    id: 'o1', client: '中村先生', num: 'TK-20260912-5577', customerType: '定価',
    zip: '150-0001', addr: '東京都渋谷区1-1-1', tel: '03-1111-2222',
    leadType: '通常', leadDate: '2026-09-15', delivTime: '', note: 'メモ', status: 'pending',
    registeredAt: '2026-09-12T01:12:00.000Z', shippedAt: '', cancelledAt: '', useRecycle: true,
    lines: [{ productId: 1, sku: 'ORG250', productName: 'オルガニック250ml', bottles: 2, boxes: 0, boxQty: 12 }],
    enclosedDoc: '納品書兼請求書',
    /* 2026-09-12 に実際に消えていた9つ */
    nouhinDocs: { '納品書兼請求書': { url: 'https://drive.google.com/file/d/AAA/view', name: 'x.pdf', at: '2026-09-12T02:00:00.000Z' } },
    nouhinDocNg: 'PDFを保存できませんでした',
    nouhinDocUrl: 'https://drive.google.com/file/d/AAA/view', nouhinDocName: 'x.pdf',
    bunrui: 'ノヴェッロ2026予約',
    yoyakuList: { at: '2026-09-12T03:00:00.000Z' },
    deletedAt: '2026-09-01T00:00:00.000Z', paymentConfirmedAt: '2026-09-12T04:00:00.000Z', rtmCancelled: true,
    /* ★だれも GAS に書いていない、これから足されるかもしれない印。
       　これが戻ってくれば「もう書き足さなくてよい」が本当だと分かります。 */
    /* ★2026-09-25 発送不要・売上に入れない・キャンセル・発行記録・あとから領収書の印 */
    noShip: true, noShipDoc: '請求書', noShipZaiko: 'heras', uriageIrenai: true, uriageIrenaiRiyu: '出し直し', tsukijime: true,
    noShipCancel: { at: '2026-09-26T01:00:00.000Z', by: 'ゆか', zaiko: '2本戻しました', kirokuNg: '' },
    hakkou: { url: 'https://drive.google.com/file/d/BBB/view', name: 'TK_請求書_x様.pdf', at: '2026-09-25T10:00:00.000Z' }, hakkouNg: '',
    ryoshuAto: [{ url: 'https://drive.google.com/file/d/CCC/view', name: 'TK_領収書_x様.pdf', at: '2026-09-26T02:00:00.000Z' }], orderTotal: 32400,
    mada_dare_mo_shiranai_shirushi: { a: 1, b: ['x', 'y'] }
  };
  bako.__o = [moto];
  vm.runInContext('saveOrders(__o)', ct);
  const ato = vm.runInContext('loadAll()', ct).data.orders[0];

  const kieta = Object.keys(moto).filter(function(k){
    return JSON.stringify(moto[k]) !== JSON.stringify(ato[k]);
  });
  eq('受注の印は、保存→読み戻しで1つも消えない（' +
     (kieta.length ? '消えた：' + kieta.join('・') : 'ぜんぶ残った') + '）', kieta.length, 0);
}


/* ══════════════════════════════════════════════════════════════════════
   📄 書類の発行記録・📑 価格リストのリンク（2026-09-25 検証で見つけた穴の見張り）
   身代わりのスプシ・ドライブの上で、本物のGASの関数を動かします（本番には触りません）。
   　・有効期限：3か月後に同じ日が無いとき（11/30 → 2月）は、その月の末日（3/1 にしない）
   　・キャンセル：その番号の請求書の行だけ灰色＋メモ。あとから出した領収書の行は触らない・二度書かない
   　・週1回の点検：キャンセルの灰色を白に戻さない
   ══════════════════════════════════════════════════════════════════════ */
{
  function Sh(){ this.c = []; this.bg = {}; }
  Sh.prototype = {
    getLastRow(){ for(let r = this.c.length; r > 0; r--){ if((this.c[r-1] || []).some(v => v !== '' && v != null)) return r; } return 0; },
    getRange(r, c, nr, nc){ const sh = this; nr = nr || 1; nc = nc || 1;
      const get = f => { const o = []; for(let i = 0; i < nr; i++){ const a = []; for(let j = 0; j < nc; j++){ const v = (sh.c[r-1+i] || [])[c-1+j]; a.push(f(v == null ? '' : v)); } o.push(a); } return o; };
      const rg = {
        getValues(){ return get(v => v); }, getFormulas(){ return get(v => (typeof v === 'string' && v[0] === '=') ? v : ''); },
        getValue(){ return get(v => v)[0][0]; },
        setValues(vs){ vs.forEach((row, i) => { sh.c[r-1+i] = sh.c[r-1+i] || []; row.forEach((v, j) => { sh.c[r-1+i][c-1+j] = v; }); }); return rg; },
        setValue(v){ return rg.setValues([[v]]); }, setBackground(b){ for(let i = 0; i < nr; i++) sh.bg[r+i] = b; return rg; },
        setFontColor(){ return rg; }, setFontWeight(){ return rg; }, setNumberFormat(){ return rg; }, setWrap(){ return rg; },
        getDisplayValues(){ return get(v => String(v)); }, setFormula(v){ return rg.setValues([[v]]); }, clear(){ for(let i = 0; i < nr; i++){ const row = sh.c[r-1+i]; if(row) for(let j = 0; j < nc; j++) row[c-1+j] = ''; } return rg; },
        getRichTextValues(){ return get(v => v).map((row, i) => row.map((v, j) => { const runs = ((sh.rich || {})[(r+i) + ':' + (c+j)]) || []; return { getRuns(){ return runs.map(x => ({ getText(){ return x.t; }, getLinkUrl(){ return x.u; } })); } }; })); } };
      return rg; },
    insertRowBefore(r){ this.c.splice(r-1, 0, []); }, setFrozenRows(){}, setColumnWidth(){}, getSheetId(){ return 1; },
    getLastColumn(){ return this.c.reduce((m, row) => Math.max(m, (row || []).length), 0); }, hideColumns(){},
    getMaxRows(){ return Math.max(this.c.length, 1); }, getMaxColumns(){ return Math.max(this.getLastColumn(), 1); },
    getParent(){ return { getUrl(){ return 'u'; } }; }
  };
  const tabs = {};
  const kanri = { getSheetByName(n){ return tabs[n] || null; }, insertSheet(n){ return (tabs[n] = new Sh()); }, getEditors(){ return []; } };
  const shTabs = {}; let tsukutta = 0; const props = { OOS_YUKA_FILE_ID:'YUKA' };
  const yTabs = {}; const yukaF = { getSheetByName(n){ return yTabs[n] || null; } };
  const shacho = { getSheetByName(n){ return shTabs[n] || null; }, getSheets(){ return Object.keys(shTabs).map(k => shTabs[k]); }, insertSheet(n){ return (shTabs[n] = new Sh()); }, getId(){ return 'SHACHO'; } };
  const alive = {};
  let hi = null;
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a){ if(a.length) super(...a); else if(hi) super(hi[0], hi[1] - 1, hi[2], 12); else super(); } }
  const ctx = vm.createContext({ console, Math, JSON, String, Number, Object, Array, RegExp, Error, parseInt, Date: FakeDate,
    SpreadsheetApp:{ openById(id){ return id === 'SHACHO' ? shacho : (id === 'YUKA' ? yukaF : kanri); }, create(){ tsukutta++; return shacho; } },
    PropertiesService:{ getScriptProperties(){ return { getProperty(k){ return k === 'OOS_KANRI_FILE_ID' ? 'K' : (props[k] || null); }, setProperty(k, v){ props[k] = v; } }; } },
    LockService:{ getScriptLock(){ return { waitLock(){}, releaseLock(){} }; } },
    DriveApp:{ getFileById(id){ if(!alive[id]) throw new Error('no'); return { isTrashed(){ return false; } }; } },
    Utilities:{ formatDate(d, tz, f){ const p = n => ('0' + n).slice(-2); return f.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate())); } },
    Logger:{ log(){} }, ContentService:{}, HtmlService:{}, ScriptApp:{}, CacheService:{}, UrlFetchApp:{}, Session:{}, MailApp:{}, GmailApp:{} });
  let _ug = true;
  try { vm.runInContext(gasSrc, ctx); } catch (e) { _ug = false; console.log('GASを読み込めない', e.message); }
  if(_ug && typeof ctx.oosKakakuLinkSave === 'function'){
    const kigen = function(y, m, d){ hi = [y, m, d]; ctx.oosKakakuLinkSave('①', 'https://x'); const r = ctx.oosKakakuLinkList().rows[0]; hi = null; return r.kigen; };
    eq('発行記録⑤ 有効期限 9/25 → 12/24', kigen(2026, 9, 25), '2026-12-24');
    eq('発行記録⑤ 有効期限 11/30 → 2/28（3/1 にしない）', kigen(2026, 11, 30), '2027-02-28');
    eq('発行記録⑤ 有効期限 1/31 → 4/30', kigen(2027, 1, 31), '2027-04-30');
    eq('発行記録⑤ 有効期限 12/1 → 2/28', kigen(2026, 12, 1), '2027-02-28');
    /* キャンセルと週1回の点検 */
    const sh = ctx.oosHakkouSheet_();
    const L = id => '=HYPERLINK("https://drive.google.com/file/d/' + id + '/view","📄 開く")';
    sh.c.push(['9/25', '請求書', 'TK-1', 'A様', 100, 'ひろみ', '減らした', L('AAAAAAAAAAAAAAAAAAAAAA1'), '', '']);
    sh.c.push(['9/26', '領収書（あとから）', 'TK-1', 'A様', 100, 'ゆか', '—', L('AAAAAAAAAAAAAAAAAAAAAA2'), '', '']);
    sh.c.push(['9/26', '請求書', 'TK-2', 'B様', 100, 'ゆか', '減らさない', L('AAAAAAAAAAAAAAAAAAAAAA3'), '', '']);
    alive['AAAAAAAAAAAAAAAAAAAAAA1'] = alive['AAAAAAAAAAAAAAAAAAAAAA2'] = alive['AAAAAAAAAAAAAAAAAAAAAA3'] = true;
    const c1 = ctx.oosHakkouCancel({ bangou:'TK-1', memo:'❌ キャンセル（ひろみ）在庫：2本戻しました' });
    eq('発行記録② キャンセルは請求書の1行だけ（あとから領収書の行は触らない）', c1.n, 1);
    eq('発行記録② メモに書き足し・灰色', String(sh.c[1][9]).indexOf('キャンセル') >= 0 && sh.bg[2] === '#eeece6' && sh.bg[3] !== '#eeece6', true);
    eq('発行記録② 二度押しても二重に書かない', ctx.oosHakkouCancel({ bangou:'TK-1', memo:'❌ キャンセル（ひろみ）在庫：2本戻しました' }).n, 0);
    ctx.oosHakkouLinkTenken();
    eq('発行記録③ 週1回の点検でキャンセルの灰色を白に戻さない', sh.bg[2], '#eeece6');
    eq('発行記録③ 開けるPDFの行は白', sh.bg[4], null);
    /* ★2026-09-25 サンプル発送先は社長専用スプシ・［終了］は古い画面からの保存で戻らない */
    const ss = ctx.oosSampleSheet_(); ctx.oosSampleSheet_();
    eq('サンプル⑦ 社長専用のファイルを1回だけ作る（2回目は作らない）', tsukutta, 1);
    ss.c.push(['2026-09-20', 'A社', 'オイル', '無償', 'TK-1', '', '', '', '', '送った', '', 'o1', '']);
    ctx.oosSampleOwari('o1');
    ctx.oosSampleSave({ id:'o1', mokuteki:'x', jokyo:'反応待ち' });
    eq('サンプル⑦ ［終了］した行は、古い画面から保存しても「終了」のまま', ss.c[1][9], '終了');
    /* ★2026-09-25 売上一覧から手で入れる（例：中村先生を有償サンプルとして） */
    const od = kanri.insertSheet('受注データ'); const ex = JSON.stringify({ recipientName:'中村先生', lines:[{ productName:'オイルA', bottles:1, boxes:1, boxQty:6, giftType:'normal' }, { productName:'オイルB', bottles:2, giftType:'normal' }] });
    od.c.push(['ID']); const rr = []; rr[0] = 'u1'; rr[1] = '中村先生'; rr[2] = 'TK-20260912-5577'; rr[11] = 'shipped'; rr[12] = '2026-09-12'; rr[13] = '2026-09-13'; rr[19] = ex; od.c.push(rr);
    const a1 = ctx.oosSampleAddOrder('u1', '有償'); const row = ss.c[ss.c.length - 1];
    eq('サンプル⑧ 売上一覧から入れる：商品ぜんぶ・有償・伝票番号・状況は送った', a1.status === 'ok' && row[2] === 'オイルA ×7、オイルB ×2' && row[3] === '有償' && row[4] === 'TK-20260912-5577' && row[9] === '送った' && row[11] === 'u1', true);
    const n1 = ss.c.length; const a2 = ctx.oosSampleAddOrder('u1', '有償');
    eq('サンプル⑧ 同じ注文を2回押しても二重に入らない', a2.aru === true && ss.c.length === n1, true);
    eq('サンプル⑧ 無い注文は断る', ctx.oosSampleAddOrder('zzz').status, 'error');
    /* ★2026-09-25 請求書は「📄 書類の発行記録」に一本に（ひろみさん）。発注書に貼った請求書を足す */
    {
      const hk = ctx.oosHakkouSheet_(); const mae = hk.c.length;
      const hc = kanri.getSheetByName('受注データ') || kanri.insertSheet('受注データ');
      const J = function(id, num, client, st, reg, enc, key, extra){ const r = []; r[0] = id; r[1] = client; r[2] = num; r[3] = '定価'; r[11] = st; r[12] = reg; r[19] = JSON.stringify(Object.assign({ enclosedDoc:enc, yukaKey:key, orderTotal:5130, lines:[] }, extra || {})); return r; };
      hc.c.push(J('h1', 'TK-20260912-1111', '梨木綾', 'shipped', '2026-09-12', '納品書兼請求書', 'K1'));
      hc.c.push(J('h2', 'TK-20260824-2222', '浅本亮', 'pending', '2026-08-24', '納品書兼請求書 ＋  ＋ ', 'K2'));
      hc.c.push(J('h3', 'TK-20260825-3333', 'のみ商店', 'shipped', '2026-08-25', '請求書', '', { noShip:true }));
      hc.c.push(J('h4', 'RT-20260825-4444', 'ホテル', 'pending', '2026-08-25', '納品書兼請求書', 'K4'));
      hc.c.push(J('h5', 'TK-20260826-5555', '納品書だけ', 'pending', '2026-08-26', '納品書', 'K5'));
      hc.c.push(J('h6', 'TK-20260827-6666', 'キャンセル済', 'cancelled', '2026-08-27', '納品書兼請求書', 'K6'));
      hc.c[hc.c.length - 3][3] = 'RT（ホテル）';
      const ysh = new Sh(); yTabs['発注書'] = ysh; ysh.rich = {};
      const head = []; head[39] = '転記キー（自動・さわらない）'; ysh.c.push(head);
      const yr = []; yr[21] = '📄 納品書兼請求書（ひらく）'; yr[39] = 'K1'; ysh.c.push(yr); ysh.rich['2:22'] = [{ t:'📄 納品書兼請求書（ひらく）', u:'https://drive.google.com/file/d/AAAAAAAAAAAAAAAAAAAAAA9/view' }];
      const yr2 = []; yr2[1] = 'x'; yr2[39] = 'K2'; ysh.c.push(yr2);
      const k1 = ctx.oosHakkouHassouSync_();
      const add = hk.c.slice(mae);
      eq('一本化① 倉庫へ送った注文の請求書を足す（バサラ・RT・発送不要・納品書だけ・キャンセル済は足さない）', k1.status === 'ok' && add.map(r => r[2]).join(',') === 'TK-20260824-2222,TK-20260912-1111', true);
      eq('一本化① 古い順・リンクがあれば式・なければ（リンクなし）・メモの印', add[0][7] === '（リンクなし）' && /^=HYPERLINK\("https:\/\/drive/.test(add[1][7]) && add[1][9] === '発注書に貼った書類（倉庫へ発送）' && add[1][6] === '発送あり（倉庫）', true);
      eq('一本化① 空の「＋」を書類の種類にしない', add[0][1], '納品書兼請求書');
      const n2 = hk.c.length; ctx.oosHakkouHassouSync_();
      eq('一本化② 何度動かしても二重に足さない', hk.c.length, n2);
      ysh.rich['3:22'] = [{ t:'📄 納品書兼請求書（ひらく）', u:'https://drive.google.com/file/d/BBBBBBBBBBBBBBBBBBBBBB8/view' }]; ysh.c[2][21] = '📄';
      ctx.oosHakkouHassouSync_();
      eq('一本化② あとから貼られたリンクを入れる', /BBBB/.test(hk.c[mae][7]), true);
      hc.c[3][11] = 'cancelled'; ctx.oosHakkouHassouSync_();
      eq('一本化③ あとでキャンセルされたら、行は消さずに灰色＋メモ', hk.c.length === n2 && String(hk.c[mae][9]).indexOf('キャンセル') >= 0 && hk.bg[mae + 1] === '#eeece6', true);
      hk.c.push(['2026/09/20', '納品書兼請求書', 'TK-9', 'x様', '', '—', '発送あり（倉庫）', '（リンクなし）', '—', '発注書に貼った書類（倉庫へ発送）']);
      const _bgNashi = hk.bg[hk.c.length]; const _tk = ctx.oosHakkouLinkTenken();
      eq('一本化④ 週1回の点検は、リンクがまだ無い行を赤くしない（数だけ数える）', hk.bg[hk.c.length] === _bgNashi && /リンクなし：1件/.test(_tk), true);
    }
    eq('サンプル⑦ 終了した日が入る', /^\d{4}-\d{2}-\d{2}$/.test(ss.c[1][12]), true);
  }
}

/* ── 発送済の行は A列も同じグレー（2026-09-28 ひろみさん「A のセルが青いままなの…全部同じ色でグレーに」）──
   A列の🔵の色の決まりより上に、A列だけのグレーが来ること。何度呼んでも1つだけ。 */
{
  const mkRule = (f, rng) => ({ f, rng, getBooleanCondition(){ return { getCriteriaValues(){ return [f]; } }; } });
  function builder(){ const b = { f:'', rng:null,
    whenFormulaSatisfied(f){ b.f = f; return b; }, whenTextEqualTo(t){ b.f = t; return b; },
    setBackground(){ return b; }, setFontColor(){ return b; }, setBold(){ return b; },
    setRanges(r){ b.rng = r[0]; return b; }, build(){ return mkRule(b.f, b.rng); } }; return b; }
  let rules = [mkRule('🔵 発送を依頼する'), mkRule('🔴 まだ')];
  const sh = { getConditionalFormatRules(){ return rules.slice(); }, setConditionalFormatRules(r){ rules = r; },
    getRange(r, c, n, w){ return { r, c, n, w }; } };
  const box = { SpreadsheetApp:{ newConditionalFormatRule: builder }, String, OOS_YC:{ honbuMemo:31 } };
  vm.createContext(box);
  vm.runInContext(H.cutVar(gasSrc, 'OOS_HASSOU_GREY') + ';\n' + H.cutVar(gasSrc, 'OOS_HASSOU_GREY_A') + ';\n' + H.cut(gasSrc, 'oosYukaHassouGreyAdd_'), box);
  box.oosYukaHassouGreyAdd_(sh, 31);
  box.oosYukaHassouGreyAdd_(sh, 31);
  eq('発送済グレー① A列のグレーが一番上（🔵の色に勝つ）', /\$Y2=TRUE/.test(rules[0].f) && rules[0].rng.w === 1, true);
  eq('発送済グレー② キャンセルの行はA列も赤いまま（グレーにしない）', /キャンセル/.test(rules[0].f), true);
  eq('発送済グレー③ 何度呼んでもA列のグレーは1つ・行のグレーも1つ', rules.filter(r => /\$Y2=TRUE/.test(r.f)).length, 2);
}

/* ── 発送の〆（2026-09-28 ひろみさん確定）：親 oos-hizuke.js と GAS のコピーが同じ日を出すか ──
   お休みは送料・約束ごとＳ（soryo.html）の本物の判定を使う。2026〜2027年の毎日で突き合わせる。 */
{
  const soryo = fs.readFileSync(require('path').join(__dirname, '..', 'soryo.html'), 'utf8');
  const TOKU = [{ sMM:8, sDD:11, eMM:8, eDD:17 }, { sMM:12, sDD:29, eMM:1, eDD:4 }];
  const S = H.makeSandbox({});
  vm.runInContext('var _holCache={}; var specialHolidays=' + JSON.stringify(TOKU) + ';\n'
    + ['hpad2','hdkey','hParseKey','hNthMon','jpHolidaySet','isJpHoliday','inHolidayRange','isSpecialHoliday','isClosedDay'].map(n => H.cut(soryo, n)).join('\n'), S.ctx);
  const G = { Date, Math, String, Object, JSON, isNaN };
  vm.createContext(G);
  vm.runInContext(['oosJpHolidaySet_','oosYasumi_','oosHassouKigen_','oosKigenMD_','oosYukaKigenText_'].map(n => H.cut(gasSrc, n)).join('\n'), G);
  const oya = (d, t, ld) => S.box.OOS_HIZUKE.hassouKigen(d, t, ld || '', S.box.isClosedDay);
  const gas = (d, t, ld) => G.oosHassouKigen_(d, t, ld || '', x => G.oosYasumi_(x, TOKU));
  let chigau = [];
  for (let d = new Date(2026, 0, 1); d < new Date(2028, 0, 1); d.setDate(d.getDate() + 1)) {
    for (const t of ['normal', 'urgent']) {
      const a = oya(new Date(d), t), b = gas(new Date(d), t);
      if (JSON.stringify(a) !== JSON.stringify(b)) chigau.push(d.toDateString() + ' ' + t);
      if (!!S.box.isClosedDay(d) !== !!G.oosYasumi_(new Date(d), TOKU)) chigau.push(d.toDateString() + ' お休み');
    }
  }
  eq('発送の〆① 親とGASが2年分の毎日で同じ日を出す', chigau.length ? chigau.slice(0, 3).join(' / ') : 'なし', 'なし');
  const hi = (s, t, ld) => (oya(new Date(s + 'T00:00:00'), t || 'normal', ld) || {}).hi;
  eq('発送の〆② 9/28(月)に依頼 → 9/30(水)（水曜1日は数える）', hi('2026-09-28'), '2026-09-30');
  eq('発送の〆③ 9/18(金)に依頼 → 9/24(木)（20〜23の連休を飛ばす）', hi('2026-09-18'), '2026-09-24');
  eq('発送の〆④ 10/10(土)に依頼 → 10/14(水)（日曜＋祝日も連休）', hi('2026-10-10'), '2026-10-14');
  eq('発送の〆⑤ 11/2(月)に依頼 → 11/6(金)（祝日＋水曜も連休）', hi('2026-11-02'), '2026-11-06');
  eq('発送の〆⑥ 12/28(月)に依頼 → 1/6(水)（年末年始を飛ばす）', hi('2026-12-28'), '2027-01-06');
  eq('発送の〆⑦ 急ぎは翌営業日（9/28→9/29）', hi('2026-09-28', 'urgent'), '2026-09-29');
  const ot = oya(new Date('2026-09-28T00:00:00'), 'scheduled', '2026-10-03');
  eq('発送の〆⑧ 日時指定はお届け日・前の日から黄色', ot.hi + ' ' + ot.kiiro, '2026-10-03 2026-10-02');
  const txt = G.oosYukaKigenText_('TK-20260928-4821\n伝票 313653\n依頼 9/1(火)\n〆 9/3(木)までに発送', new Date(2026, 8, 28), { shu:'tsujo', hi:'2026-09-30' });
  eq('発送の〆⑨ B列は番号の行を残し、前の依頼・〆だけ入れ替える', txt, 'TK-20260928-4821\n伝票 313653\n依頼 9/28(月)\n〆 9/30(水)までに発送');
}

/* ── 🚚 いま発送する分（2026-09-28 承認モック）：🔵で☑なしだけ・〆の早い順・日時指定は前の日で並べる・〆なしは下 ── */
{
  const G = { Date, Math, String, Object, JSON, isNaN };
  vm.createContext(G);
  vm.runInContext(['OOS_YUKA_BTN_GO', 'OOS_YUKA_BTN_GO_TSUCHI'].map(n => H.cutVar(gasSrc, n)).join(';\n') + ';\n'
    + 'var OOS_YC = { slip:2, note:21, shipped:25 };\n'
    + ['oosYukaGoKa_', 'oosImaKigenOf_', 'oosImaGyou_'].map(n => H.cut(gasSrc, n)).join('\n'), G);
  const GO = '発送してください', TSU = '発送してください（LINE通知済）', STOP = 'OOS未チェック 発送しないでください（登録済）';
  function gyo(a, b, y, note, name){ const r = new Array(25).fill(''); r[0] = a; r[1] = b; r[2] = 'MEM2L-5231\nメメジック 2L\n賞味期限 2027.11.11'; r[3] = '2'; r[10] = name || 'x'; r[20] = note || ''; r[24] = y ? 'TRUE' : 'FALSE'; return r; }
  const disp = [
    gyo(GO,   'RT-1\n依頼 9/20(日)\n🗓 お届け 10/3(土) 指定', false, '', '上の行'),   /* 2行目：お届け10/3 → 10/2で並ぶ */
    gyo(STOP, 'TK-2\n依頼 9/28(月)\n〆 9/30(水)までに発送', false),                    /* 赤は出ない */
    gyo(TSU,  'TK-3\n依頼 9/24(木)\n〆 9/26(土)までに発送', false, '', '期限切れ'),     /* 4行目 */
    gyo(GO,   'TK-4\n依頼 9/28(月)\n〆 9/29(火)までに発送（急ぎ）', false, '', '急ぎ'),  /* 5行目 */
    gyo(GO,   'TK-5\n依頼 9/28(月)\n〆 9/30(水)までに発送', true),                      /* 発送済は出ない */
    gyo(GO,   'TK-6\n依頼 9/28(月)\n〆 9/30(水)までに発送', false, '❌ キャンセルされました'),  /* キャンセルは出ない */
    gyo(GO,   'TK-7\n伝票 313653', false, '', '昔の行'),                                  /* 8行目：〆なし → 下 */
    gyo(GO,   'TK-8\n依頼 9/28(月)\n〆 10/1(木)までに発送', false, '', '通常')            /* 9行目 */
  ];
  const vals = disp.map(r => r.map((c, i) => i === 24 ? c === 'TRUE' : c));
  const out = G.oosImaGyou_(vals, disp, new Date(2026, 8, 28));
  eq('いま発送する分① 出るのは🔵で☑なし・キャンセルでない行だけ（5件）', out.length, 5);
  eq('いま発送する分② 〆の早い順・日時指定は前の日で・〆なしは下', out.map(g => g.row).join(','), '4,5,9,2,8');
  eq('いま発送する分③ 〆を過ぎた行は黄色', out[0].kg.kiire, true);
  eq('いま発送する分④ 今日が〆の前の日なら黄色にしない（急ぎ9/29）', out[1].kg.kiire, false);
  /* ★2026-09-28 ひろみさん「〆と依頼の列は発注書にはないよね。いらない」→ 伝票番号の欄に発注書のB列をそのまま */
  eq('いま発送する分⑤ 伝票番号の欄は発注書のB列そのまま（依頼・〆も入る）', out[0].b, 'TK-3\n依頼 9/24(木)\n〆 9/26(土)までに発送');
  eq('いま発送する分⑥ 表の見出しは4つ（〆・依頼の列はない）', /\['発注書へ', '伝票番号', 'お届け先', '商品'\]/.test(H.cut(gasSrc, 'oosImaHassouTsukuru_')), true);
  eq('いま発送する分⑦ 説明（ひろみさんの言葉）と、だれも書けない保護', /発送がOKになったもの（🔵 発送してください）だけを抜き出したシートです/.test(gasSrc) && /setWarningOnly\(false\)/.test(H.cut(gasSrc, 'oosImaHassouTsukuru_')), true);
  eq('いま発送する分⑧ 商品は番号＋名前×数（賞味期限の行は出さない）', out[0].shohin, 'MEM2L-5231 メメジック 2L ×2');
  const kyou2 = G.oosImaGyou_(vals, disp, new Date(2026, 9, 2));
  eq('いま発送する分⑨ お届け10/3は前の日（10/2）から黄色', kyou2.filter(g => g.row === 2)[0].kg.kiire, true);
  eq('いま発送する分⑩ 案内の文言（ひろみさん案）', /［📝 ◯行目へ］を押すと「発注書」タブの◯行目に飛びます。そこで送り状NO.を書いてください（ここでは書かないでください）。/.test(gasSrc), true);
}

/* ── 頼みごとメモ（2026-09-28）：社長の鍵でサーバーに保存できる・ほかの鍵では開かない ── */
{
  const G = { GROUP_PASSWORDS:{ secret:'S1', j:'J1', gate:'G1', biz:'B1', d:'D1' } };
  vm.createContext(G); vm.runInContext(H.cut(gasSrc, 'stickyMemoPasswordOk'), G);
  eq('頼みごとメモ① 社長の鍵で開く', G.stickyMemoPasswordOk('頼みごとメモ', 'S1'), true);
  eq('頼みごとメモ② ほかの鍵では開かない', G.stickyMemoPasswordOk('頼みごとメモ', 'J1') || G.stickyMemoPasswordOk('頼みごとメモ', 'G1'), false);
  const tm = fs.readFileSync(require('path').join(__dirname, '..', 'eigyo', 'tanomi_memo.html'), 'utf8');
  eq('頼みごとメモ③ 画面が使うタブの名前と同じ', /var SHEET_NAME = '頼みごとメモ';/.test(tm), true);
}

/* ══════════════════════════════════════════════════════════════════════
   🛡 見張り（自動実行）の整理 ── 2026-10-05 ひろみさん
   「見張りがいくつもあるから、その見張りが間違ったり古い見張りが作動したりしてると思う。
   　見張りをチェックして、古いものは捨てて新しく更新するとか、見張りの数も減らして、
   　機能をしっかりつけさせたものにしてほしい」
   ★自動実行の正本は GAS の OOS_MIHARI_KIMARI（要るもの）・OOS_MIHARI_FURUI（古いもの）。
   　oosMihariSeiri を【本物のまま】身代わりの ScriptApp で動かして確かめます。
   ══════════════════════════════════════════════════════════════════════ */
{
  const G = { console, JSON, String, Object, Array, Number, Math, Date, RegExp, Logger:{ log(){} } };
  vm.createContext(G);
  ['OOS_YC','OOS_YUKA_SHEET','OOS_YUKA_PROP_KEY','OOS_HONBU_PROP_KEY','OOS_BASARA_SHEET_PROP',
   'OOS_MIHARI_KIMARI','OOS_MIHARI_ICHIJI','OOS_MIHARI_FURUI','OOS_HAKKOU_ATO_FN']
    .forEach(n => vm.runInContext(H.cutVar(gasSrc, n), G));
  ['oosMihariSeiri','oosMihariIchiran','oosImaHassouIruKa_','oosHakkouAtoYoyaku_','oosHakkouAto']
    .forEach(n => vm.runInContext(H.cut(gasSrc, n), G));
  const kimariFn = G.OOS_MIHARI_KIMARI.map(k => k.fn);
  eq('見張りの整理① 要る自動実行の表は15本（時間11・入力のたび4）', kimariFn.length + ':' + G.OOS_MIHARI_KIMARI.filter(k => k.shu === 'edit').length, '15:4');
  eq('見張りの整理② 表の名前がだぶっていない', new Set(kimariFn).size, kimariFn.length);
  eq('見張りの整理③ 古いもの（捨てる）に、やめた4本が入っている',
     ['basaraWatch','updateViewCopy','oosSoukoStockSync','oosSoukoOnEdit'].every(n => !!G.OOS_MIHARI_FURUI[n]), true);
  eq('見張りの整理④ 要るものと古いものが重なっていない', kimariFn.filter(n => G.OOS_MIHARI_FURUI[n]).length, 0);

  /* 身代わりの ScriptApp */
  let tr = [];
  function mk(fn, shu, sid){ return { getHandlerFunction(){ return fn; }, getEventType(){ return shu; }, getTriggerSourceId(){ return sid || ''; } }; }
  G.ScriptApp = { WeekDay:{ MONDAY:'MONDAY' },
    getProjectTriggers(){ return tr.slice(); },
    deleteTrigger(t){ const i = tr.indexOf(t); if(i >= 0) tr.splice(i, 1); },
    newTrigger(fn){ const b = { _shu:'CLOCK', _sid:'', timeBased(){ return b; }, everyMinutes(){ return b; }, everyHours(){ return b; }, everyDays(){ return b; },
      atHour(){ return b; }, onWeekDay(){ return b; }, after(){ return b; }, forSpreadsheet(id){ b._sid = id; return b; }, onEdit(){ b._shu = 'ON_EDIT'; return b; },
      create(){ tr.push(mk(fn, b._shu, b._sid)); } }; return b; } };
  const props = {}; props[G.OOS_YUKA_PROP_KEY] = 'YUKA'; props[G.OOS_HONBU_PROP_KEY] = 'HONBU'; props[G.OOS_BASARA_SHEET_PROP] = 'BASARA';
  G.PropertiesService = { getScriptProperties(){ return { getProperty(k){ return props[k] || ''; } }; } };
  G.oosKanriFileId_ = function(){ return 'KANRI'; };
  tr = [ mk('basaraWatch','CLOCK'), mk('basaraWatchV2','CLOCK'), mk('basaraWatchV2','CLOCK'), mk('updateViewCopy','CLOCK'),
         mk('oosYukaOnEdit','ON_EDIT','OLDFILE'), mk('oosYukaOnEdit','ON_EDIT','YUKA'), mk('nazo','CLOCK'), mk('oosSoukoMatomeSend','CLOCK') ];
  const d = G.oosMihariIchiran();
  eq('見張りの整理⑤ 見るだけ（dry）では1本も消さない・足さない', tr.length, 8);
  eq('見張りの整理⑥ 古い・二重・別ファイルを見分ける', d.消した.sort().join('、'), 'basaraWatch、basaraWatchV2（二重）、oosYukaOnEdit（別ファイル）、updateViewCopy');
  eq('見張りの整理⑦ 見覚えのないものは消さずに報告', d.気になる.join('／'), '見覚えなし：nazo');
  eq('見張りの整理⑧ 一時のもの（3分まとめLINE）は消さない', d.lines.some(l => l.indexOf('⏳ 一時') >= 0), true);
  const r = G.oosMihariSeiri(false);
  const nokori = tr.map(t => t.getHandlerFunction());
  eq('見張りの整理⑨ 整理すると 15本＋見覚えなし1＋一時1＝17本', tr.length, 17);
  eq('見張りの整理⑩ 古い2本が消えている', nokori.filter(n => n === 'basaraWatch' || n === 'updateViewCopy').length, 0);
  eq('見張りの整理⑪ basaraWatchV2 は1本だけ', nokori.filter(n => n === 'basaraWatchV2').length, 1);
  eq('見張りの整理⑫ oosYukaOnEdit は正しいファイルの1本だけ', tr.filter(t => t.getHandlerFunction() === 'oosYukaOnEdit').map(t => t.getTriggerSourceId()).join(), 'YUKA');
  eq('見張りの整理⑬ 足りなかった13本を入れた', r.入れた.length, 13);
  eq('見張りの整理⑭ 入力のたび（onEdit）は正しいファイルに付く',
     ['oosKanriOnEdit:KANRI','oosHonbuOnEdit:HONBU','oosBasaraSheetOnEdit:BASARA'].every(x => tr.some(t => t.getHandlerFunction() + ':' + t.getTriggerSourceId() === x)), true);
  const r2 = G.oosMihariSeiri(false);
  eq('見張りの整理⑮ もう一度やっても何も変わらない（何回でも同じ）', r2.消した.length + r2.入れた.length + ':' + tr.length, '0:17');
  eq('見張りの整理⑯ doGet に点検・整理の窓口がある', /action === 'oosMihariSeiri'/.test(H.cut(gasSrc, 'doGet')), true);
  eq('見張りの整理⑰ 昔の簡易トリガー onEdit は止めてある', /\nfunction onEdit\(/.test(gasSrc), false);

  /* 🚚 いま発送する分の作り直しは、中身が変わる列だけ */
  function ev(name, row, col, n){ return { range:{ getSheet(){ return { getName(){ return name; } }; }, getRow(){ return row; }, getColumn(){ return col; }, getNumColumns(){ return n || 1; } } }; }
  const Y = G.OOS_YUKA_SHEET;
  eq('作り直し① 送り状NO.（X列）を書いても作り直さない', G.oosImaHassouIruKa_(ev(Y, 5, G.OOS_YC.track)), false);
  eq('作り直し② 倉庫用メモ・本部用メモ・LINEお知らせ列でも作り直さない',
     [G.OOS_YC.soukoMemo, G.OOS_YC.honbuMemo, 33].map(c => G.oosImaHassouIruKa_(ev(Y, 5, c))).join(), 'false,false,false');
  eq('作り直し③ A列（🔵）・B列・商品・お届け先・備考・発送済☑・❌は作り直す',
     [1, 2, 3, 11, G.OOS_YC.note, G.OOS_YC.shipped, G.OOS_YC.cancel].map(c => G.oosImaHassouIruKa_(ev(Y, 5, c))).join(), 'true,true,true,true,true,true,true');
  eq('作り直し④ 見出し行・ほかのタブは作り直さない', [G.oosImaHassouIruKa_(ev(Y, 1, 1)), G.oosImaHassouIruKa_(ev('ほか', 5, 1))].join(), 'false,false');
  eq('作り直し⑤ まとめて貼った範囲に発送済☑が入っていれば作り直す', G.oosImaHassouIruKa_(ev(Y, 5, 23, 3)), true);
  eq('作り直し⑥ oosYukaOnEdit の finally は oosImaHassouIruKa_ に聞く', /oosImaHassouIruKa_\(e\)/.test(H.cut(gasSrc, 'oosYukaOnEdit')), true);
  eq('作り直し⑦ どのマスでも作り直す古い形に戻っていない', /getRow\(\) >= 2\) oosImaHassouTsukuru_\(\)/.test(H.cut(gasSrc, 'oosYukaOnEdit')), false);

  /* 📄 書類を貼ったあとの発行記録の作り直しは、2分後に1回だけ */
  tr = []; let tsukutta = 0; G.oosSeikyuIchiranTsukuru = function(){ tsukutta++; };
  G.oosHakkouAtoYoyaku_(); G.oosHakkouAtoYoyaku_(); G.oosHakkouAtoYoyaku_();
  eq('貼ったあと① 3回貼っても予約は1つ', tr.filter(t => t.getHandlerFunction() === 'oosHakkouAto').length, 1);
  G.oosHakkouAto();
  eq('貼ったあと② 動いたら予約を消して1回だけ作り直す', tsukutta + ':' + tr.length, '1:0');
  eq('貼ったあと③ oosYukaSetDocLinks はその場で作り直さず予約する',
     H.cut(gasSrc, 'oosYukaSetDocLinks').indexOf('oosSeikyuIchiranTsukuru()') < 0 && H.cut(gasSrc, 'oosYukaSetDocLinks').indexOf('oosHakkouAtoYoyaku_()') >= 0, true);

  /* 🔵 黙って通さない・（LINE通知済）を直接えらんだ行 */
  eq('🔵① B列に依頼／〆を書けなかったらA列のメモに残す', H.cut(gasSrc, 'oosYukaShipGo_').indexOf('B列に「依頼／〆」を書けませんでした') >= 0, true);
  eq('🔵② ▼で（LINE通知済）を直接えらんだ行も🔵と同じ', /OOS_YUKA_BTN_GO_TSUCHI[\s\S]{0,160}oosYukaShipGo_\(sh, row\)/.test(H.cut(gasSrc, 'oosYukaOnEdit')), true);
}

/* ══════ 📝 付箋メモ：完了（done）の印を、シートが真偽値に変えていても読み戻す（2026-10-08）══════
   ひろみさん「ゆかメモで終了にしたものが、開き直すと全部復活する」。
   保存は 'TRUE' という文字で書くが、スプレッドシートは真偽値 TRUE に変えて持つ。文字としか比べていなかったので
   done が毎回 false で戻り、✅完了にしたメモが開き直すたびに復活していた。GASの本物の loadStickyMemos で確かめる。 */
{
  const M = H.makeSandbox({
    stickyMemoPasswordOk(){ return true; },
    stickyMemoSpreadsheet(){ return {}; },
    readSheetGlobal(ss, name, mapFn){
      return [
        ['memo_1', '真偽値で持たれた完了',  '2026-10-08', false,   true,    '2026-10-08T00:00:00.000Z', ''],
        ['memo_2', '文字で持たれた完了',    '2026-10-08', 'FALSE', 'TRUE',  '2026-10-08T00:00:00.000Z', ''],
        ['memo_3', 'まだ',                  '2026-10-08', 'FALSE', 'FALSE', '2026-10-08T00:00:00.000Z', 'today'],
        ['memo_4', 'まだ（真偽値）',        '2026-10-08', false,   false,   '2026-10-08T00:00:00.000Z', 'today']
      ].map(mapFn);
    },
    Utilities: { formatDate(d){ return '2026-10-08'; } }, Session: { getScriptTimeZone(){ return 'Asia/Tokyo'; } }
  });
  vm.runInContext(H.cut(gasSrc, 'loadStickyMemos') + '\n' + H.cut(gasSrc, 'normalizeStickyDate'), M.ctx);
  const got = M.box.loadStickyMemos('付箋メモJ', 'x').data.memos;
  eq('付箋メモ① 真偽値 TRUE で持たれた完了も done:true で読み戻す', got[0].done, true);
  eq('付箋メモ② 文字 \'TRUE\' で持たれた完了も done:true', got[1].done, true);
  eq('付箋メモ③ まだのものは false のまま（文字・真偽値どちらも）', got[2].done + ',' + got[3].done, 'false,false');
  eq('付箋メモ④ 誰かに伝える（tellSomeone）も同じ読み方', got[0].tellSomeone + ',' + got[1].tellSomeone, 'false,false');
  eq('付箋メモ⑤ 中身（text・色）はそのまま', got[2].text + '/' + got[2].color, 'まだ/today');
}


/* ══════ ✅ RTの登録は【1往復】（oosRtIkki）＋ 🗓 依頼／〆の取りこぼし（2026-10-09 ひろみさん承認）══════
   承認済みモック：mocks/mock_RT登録は1往復_2026-10-09.html
   本物の oosRtIkki・oosRtIkkiChuumon_・oosRtIkkiChuumonKaku_・oosRtIkkiPdf_・oosOrderGyou_ を、
   シート・ドライブ・鍵の身代わりで動かす。発注書に1行入れる oosYukaImportOrder と V列を書く oosYukaSetDocLinks は
   記録だけ取る作り物（それぞれ自分の見張りがある）。 */
{
  const juchu = [];                       /* 受注データ（2行目から）。1行＝20列 */
  const yukaV = {};                       /* 発注書のV列 { key: [{文字,リンク}] } */
  const drive = {};                       /* RT書類フォルダ { 名前: {url,id} } */
  let saveta = 0, importKaisu = 0, setKaisu = 0, lockMachi = 0, lockHanashi = 0, lockDame = false;
  const juchuSheet = {
    getLastRow(){ return juchu.length + 1; },
    getRange(r, c, n, m){
      return {
        getValues(){ return juchu.slice(r - 2, r - 2 + (n || 1)).map(x => x.slice(c - 1, c - 1 + (m || 1))); },
        getValue(){ return (juchu[r - 2] || [])[c - 1]; },
        setValue(v){ if(!juchu[r - 2]) juchu[r - 2] = new Array(20).fill(''); juchu[r - 2][c - 1] = v; }
      };
    },
    appendRow(row){ juchu.push(row.slice()); }
  };
  const yukaSheet = {
    getLastRow(){ return 3; },
    getLastColumn(){ return 40; },
    getRange(r, c, n, m){
      return { getDisplayValues(){ return [['RT-20260916-7361\n380498'], ['']].slice(0, n || 1).map(x => c === 21 ? ['【RT RT-20260916-7361】'] : x); },
               getValues(){ return [[c === 40 ? 'K-old' : '転記キー（自動・さわらない）']]; },
               getValue(){ return 'K-old'; }, setValue(){}, hideColumns(){} };
    },
    hideColumns(){}
  };
  const G = H.makeSandbox({
    SHEET_ID_MAIN: 'MAIN',
    SpreadsheetApp: { openById(){ return { getSheetByName(n){ return n === '受注データ' ? juchuSheet : null; } }; } },
    LockService: { getScriptLock(){ return { waitLock(){ lockMachi++; if(lockDame) throw new Error('busy'); }, releaseLock(){ lockHanashi++; } }; } },
    Logger: { log(){} }, Utilities: { sleep(){} },
    oosYukaFile_(){ return { getSheetByName(n){ return n === '発注書' ? yukaSheet : null; } }; },
    oosKeyColByHeader_(){ return 40; },
    oosFindRowByKey_(sh, col, key){ return key ? 5 : 0; },
    oosYukaBangouOf_(b){ return String(b || '').split('\n')[0]; },
    oosRtDocFolder_(){ return { getFilesByName(nm){ const f = drive[nm]; let used = false;
      return { hasNext(){ return !!f && !used; }, next(){ used = true; return { getUrl(){ return f.url; }, getId(){ return f.id; } }; } }; } }; },
    oosRtDocShare_(){},
    saveExtraDoc(b64, nm){ saveta++; drive[nm] = { url: 'https://drive.test/' + nm, id: 'id-' + saveta }; return { status: 'ok', url: drive[nm].url, id: drive[nm].id, name: nm }; },
    oosYukaImportOrder(yo){ importKaisu++; return importKaisu === 1 ? { status: 'ok', row: 5, key: 'K-new' } : { status: 'dup', row: 5, key: 'K-new' }; },
    oosYukaSetDocLinks(p){ setKaisu++; const l = yukaV[p.key] || []; function tasu(n, u){ if(!u) return; if(!l.some(x => x['文字'] === n)) l.push({ '文字': n, 'リンク': u }); }
      tasu(p.nouhinName, p.nouhinUrl); tasu(p.hokaName, p.hokaUrl); yukaV[p.key] = l; return { status: 'ok' }; },
    oosRtIkkiVretsu_(key){ return (yukaV[key] || []).slice(); }
  });
  const retsuAt = gasSrc.indexOf('var OOS_ORDER_RETSU =');
  vm.runInContext(gasSrc.slice(retsuAt, gasSrc.indexOf('];', retsuAt) + 2), G.ctx);
  ['OOS_YC', 'OOS_YUKA_SHEET', 'OOS_RT_IKKI_NOUHIN', 'OOS_RT_IKKI_DENPYOU'].forEach(n => vm.runInContext(H.cutVar(gasSrc, n), G.ctx));
  ['oosOrderExtraAll_', 'oosOrderKasaneru_', 'oosOrderGyou_', 'oosRtIkki', 'oosRtIkkiChuumon_', 'oosRtIkkiFudaSagasu_', 'oosRtIkkiPdf_', 'oosRtIkkiChuumonKaku_']
    .forEach(n => vm.runInContext(H.cut(gasSrc, n), G.ctx));
  G.box.oosRtIkkiVretsu_ = function(key){ return (yukaV[key] || []).slice(); };   /* 作り物をあとから置き直す（切り出しが本物を連れてきても負けない） */

  const order = { id: 'o-new', num: 'RT-20261009-1234', client: 'エクシブ蓼科', customerType: 'rt', status: 'pending',
    note: 'RT伝票取込 ／ 伝票番号 670636 ／ 納品予定日 2026/10/14', registeredAt: '2026-10-09T00:00:00.000Z',
    lines: [{ productId: 1, productName: 'オルガニック 500ml', bottles: 12, boxes: 0 }], recipientName: 'エクシブ蓼科', rtCut: { fac: 'エクシブ蓼科' } };
  const nimotsu = { mode: 'toroku', slipNo: '670636', order: JSON.parse(JSON.stringify(order)),
    yukaOrder: { num: 'RT-20261009-1234', src: 'RT', slipNo: '670636', items: [] },
    docs: [{ shu: 'nouhin', b64: 'N', filename: 'エクシブ蓼科_670636_納品書.pdf' }, { shu: 'denpyou', b64: 'D', filename: 'エクシブ蓼科_670636_伝票.pdf' }] };

  /* ① 1回の荷物で、行・PDF2つ・V列のリンク2つ・受注データの1件 がそろう */
  const r1 = G.box.oosRtIkki(JSON.parse(JSON.stringify(nimotsu)));
  eq('1往復① 返事は ok で、2つとも貼れている', r1.status + ':' + r1.hareta, 'ok:true');
  eq('1往復① 発注書に1行（oosYukaImportOrder を1回）', importKaisu, 1);
  eq('1往復① PDFを2つ保存した', saveta, 2);
  eq('1往復① V列にリンク2つ（名札はRTの決めごとどおり）', (yukaV['K-new'] || []).map(x => x['文字']).join('／'), '📄 納品書（ひらく）／📄 発注伝票（ひらく）');
  eq('1往復① 受注データに【1件だけ】足した（全消しではない）', juchu.length + ':' + r1.kaita.shu, '1:tashita');
  eq('1往復① 受注データの行は saveOrdersMain と同じ作り（20列・IDが1列目・拡張JSONが20列目）',
     juchu[0].length + ':' + juchu[0][0] + ':' + (JSON.parse(juchu[0][19]).yukaKey), '20:o-new:K-new');
  eq('1往復① 注文にふだ・送った時刻・伝票PDFのURLが入って返る',
     r1.order.yukaKey + ':' + (!!r1.order.yukaImport.at) + ':' + r1.order.extraDocUrl, 'K-new:true:https://drive.test/エクシブ蓼科_670636_伝票.pdf');
  eq('1往復① rtCut（RT残高の切り出し）など、注文の印はまるごと残る', JSON.parse(juchu[0][19]).rtCut.fac, 'エクシブ蓼科');
  eq('1往復① 鍵をかけて、はなした', lockMachi + ':' + lockHanashi, '1:1');

  /* ② 同じ荷物をもう一度 → 二重にならない（行も・PDFも・受注データも） */
  const r2 = G.box.oosRtIkki(JSON.parse(JSON.stringify(nimotsu)));
  eq('1往復② 2回目も ok・2つとも貼れている', r2.status + ':' + r2.hareta, 'ok:true');
  eq('1往復② 「もう登録されている」と見分け、発注書へは行を作りに行かない', r2.nijuu + ':' + importKaisu, 'RT-20261009-1234:1');
  eq('1往復② PDFは同じ名前を使い回す（保存は増えない）', saveta, 2);
  eq('1往復② V列は2つのまま（増えない）', (yukaV['K-new'] || []).length, 2);
  eq('1往復② 受注データも1件のまま（印だけ直す）', juchu.length + ':' + r2.kaita.shu, '1:naoshita');

  /* ③ 書類だけ（登録済みの伝票を読み直したとき）。ふだが注文に無くても、発注書の行から見つける */
  juchu.push(G.box.oosOrderGyou_({ id: 'o-old', num: 'RT-20260916-7361', note: 'RT伝票取込 ／ 伝票番号 380498', status: 'pending', lines: [] }));
  const r3 = G.box.oosRtIkki({ mode: 'docsOnly', slipNo: '380498', order: { id: 'o-old', num: 'RT-20260916-7361' },
    docs: [{ shu: 'nouhin', b64: 'N2', filename: '高山_380498_納品書.pdf' }, { shu: 'denpyou', b64: 'D2', filename: '高山_380498_伝票.pdf' }] });
  eq('1往復③ 書類だけでも ok・2つとも貼れる', r3.status + ':' + r3.mode + ':' + r3.hareta, 'ok:docsOnly:true');
  eq('1往復③ ふだは発注書の行（番号）から見つけた', r3.key, 'K-old');
  eq('1往復③ 発注書に行は作らない', importKaisu, 1);
  eq('1往復③ 受注データの印だけ直す（行は増えない）', juchu.length + ':' + r3.kaita.shu + ':' + JSON.parse(juchu[1][19]).yukaKey, '2:naoshita:K-old');

  /* ④ 書類だけなのに、受注データに無い → はっきり断る（何も書かない） */
  const r4 = G.box.oosRtIkki({ mode: 'docsOnly', order: { id: 'nai', num: 'RT-0' }, docs: [] });
  eq('1往復④ 無い注文には理由つきで断る', r4.status + ':' + (r4.message.indexOf('見つかりません') >= 0), 'error:true');
  eq('1往復④ 何も書いていない（③で2つ保存したので4のまま）', juchu.length + ':' + saveta + ':' + importKaisu, '2:4:1');

  /* ⑤ 発注書に行を作れなかった → 断る。PDFも受注データも書かない（順番＝行が先） */
  G.box.oosYukaImportOrder = function(){ return { status: 'error', message: '発注書のファイルがありません' }; };
  const r5 = G.box.oosRtIkki({ mode: 'toroku', slipNo: '999', order: { id: 'o-x', num: 'RT-0', note: '伝票番号 999' }, yukaOrder: { num: 'RT-0' },
    docs: [{ shu: 'nouhin', b64: 'N3', filename: 'x_納品書.pdf' }] });
  eq('1往復⑤ 行を作れなければ、GASの理由をそのまま返す', r5.status + ':' + r5.message, 'error:発注書に行を作れませんでした：発注書のファイルがありません');
  eq('1往復⑤ PDFも受注データも書いていない', saveta + ':' + juchu.length, '4:2');

  /* ⑥ 鍵が取れない（混んでいる） → 断る */
  lockDame = true;
  const r6 = G.box.oosRtIkki(JSON.parse(JSON.stringify(nimotsu)));
  eq('1往復⑥ 混んでいるときは「もう一度送る」案内で断る', r6.status + ':' + (r6.message.indexOf('混み合っています') >= 0), 'error:true');
  lockDame = false;

  /* ⑦ 作り（文字でも） */
  eq('1往復⑦ doPost の振り分けに rtIkki がある', gasSrc.indexOf("'rtIkki') return oosRtIkki(") >= 0, true);
  eq('1往復⑦ saveOrdersMain は oosOrderGyou_ を使う（行の作り方は1か所）', /orders\.map\(oosOrderGyou_\)/.test(H.cut(gasSrc, 'saveOrdersMain')), true);
  eq('1往復⑦ oosRtIkki は saveOrdersMain（全消し→書き直し）を呼ばない', H.cut(gasSrc, 'oosRtIkki').indexOf('saveOrdersMain') < 0, true);
}

/* ══════ 🗓 B列の「依頼／〆」を取りこぼさない（2026-10-09 ひろみさん「1時間では遅い。2〜3分以内に」）══════ */
{
  const G = { console, JSON, String, Object, Array, Number, Math, Date, RegExp, Error, Logger: { log(){} }, Utilities: { sleep(){} } };
  vm.createContext(G);
  ['OOS_YC', 'OOS_YUKA_SHEET', 'OOS_YUKA_BTN_GO', 'OOS_YUKA_BTN_GO_TSUCHI', 'OOS_KIGEN_ATO_FN', 'OOS_KIGEN_ATO_PROP', 'OOS_MIHARI_ICHIJI']
    .forEach(n => vm.runInContext(H.cutVar(gasSrc, n), G));
  ['oosYukaKigenKakuKurikaeshi_', 'oosKigenAtoYoyaku_', 'oosKigenAto', 'oosKigenUmeru_', 'oosKigenNoteDate_']
    .forEach(n => vm.runInContext(H.cut(gasSrc, n), G));
  /* やり直し：2回こけて3回目で書けた */
  let kake = 0, kaita = [];
  G.oosYukaKigenKaku_ = function(sh, row, key, disp, irai){ kake++; if(kake < 3) throw new Error('混んでいます'); kaita.push({ row, irai }); return { shu: 'tsujo' }; };
  const k1 = G.oosYukaKigenKakuKurikaeshi_({}, 5, 'K', []);
  eq('依頼〆① 同じ実行の中で3回までやり直す（2回こけても書ける）', kake + ':' + (k1 && k1.shu), '3:tsujo');
  kake = 0; G.oosYukaKigenKaku_ = function(){ kake++; throw new Error('まだ混んでいます'); };
  let nageta = '';
  try{ G.oosYukaKigenKakuKurikaeshi_({}, 5, 'K', []); }catch(e){ nageta = e.message; }
  eq('依頼〆② 3回ともだめなら、理由を投げる（黙らない）', kake + ':' + nageta, '3:まだ混んでいます');
  /* 2分後に1回の予約：何回頼んでも1つ、行は足していく */
  let tr = []; const props = {};
  G.ScriptApp = { getProjectTriggers(){ return tr.slice(); }, deleteTrigger(t){ tr.splice(tr.indexOf(t), 1); },
    newTrigger(fn){ const b = { timeBased(){ return b; }, after(){ return b; }, create(){ tr.push({ getHandlerFunction(){ return fn; } }); } }; return b; } };
  G.PropertiesService = { getScriptProperties(){ return { getProperty(k){ return props[k] || ''; }, setProperty(k, v){ props[k] = v; }, deleteProperty(k){ delete props[k]; } }; } };
  G.oosKigenAtoYoyaku_(5); G.oosKigenAtoYoyaku_(7); G.oosKigenAtoYoyaku_(5);
  eq('依頼〆③ 予約は1つだけ・行は 5,7 の2つ', tr.length + ':' + props[G.OOS_KIGEN_ATO_PROP], '1:5,7');
  let umetaRows = null; G.oosKigenUmeru_ = function(rows){ umetaRows = rows.slice(); return { status: 'ok' }; };
  G.oosKigenAto();
  eq('依頼〆④ 2分後：予約を消して、その行だけ埋めに行く', tr.length + ':' + umetaRows.join(','), '0:5,7');
  eq('依頼〆④ 控えた行も消す（次の予約が古い行を引きずらない）', props[G.OOS_KIGEN_ATO_PROP] === undefined, true);
  /* 埋める：🔵なのに依頼／〆が無い行だけ。発送済・キャンセル・赤・もう書いてある行は触らない。依頼日は🔵にした日 */
  vm.runInContext(H.cut(gasSrc, 'oosKigenUmeru_'), G);   /* 本物に戻す */
  const Y = G.OOS_YC;
  function gyou(a, b, note, track, shipped){ const r = new Array(Y.shipped).fill(''); r[0] = a; r[Y.slip - 1] = b; r[Y.note - 1] = note || ''; r[Y.track - 1] = track || ''; r[Y.shipped - 1] = shipped || ''; return r; }
  const disp = [
    gyou(G.OOS_YUKA_BTN_GO,        'RT-1\n670636'),                                  /* 2行目：🔵・依頼なし → 埋める */
    gyou(G.OOS_YUKA_BTN_GO_TSUCHI, 'RT-2\n依頼 10/8(木)\n〆 10/10(土)までに発送'),   /* 3行目：もう書いてある → 触らない */
    gyou('OOS未チェック 発送しないでください（登録済）', 'RT-3'),                       /* 4行目：赤 → 触らない */
    gyou(G.OOS_YUKA_BTN_GO,        'RT-4', '', '4523-0000'),                          /* 5行目：送り状NO.あり → 触らない */
    gyou(G.OOS_YUKA_BTN_GO,        'RT-5', '❌ キャンセルされました'),                   /* 6行目：キャンセル → 触らない */
    gyou(G.OOS_YUKA_BTN_GO_TSUCHI, 'RT-6')                                            /* 7行目：🔵（通知済）・依頼なし → 埋める */
  ];
  const notes = [['⏳ 3分後に倉庫へLINEで知らせます（ほかの🔵とまとめて1通） 10/8 14:30'], [''], [''], [''], [''], ['📨 倉庫LINEへ知らせました 10/7 09:05']];
  const sh = { getRange(r, c, n, m){ return {
    getDisplayValues(){ return disp.slice(); }, getNotes(){ return notes.slice(); },
    getValues(){ return disp.map((_, i) => ['K' + (i + 2)]); } }; } };
  G.oosYukaFile_ = function(){ return { getSheetByName(){ return sh; } }; };
  G.oosLastDataRow_ = function(){ return disp.length + 1; };
  G.oosKeyColByHeader_ = function(){ return 40; };
  kaita = []; G.oosYukaKigenKaku_ = function(s, row, key, d, irai){ kaita.push(row + ':' + key + ':' + (irai.getMonth() + 1) + '/' + irai.getDate()); };
  const u = G.oosKigenUmeru_();
  eq('依頼〆⑤ 埋めるのは「🔵なのに依頼／〆が無い」2行だけ（赤・書いてある・発送済・キャンセルは触らない）', u.umeta + ':' + u.mita, '2:2');
  eq('依頼〆⑤ 依頼日は🔵にした日（A列のメモの日時）から数える', kaita.join('／'), '2:K2:10/8／7:K7:10/7');
  const u2 = G.oosKigenUmeru_(['7']);
  eq('依頼〆⑥ 行を指定すればその行だけ', u2.umeta + ':' + kaita[kaita.length - 1], '1:7:K7:10/7');
  eq('依頼〆⑦ メモに日時が無ければ今日（null）', G.oosKigenNoteDate_('') === null, true);
  /* 作り */
  const go = H.cut(gasSrc, 'oosYukaShipGo_');
  eq('依頼〆⑧ 🔵は やり直し付き（oosYukaKigenKakuKurikaeshi_）で書き、だめなら2分後の予約（oosKigenAtoYoyaku_）', go.indexOf('oosYukaKigenKakuKurikaeshi_(sh, row, key, disp)') >= 0 && go.indexOf('oosKigenAtoYoyaku_(row)') >= 0, true);
  eq('依頼〆⑨ 10/5の「A列のメモに⚠️を残す」は残っている', go.indexOf('B列に「依頼／〆」を書けませんでした') >= 0, true);
  eq('依頼〆⑩ 1時間ごとの既存の見張り（oosImaHassouJikan）に相乗り（新しい見張りは作らない）', H.cut(gasSrc, 'oosImaHassouJikan').indexOf('oosKigenUmeru_()') >= 0, true);
  eq('依頼〆⑪ 2分後の予約 oosKigenAto は「一時のもの」の表にある（見張りの整理で消されない）', G.OOS_MIHARI_ICHIJI.indexOf('oosKigenAto') >= 0, true);
  eq('依頼〆⑫ oosYukaKigenKaku_ は🔵にした日を受け取れる（渡さなければ今日）', gasSrc.indexOf('oosYukaKigenKaku_(sh, row, key, disp, iraiDate)') >= 0 && gasSrc.indexOf('var irai = iraiDate ') >= 0, true);
}


/* ══════ 📦 バサラ発注シート：商品①と②が同じときの注意メモ（2026-10-09 ひろみさん）／メール取込の停止 ══════ */
{
  const B = { console, String, Object, Array, Number };
  vm.createContext(B);
  vm.runInContext(H.cut(gasSrc, 'oosBasaraOnajiShohin_'), B);
  function gyou(a, b, c, d){ const r = new Array(26).fill(''); r[2] = a || ''; r[4] = b || ''; r[6] = c || ''; r[8] = d || ''; return r; }
  eq('同じ商品① ①と②が同じ → 注意の文', B.oosBasaraOnajiShohin_(gyou('ORG250 オルガニック 250ml', 'ORG250 オルガニック 250ml')),
     '⚠️ 商品①と②が同じ商品です。まちがいでなければそのままで大丈夫です（受付はしています）。');
  eq('同じ商品② ちがう商品なら何も言わない', B.oosBasaraOnajiShohin_(gyou('ORG250 オルガニック 250ml', 'MEM250 メメジック 250ml')), '');
  eq('同じ商品③ ①だけなら何も言わない', B.oosBasaraOnajiShohin_(gyou('ORG250 オルガニック 250ml')), '');
  eq('同じ商品④ （入荷待ち）が付いていても同じと見る', B.oosBasaraOnajiShohin_(gyou('ORG750 オルガニック 750ml（入荷待ち）', 'ORG750 オルガニック 750ml')) !== '', true);
  eq('同じ商品⑤ ①と③・②と④のように離れていても見つける', B.oosBasaraOnajiShohin_(gyou('A', 'B', 'A', 'B')), '⚠️ 商品①と③・商品②と④が同じ商品です。まちがいでなければそのままで大丈夫です（受付はしています）。');
  const acc = H.cut(gasSrc, 'oosBasaraOrderAccept_');
  eq('同じ商品⑥ 受付（✅ 受付）のあとにメモを付ける・受付は止めない', acc.indexOf('oosBasaraOnajiShohin_(d)') > acc.indexOf("cell.setValue('✅ 受付 '") && acc.indexOf('oosBasaraOnajiShohin_(d)') > 0, true);
  eq('同じ商品⑦ stop（受付を止める）には使っていない', /stop\([^)]*oosBasaraOnajiShohin_/.test(acc), false);
  /* メールの入口 */
  const bw = H.cut(gasSrc, 'basaraWatchV2');
  eq('メール入口① basaraWatchV2 は BASARA_MAIL_TORIKOMI が false なら basaraRun_ を呼ばない', /var BASARA_MAIL_TORIKOMI = false;/.test(gasSrc) && bw.indexOf('if(!BASARA_MAIL_TORIKOMI)') >= 0, true);
  eq('メール入口② 欠品の見張り（basaraStockWatchV2_）は残っている', bw.indexOf('basaraStockWatchV2_()') >= 0, true);
  eq('メール入口③ 共有に足す窓口は決めたアドレスだけ', H.cut(gasSrc, 'doGet').indexOf("['hara@basarastar.com', 'nobuyukidayoooo@gmail.com']") >= 0, true);
}

console.log('===== GAS と oos-zaiko.js の突き合わせ =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
