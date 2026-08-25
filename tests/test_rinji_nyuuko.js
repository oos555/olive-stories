/* 臨時入庫（輸入ではない日々の入庫）の毎日の自動反映が、本物のGAS関数で正しく動くかを試す。
   2026-08-25 追加。GASのファイルは【公開リポジトリに置きません】。
   手元の作業フォルダにあれば読み、無ければこのテストは飛ばします。 */
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

const WIDTH = 10; // id,pid,商品名,ロット,賞味期限,在庫数,不良数,ステータス,メモ,入庫予定数

/* 在庫データの身代わりシート（メモリ上だけ）。行は WIDTH 列の配列 */
function makeSheet(initialRows){
  let rows = initialRows.map(r => r.slice());
  return {
    _rows: () => rows,
    getLastRow(){ return rows.length + 1; },
    getRange(r, c, nr, nc){
      return {
        getValues(){ return rows.slice(r-2, r-2+nr).map(x => x.slice()); },
        setValue(v){ rows[r-2][c-1] = v; },
        setValues(v){ for(let k=0;k<nr;k++) rows[r-2+k] = v[k].slice(); }
      };
    }
  };
}

const honbuMsgs = [];
function buildSandbox(sheet){
  return H.makeSandbox({
    SpreadsheetApp: { openById(){ return { getSheetByName(n){ return (n === '在庫データ') ? sheet : null; } }; } },
    SHEET_ID_MAIN: 'x',
    Utilities: { formatDate(){ return '2026-08-25'; } },
    Logger: { log(){} },
    oosLineToHonbu_(t){ honbuMsgs.push(t); }
  });
}
function load(G){ vm.runInContext(H.cut(gasSrc, 'oosRestockAutoApply'), G.ctx); }

/* ── ① 予定日が来ていて、すでに'new'ロットがある商品 → 棚の良品に足し込む ───── */
{
  honbuMsgs.length = 0;
  const sheet = makeSheet([
    ['lot-1', 1, '紙袋 黒 大', 'A', '', 40, 0, 'new', '', 0],
    ['rin-1', 1, '紙袋 黒 大', '', '', 100, 0, 'restock', '2026-08-25', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('①反映件数', r.applied, 1);
  eq('①棚の良品が40→140になる', sheet._rows()[0][5], 140);
  eq('①臨時入庫の行は在庫0になる', sheet._rows()[1][5], 0);
  eq('①臨時入庫の行の状態がrestock_doneになる（二重反映よけ）', sheet._rows()[1][7], 'restock_done');
  eq('①本部LINEに事後報告が飛ぶ', honbuMsgs.length, 1);
}

/* ── ② 予定日が来ていて、'new'ロットが無い商品 → その行自体が'new'になる（行が増えない）── */
{
  const sheet = makeSheet([
    ['rin-2', 2, 'ギフト箱', '', '', 12, 0, 'restock', '2026-08-25', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('②反映件数', r.applied, 1);
  eq('②行数は増えない', sheet._rows().length, 1);
  eq('②その行が棚の良品(new)になる', sheet._rows()[0][7], 'new');
  eq('②在庫数はそのまま12', sheet._rows()[0][5], 12);
}

/* ── ③ 予定日がまだ先 → 何もしない ─────────────────────────────── */
{
  const sheet = makeSheet([
    ['lot-3', 3, 'ORG250', 'A', '', 40, 0, 'new', '', 0],
    ['rin-3', 3, 'ORG250', '', '', 30, 0, 'restock', '2026-09-01', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('③反映件数は0', r.applied, 0);
  eq('③棚の良品は動かない', sheet._rows()[0][5], 40);
  eq('③臨時入庫の行もそのまま', sheet._rows()[1][5], 30);
  eq('③状態もrestockのまま', sheet._rows()[1][7], 'restock');
}

/* ── ④ 同じ日にちょうど反映（予定日＝今日）── */
{
  const sheet = makeSheet([
    ['lot-4', 4, 'MEM500', 'A', '', 10, 0, 'new', '', 0],
    ['rin-4', 4, 'MEM500', '', '', 6, 0, 'restock', '2026-08-25', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('④予定日＝今日でも反映される', r.applied, 1);
  eq('④棚の良品10→16', sheet._rows()[0][5], 16);
}

/* ── ⑤ 一度反映した(restock_done)行は、もう一度実行しても二重に足さない ───── */
{
  const sheet = makeSheet([
    ['lot-5', 5, 'AGR250', 'A', '', 20, 0, 'new', '', 0],
    ['rin-5', 5, 'AGR250', '', '', 30, 0, 'restock_done', '反映済み：2026-08-24', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('⑤すでに反映済みのものは対象外', r.applied, 0);
  eq('⑤棚の良品は動かない（二重加算されない）', sheet._rows()[0][5], 20);
}

/* ── ⑥ 数が0の予定は反映しない ─────────────────────────────────── */
{
  const sheet = makeSheet([
    ['lot-6', 6, 'PRI250', 'A', '', 5, 0, 'new', '', 0],
    ['rin-6', 6, 'PRI250', '', '', 0, 0, 'restock', '2026-08-20', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('⑥0本の予定は反映しない', r.applied, 0);
  eq('⑥棚の良品は動かない', sheet._rows()[0][5], 5);
}

/* ── ⑦ 複数商品を1回でまとめて反映 ─────────────────────────────── */
{
  const sheet = makeSheet([
    ['lot-7a', 7, 'TGR100', 'A', '', 8, 0, 'new', '', 0],
    ['rin-7a', 7, 'TGR100', '', '', 5, 0, 'restock', '2026-08-25', 0],
    ['lot-7b', 8, 'ZAI250', 'A', '', 3, 0, 'new', '', 0],
    ['rin-7b', 8, 'ZAI250', '', '', 7, 0, 'restock', '2026-08-25', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('⑦2件まとめて反映', r.applied, 2);
  eq('⑦1つ目の商品', sheet._rows()[0][5], 13);
  eq('⑦2つ目の商品', sheet._rows()[2][5], 10);
}

/* ── ⑧ 別の角度から：予定を入れただけの商品を、バサラの欠品判定(regularGood)が
   「もう在庫がある」と誤解しないこと（2026-08-25にoos-zaiko.jsで見つかった穴と同じ形の見張り）── */
{
  const G = H.makeSandbox({ Logger:{log(){}} });
  vm.runInContext(H.cut(gasSrc, 'basaraComputeStock_'), G.ctx);
  G.ctx.loadProducts = function(){ return { products:[{ id:9, sku:'ORG250', name:'オルガニック250ml' }] }; };
  G.ctx.readSheetGlobal = function(ss, name){
    if(name === '在庫データ') return [
      { pid:9, stock:0,  status:'new' },        // 棚の良品は0本＝本当は欠品
      { pid:9, stock:50, status:'restock' }     // 臨時入庫の予定が50本入っているだけ（まだ反映していない）
    ];
    if(name === '不良在庫データ') return [];
    return [];
  };
  G.ctx.SHEET_ID_MAIN = 'x';
  G.ctx.SpreadsheetApp = { openById(){ return { getSheetByName(){ return null; } }; } };
  const calc = G.box.basaraComputeStock_();
  eq('⑧臨時入庫の予定50本を、在庫があると誤解しない（正規良品在庫は0のまま）', calc.regularGood('ORG250'), 0);
}

console.log('===== 臨時入庫：毎日の自動反映（本物のGAS関数）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
