/* ══════════════════════════════════════════════════════════════════════
   🛠 GAS（コード.js）の直し ── 2026-10-19 その3：発送日は送り状NO.のマスに一緒に書いてもらう
   ──────────────────────────────────────────────────────────────────────
   ひろみさん（2026-10-19）：「列を作るんじゃなくて、送り状のところに日にちを書いてもらおう。
   　今『佐川：4523…』って書いてもらってるから、ここに一緒に日にちも入れてください、でいい」
   「発送日は自動で入るようにして、だけど修正もできるようにして、そのことをちゃんとその枠のところに書いといて」

   やること
     ① 発注書のX列（送り状NO.）に書かれた文字を【日付】と【番号】に分ける係（oosHassouBiWake_）
        例「10/18 佐川：452334067721」→ 発送日 2026/10/18・送り状NO.「佐川：452334067721」
        日付が無ければ「書いた日」を発送日にする（自動）。
     ② 送り状NO.を書いたとき／発送済☑のとき、分けた結果を原さんのシートへ（発送日・送り状NO.）
        ・マスに日付が書いてあれば、原さんのシートの発送日をその日に【上書き】（＝直せる）
        ・日付が無ければ、まだ空のときだけ書いた日を入れる（もう入っていれば触らない）
     ③ 発注書のX列の見出しに「日にちも一緒に」と書く（oosYukaOkurijouMidashi・人が実行。oosBasaraHassoubiRetsu からも呼ぶ）

   使い方（ひろみさんのPC・PowerShell）：
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories
     git pull
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories-gas
     npx.cmd @google/clasp pull
     node C:\Users\cucin\OneDrive\ドキュメント\olive-stories\scripts\gas_naoshi_2026-10-19c.js コード.js
     npx.cmd @google/clasp push --force
   そのあと編集画面で「oosBasaraHassoubiRetsu」を1回実行（原さんのシートに発送日の列・発注書のX列の見出し）。
   ★gas_naoshi_2026-10-19.js（その1）を先に入れてあることが前提。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const file = process.argv[2] || path.join(__dirname, 'コード.js');
if(!fs.existsSync(file)){ console.error('見つかりません：' + file); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');
const moto = src;
if(src.indexOf('function oosBasaraHassoubiRetsu(') < 0){ console.error('先に gas_naoshi_2026-10-19.js（その1）を入れてください。何もしませんでした。'); process.exit(1); }
if(src.indexOf('function oosHassouBiWake_(') >= 0){ console.log('もう直してあります（oosHassouBiWake_ があります）。何もしませんでした。'); process.exit(0); }

const kaeta = [];
function kae(namae, a, b){
  const n = src.split(a).length - 1;
  if(n !== 1) throw new Error(namae + '：目印が ' + n + ' 回見つかりました（1回のはず）。何も変えていません。\n目印：' + a.slice(0, 80));
  src = src.split(a).join(b);
  kaeta.push(namae);
}
try{
/* ② 送り状NO.を書いたとき */
kae('② 送り状NO.を書いたとき：日付と番号に分けて配る',
"  var track = String(sh.getRange(row,OOS_YC.track).getDisplayValue()||'').trim();\n" +
"  if(!track) return;                                 // 消したときは何もしない（発送の取り消しは本部へ連絡）\n" +
"  var key = String(sh.getRange(row, oosKeyColByHeader_(sh)).getValue()||'');\n" +
"  if(key) oosTrackFanout_(key, track);",
"  var track = String(sh.getRange(row,OOS_YC.track).getDisplayValue()||'').trim();\n" +
"  if(!track) return;                                 // 消したときは何もしない（発送の取り消しは本部へ連絡）\n" +
"  /* ★2026-10-19 ひろみさん：発送日は送り状NO.のマスに一緒に書いてもらう（例「10/18 佐川：4523…」）。\n" +
"     日付と番号に分けて、原さんのシートの発送日・送り状NO.へ。日付が無ければ書いた日（自動）。 */\n" +
"  var wake = oosHassouBiWake_(track);\n" +
"  var key = String(sh.getRange(row, oosKeyColByHeader_(sh)).getValue()||'');\n" +
"  if(key) oosTrackFanout_(key, wake.track, wake.day);");
/* ② 発送済☑のとき */
kae('② 発送済☑のとき：同じく分けて配る',
"  if(key) oosTrackFanout_(key, track);               // 同じ番号の上書きなので二重でも壊れない",
"  var wake2 = oosHassouBiWake_(track);   /* ★2026-10-19 日付と番号に分ける */\n" +
"  if(key) oosTrackFanout_(key, wake2.track, wake2.day);   // 同じ番号の上書きなので二重でも壊れない");
/* ② 配る係：日付を受け取る */
kae('② 配る係：発送日を受け取る（書いてあれば上書き・無ければ空のときだけ）',
"function oosTrackFanout_(key, track){",
"function oosTrackFanout_(key, track, day){   /* ★2026-10-19 day＝X列に書かれた発送日（無ければ ''） */");
kae('② 配る係：発送日の入れ方',
"        try{\n" +
"          var dcol = oosBasaraShipDayCol_(bsh);\n" +
"          if(dcol && !String(bsh.getRange(brow, dcol).getDisplayValue()||'').trim()){\n" +
"            bsh.getRange(brow, dcol).setValue(Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy/MM/dd'));\n" +
"          }\n" +
"        }catch(eDay){}",
"        /* ★2026-10-19 ひろみさん「自動で入る・でも直せる」：\n" +
"           X列に日付が書いてあれば（day あり）その日で【上書き】＝倉庫さんが直せば原さんのシートも直る。\n" +
"           書いてなければ、まだ空のときだけ書いた日を入れる（もう入っていれば触らない）。 */\n" +
"        try{\n" +
"          var dcol = oosBasaraShipDayCol_(bsh);\n" +
"          if(dcol){\n" +
"            var sudeni = String(bsh.getRange(brow, dcol).getDisplayValue()||'').trim();\n" +
"            if(day) bsh.getRange(brow, dcol).setValue(day);\n" +
"            else if(!sudeni) bsh.getRange(brow, dcol).setValue(Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy/MM/dd'));\n" +
"          }\n" +
"        }catch(eDay){}");
/* ③ 列を入れる関数の最後で、発注書の見出しも直す */
kae('③ oosBasaraHassoubiRetsu の最後で発注書X列の見出しも直す',
"  var t = out.join('\\n'); Logger.log(t);\n  return { status:'ok', lines: out };\n}",
"  try{ var m = oosYukaOkurijouMidashi(); out.push('発注書X列の見出し：' + (m && m.message || m)); }catch(eM){ out.push('⚠ 発注書X列の見出しは直せませんでした：' + eM); }\n" +
"  var t = out.join('\\n'); Logger.log(t);\n  return { status:'ok', lines: out };\n}");
}catch(e){ console.error(String(e.message || e)); process.exit(1); }

const tsuika = `

/* ══════════════════════════════════════════════════════════════════════
   📅 発送日は送り状NO.のマスに一緒に書いてもらう（2026-10-19 ひろみさん）
   ──────────────────────────────────────────────────────────────────────
   発注書のX列（送り状NO.）の見出しと、日付と番号を分ける係。
   ★見出しの言葉はここで決める（ひろみさんの言葉のまま）。
   ══════════════════════════════════════════════════════════════════════ */
var OOS_YUKA_HEAD_TRACK = '送り状番号、発送日、発送業者名を記入してください（例：10/18 佐川：452334067721）\\n※日にちが無いときは書いた日が発送日になります。直すときはこのマスの日にちを直してください';

/* X列の文字を【発送日】と【送り状NO.】に分ける。
   日付の形：10/18・10-18・10.18・2026/10/18・10月18日（全角の数字も可）。先頭にあるものだけ日付と見る。
   年が無ければ今年。それが明日より先なら去年（12月に発送して1月に書いたとき）。
   返す形：{ day:'2026/10/18' または '', track:'佐川：452334067721' } */
function oosHassouBiWake_(text, now){
  var s = String(text || '').replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
                            .replace(/[／]/g, '/').replace(/[－ー]/g, '-').replace(/[　]/g, ' ').trim();
  /* ★2026-10-19 ひろみさん「送り状番号、発送日、発送業者名」の順で書かれることもあるので、日付は【どこにあっても】読む。
     ただし前後が区切り（先頭・末尾・空白・、,：:）のものだけ。番号の中の「23-10」などは日付と見ない。 */
  var re = /(^|[\\s、,：:])((?:\\d{4}[\\/\\-.年])?(\\d{1,2})[\\/\\-.月](\\d{1,2})日?)(?=$|[\\s、,：:])/;
  var m = s.match(re);
  if(!m) return { day:'', track:String(text || '').trim() };
  var base = now || new Date();
  var ym = m[2].match(/^(\\d{4})[\\/\\-.年]/);
  var y = ym ? Number(ym[1]) : base.getFullYear();
  var mo = Number(m[3]), d = Number(m[4]);
  if(!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return { day:'', track:String(text || '').trim() };
  var dt = new Date(y, mo - 1, d);
  if(!ym && dt.getTime() > base.getTime() + 24*60*60*1000) dt = new Date(y - 1, mo - 1, d);
  var day = Utilities.formatDate(dt, 'Asia/Tokyo', 'yyyy/MM/dd');
  var rest = (s.slice(0, m.index) + m[1] + s.slice(m.index + m[0].length)).replace(/\\s+/g, ' ').replace(/^[\\s、,：:]+|[\\s、,：:]+$/g, '').trim();
  return { day: day, track: rest || String(text || '').trim() };
}

/* ★人が実行（oosBasaraHassoubiRetsu からも呼ばれる）：発注書のX列の見出しを「日にちも一緒に」に直す */
function oosYukaOkurijouMidashi(){
  var yuka = oosYukaFile_(); if(!yuka) return { status:'error', message:'発注書のファイルがありません' };
  var sh = yuka.getSheetByName(OOS_YUKA_SHEET); if(!sh) return { status:'error', message:'発注書タブがありません' };
  var col = oosYukaSoukoRetsu_(sh).track;
  var before = String(sh.getRange(1, col).getDisplayValue() || '');
  sh.getRange(1, col).setValue(OOS_YUKA_HEAD_TRACK).setWrap(true);
  try{ sh.setColumnWidth(col, Math.max(sh.getColumnWidth(col), 220)); }catch(e){}
  return { status:'ok', message: col + '列目の見出しを直しました（前：' + before.replace(/\\n/g,' ') + '）' };
}
`;
src = src.replace(/\s*$/, '') + '\n' + tsuika;
kaeta.push('①③ 末尾に oosHassouBiWake_（分ける係）・oosYukaOkurijouMidashi（見出し）を足す');
const bak = path.join(path.dirname(file), 'コード_before_hassoubi2_2026-10-19.js.bak');
if(!fs.existsSync(bak)) fs.writeFileSync(bak, moto);
fs.writeFileSync(file, src);
try{ execFileSync(process.execPath, ['--check', file], { stdio:'pipe' }); }
catch(e){ fs.writeFileSync(file, moto); console.error('文法エラーになったので元に戻しました：\n' + String(e.stderr || e)); process.exit(1); }
console.log('直しました：' + file);
kaeta.forEach(l => console.log('　' + l));
console.log('控え：' + bak);
console.log('次：npx.cmd @google/clasp push --force → 編集画面で oosBasaraHassoubiRetsu を1回実行');
