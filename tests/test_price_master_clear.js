/* 輸入Eの「＋設定に戻す」（1マスだけ価格を消す機能）が、GASの本物の saveAllData を使って
   本当に消えるか・他の商品を巻き込まないかを確かめる。
   2026-08-25：「1つ消して、次のマスを消すと、最初に消したものの金額が元に戻る」バグの再発防止テスト。
   GASのファイルは【公開リポジトリに置きません】（パスワードとLINEのIDが入っているため）。
   手元の作業フォルダにあれば読み、無ければこのテストは飛ばします。
   置き場所：%USERPROFILE%\OneDrive\ドキュメント\olive-stories-gas\コード.js（clasp pull で作られます） */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
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
  if(got === want) pass++; else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}

const PM_HEADERS = ['sku','productName','priceGeneral','priceWholesale1','priceWholesale2','priceRT','priceDefect','taxRate','priceBasara','priceSpecial','priceOldLot'];

/* 価格マスタの身代わりシート（メモリ上だけ）。行は [sku,name,general,ws1,ws2,rt,defect,taxRate,basara,special,oldlot] */
function makeSheet(initialRows){
  let rows = initialRows.map(r => r.slice());
  return {
    _rows: () => rows,
    getLastRow(){ return rows.length + 1; }, // +1 = ヘッダー行
    getLastColumn(){ return PM_HEADERS.length; },
    getRange(r, c, nr, nc){
      return {
        getValues(){
          if(r === 1) return [PM_HEADERS.slice(0, nc)];
          return rows.slice(r-2, r-2+nr).map(x => x.slice());
        },
        setValues(v){
          if(r === 1) return; // ヘッダー書き込みは無視（テストでは見ない）
          rows = v.map(x => x.slice());
        },
        setBackground(){ return this; }, setFontColor(){ return this; }, setFontWeight(){ return this; }
      };
    },
    clearContents(){ rows = []; },
    insertSheet(){ return this; }
  };
}

function buildSandbox(sheet){
  return H.makeSandbox({
    SpreadsheetApp: { openById(){ return { getSheetByName(n){ return (n === '価格マスタ') ? sheet : null; }, insertSheet(){ return sheet; } }; } },
    SHEET_ID_MAIN: 'x',
    loadProducts(){ throw new Error('no products in this test'); }, // saveAllDataはtry/catchで無視する
    Logger: { log(){} }
  });
}

function loadIntoSandbox(G){
  vm.runInContext(H.cutVar(gasSrc, 'OOS_PAYLOAD_SHEET_MAP'), G.ctx);
  ['oosGuardEmptyPayload_','saveAllData'].forEach(n => vm.runInContext(H.cut(gasSrc, n), G.ctx));
}

/* ── ① 1マスだけnullで消す→ちゃんと0になる／他の欄・他の商品は変わらない ───────── */
{
  const sheet = makeSheet([
    ['ORG250','オルガニック250ml',4750,3388,3200,3800,0,0.08,3388,0,0],
    ['MEM500','メメジック500ml',9120,6228,6000,6884,0,0.08,6228,0,0]
  ]);
  const G = buildSandbox(sheet);
  loadIntoSandbox(G);
  G.box.saveAllData({ priceMaster: [
    { sku:'ORG250', priceBasara:null },   // ★1マスだけ消す（null）
    { sku:'MEM500', priceBasara:6228 }    // 触っていない方は今の値をそのまま送る（既存の作法どおり）
  ]});
  const rows1 = sheet._rows();
  const org1 = rows1.find(r => r[0]==='ORG250'), mem1 = rows1.find(r => r[0]==='MEM500');
  eq('①ORG250のバサラ価格が消える(0)', org1[8], 0);
  eq('①ORG250の他の欄(定価)は変わらない', org1[2], 4750);
  eq('①MEM500のバサラ価格は変わらない', mem1[8], 6228);

  /* ── ② 続けて2つ目を消す→①で消したはずのORG250が元に戻らない（今回のバグの再現テスト）── */
  G.box.saveAllData({ priceMaster: [
    { sku:'ORG250', priceBasara:0 },      // clearTierPriceNowは「取り直した最新値」をそのまま送る＝0（すでに消えている）
    { sku:'MEM500', priceBasara:null }    // ★2つ目を消す
  ]});
  const rows2 = sheet._rows();
  const org2 = rows2.find(r => r[0]==='ORG250'), mem2 = rows2.find(r => r[0]==='MEM500');
  eq('②2つ目を消しても、1つ目(ORG250)は0のまま＝元に戻らない', org2[8], 0);
  eq('②2つ目(MEM500)のバサラ価格が消える(0)', mem2[8], 0);
}

/* ── ③ 通常の金額反映（nullではなく実際の数字）は今までどおり効く ───────────── */
{
  const sheet = makeSheet([['AGR250','アグルミ250ml',6200,4330,4000,4700,0,0.08,4330,0,0]]);
  const G = buildSandbox(sheet);
  loadIntoSandbox(G);
  G.box.saveAllData({ priceMaster: [{ sku:'AGR250', priceBasara:5000 }] });
  eq('③金額を入れる保存は今までどおり反映される', sheet._rows()[0][8], 5000);
}

/* ── ④ 古い形のアプリが該当欄を送ってこない（キー自体が無い）→ 消えずに残る（2026-08-12の守り）── */
{
  const sheet = makeSheet([['TGR100','唐辛子オイル100ml',2700,2040,1900,2200,0,0.08,2040,0,0]]);
  const G = buildSandbox(sheet);
  loadIntoSandbox(G);
  G.box.saveAllData({ priceMaster: [{ sku:'TGR100', productName:'唐辛子オイル100ml' }] }); // priceBasaraのキー自体が無い
  eq('④欄そのものを送らなかった古いアプリ経由でも金額は消えない', sheet._rows()[0][8], 2040);
}

/* ── ⑤ 空の配列を送っても、既存データがあるシートは消えない（EMPTY_GUARD）───── */
{
  const sheet = makeSheet([['PRI250','プリモフルット250ml',4750,3388,3200,3800,0,0.08,3388,0,0]]);
  const G = buildSandbox(sheet);
  loadIntoSandbox(G);
  G.box.saveAllData({ priceMaster: [] });
  eq('⑤空配列の保存では既存の価格マスタが無傷', sheet._rows().length, 1);
  eq('⑤中身も変わらない', sheet._rows()[0][8], 3388);
}

console.log('===== 価格マスタ：1マスだけ消す機能（本物のsaveAllData）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
