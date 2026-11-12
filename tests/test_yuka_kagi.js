/* ══════════════════════════════════════════════════════════════════════
   🔑 行を足すときの【かぎ（順番待ち）】── 2026-11-13

   ★2026-11-12 22:43 の事故：
   　原さんがバサラ発注シートの☑を2件つづけて入れた（筒井様・中口様）。
   　2つの受付がほぼ同時に走り、どちらも「最後の行＋1」＝47行目を選んで書いたので、
   　あとの中口様が先の筒井様の行を上書きした。筒井様の注文（BA-20261112-4364）だけが
   　発注書から消え、47行目の「お客様からのメモ」に筒井様の文だけが残っていた。
   　ゆかちゃん：「なぜか筒井様のオーダーだけ倉庫のスペースに入っていなくて修正可能ですか」
   　ひろみさん：「同時に走らないように何か工夫するみたいな」「同時に走り得る場所だけでお願いします」

   ★直し：共通の「かぎ係」oosKagiDe_ を1つ作り、同時に走りうる「行を足す」処理は全部これを通す。
   　・oosYukaImportOrder（発注書）　　　　　　・oosBasaraOrderAccept_ の御請求明細
   　・basaraAppendOrderRow_（受注データ）　　　・oosYoyakuListAdd（取り置き・予約リスト）
   　・oosSeikyuHakkoAdd_（請求書発行タブ）　　・oosRtbLogAdd（RT残高ログ）
   　1人が手で押す保存（メモなど）にはかけない（遅くしないため）。
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

/* ── ① かぎ係 oosKagiDe_ がある ─────────────────────────── */
const kakari = cutFn(GAS, 'oosKagiDe_');
ok('①かぎ係 oosKagiDe_(nakami, opt) がある', /function oosKagiDe_\(nakami,\s*opt\)/.test(GAS));
ok('①かぎ係は LockService.getScriptLock() を使う', kakari.indexOf('LockService.getScriptLock()') >= 0);
ok('①かぎ係は waitLock で順番を待つ（省略で30秒）', kakari.indexOf('kagi.waitLock(byou * 1000)') >= 0 && /var byou = Number\(opt\.byou\)[^;]*30;/.test(kakari));
ok('①かぎ係は中身を動かしてから flush し、finally で必ず鍵を返す',
   kakari.indexOf('var out = nakami();') >= 0
   && kakari.indexOf('var out = nakami();') < kakari.indexOf('SpreadsheetApp.flush()')
   && /finally\s*\{[^}]*releaseLock\(\)/.test(kakari));
ok('①鍵をかけるのは、中身を動かす【前】', kakari.indexOf('waitLock(') < kakari.indexOf('var out = nakami();'));
ok('①kagiSumi のときだけ鍵を飛ばす', kakari.indexOf('if(opt.kagiSumi) return nakami();') >= 0);
ok('①鍵がとれないとき：ふつうは error を返す', kakari.indexOf("return {status:'error', message:msg};") >= 0);
ok('①鍵がとれないとき：nageru なら例外を投げる', kakari.indexOf('if(opt.nageru) throw new Error(msg);') >= 0);
ok('①鍵がとれないとき：kagiNashiDemo なら中身を動かす', /if\(opt\.kagiNashiDemo\)\{[\s\S]*?return nakami\(\);/.test(kakari));
ok('①文に「もう一度お試しください」がある', kakari.indexOf('もう一度お試しください') >= 0);

/* ── ② 発注書（oosYukaImportOrder）は、かぎ係を通す ──────── */
const fn = cutFn(GAS, 'oosYukaImportOrder');
ok('②oosYukaImportOrder(order, opt) になっている', /function oosYukaImportOrder\(order,\s*opt\)/.test(GAS));
ok('②入口でかぎ係を呼ぶ', fn.indexOf('return oosKagiDe_(nakami, opt);') >= 0);
ok('②自前の鍵は持たない（鍵は かぎ係 の1か所だけ）', fn.indexOf('LockService') < 0);
const nakaStart = fn.indexOf('nakami(){');
ok('②今までの中身が「なかみ」として同じ関数の中にある', nakaStart > 0);
const naka = nakaStart > 0 ? fn.slice(nakaStart) : '';
ok('②中身は「最後の行＋1」を oosLastDataRow_ で決める', naka.indexOf('oosLastDataRow_(sh, 2, OOS_YC.doc2) + 1') >= 0);
ok('②中身は B列の番号と備考の【出どころ 番号】で二重よけする', naka.indexOf("return {status:'dup', row:i+2, key:_dk};") >= 0);
ok('②中身は最後に ok と行番号とふだを返す', naka.indexOf("return {status:'ok', row:newRow, key:_key};") >= 0);
ok('②中身は最初に「注文の中身が空です」を見る', naka.indexOf("if(!order) return {status:'error', message:'注文の中身が空です'};") >= 0);
ok('②別名の中身（oosYukaImportOrderNakami_ など）を作っていない', GAS.indexOf('oosYukaImportOrderNakami_') < 0);
['oosBasaraOrderAccept_', 'oosYoyakuListGo_', 'oosYukaRoundTrip', 'oosRtIkki'].forEach(function(nm){
  ok('②' + nm + ' は oosYukaImportOrder( を呼ぶ', cutFn(GAS, nm).indexOf('oosYukaImportOrder(') >= 0);
});
ok('②doPost の yukaImportOrder も同じ入口を通る', GAS.indexOf("'yukaImportOrder') return oosYukaImportOrder(") >= 0);

/* ── ③ 同時に走りうる「行を足す」場所は、全部かぎ係を通す ── */
const basho = {
  'basaraAppendOrderRow_': 'oosKagiDe_(function(){ sheet.appendRow(row); }, { nageru:true });',
  'oosRtbLogAdd':          'return oosKagiDe_(function(){',
  'oosYoyakuListAdd':      'return oosKagiDe_(nakami, opt);',
  'oosSeikyuHakkoAdd_':    'oosKagiDe_(function(){',
  'oosBasaraOrderAccept_': 'if(sm) oosKagiDe_(function(){'
};
Object.keys(basho).forEach(function(nm){
  const b = cutFn(GAS, nm);
  ok('③' + nm + ' はかぎ係を通して行を足す', b.indexOf(basho[nm]) >= 0);
  ok('③' + nm + ' は自前の鍵を持たない', b.indexOf('LockService') < 0);
});
ok('③oosYoyakuListAdd の中身（数えて書く）は なかみ の中にある',
   (function(){ const b = cutFn(GAS, 'oosYoyakuListAdd'); const i = b.indexOf('nakami(){'); return i > 0 && b.slice(i).indexOf('var newRow = Math.max(last, 2) + 1;') >= 0; })());
ok('③oosSeikyuHakkoAdd_ の「最後の行＋1」は かぎ係 の中にある',
   (function(){ const b = cutFn(GAS, 'oosSeikyuHakkoAdd_'); return b.indexOf('oosKagiDe_(function(){') < b.indexOf('Math.max(s.getLastRow()+1, 3)'); })());
ok('③御請求明細の「最後の行＋1」は かぎ係 の中にあり、鍵がとれなくても受付を止めない',
   (function(){ const b = cutFn(GAS, 'oosBasaraOrderAccept_'); const i = b.indexOf('if(sm) oosKagiDe_(function(){'); return i > 0 && b.slice(i).indexOf('var r2 = sm.getLastRow()+1;') >= 0 && b.slice(i).indexOf('}, { kagiNashiDemo:true });') >= 0; })());
ok('③受注データの appendRow は かぎ係 の中だけ（外にむき出しの appendRow(row) が無い）',
   cutFn(GAS, 'basaraAppendOrderRow_').split('appendRow(').length - 1 === 1);

/* ── ④ 鍵を持ったまま、鍵つきの関数を呼ばない（自分の鍵を自分で待たない）── */
const fnAt = [];
const lines = GAS.split('\n');
lines.forEach(function(l, i){ const m = l.match(/^function\s+([A-Za-z0-9_$]+)\s*\(/); if (m) fnAt.push([i, m[1]]); });
const kagiTsuki = ['oosKagiDe_', 'oosYukaImportOrder', 'basaraAppendOrderRow_', 'oosRtbLogAdd', 'oosYoyakuListAdd', 'oosSeikyuHakkoAdd_'];
const nijuu = [];
fnAt.forEach(function(x, idx){
  const nm = x[1]; if (nm === 'oosKagiDe_') return;
  const e = idx + 1 < fnAt.length ? fnAt[idx + 1][0] : lines.length;
  const b = lines.slice(x[0], e).join('\n');
  if (b.indexOf('LockService.getScriptLock()') < 0) return;         /* 自前の鍵を持つ関数だけ見る */
  kagiTsuki.forEach(function(t){
    if (b.indexOf(t + '(') < 0) return;
    if (nm === 'oosRtIkki' && t === 'oosYukaImportOrder' && b.indexOf('oosYukaImportOrder(yo, { kagiSumi:true })') >= 0) return;   /* 印つきで呼ぶ＝OK */
    nijuu.push(nm + '→' + t);
  });
});
ok('④自前の鍵を持つ関数が、かぎ係つきの関数を印なしで呼んでいない', nijuu.length === 0, '（' + nijuu.join(' / ') + '）');
const rt = cutFn(GAS, 'oosRtIkki');
ok('④oosRtIkki は自分で鍵をかけている', rt.indexOf('LockService.getScriptLock()') >= 0 && rt.indexOf('waitLock(60000)') >= 0);
ok('④oosRtIkki は { kagiSumi:true } を渡して二重にかけない', rt.indexOf('oosYukaImportOrder(yo, { kagiSumi:true })') >= 0);
ok('④サンプル台帳の自動追加は、呼ぶ側（oosSampleList 等）が鍵を持っている', /lock\.waitLock\(20000\);\s*tashita = oosSampleJidou_\(sh\);/.test(GAS));

/* ── ⑤ 本物の かぎ係 を動かして確かめる ─────────────────── */
function run(opt, nakamiFn){
  const log = [];
  const sandbox = {
    LockService: { getScriptLock: function(){ return {
      waitLock: function(ms){ log.push('wait:' + ms); if (opt.konde) throw new Error('timeout'); },
      releaseLock: function(){ log.push('release'); } }; } },
    SpreadsheetApp: { flush: function(){ log.push('flush'); } },
    Logger: { log: function(){ log.push('log'); } },
    Error: Error,
    __nakami: function(){ log.push('nakami'); return nakamiFn(); },
    __out: null
  };
  vm.createContext(sandbox);
  vm.runInContext(kakari + '\n__out = (function(){ try{ return oosKagiDe_(__nakami, ' + JSON.stringify(opt.opt || null) + '); }catch(e){ return {threw:String(e.message)}; } })();', sandbox);
  return { out: sandbox.__out, log: log };
}
let r = run({}, function(){ return {status:'ok', row:48}; });
ok('⑤ふつう：待つ→中身→flush→鍵を返す、の順', r.log.join('>') === 'wait:30000>nakami>flush>release', '（いま ' + r.log.join('>') + '）');
ok('⑤ふつう：中身の答えがそのまま返る', r.out && r.out.status === 'ok' && r.out.row === 48);
r = run({ opt:{ byou:5 } }, function(){ return 1; });
ok('⑤byou で待つ秒数を変えられる', r.log[0] === 'wait:5000' && r.out === 1);
r = run({}, function(){ throw new Error('書けなかった'); });
ok('⑤中身が失敗しても鍵は必ず返す', r.log.indexOf('release') >= 0 && r.out && r.out.threw === '書けなかった');
r = run({ konde:true }, function(){ return {status:'ok'}; });
ok('⑤混んでいて鍵がとれない：中身を動かさず error を返す', r.out && r.out.status === 'error' && r.log.indexOf('nakami') < 0 && /もう一度お試しください/.test(r.out.message));
r = run({ konde:true, opt:{ nageru:true } }, function(){ return 1; });
ok('⑤混んでいて nageru：例外を投げ、中身は動かさない', r.out && /もう一度お試しください/.test(r.out.threw) && r.log.indexOf('nakami') < 0);
r = run({ konde:true, opt:{ kagiNashiDemo:true } }, function(){ return {status:'ok', row:9}; });
ok('⑤混んでいて kagiNashiDemo：鍵なしで中身を動かし、鍵は返さない（持っていない）', r.out && r.out.row === 9 && r.log.indexOf('nakami') >= 0 && r.log.indexOf('release') < 0);
r = run({ opt:{ kagiSumi:true } }, function(){ return {status:'ok', row:50}; });
ok('⑤kagiSumi：鍵をかけずに中身だけ動く', r.log.join('>') === 'nakami' && r.out && r.out.row === 50, '（いま ' + r.log.join('>') + '）');

/* ── ⑥ 本物の発注書の入口も、かぎ係ごと動かす ─────────── */
(function(){
  const log = [];
  const sandbox = {
    LockService: { getScriptLock: function(){ return { waitLock: function(ms){ log.push('wait'); }, releaseLock: function(){ log.push('release'); } }; } },
    SpreadsheetApp: { flush: function(){ log.push('flush'); } },
    Logger: { log: function(){} }, Error: Error,
    oosYukaFile_: function(){ log.push('file'); return null; },
    __out: null
  };
  vm.createContext(sandbox);
  vm.runInContext(kakari + '\n' + fn + '\n__out = oosYukaImportOrder({num:"X"}, null);', sandbox);
  ok('⑥発注書の入口：待つ→中身→flush→鍵を返す、の順で、中身の答えが返る',
     log.join('>') === 'wait>file>flush>release' && sandbox.__out && sandbox.__out.status === 'error' && /運用コピー/.test(sandbox.__out.message), '（いま ' + log.join('>') + '）');
})();

/* ── 結果 ───────────────────────────────────────────────── */
const title = '🔑 行を足すときの かぎ係（2件同時の☑で行が消えた事故の再発防止・2026-11-13）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
