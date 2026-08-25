/* 受注Ａ：ゆかさんからの3件の指摘（2026-08-25）の見張り
   ①出荷依頼書の「紙袋：なし」→「ギフト包装用の紙袋：なし」に変えて、紙袋そのものの出荷と混同しないようにした
   ②STORES取込の注文が受注一覧で見分けられるようにバッジを追加し、
     「倉庫には送らない（記録のみ）」を選べるようにした（STORESに限らず、どの注文にも使える）
   本番の index.html から本物の関数をそのまま切り出して動かす。保存先には一切書き込まない。 */
const vm = require('vm');
const H = require('./harness');

const src = H.read('index.html');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

/* ── ①ギフト包装用の紙袋（文言の混同対策） ── */
ok('①ラベルが「ギフト包装用の紙袋」になっている', src.indexOf("'ギフト包装用の紙袋：'") >= 0);
ok('①「ギフト包装用の紙袋：あり」がある', src.indexOf('ギフト包装用の紙袋：あり') >= 0);
ok('①「ギフト包装用の紙袋：なし」がある', src.indexOf("'ギフト包装用の紙袋：なし'") >= 0);
ok('①素の「紙袋：なし」（誤読のもと）が残っていない', /[^ト]紙袋：なし/.test(src.replace(/ギフト包装用の紙袋：なし/g,'')), false);

/* ── ②STORESバッジ・記録のみボタン（ソース確認） ── */
ok('②STORESバッジがある', src.indexOf('🛒STORES') >= 0);
ok('②storesBadgeが判定に使われている', src.indexOf("o.source==='stores' ?") >= 0);
ok('②whSkipStateOfがある', src.indexOf('function whSkipStateOf') >= 0);
ok('②「倉庫には送らない」ボタンがある', src.indexOf('倉庫には送らない（記録のみ') >= 0);
ok('②未送信の赤バッジに記録のみの分岐がある', src.indexOf('🚫 記録のみ（倉庫には送らない）') >= 0);
ok('②元に戻すボタンがある', src.indexOf('やっぱり倉庫へ送れるようにする') >= 0);

/* ── ②実際に動かして確認（whSkip状態の遷移） ── */
const orders = [{ id:'o1', num:'ST-20260825-0001', source:'stores', status:'pending' }];
const syncCalls = [];
const { box, ctx } = H.makeSandbox({
  orders: orders,
  renderList(){},
  syncOrdersToGAS(list){ syncCalls.push(list); },
  showSyncStatus(){}
});
vm.runInContext(H.cut(src, 'whSkipStateOf'), ctx);
vm.runInContext(H.cut(src, 'whSkip'), ctx);
vm.runInContext(H.cut(src, 'whSkipUndo'), ctx);

const o1 = orders[0];
eq('② 初期状態はnone', box.whSkipStateOf(o1), 'none');

box.whSkip('o1');
eq('② whSkipでskip状態になる', box.whSkipStateOf(o1), 'skip');
ok('② whSkipで記録が残る（誰がいつ）', !!(o1.whSkip && o1.whSkip.at));
eq('② whSkipで保存が呼ばれる', syncCalls.length, 1);
eq('② 保存対象はその注文だけ', syncCalls[0][0].id, 'o1');

box.whSkipUndo('o1');
eq('② whSkipUndoでnoneに戻る', box.whSkipStateOf(o1), 'none');
eq('② 戻したときも保存される', syncCalls.length, 2);

console.log('===== 受注Ａ：ゆかさんの3件の指摘の見張り =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
