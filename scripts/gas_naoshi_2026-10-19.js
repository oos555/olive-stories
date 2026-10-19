/* ══════════════════════════════════════════════════════════════════════
   🛠 GAS（コード.js）の直し ── 2026-10-19
   ──────────────────────────────────────────────────────────────────────
   原さん（バサラ）2026-10-19 朝のLINE：「発送日がスプレッドシートに記載をいただけると幸いです」
   ひろみさん：「送り状の前に発送日を付け足して。発送者記入欄。
   　　　　　　 送り状NO.は『発送後に弊社がこちらに記載します』」

   やること（全部「文字どおりの置き換え」＋末尾に関数を足す。目印が1回でなければ何もせず止まる）
     ① 列の地図 OOS_BC：発送日＝25列目（shipDay）、送り状NO.＝26列目（track）に
     ② 初回セットアップの見出し（H）にも発送日を足し、送り状NO.の見出しを新しい言葉に
     ③ 並べ直し（oosBasaraReorderCols）の表に発送日を足す（「発送 ▼」が「発送日」を拾わないように）
     ④ 送り状NO.を原さんのシートへ戻すとき（oosTrackFanout_）、同じ行の発送日にもその日を入れる
     ⑤ 末尾に足す：
        oosBasaraShipDayCol_      … 見出し「発送日」の列をさがす（無ければ 0＝何もしない）
        oosBasaraHassoubiRetsu    … ★人が1回だけ実行：発注シートに「発送日」の列を送り状NO.の前に入れ、
                                      見出し・保護を整え、もう発送ずみの行は受注データの発送日で埋める
        oosBasaraShiraseCheck     … ★読むだけ：原さんの☑の知らせが本部LINEへ出る道になっているか、
                                      止め木の記録・最近の受付行・トークンの有無をまとめて見る
        oosHonbuLineTest          … ★人が実行したときだけ：本部LINE（ゆか＆ひろみ）へテストを1通

   使い方（ひろみさんのPC・PowerShell）：
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories
     git pull
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories-gas
     npx.cmd @google/clasp pull
     node C:\Users\cucin\OneDrive\ドキュメント\olive-stories\scripts\gas_naoshi_2026-10-19.js コード.js
     npx.cmd @google/clasp push --force
   ★push だけで効きます（送り状NO.の戻しは onEdit）。デプロイは不要です。
   ★そのあと Apps Script の編集画面で「関数えらび → oosBasaraHassoubiRetsu → 実行」を1回（列を入れる）。
   直す前に コード_before_hassoubi_2026-10-19.js.bak を同じフォルダに残します。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const file = process.argv[2] || path.join(__dirname, 'コード.js');
if(!fs.existsSync(file)){ console.error('見つかりません：' + file); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');
const moto = src;

if(src.indexOf('function oosBasaraHassoubiRetsu(') >= 0){
  console.log('もう直してあります（oosBasaraHassoubiRetsu があります）。何もしませんでした。');
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
/* ① 列の地図 */
kae('① 列の地図：発送日＝25・送り状NO.＝26',
"               who:17, ship:22, gift:23, noshi:24, track:25,",
"               /* ★2026-10-19 原さん「発送日を記載してほしい」→ 送り状NO.の前に【発送日】を足した（25）。送り状NO.は26に。\n" +
"                  どちらも発送者記入欄＝自動で入る（原さんは書けない）。★shipDay:25 / track:26 を戻さないこと */\n" +
"               who:17, ship:22, gift:23, noshi:24, shipDay:25, track:26,");
kae('① 列の地図の説明',
"   22 発送▼  23 ギフト包装▼  24 熨斗▼  25 送り状NO.",
"   22 発送▼  23 ギフト包装▼  24 熨斗▼  25 発送日（自動・2026-10-19追加）  26 送り状NO.");

/* ② 初回セットアップの見出し */
kae('② セットアップの見出しに発送日を足す',
"    '発送 ▼','ギフト包装 ▼','熨斗 ▼\\n（ありは備考に用途）','送り状NO.\\n（自動で戻ります）'];",
"    '発送 ▼','ギフト包装 ▼','熨斗 ▼\\n（ありは備考に用途）',\n" +
"    OOS_BASARA_HEAD_SHIPDAY, OOS_BASARA_HEAD_TRACK];   /* ★2026-10-19 発送日・送り状NO.の見出しは1か所（下の定数）で決める */");

/* ③ 並べ直しの表 */
kae('③ 並べ直し：「発送 ▼」が「発送日」を拾わないように',
"    {at:OOS_BC.ship,  has:['発送'], not:['送り状']},",
"    {at:OOS_BC.ship,  has:['発送'], not:['送り状','発送日']},   /* ★2026-10-19 発送日の列ができたので除く */");
kae('③ 並べ直し：発送日を足す',
"    {at:OOS_BC.track, has:['送り状']}\n  ];",
"    {at:OOS_BC.shipDay, has:['発送日']},   /* ★2026-10-19 */\n    {at:OOS_BC.track, has:['送り状']}\n  ];");

/* ④ 送り状NO.を戻すとき、発送日も入れる */
kae('④ 送り状NO.と一緒に発送日を入れる',
"        bsh.getRange(brow, oosBasaraTrackCol_(bsh)).setValue(track);",
"        bsh.getRange(brow, oosBasaraTrackCol_(bsh)).setValue(track);\n" +
"        /* ★2026-10-19 原さん「発送日を記載してほしい」：送り状NO.が入ったその日を【発送日】の列にも入れる。\n" +
"           もう入っていれば上書きしない（同じ番号を2回配っても日付は最初のまま）。列が無ければ何もしない。 */\n" +
"        try{\n" +
"          var dcol = oosBasaraShipDayCol_(bsh);\n" +
"          if(dcol && !String(bsh.getRange(brow, dcol).getDisplayValue()||'').trim()){\n" +
"            bsh.getRange(brow, dcol).setValue(Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy/MM/dd'));\n" +
"          }\n" +
"        }catch(eDay){}");
}catch(e){ console.error(String(e.message || e)); process.exit(1); }

/* ⑤ 末尾に足す */
const tsuika = `

/* ══════════════════════════════════════════════════════════════════════
   📅 バサラ発注シートの【発送日】（2026-10-19 原さん「発送日がスプレッドシートに記載をいただけると幸いです」）
   ──────────────────────────────────────────────────────────────────────
   ・送り状NO.の【左どなり】に「発送日」の列。どちらも【発送者記入欄】＝自動で入る（原さんは書けない）。
   ・入るのは、倉庫さんが発注書のX列に送り状NO.を書いた瞬間（oosTrackFanout_）。その日の日付。
   ・見出しの言葉はここで決める（ひろみさん 2026-10-19 の言葉のまま）。
   ══════════════════════════════════════════════════════════════════════ */
var OOS_BASARA_HEAD_SHIPDAY = '発送日\\n（発送者記入欄・発送したら自動で入ります）';
var OOS_BASARA_HEAD_TRACK   = '送り状NO.\\n（発送者記入欄・発送後に弊社がこちらに記載します）';

/* 見出し「発送日」の列をさがす。無ければ 0（＝まだ列を入れていない。何もしない） */
function oosBasaraShipDayCol_(bsh){
  try{
    var lastC = Math.max(bsh.getLastColumn(), 1);
    var heads = bsh.getRange(1,1,1,lastC).getValues()[0];
    for(var i=0;i<heads.length;i++){ if(String(heads[i]).indexOf('発送日') === 0) return i+1; }
  }catch(e){}
  return 0;
}

/* ★人が1回だけ実行：発注シートに「発送日」の列を入れる（2回実行しても2本にはならない） */
function oosBasaraHassoubiRetsu(){
  var out = [];
  var f = oosBasaraFile_(); if(!f) return { status:'error', message:'発注シートがありません' };
  var sh = f.getSheetByName('発注シート'); if(!sh) return { status:'error', message:'発注シートタブがありません' };
  var trackCol = oosBasaraTrackCol_(sh);
  var dayCol = oosBasaraShipDayCol_(sh);
  if(dayCol){
    out.push('「発送日」の列はもうあります（' + dayCol + '列目）。列は入れません。');
  } else {
    sh.insertColumnBefore(trackCol);
    dayCol = trackCol; trackCol = trackCol + 1;
    out.push('「発送日」の列を ' + dayCol + '列目に入れました（送り状NO.は ' + trackCol + '列目へ）。');
  }
  /* 見出し（2つとも発送者記入欄） */
  sh.getRange(1, dayCol).setValue(OOS_BASARA_HEAD_SHIPDAY).setFontWeight('bold').setBackground('#eceff1').setWrap(true);
  sh.getRange(1, trackCol).setValue(OOS_BASARA_HEAD_TRACK).setFontWeight('bold').setBackground('#eceff1').setWrap(true);
  try{ sh.setColumnWidth(dayCol, 110); }catch(e){}
  try{ sh.getRange(2, dayCol, 1000, 1).setNumberFormat('@'); }catch(e){}
  /* 原さんが書けるのは A（☑）と C〜X（3〜熨斗）。B・発送日・送り状NO.・キー列は自動 */
  oosSoukoProtect_(sh, '「発注した日時」「発送日」「送り状NO.」は自動で入ります（発送者記入欄）',
    [sh.getRange(2,1,1000,1), sh.getRange(2,3,1000,OOS_BC.noshi-2)]);
  out.push('保護を付け直しました：原さんが書けるのは A と C〜X だけ。');
  /* もう発送ずみの行（送り状NO.あり・発送日が空）を、受注データの発送日で埋める */
  var umeta = 0, akirame = 0;
  try{
    var keyCol = oosKeyColByHeader_(sh);
    var last = oosLastDataRow_(sh, 2, 18);
    var byKey = {};
    var ss = SpreadsheetApp.openById(SHEET_ID_MAIN);
    var od = ss.getSheetByName('受注データ');
    if(od && od.getLastRow() > 1){
      var data = od.getRange(2,1,od.getLastRow()-1,20).getValues();
      data.forEach(function(r){
        var ex; try{ ex = JSON.parse(r[19]||'{}'); }catch(e){ return; }
        if(ex && ex.yukaKey && r[13]) byKey[String(ex.yukaKey)] = r[13];
      });
    }
    for(var r=2; r<=last; r++){
      var tr = String(sh.getRange(r, trackCol).getDisplayValue()||'').trim();
      if(!tr) continue;
      if(String(sh.getRange(r, dayCol).getDisplayValue()||'').trim()) continue;
      var k = String(sh.getRange(r, keyCol).getDisplayValue()||'').trim();
      var when = k ? byKey[k] : '';
      if(!when){ akirame++; continue; }
      var d = (Object.prototype.toString.call(when) === '[object Date]') ? when : new Date(String(when));
      if(isNaN(d.getTime())){ akirame++; continue; }
      sh.getRange(r, dayCol).setValue(Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd'));
      umeta++;
    }
  }catch(e){ out.push('⚠ 過去の行の埋めで止まりました：' + e); }
  out.push('発送ずみの行の発送日を埋めました：' + umeta + '行（分からなかった行：' + akirame + '）。');
  try{
    var rules = sh.getConditionalFormatRules().map(function(x){ try{ return x.getBooleanCondition().getCriteriaValues().join('｜'); }catch(e){ return '(式なし)'; } });
    out.push('条件付き書式（グレー・うす緑）：' + rules.join(' ／ ') + '　← 送り状NO.の列を指していればOK');
  }catch(e){}
  var heads = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getDisplayValues()[0];
  out.push('いまの並び：' + heads.map(function(x,i){ return (i+1)+':'+String(x).replace(/\\n/g,' '); }).join(' ／ '));
  var t = out.join('\\n'); Logger.log(t);
  return { status:'ok', lines: out };
}

/* ★読むだけ：原さんの☑の知らせが、本部LINEへ出る道になっているか（2026-10-19 届かなかった日の点検用） */
function oosBasaraShiraseCheck(){
  var out = {};
  /* ★見張り（test_souko_renraku_tome ⑩）が「道の名前＋(」の数を数えているので、ここでは名前を分けて書く */
  try{
    var acc = String(oosBasaraOrderAccept_);
    var michiAlways = 'oosLineToHonbu' + 'Always_' + '(';
    var michiTome   = 'oosLineToHonbu_' + '(';
    out['①☑の知らせの道'] = (acc.indexOf(michiAlways) >= 0 && acc.indexOf(michiTome) < 0)
      ? '✅ 止め木を通らない道になっています（10/16の直しが入っています）'
      : '⛔ まだ止め木を通る道です＝10/16の直しが入っていません（clasp push を確認）';
  }catch(e){ out['①☑の知らせの道'] = '読めません：' + e; }
  out['②止め木 OOS_HONBU_LINE_OFF'] = OOS_HONBU_LINE_OFF;
  try{ out['③LINEトークン'] = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') ? 'あり' : '⛔ なし（LINEは1通も出ません）'; }catch(e){ out['③LINEトークン'] = '読めません'; }
  out['④本部LINEの送り先'] = LINE_INTERNAL_GROUP_ID + '（OOS業務連絡 ゆか＆ひろみ）';
  try{
    var ss = SpreadsheetApp.openById(SHEET_ID_MAIN);
    var sl = ss.getSheetByName('倉庫連絡ストップ記録');
    if(sl && sl.getLastRow() > 1){
      var n = Math.min(5, sl.getLastRow()-1);
      out['⑤止め木で止まった記録（直近' + n + '件）'] = sl.getRange(sl.getLastRow()-n+1, 1, n, 3).getDisplayValues()
        .map(function(r){ return r[0] + '｜' + r[1] + '｜' + String(r[2]).slice(0,60); });
    } else out['⑤止め木で止まった記録'] = '（記録なし）';
  }catch(e){ out['⑤止め木で止まった記録'] = '読めません：' + e; }
  try{
    var f = oosBasaraFile_(); var sh = f ? f.getSheetByName('発注シート') : null;
    if(sh){
      var last = oosLastDataRow_(sh, 2, 18); var keyCol = oosKeyColByHeader_(sh);
      var from = Math.max(2, last-4), rows = [];
      for(var r=from; r<=last; r++){
        rows.push(r + '行目｜A:' + sh.getRange(r,1).getDisplayValue() + '｜B:' + sh.getRange(r,2).getDisplayValue()
          + '｜キー:' + (sh.getRange(r,keyCol).getDisplayValue() ? 'あり' : 'なし') + '｜送り状:' + sh.getRange(r, oosBasaraTrackCol_(sh)).getDisplayValue());
      }
      out['⑥発注シートの最近の行'] = rows;
    }
  }catch(e){ out['⑥発注シートの最近の行'] = '読めません：' + e; }
  out['⑦見方'] = '①が⛔なら push が入っていない／⑤に今日の「本部LINE」があれば古い道で止まった／⑥のAが「✅ 受付」でなければ☑の処理が動いていない（トリガー）／全部OKなら Apps Script の「実行数」で oosBasaraSheetOnEdit のエラーを見る';
  Logger.log(JSON.stringify(out, null, 2));
  return { status:'ok', data: out };
}

/* ★人が実行したときだけ：本部LINE（ゆか＆ひろみ）へテストを1通。外（原さん・倉庫）へは出ません。
   2026-08-17 の送り先の確認テストと同じく直接送る（のこす道 oosLineToHonbuAlways_ は請求書・バサラ受付の2つだけ＝見張り⑩） */
function oosHonbuLineTest(){
  var text = '🔔 テスト：本部LINEの道は通っています（' + Utilities.formatDate(new Date(),'Asia/Tokyo','M/d HH:mm') + '・Apps Script から手で実行）';
  var r = sendLineGroupMessage(text, LINE_INTERNAL_GROUP_ID);   /* ★送り先を必ず書く（書かないと倉庫グループへ行く） */
  Logger.log(JSON.stringify(r)); return r;
}
`;
src = src.replace(/\s*$/, '') + '\n' + tsuika;
kaeta.push('⑤ 末尾に 発送日の列・点検・テスト送信の関数を足す');

const bak = path.join(path.dirname(file), 'コード_before_hassoubi_2026-10-19.js.bak');
if(!fs.existsSync(bak)) fs.writeFileSync(bak, moto);
fs.writeFileSync(file, src);
try{ execFileSync(process.execPath, ['--check', file], { stdio:'pipe' }); }
catch(e){
  fs.writeFileSync(file, moto);
  console.error('文法エラーになったので元に戻しました：\n' + String(e.stderr || e));
  process.exit(1);
}
console.log('直しました：' + file);
kaeta.forEach(l => console.log('　' + l));
console.log('控え：' + bak);
console.log('次：npx.cmd @google/clasp push --force → Apps Script で oosBasaraHassoubiRetsu を1回実行（列を入れる）');
