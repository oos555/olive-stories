/* 統合マスタN：「打った数字が、画面を閉じると消える」事故を防ぐ見張り（2026-08-25）
   ・保存待ち／保存中に画面を閉じようとしたら、ブラウザの標準確認で止める（beforeunload）
   ・保存が失敗したら、3秒で消える通知だけでなく、消えない赤い帯を出し続ける
   ・autoSaveTimer が「一度保存すると二度と null に戻らない」バグを直した
     （直っていないと、最初の1回の保存のあと oosCheckStale と reloadStockNow が
       ずっと働かなくなる。実際に見つかった不具合）
   本番の master.html から本物の関数をそのまま切り出して動かす。保存先には一切書き込まない。 */
const vm = require('vm');
const H = require('./harness');

const src = H.read('master.html');

let pass = 0, fail = 0; const fails = [];
function eq(l, got, want){ if(String(got) === String(want)) pass++; else { fail++; fails.push(`${l}  期待:${want}  実際:${got}`); } }
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

/* ── ①ソース上の存在確認 ───────────────────────────── */
ok('①beforeunloadの見張りがある', src.indexOf("addEventListener('beforeunload'") >= 0);
ok('①保存失敗の赤い帯を出す関数がある', src.indexOf('function oosSaveFailShow') >= 0);
ok('①保存失敗の赤い帯を消す関数がある', src.indexOf('function oosSaveFailHide') >= 0);
ok('①saveAllDataToGASの中で autoSaveTimer をnullに戻している',
   H.cut(src, 'saveAllDataToGAS').indexOf('autoSaveTimer = null;') >= 0);

/* ── ②実際に動かして確認 ───────────────────────────── */
function buildSandbox(fetchImpl){
  const elements = {};
  function makeEl(id){
    if(!elements[id]) elements[id] = { id, style:{}, innerHTML:'', appendedTo:null };
    return elements[id];
  }
  const doc = {
    getElementById(id){ return elements[id] || null; },
    createElement(){ const el = { style:{}, innerHTML:'' }; return el; },
    body: { appendChild(el){ if(!el.id) el.id = 'oos-savefail-bar'; elements[el.id] = el; el.appendedTo = 'body'; } }
  };
  let unloadHandler = null;
  const win = {
    addEventListener(name, fn){ if(name === 'beforeunload') unloadHandler = fn; }
  };
  const timers = [];
  const { box, ctx } = H.makeSandbox({
    document: doc,
    fetch: fetchImpl,
    setTimeout(fn, ms){ timers.push(fn); return timers.length; },
    esc(s){ return String(s == null ? '' : s); }
  });
  // makeSandbox は window=box にしてしまうので、addEventListener だけ差し替える
  box.addEventListener = win.addEventListener;
  box.window.addEventListener = win.addEventListener;
  return { box, ctx, elements, makeEl, getUnloadHandler: () => unloadHandler, timers };
}

function loadCore(ctx){
  ['scheduleAutoSave', 'oosSaveFailShow', 'oosSaveFailHide', 'saveAllDataToGAS',
   'buildEdits_placeholder_not_used'].forEach(() => {}); // (noop, 明示のためだけ)
  vm.runInContext('var autoSaveTimer = null; var oosSaveInFlight = false;', ctx);
  vm.runInContext('var lots = []; var defects = []; var defectHolds = []; var defectCategories = [];', ctx);
  vm.runInContext('var baselineLots = []; var baselineDefects = [];', ctx);
  vm.runInContext('function findProduct(){ return null; }', ctx);
  vm.runInContext('function withProductName(a){ return a || []; }', ctx);
  vm.runInContext('function stockRecStr(o){ return JSON.stringify(o); }', ctx);
  vm.runInContext('var gasSyncEnabled = true; var GAS_URL = "https://example.test/exec";', ctx);
  vm.runInContext('function showSyncStatus(){}', ctx);
  vm.runInContext(H.cut(src, 'oosSaveFailShow'), ctx);
  vm.runInContext(H.cut(src, 'oosSaveFailHide'), ctx);
  vm.runInContext(H.cut(src, 'saveAllDataToGAS'), ctx);
  // beforeunload の登録部分だけを抜き出して実行（関数ではなく文なので正規表現で切り出す）
  const m = /window\.addEventListener\('beforeunload'[\s\S]*?\}\);/.exec(src);
  if(!m) throw new Error('beforeunload の登録コードが見つからない');
  vm.runInContext(m[0], ctx);
}

async function flush(){
  for(let i=0;i<8;i++){ await new Promise(r => setImmediate(r)); }
}

/* ②-1 保存に成功したら：失敗バーは出ない・oosSaveInFlightはfalseに戻る */
(async function(){
  const okFetch = () => Promise.resolve({ json: () => Promise.resolve({ status:'ok', data:{ lots:[], defects:[] } }) });
  const s = buildSandbox(okFetch);
  s.makeEl('oos-savefail-bar').style.display = 'none';
  loadCore(s.ctx);
  s.box.saveAllDataToGAS();
  eq('②-1 保存中は oosSaveInFlight が true', s.box.oosSaveInFlight, true);
  await flush();
  eq('②-1 保存が終わると oosSaveInFlight は false', s.box.oosSaveInFlight, false);
  eq('②-1 保存が終わると autoSaveTimer は null', s.box.autoSaveTimer, null);
  const bar = s.elements['oos-savefail-bar'];
  ok('②-1 成功時は失敗バーが表示されない', !bar || bar.style.display === 'none');
})().then(runFailCase);

/* ②-2 保存に失敗したら：赤い帯が出る（表示されたままになる） */
function runFailCase(){
  return (async function(){
    let calls = 0;
    const failFetch = () => { calls++; return Promise.reject(new Error('通信エラー（テスト）')); };
    const s = buildSandbox(failFetch);
    loadCore(s.ctx);
    s.box.saveAllDataToGAS();
    await flush();
    eq('②-2 通信に失敗しても oosSaveInFlight は最後にfalseへ戻る', s.box.oosSaveInFlight, false);
    const bar = s.elements['oos-savefail-bar'];
    ok('②-2 失敗時は赤い帯が作られて表示される', !!bar && bar.style.display === 'flex');
    ok('②-2 帯の中に「もう一度保存する」ボタンがある', !!bar && bar.innerHTML.indexOf('もう一度保存する') >= 0);
  })().then(runUnloadCase);
}

/* ②-3 beforeunload：保存待ち／保存中なら止める。何もなければ止めない */
function runUnloadCase(){
  const okFetch = () => Promise.resolve({ json: () => Promise.resolve({ status:'ok', data:{ lots:[], defects:[] } }) });
  const s = buildSandbox(okFetch);
  loadCore(s.ctx);
  const handler = s.getUnloadHandler();
  ok('②-3 beforeunloadハンドラが登録される', typeof handler === 'function');

  // 何も保存待ちが無いとき → 止めない
  let e1 = { prevented:false, preventDefault(){ this.prevented = true; } };
  s.box.autoSaveTimer = null; s.box.oosSaveInFlight = false;
  handler(e1);
  ok('②-3 保存待ちが無ければ画面を閉じても止めない', e1.prevented === false);

  // まだ保存タイマー待ち（2秒以内）のとき → 止める
  let e2 = { prevented:false, preventDefault(){ this.prevented = true; } };
  s.box.autoSaveTimer = 123; s.box.oosSaveInFlight = false;
  handler(e2);
  ok('②-3 保存タイマー待ちのときは閉じるのを止める', e2.prevented === true);

  // 通信中（保存の往復中）のとき → 止める
  let e3 = { prevented:false, preventDefault(){ this.prevented = true; } };
  s.box.autoSaveTimer = null; s.box.oosSaveInFlight = true;
  handler(e3);
  ok('②-3 保存の通信中も閉じるのを止める', e3.prevented === true);

  finish();
}

function finish(){
  console.log('===== 統合マスタN：保存できずに消える事故の見張り =====');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
  process.exit(fail ? 1 : 0);
}
