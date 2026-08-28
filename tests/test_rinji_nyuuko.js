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

/* ★2026-08-28追加：スプレッドシートは「2026-09-04」と書いた文字を勝手に日付型に変えてしまい、
   文字のまま比べる旧コードでは自動反映が一度も動かなかった（実データで発見）。
   テストでも本物どおり、日付の直し（oosRestockDateStr_）まで含めて動かす。
   「今日」は2026-08-25に固定する（実際の日付が進んでもテストが壊れないように）。 */
class TestDate extends Date {
  constructor(...a){ if(a.length) super(...a); else super('2026-08-25T09:00:00+09:00'); }
}
function jstYmd(d){
  const t = new Date(d.getTime() + 9*3600*1000);
  const p = n => String(n).padStart(2,'0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth()+1)}-${p(t.getUTCDate())}`;
}

/* 在庫データの身代わりシート（メモリ上だけ）。行は WIDTH 列の配列 */
function makeSheet(initialRows){
  let rows = initialRows.map(r => r.slice());
  return {
    _rows: () => rows,
    getLastRow(){ return rows.length + 1; },
    getLastColumn(){ return WIDTH; },
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
    Date: TestDate,   // ★「今日」を2026-08-25に固定
    Utilities: { formatDate(d){ return jstYmd(d); } },   // ★本物と同じく日本時間のyyyy-MM-ddに直す
    Logger: { log(){} },
    oosLineToHonbu_(t){ honbuMsgs.push(t); }
  });
}
function load(G){ vm.runInContext(H.cut(gasSrc, 'oosRestockDateStr_') + '\n' + H.cut(gasSrc, 'oosRestockAutoApply'), G.ctx); }

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

/* ── ⑨ 意地悪テスト：本来1商品1件のはずの臨時入庫が、何かの拍子に同じ商品で
   2件シートに残っていた場合でも、二重に足さず・エラーにもならないこと ───── */
{
  const sheet = makeSheet([
    ['lot-9',  9, 'ZAI500', 'A', '', 10, 0, 'new', '', 0],
    ['rin-9a', 9, 'ZAI500', '', '', 5, 0, 'restock', '2026-08-20', 0],
    ['rin-9b', 9, 'ZAI500', '', '', 8, 0, 'restock', '2026-08-22', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('⑨2件とも反映される（両方の合計が積み上がる）', r.applied, 2);
  eq('⑨棚の良品＝10+5+8＝23になる（片方だけ・二重にならない）', sheet._rows()[0][5], 23);
  eq('⑨1件目もrestock_doneになる', sheet._rows()[1][7], 'restock_done');
  eq('⑨2件目もrestock_doneになる', sheet._rows()[2][7], 'restock_done');
}

/* ── ⑩ 意地悪テスト：メモ欄の日付が壊れた形式（空白・全角・変な文字列）でも
   誤って反映しない（"undefined" <= today のような文字列比較の事故を防ぐ）── */
{
  const sheet = makeSheet([
    ['lot-10',  10, 'AGR3L', 'A', '', 4, 0, 'new', '', 0],
    ['rin-10a', 10, 'AGR3L', '', '', 9, 0, 'restock', '　', 0],           // 空白だけ
    ['rin-10b', 10, 'AGR3L', '', '', 9, 0, 'restock', 'あとで決める', 0]  // 日付じゃない文字列
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('⑩日付が入っていない／変な文字列のものは反映しない', r.applied, 0);
  eq('⑩棚の良品は動かない', sheet._rows()[0][5], 4);
}

/* ── ⑪ ★2026-08-28の修正の核心：予定日のマスが「日付型」に変わっていても反映される ──
   スプレッドシートは「2026-09-04」と書いた文字を勝手に日付型に変える。旧コードは
   String(日付型)＝"Tue Aug 25 2026 …" と "2026-08-25" を比べて永遠に一致しなかった。 */
{
  const dueToday = new TestDate('2026-08-24T15:00:00.000Z');   // ＝日本時間2026-08-25の0:00（今日）
  const sheet = makeSheet([
    ['lot-11', 11, '紙袋 黒 小', 'A', '', 20, 0, 'new', '', 0],
    ['rin-11', 11, '紙袋 黒 小', '', '', 150, 0, 'restock', dueToday, 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('⑪日付型の予定日（今日）でも反映される', r.applied, 1);
  eq('⑪棚の良品20→170', sheet._rows()[0][5], 170);
  eq('⑪状態はrestock_doneになる', sheet._rows()[1][7], 'restock_done');
}

/* ── ⑫ 日付型の予定日がまだ先 → 反映しない（早すぎる反映も事故）── */
{
  const dueFuture = new TestDate('2026-09-03T15:00:00.000Z');   // ＝日本時間2026-09-04（まだ先）
  const sheet = makeSheet([
    ['lot-12', 12, '紙袋 黒 大', 'A', '', 40, 0, 'new', '', 0],
    ['rin-12', 12, '紙袋 黒 大', '', '', 300, 0, 'restock', dueFuture, 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  const r = G.box.oosRestockAutoApply();
  eq('⑫日付型の予定日（未来）は反映しない', r.applied, 0);
  eq('⑫棚の良品は動かない', sheet._rows()[0][5], 40);
  eq('⑫状態はrestockのまま', sheet._rows()[1][7], 'restock');
}

/* ── ⑬ 日付の直し（oosRestockDateStr_）そのものの確認 ── */
{
  const G = buildSandbox(makeSheet([])); load(G);
  const f = G.box.oosRestockDateStr_;
  eq('⑬日付型 → yyyy-MM-dd（日本時間）', f(new TestDate('2026-09-03T15:00:00.000Z')), '2026-09-04');
  eq('⑬世界時のISO文字列 → 日本時間の日付', f('2026-09-03T15:00:00.000Z'), '2026-09-04');
  eq('⑬ふつうの日付文字はそのまま', f('2026-09-04'), '2026-09-04');
  eq('⑬前後の空白は取り除く', f(' 2026-09-04 '), '2026-09-04');
  eq('⑬空は空のまま', f(''), '');
  eq('⑬ふつうの文字のメモは変えない', f('反映済み：2026-08-24'), '反映済み：2026-08-24');
}

/* ── ⑭ loadAllData：日付型に変わったメモを「yyyy-MM-dd」に直してアプリへ返す
   （直さないと統合マスタNの予定日の欄が空白に見える）── */
{
  const dueCell = new TestDate('2026-09-03T15:00:00.000Z');
  const sheet = makeSheet([
    ['rin-14', 14, '紙袋 黒 大', '', '', 300, 0, 'restock', dueCell, 0],
    ['lot-14', 14, '紙袋 黒 大', 'A', '', 40, 0, 'new', 'ふつうのメモ', 0],
    // 一度アプリが読み直して保存し直すと、日付が「文字」のままシートに残ることもある（実データで確認）
    ['rin-14b', 15, '紙袋 黒 小', '', '', 150, 0, 'restock', '2026-09-03T15:00:00.000Z', 0]
  ]);
  const G = buildSandbox(sheet); load(G);
  G.ctx.loadProductLabels = function(){ return []; };   // ラベル読みは今回の関心外なので身代わり
  vm.runInContext(H.cut(gasSrc, 'loadAllData'), G.ctx);
  const d = G.box.loadAllData().data;
  eq('⑭日付型の予定日は文字に直って返る', d.lots[0].note, '2026-09-04');
  eq('⑭ふつうの文字のメモはそのまま', d.lots[1].note, 'ふつうのメモ');
  eq('⑭世界時ISO文字のままの予定日も日本時間の日付に直る', d.lots[2].note, '2026-09-04');
}

console.log('===== 臨時入庫：毎日の自動反映（本物のGAS関数）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
