/* 文法の見張り（2026-08-20 追加）

   ★なぜ足したか
   2026-08-20 の夜、index.html の中の文字列に改行が紛れ込んで【文法エラー】になったのに、
   そのとき 961項目のテストは全部PASSしていました。
   ほかのテストは「関数を1つずつ切り出して」動かすので、切り出さなかった場所が壊れていても気づけません。
   文法が壊れたファイルは【画面がまったく出なくなる】いちばん重い事故なので、
   ここで全ファイルをまとめて見張ります。

   ・すべての .html の中の <script>（外部ファイル読み込みは除く）
   ・すべての .js（テストと道具は除く）
   ★このテストを一覧から外さないでください。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0; const fails = [];
function ok(name){ pass++; }
function ng(name, msg){ fail++; fails.push(name + '　' + msg); }

/* ── ① すべての画面（.html）の中のスクリプト ── */
const htmls = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let scriptCount = 0;
htmls.forEach(function(f){
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0, bad = 0, lastMsg = '';
  while((m = re.exec(t))){
    const attrs = m[1] || '';
    const ty = (attrs.match(/type\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    if(ty && !/javascript|module/i.test(ty)) continue;      // JSON など JS でないものは飛ばす
    n++; scriptCount++;
    try{ new vm.Script(m[2]); }
    catch(e){ bad++; lastMsg = e.message; }
  }
  if(bad) ng('① ' + f + ' の文法', '（' + bad + 'か所）' + lastMsg);
  else ok('① ' + f + ' の文法');
});

/* ── ② 共通のスクリプト（.js） ── */
const jsFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
jsFiles.forEach(function(f){
  try{ new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8')); ok('② ' + f + ' の文法'); }
  catch(e){ ng('② ' + f + ' の文法', e.message); }
});

/* ── ③ 文字列の中に生の改行が入っていないか（今回の事故の形そのもの） ── */
htmls.concat(jsFiles).forEach(function(f){
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  /* alert(' … で始まって、その行のうちに閉じていないもの */
  const lines = t.split(/\r?\n/);
  let hit = 0;
  lines.forEach(function(L){
    const m = L.match(/alert\('([^']*)$/);
    if(m && L.indexOf("');") < 0 && !/\+\s*$/.test(L) && !/\\$/.test(L)) hit++;
  });
  if(hit) ng('③ ' + f + ' に閉じていない alert(\' がある', '（' + hit + '行）');
  else ok('③ ' + f);
});

/* ── ④ 見張りそのものが働いているか（わざと壊して確かめる） ── */
try{ new vm.Script("alert('こわれた\n文字列');"); ng('④ 見張りの自己確認', 'こわれた文字列を通してしまった'); }
catch(e){ ok('④ 見張りの自己確認'); }

console.log('===== 文法の見張り =====');
console.log('  画面 ' + htmls.length + '個／共通スクリプト ' + jsFiles.length + '個／<script> ' + scriptCount + '個 を確かめました');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ★ ' + f)); }
process.exit(fail ? 1 : 0);
