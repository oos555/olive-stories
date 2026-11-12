/* ══════════════════════════════════════════════════════════════════════
   🔑 発注書に行を足すときの【かぎ（順番待ち）】── 2026-11-13

   ★2026-11-12 22:43 の事故：
   　原さんがバサラ発注シートの☑を2件つづけて入れた（筒井様・中口様）。
   　2つの受付がほぼ同時に走り、どちらも「最後の行＋1」＝47行目を選んで書いたので、
   　あとの中口様が先の筒井様の行を上書きした。筒井様の注文（BA-20261112-4364）だけが
   　発注書から消え、47行目の「お客様からのメモ」に筒井様の文だけが残っていた。
   　ゆかちゃん：「なぜか筒井様のオーダーだけ倉庫のスペースに入っていなくて修正可能ですか」

   ★直し：oosYukaImportOrder の入口で LockService の鍵をかけ、1件ずつ書く。
   　今までの中身は、同じ関数の中の「なかみ」にそのまま（1文字も変えずに）入っている。
   　oosRtIkki はもう鍵を持っているので {kagiSumi:true} で二重にかけない。

   ★このテストは「鍵が外されていないか」の見張りです。落ちたら、同じ事故がまた起きます。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const H = require('./harness');
const GAS = H.readGas();

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function cutFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  return '';
}

/* ── ① 入口で鍵をかけている ─────────────────────────────── */
const fn = cutFn(GAS, 'oosYukaImportOrder');
ok('①oosYukaImportOrder(order, opt) になっている', /function oosYukaImportOrder\(order,\s*opt\)/.test(GAS));
ok('①入口は LockService.getScriptLock() を使う', fn.indexOf('LockService.getScriptLock()') >= 0);
ok('①入口は waitLock で順番を待つ', /waitLock\(\d+\)/.test(fn));
ok('①鍵がとれないときは error を返す（例外で落とさない）', /catch\(eL\)\{\s*return \{status:'error'/.test(fn));
ok('①中身を動かしてから flush し、finally で必ず鍵を返す',
   fn.indexOf('var out = nakami();') >= 0
   && fn.indexOf('var out = nakami();') < fn.indexOf('SpreadsheetApp.flush()')
   && /finally\s*\{[^}]*releaseLock\(\)/.test(fn));
ok('①鍵をかけるのは、中身を動かす【前】', fn.indexOf('waitLock(') < fn.indexOf('var out = nakami();'));
ok('①鍵は1か所だけ（中身の中でもう一度かけていない）', fn.split('LockService.getScriptLock()').length - 1 === 1);

/* ── ② 中身は今までと同じ（行の決め方・二重よけ）────────── */
const nakaStart = fn.indexOf('nakami(){');
ok('②今までの中身が「なかみ」として同じ関数の中にある', nakaStart > 0);
const naka = nakaStart > 0 ? fn.slice(nakaStart) : '';
ok('②中身は「最後の行＋1」を oosLastDataRow_ で決める', naka.indexOf('oosLastDataRow_(sh, 2, OOS_YC.doc2) + 1') >= 0);
ok('②中身は B列の番号と備考の【出どころ 番号】で二重よけする', naka.indexOf("return {status:'dup', row:i+2, key:_dk};") >= 0);
ok('②中身は最後に ok と行番号とふだを返す', naka.indexOf("return {status:'ok', row:newRow, key:_key};") >= 0);
ok('②中身は最初に「注文の中身が空です」を見る', naka.indexOf("if(!order) return {status:'error', message:'注文の中身が空です'};") >= 0);

/* ── ③ 発注書に行を足す道は、この入口だけ ─────────────── */
ok('③別名の中身（oosYukaImportOrderNakami_ など）を作っていない', GAS.indexOf('oosYukaImportOrderNakami_') < 0);
const callers = ['oosBasaraOrderAccept_', 'oosYoyakuListGo_', 'oosYukaRoundTrip', 'oosRtIkki'];
callers.forEach(function(nm){
  const body = cutFn(GAS, nm);
  ok('③' + nm + ' は鍵つきの入口 oosYukaImportOrder( を呼ぶ', body.indexOf('oosYukaImportOrder(') >= 0);
});
ok('③doPost の yukaImportOrder も鍵つきの入口を通る', GAS.indexOf("'yukaImportOrder') return oosYukaImportOrder(") >= 0);

/* ── ④ oosRtIkki は鍵を持ったまま呼ぶので二重にかけない ──── */
const rt = cutFn(GAS, 'oosRtIkki');
ok('④oosRtIkki は自分で鍵をかけている', rt.indexOf('LockService.getScriptLock()') >= 0 && rt.indexOf('waitLock(60000)') >= 0);
ok('④oosRtIkki は { kagiSumi:true } を渡して二重にかけない', rt.indexOf('oosYukaImportOrder(yo, { kagiSumi:true })') >= 0);
ok('④入口は kagiSumi のときだけ鍵を飛ばす', fn.indexOf('if(!opt.kagiSumi){') >= 0 && fn.indexOf('if(kagi) kagi.releaseLock();') >= 0);

/* ── ⑤ 本物の入口を動かして確かめる（鍵の順番・失敗しても返す）── */
function run(opt){
  const log = [];
  const sandbox = {
    LockService: { getScriptLock: function(){ return {
      waitLock: function(ms){ log.push('wait:' + ms); if (opt.konde) throw new Error('timeout'); },
      releaseLock: function(){ log.push('release'); } }; } },
    SpreadsheetApp: { flush: function(){ log.push('flush'); } },
    /* 中身の最初の読み先。null を返すと中身は「運用コピーがまだありません」で止まる＝書かずに返る */
    oosYukaFile_: function(){ log.push('file'); if (opt.kowasu) throw new Error('読めなかった'); return null; },
    __out: null
  };
  vm.createContext(sandbox);
  vm.runInContext(fn + '\n__out = (function(){ try{ return oosYukaImportOrder(' + JSON.stringify(opt.order === undefined ? {num:'X'} : opt.order) + ', ' + JSON.stringify(opt.opt || null) + '); }catch(e){ return {threw:String(e.message)}; } })();', sandbox);
  return { out: sandbox.__out, log: log };
}
let r = run({});
ok('⑤ふつう：待つ→中身→flush→鍵を返す、の順', r.log.join('>') === 'wait:30000>file>flush>release', '（いま ' + r.log.join('>') + '）');
ok('⑤ふつう：中身の答えがそのまま返る', r.out && r.out.status === 'error' && /運用コピー/.test(r.out.message));
r = run({ kowasu:true });
ok('⑤中身が失敗しても鍵は必ず返す', r.log.indexOf('release') >= 0 && r.out && r.out.threw === '読めなかった');
r = run({ konde:true });
ok('⑤混んでいて鍵がとれない：中身を動かさず error を返す', r.out && r.out.status === 'error' && r.log.indexOf('file') < 0);
ok('⑤混んでいるときの文に「もう一度お試しください」がある', r.out && /もう一度お試しください/.test(r.out.message));
r = run({ opt:{kagiSumi:true} });
ok('⑤kagiSumi：鍵をかけずに中身だけ動く', r.log.join('>') === 'file' && r.out && r.out.status === 'error', '（いま ' + r.log.join('>') + '）');
r = run({ order:null });
ok('⑤注文が空：鍵はかかり、「注文の中身が空です」で返る', r.log[0] === 'wait:30000' && r.out && /注文の中身が空です/.test(r.out.message) && r.log.indexOf('release') >= 0);

/* ── 結果 ───────────────────────────────────────────────── */
const title = '🔑 発注書に行を足すときの かぎ（2件同時の☑で行が消えた事故の再発防止・2026-11-13）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
