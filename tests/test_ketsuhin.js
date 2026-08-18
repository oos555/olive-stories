/* 欠品メールの「1商品1回だけ」の鍵が本当にかかるかを、GASの本物の関数で試す。
   メールは実際には出さず、身代わりが件数だけ数える。GASには一切書き込まない。 */
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
  if(got === want) pass++; else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

/* 状態シートの身代わり（メモリの上だけ） */
function makeStateSheet(){
  let rows = [];   // [sku, name, state, when, memo]
  return {
    _rows: () => rows,
    getLastRow(){ return rows.length + 1; },
    getRange(r, c, nr, nc){
      return {
        getValues(){ return rows.map(x => x.slice()); },
        setValues(v){ rows = v.map(x => x.slice()); },
        clearContent(){ rows = []; },
        setBackground(){ return this; }, setFontColor(){ return this; }, setFontWeight(){ return this; }
      };
    },
    insertSheet(){ return this; }
  };
}

const PRODUCTS = [{ id:1, sku:'ORG100', name:'オルガニック100ml', boxQty:12 }];
let LOTS = [{ pid:1, stock:0, status:'new' }];
const DEFECTS = [];

const mails = { out: [], restock: [], honbu: [] };
const stateSheet = makeStateSheet();

const G = H.makeSandbox({
  SpreadsheetApp: { openById(){ return { getSheetByName(n){ return (n === 'バサラ欠品状態') ? stateSheet : null; }, insertSheet(){ return stateSheet; } }; } },
  SHEET_ID_MAIN: 'x',
  BASARA_STOCK_STATE_SHEET: 'バサラ欠品状態',
  loadProducts(){ return { products: PRODUCTS }; },
  readSheetGlobal(ss, name){
    if(name === '在庫データ')     return LOTS.map(l => ({ pid:l.pid, stock:l.stock, status:l.status }));
    if(name === '不良在庫データ') return DEFECTS.slice();
    if(name === '価格マスタ')     return [{ sku:'ORG100', productName:'オルガニック100ml', priceBasara: 1200 }];
    return [];
  },
  Utilities: { formatDate(){ return '2026-08-18 03:00'; } },
  Logger: { log(){} },
  MailApp: { sendEmail(){} },
  basaraSendStockMail_(kind, name){ mails.out.push(name); },
  basaraSendRestockMail_(name){ mails.restock.push(name); },
  oosLineToHonbu_(t){ mails.honbu.push(t); },
  oosLineToWarehouse_(){ return { code:200 }; }
});
['basaraComputeStock_','basaraStateSheet_','basaraStateRead_','basaraStateWrite_',
 'basaraStockWatchV2_','basaraRestockList','basaraSendRestock'].forEach(function(n){
  vm.runInContext(H.cut(gasSrc, n), G.ctx);
});

/* ── ① はじめて見る商品は、欠品でも静かに記録するだけ ───────── */
LOTS[0].stock = 0;
G.box.basaraStockWatchV2_();
eq('① 初回は1通も送らない', mails.out.length, 0);
eq('① 状態は out として記録される', stateSheet._rows()[0][2], 'out');

/* ── ② 鍵がかかっている間は、0↔1を何度往復しても送らない ────── */
for(let i = 0; i < 50; i++){
  LOTS[0].stock = (i % 2 === 0) ? 5 : 0;
  G.box.basaraStockWatchV2_();
}
eq('② 0↔1を50回往復しても欠品メール0通', mails.out.length, 0);
eq('② 鍵は out のまま', stateSheet._rows()[0][2], 'out');

/* ── ③ 鍵は人が「入荷しました」を押したときだけ外れる ────────── */
LOTS[0].stock = 12;
const list = G.box.basaraRestockList();
eq('③ 在庫が戻ると「入荷の連絡」の対象に出る', list.data.list.length, 1);
eq('③ その商品の販売可能数', list.data.list[0].available, 12);
G.box.basaraSendRestock(['ORG100'], 'テスト');
eq('③ 入荷メールが1通だけ出る', mails.restock.length, 1);
eq('③ 鍵が外れて in になる', stateSheet._rows()[0][2], 'in');
eq('③ 本部に事後報告が飛ぶ', mails.honbu.length >= 1, true);

/* ── ④ 鍵が外れたあと、0になったら1通だけ自動で飛ぶ ─────────── */
mails.out.length = 0;
LOTS[0].stock = 0;
G.box.basaraStockWatchV2_();
eq('④ 在庫あり→0 で欠品メール1通', mails.out.length, 1);
for(let i = 0; i < 30; i++){
  LOTS[0].stock = (i % 2 === 0) ? 3 : 0;
  G.box.basaraStockWatchV2_();
}
eq('④ そのあと何度往復しても増えない（1通のまま）', mails.out.length, 1);

/* ── ⑤ 鍵がかかっていない商品に「入荷」を押しても送らない ─────── */
mails.restock.length = 0;
const r5 = G.box.basaraSendRestock(['ORG100'], 'テスト');   // いまは out（鍵あり）→送る
eq('⑤ 鍵ありなら送る', mails.restock.length, 1);
mails.restock.length = 0;
const r6 = G.box.basaraSendRestock(['ORG100'], 'テスト');   // もう in（鍵なし）→送らない
eq('⑤ 鍵が無いときは送らない（二重送信よけ）', mails.restock.length, 0);
eq('⑤ 見送りとして記録される', r6.data.skipped.length, 1);

/* ── ⑥ 在庫が戻っていない商品は「入荷の連絡」の一覧に出ない ───── */
LOTS[0].stock = 0;
G.box.basaraStockWatchV2_();                                  // また out になる
const list6 = G.box.basaraRestockList();
eq('⑥ 在庫0のうちは一覧に出ない', list6.data.list.length, 0);

console.log('===== 欠品／入荷の連絡（GASの本物の関数）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
