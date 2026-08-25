/* 統合マスタN：「打った数字が、画面を閉じると消える」事故を防ぐ見張り（2026-08-25・第2版）
   ・第1版（beforeunloadの確認ダイアログで止める方式）はスマホでは効かない
     （iPhone/iPadのSafariは何年も前からこの確認を出さない）とひろみさんに指摘され、作り直した。
   ・本命：画面が隠れる気配（アプリ切替・タブ切替・画面ロック・ページ離脱）を検知した瞬間に、
     確認もダイアログも出さず、待たずに今すぐ保存する（visibilitychange と pagehide の両方）。
   ・保存が失敗したときは、3秒で消える通知だけでなく、消えない赤い帯を出し続ける。
   ・autoSaveTimer が「一度保存すると二度と null に戻らない」バグも直した
     （直っていないと、最初の1回の保存のあと oosCheckStale と reloadStockNow がずっと働かなくなる）。
   本番の master.html から本物の関数をそのまま切り出して動かす。保存先には一切書き込まない。 */
const vm = require('vm');
const H = require('./harness');

const src = H.read('master.html');

let pass = 0, fail = 0; const fails = [];
function eq(l, got, want){ if(String(got) === String(want)) pass++; else { fail++; fails.push(`${l}  期待:${want}  実際:${got}`); } }
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

/* ── ①ソース上の存在確認 ───────────────────────────── */
ok('①visibilitychangeの見張りがある（本命）', src.indexOf("addEventListener('visibilitychange'") >= 0);
ok('①pagehideの見張りがある（本命）', src.indexOf("addEventListener('pagehide'") >= 0);
ok('①beforeunloadはおまけとして残っている', src.indexOf("addEventListener('beforeunload'") >= 0);
ok('①即座に保存する関数がある', src.indexOf('function oosFlushPendingSave') >= 0);
ok('①保存失敗の赤い帯を出す関数がある', src.indexOf('function oosSaveFailShow') >= 0);
ok('①保存失敗の赤い帯を消す関数がある', src.indexOf('function oosSaveFailHide') >= 0);
ok('①saveAllDataToGASの中で autoSaveTimer をnullに戻している',
   H.cut(src, 'saveAllDataToGAS').indexOf('autoSaveTimer = null;') >= 0);
ok('①oosFlushPendingSaveはタイマーが有るときだけ動く（無駄撃ちしない）',
   H.cut(src, 'oosFlushPendingSave').indexOf('if(autoSaveTimer)') >= 0);

/* ── ②実際に動かして確認 ───────────────────────────── */
function buildSandbox(fetchImpl){
  const elements = {};
  function makeEl(id){
    if(!elements[id]) elements[id] = { id, style:{}, innerHTML:'', appendedTo:null };
    return elements[id];
  }
  const doc = {
    visibilityState: 'visible',
    _docListeners: {},
    addEventListener(name, fn){ doc._docListeners[name] = fn; },
    getElementById(id){ return elements[id] || null; },
    createElement(){ const el = { style:{}, innerHTML:'' }; return el; },
    body: { appendChild(el){ if(!el.id) el.id = 'oos-savefail-bar'; elements[el.id] = el; el.appendedTo = 'body'; } }
  };
  const winListeners = {};
  const win = {
    addEventListener(name, fn){ winListeners[name] = fn; }
  };
  const realTimers = []; // {fn, id} 本物の setTimeout はそのまま使う（saveAllDataToGASの実行タイミング検証には要らないため簡略化）
  const { box, ctx } = H.makeSandbox({
    document: doc,
    fetch: fetchImpl,
    // scheduleAutoSave の setTimeout は「呼ばれたことだけ」記録して実行はしない
    // （このテストでは oosFlushPendingSave が clearTimeout → saveAllDataToGAS を直接呼ぶ経路を確かめる）
    setTimeout(fn, ms){ realTimers.push(fn); return realTimers.length; },
    clearTimeout(){},
    esc(s){ return String(s == null ? '' : s); }
  });
  box.addEventListener = win.addEventListener;
  box.window.addEventListener = win.addEventListener;
  return {
    box, ctx, elements, makeEl,
    getVisHandler: () => doc._docListeners['visibilitychange'],
    getPageHideHandler: () => winListeners['pagehide'],
    getUnloadHandler: () => winListeners['beforeunload'],
    setVisibility(v){ doc.visibilityState = v; }
  };
}

function loadCore(s){
  const ctx = s.ctx;
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
  vm.runInContext(H.cut(src, 'oosFlushPendingSave'), ctx);
  // 見張りの「登録」文（関数ではないので H.cut は使えない）を、実際に書いてあるままの形で1つずつ切り出して実行する
  function grab(re, label){
    const m = re.exec(src);
    if(!m) throw new Error('見つからない: ' + label);
    return m[0];
  }
  vm.runInContext(grab(/try\{\s*document\.addEventListener\('visibilitychange'[\s\S]*?\}catch\(e\)\{\}/, 'visibilitychange'), ctx);
  vm.runInContext(grab(/window\.addEventListener\('pagehide'[\s\S]*?\}\);/, 'pagehide'), ctx);
  vm.runInContext(grab(/window\.addEventListener\('beforeunload'[\s\S]*?\n\}\);/, 'beforeunload'), ctx);
}

async function flush(){
  for(let i=0;i<8;i++){ await new Promise(r => setImmediate(r)); }
}

/* ②-1 保存に成功したら：失敗バーは出ない・oosSaveInFlightはfalseに戻る */
(async function(){
  const okFetch = () => Promise.resolve({ json: () => Promise.resolve({ status:'ok', data:{ lots:[], defects:[] } }) });
  const s = buildSandbox(okFetch);
  s.makeEl('oos-savefail-bar').style.display = 'none';
  loadCore(s);
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
    const failFetch = () => Promise.reject(new Error('通信エラー（テスト）'));
    const s = buildSandbox(failFetch);
    loadCore(s);
    s.box.saveAllDataToGAS();
    await flush();
    eq('②-2 通信に失敗しても oosSaveInFlight は最後にfalseへ戻る', s.box.oosSaveInFlight, false);
    const bar = s.elements['oos-savefail-bar'];
    ok('②-2 失敗時は赤い帯が作られて表示される', !!bar && bar.style.display === 'flex');
    ok('②-2 帯の中に「もう一度保存する」ボタンがある', !!bar && bar.innerHTML.indexOf('もう一度保存する') >= 0);
  })().then(runUnloadCase);
}

/* ②-3 beforeunload（おまけ）：保存待ち／保存中なら止める。何もなければ止めない */
function runUnloadCase(){
  const okFetch = () => Promise.resolve({ json: () => Promise.resolve({ status:'ok', data:{ lots:[], defects:[] } }) });
  const s = buildSandbox(okFetch);
  loadCore(s);
  const handler = s.getUnloadHandler();
  ok('②-3 beforeunloadハンドラが登録される', typeof handler === 'function');

  let e1 = { prevented:false, preventDefault(){ this.prevented = true; } };
  s.box.autoSaveTimer = null; s.box.oosSaveInFlight = false;
  handler(e1);
  ok('②-3 保存待ちが無ければ画面を閉じても止めない', e1.prevented === false);

  let e2 = { prevented:false, preventDefault(){ this.prevented = true; } };
  s.box.autoSaveTimer = 123; s.box.oosSaveInFlight = false;
  handler(e2);
  ok('②-3 保存タイマー待ちのときは閉じるのを止める', e2.prevented === true);

  let e3 = { prevented:false, preventDefault(){ this.prevented = true; } };
  s.box.autoSaveTimer = null; s.box.oosSaveInFlight = true;
  handler(e3);
  ok('②-3 保存の通信中も閉じるのを止める', e3.prevented === true);

  runFlushCase();
}

/* ②-4【本命】画面が隠れた瞬間に、確認なしで即座に保存する（visibilitychange） */
function runFlushCase(){
  (async function(){
    let fetchCalls = 0;
    const okFetch = () => { fetchCalls++; return Promise.resolve({ json: () => Promise.resolve({ status:'ok', data:{ lots:[], defects:[] } }) }); };
    const s = buildSandbox(okFetch);
    loadCore(s);

    // まだ保存タイマー待ち（scheduleAutoSaveが積んだつもり）の状態を作る
    s.box.autoSaveTimer = 999;

    const visHandler = s.getVisHandler();
    ok('②-4 visibilitychangeハンドラが登録される', typeof visHandler === 'function');

    // タブが見えたままの変化（例:フォーカスは残っている）では、保存を早めない
    s.setVisibility('visible');
    visHandler();
    eq('②-4 画面が見えている間は即時保存しない（タイマーはそのまま）', s.box.autoSaveTimer, 999);
    eq('②-4 見えている間はfetchも呼ばれない', fetchCalls, 0);

    // 画面が隠れた（アプリ切替・タブ切替・画面ロック）→ 確認なしで今すぐ保存
    s.setVisibility('hidden');
    visHandler();
    eq('②-4 隠れた瞬間にタイマー待ちが解除される', s.box.autoSaveTimer, null);
    await flush();
    eq('②-4 隠れた瞬間に実際に保存（fetch）が走る', fetchCalls > 0, true);
    eq('②-4 保存が完了する', s.box.oosSaveInFlight, false);
  })().then(runPageHideCase).catch(function(e){ fail++; fails.push('★②-4 例外: ' + e.message); runPageHideCase(); });
}

/* ②-5 pagehide（タブを閉じる・別ページへ移動）でも同様に即座保存される */
function runPageHideCase(){
  (async function(){
    let fetchCalls = 0;
    const okFetch = () => { fetchCalls++; return Promise.resolve({ json: () => Promise.resolve({ status:'ok', data:{ lots:[], defects:[] } }) }); };
    const s = buildSandbox(okFetch);
    loadCore(s);
    s.box.autoSaveTimer = 555;

    const pageHideHandler = s.getPageHideHandler();
    ok('②-5 pagehideハンドラが登録される', typeof pageHideHandler === 'function');
    pageHideHandler();
    eq('②-5 pagehideでもタイマー待ちが即座に解除される', s.box.autoSaveTimer, null);
    await flush();
    eq('②-5 pagehideでも実際に保存（fetch）が走る', fetchCalls > 0, true);

    // 保存待ちが無いときに呼んでも、無駄な保存をしない
    let fetchCalls2 = 0;
    const okFetch2 = () => { fetchCalls2++; return Promise.resolve({ json: () => Promise.resolve({ status:'ok', data:{ lots:[], defects:[] } }) }); };
    const s2 = buildSandbox(okFetch2);
    loadCore(s2);
    s2.box.autoSaveTimer = null;
    s2.getPageHideHandler()();
    await flush();
    eq('②-5 保存待ちが無ければ、隠れても無駄に保存しない', fetchCalls2, 0);

    finish();
  })().catch(function(e){ fail++; fails.push('★②-5 例外: ' + e.message); finish(); });
}

function finish(){
  console.log('===== 統合マスタN：保存できずに消える事故の見張り（第2版） =====');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
  process.exit(fail ? 1 : 0);
}
