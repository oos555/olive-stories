/* 原価の守り（EMPTY_GUARD／マージ保存／oosGuardEmptyPayload_）が本当に効くかを
   GASの本物の関数で試す。GASにも本番のシートにも一切書き込まない（身代わりのシートで動かす）。 */
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
  if(JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}

/* シートの身代わり（1行目は見出し、2行目から中身） */
function makeSheet(rows){
  let data = rows.map(r => r.slice());   // 見出しを含まない中身だけ
  return {
    _data: () => data,
    getLastRow(){ return data.length + 1; },
    getRange(r, c, nr, nc){
      return {
        getValues(){ return data.map(x => x.slice()); },
        setValues(v){
          if(r === 1) return;                       // 見出し行の書き込みは無視
          data = v.map(x => x.slice());
        },
        setBackground(){ return this; }, setFontColor(){ return this; }, setFontWeight(){ return this; }
      };
    },
    clearContents(){ data = []; }
  };
}

function ctxWith(sheets){
  const G = H.makeSandbox({
    SHEET_ID_MAIN: 'x',
    COST_DATA_PASSWORD: 'テスト用のあいことば',   /* ★本物のパスワードは書きません（公開リポジトリのため） */
    OOS_PAYLOAD_SHEET_MAP: null,
    SpreadsheetApp: { openById(){ return {
      getSheetByName(n){ return sheets[n] || null; },
      insertSheet(n){ sheets[n] = makeSheet([]); return sheets[n]; }
    }; } },
    Logger: { log(){} }
  });
  vm.runInContext(H.cutVar(gasSrc, 'OOS_PAYLOAD_SHEET_MAP'), G.ctx);
  vm.runInContext(H.cut(gasSrc, 'oosGuardEmptyPayload_'), G.ctx);
  vm.runInContext(H.cut(gasSrc, 'saveCostData'), G.ctx);
  return G;
}

/* ── ① 全部0で保存 → EMPTY_GUARD が止める。原価は無傷 ────────── */
let sheets = { '原価データ（非公開）': makeSheet([
  ['ORG100','オルガニック100ml', 820, 'メモA'],
  ['ORG250','オルガニック250ml', 1450, ''],
  ['ORG500','オルガニック500ml', 2600, '']
]) };
let G = ctxWith(sheets);
let r = G.box.saveCostData('テスト用のあいことば', { costs: [
  { sku:'ORG100', costPerUnit:0 }, { sku:'ORG250', costPerUnit:0 }, { sku:'ORG500', costPerUnit:0 }
] });
eq('① 全部0の保存は拒否される', r.code, 'EMPTY_GUARD');
eq('① サーバーの原価は無傷（3件）', sheets['原価データ（非公開）']._data().length, 3);
eq('① ORG100 の原価は 820 のまま', sheets['原価データ（非公開）']._data()[0][2], 820);

/* ── ② 一部の商品だけ送った保存 → 送らなかった原価は残る（マージ）── */
sheets = { '原価データ（非公開）': makeSheet([
  ['ORG100','オルガニック100ml', 820, 'メモA'],
  ['ORG250','オルガニック250ml', 1450, ''],
  ['ORG500','オルガニック500ml', 2600, '']
]) };
G = ctxWith(sheets);
r = G.box.saveCostData('テスト用のあいことば', { costs: [ { sku:'ORG250', costPerUnit: 1500 } ] });
let d = sheets['原価データ（非公開）']._data();
eq('② 保存は成功する', r.status, 'ok');
eq('② 商品は3件のまま（消えない）', d.length, 3);
eq('② 送らなかった ORG100 は 820 のまま', d.find(x => x[0]==='ORG100')[2], 820);
eq('② 送らなかった ORG500 は 2600 のまま', d.find(x => x[0]==='ORG500')[2], 2600);
eq('② 送った ORG250 は 1500 に更新', d.find(x => x[0]==='ORG250')[2], 1500);
eq('② 送らなかった商品名も残る', d.find(x => x[0]==='ORG100')[1], 'オルガニック100ml');

/* ── ③ ふつうの更新はちゃんと通る ───────────────────────── */
sheets = { '原価データ（非公開）': makeSheet([['ORG100','オルガニック100ml', 820, '']]) };
G = ctxWith(sheets);
r = G.box.saveCostData('テスト用のあいことば', { costs: [ { sku:'ORG100', costPerUnit: 900, note:'値上がり' } ] });
eq('③ 更新できる', sheets['原価データ（非公開）']._data()[0][2], 900);
eq('③ メモも入る', sheets['原価データ（非公開）']._data()[0][3], '値上がり');

/* ── ④ パスワードが違えば拒否 ───────────────────────────── */
sheets = { '原価データ（非公開）': makeSheet([['ORG100','x', 820, '']]) };
G = ctxWith(sheets);
r = G.box.saveCostData('ちがう', { costs: [ { sku:'ORG100', costPerUnit: 0 } ] });
eq('④ パスワード違いは拒否', r.status, 'error');
eq('④ 原価は無傷', sheets['原価データ（非公開）']._data()[0][2], 820);

/* ── ⑤ サーバーがまだ空なら、0でも保存できる（初回登録を邪魔しない）── */
sheets = { '原価データ（非公開）': makeSheet([]) };
G = ctxWith(sheets);
r = G.box.saveCostData('テスト用のあいことば', { costs: [ { sku:'ORG100', costPerUnit: 0 } ] });
eq('⑤ 空のサーバーには 0 でも保存できる', r.status, 'ok');

/* ── ⑥ 空の配列では、価格マスタ・特価を上書きしない ─────────── */
sheets = {
  '価格マスタ':       makeSheet([['ORG100','オルガニック100ml',1,2,3,4,5,6,7]]),
  'イレギュラー特価': makeSheet([['ORG250','特価', 999]]),
  'お客様マスタ':     makeSheet([['c1','中村']])
};
G = ctxWith(sheets);
let payload = { priceMaster: [], specialPrices: [], customers: [], lots: [{ pid:1 }] };
let skipped = G.box.oosGuardEmptyPayload_(G.box.SpreadsheetApp.openById('x'), payload);
eq('⑥ 見送りにしたシート', skipped.sort(), ['お客様マスタ','イレギュラー特価','価格マスタ'].sort());
eq('⑥ priceMaster は保存対象から外れた', payload.priceMaster, undefined);
eq('⑥ specialPrices は保存対象から外れた', payload.specialPrices, undefined);
eq('⑥ customers は保存対象から外れた', payload.customers, undefined);
eq('⑥ 中身のある lots はそのまま通る', payload.lots.length, 1);

/* ⑥-2 わざと全部消したいときだけ通る */
payload = { priceMaster: [], forceEmptyOk: true };
skipped = G.box.oosGuardEmptyPayload_(G.box.SpreadsheetApp.openById('x'), payload);
eq('⑥-2 forceEmptyOk なら見送らない', skipped.length, 0);

/* ⑥-3 シートがもともと空なら、空で保存してよい */
sheets = { '価格マスタ': makeSheet([]) };
G = ctxWith(sheets);
payload = { priceMaster: [] };
skipped = G.box.oosGuardEmptyPayload_(G.box.SpreadsheetApp.openById('x'), payload);
eq('⑥-3 もともと空なら止めない', skipped.length, 0);

console.log('===== 原価・価格マスタの守り（GASの本物の関数）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
