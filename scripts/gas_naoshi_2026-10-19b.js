/* ══════════════════════════════════════════════════════════════════════
   🛠 GAS（コード.js）の直し ── 2026-10-19 その2：見張りを Head に戻す
   ──────────────────────────────────────────────────────────────────────
   2026-10-19 実測（Apps Script「実行数」の「導入」の列）：
     basaraWatchV2 ＝ Head（保存した最新で動く）
     oosBasaraSheetOnEdit・oosBasaraSync・oosHonbuSync・oosImaHassouJikan・oosSampleJidouTimer ＝ バージョン 416
   → 10/05 に見張りを【Webアプリの窓口（?action=oosMihariSeiri）】から作り直したため、
     作られた見張りは「そのときのデプロイの版」に固定され、clasp push（Head）の直しを見ていなかった。
     10/16 の「原さんの☑ → 本部LINE」が 10/19 に効かなかった本当の原因はこれ。
   ★決まり：見張り（トリガー）は【必ず編集画面から】作る。Webアプリ経由で作らない。

   やること
     ① doGet の ?action=oosMihariSeiri を【読むだけ】にする（Webアプリ経由では作り直せないようにする）
     ② 末尾に oosMihariHeadNiModosu を足す：決めごとの表（OOS_MIHARI_KIMARI）の見張りを全部消して、
        編集画面から作り直す（＝Head）。★編集画面の「関数えらび」から実行すること。

   使い方（ひろみさんのPC・PowerShell）：
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories
     git pull
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories-gas
     npx.cmd @google/clasp pull
     node C:\Users\cucin\OneDrive\ドキュメント\olive-stories\scripts\gas_naoshi_2026-10-19b.js コード.js
     npx.cmd @google/clasp push --force
   そのあと Apps Script の編集画面で「関数えらび → oosMihariHeadNiModosu → 実行」。
   直す前に コード_before_head_2026-10-19.js.bak を同じフォルダに残します。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const file = process.argv[2] || path.join(__dirname, 'コード.js');
if(!fs.existsSync(file)){ console.error('見つかりません：' + file); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');
const moto = src;

if(src.indexOf('function oosMihariHeadNiModosu(') >= 0){
  console.log('もう直してあります（oosMihariHeadNiModosu があります）。何もしませんでした。');
  process.exit(0);
}
const kaeta = [];
function kae(namae, a, b){
  const n = src.split(a).length - 1;
  if(n !== 1) throw new Error(namae + '：目印が ' + n + ' 回見つかりました（1回のはず）。何も変えていません。\n目印：' + a.slice(0, 80));
  src = src.split(a).join(b);
  kaeta.push(namae);
}
try{
kae('① Webアプリ経由の oosMihariSeiri は読むだけに',
"    if(action === 'oosMihariSeiri'){ return makeResponse(oosMihariSeiri(e.parameter.dry === '1')); }",
"    /* ★2026-10-19 Webアプリ経由では【読むだけ】。ここから見張りを作ると、そのときのデプロイの版に固定され、\n" +
"       clasp push（Head）の直しが効かなくなる（10/19 に実測）。作り直すのは編集画面から oosMihariHeadNiModosu。 */\n" +
"    if(action === 'oosMihariSeiri'){ return makeResponse(oosMihariSeiri(true)); }");
}catch(e){ console.error(String(e.message || e)); process.exit(1); }

const tsuika = `

/* ══════════════════════════════════════════════════════════════════════
   🔁 見張りを Head（保存した最新のコード）に戻す（2026-10-19）
   ──────────────────────────────────────────────────────────────────────
   実測：Webアプリ（doGet）経由で作った見張りは、作った瞬間のデプロイの版（例：バージョン 416）に固定される。
   その見張りは clasp push で直しても古い版のまま動く。10/16 の本部LINEの直しが 10/19 に効かなかった原因。
   ★この関数は【編集画面の「関数えらび」から】実行すること。そうすると作り直した見張りは Head になる。
   ★Webアプリ経由（doGet）からは呼ばない（また版に固定される）。
   やること：決めごとの表（OOS_MIHARI_KIMARI）にある見張りと古い見張りを全部消し、oosMihariSeiri(false) で入れ直す。
   一時のもの（oosSoukoMatomeSend・oosHakkouAto）と見覚えのないものは触らない。
   ══════════════════════════════════════════════════════════════════════ */
function oosMihariHeadNiModosu(){
  var kimari = {}; OOS_MIHARI_KIMARI.forEach(function(k){ kimari[k.fn] = true; });
  var keshita = [];
  ScriptApp.getProjectTriggers().forEach(function(t){
    var fn = String(t.getHandlerFunction() || '');
    if(kimari[fn] || OOS_MIHARI_FURUI[fn]){ ScriptApp.deleteTrigger(t); keshita.push(fn); }
  });
  var r = oosMihariSeiri(false);
  var lines = ['消した見張り：' + (keshita.length ? keshita.join('、') : '（なし）'), ''].concat(r.lines);
  lines.push('');
  lines.push('★確かめ方：左の「実行数」で、次に動いた見張りの「導入」が【Head】になっていればOK（「バージョン ◯◯」なら、Webアプリ経由で作られています）');
  Logger.log(lines.join('\\n'));
  return { status:'ok', 消した:keshita, 入れた:r.入れた, lines:lines };
}
`;
src = src.replace(/\s*$/, '') + '\n' + tsuika;
kaeta.push('② 末尾に oosMihariHeadNiModosu を足す');
const bak = path.join(path.dirname(file), 'コード_before_head_2026-10-19.js.bak');
if(!fs.existsSync(bak)) fs.writeFileSync(bak, moto);
fs.writeFileSync(file, src);
try{ execFileSync(process.execPath, ['--check', file], { stdio:'pipe' }); }
catch(e){ fs.writeFileSync(file, moto); console.error('文法エラーになったので元に戻しました：\n' + String(e.stderr || e)); process.exit(1); }
console.log('直しました：' + file);
kaeta.forEach(l => console.log('　' + l));
console.log('控え：' + bak);
console.log('次：npx.cmd @google/clasp push --force → Apps Script の編集画面で oosMihariHeadNiModosu を実行（見張りを Head に戻す）');
