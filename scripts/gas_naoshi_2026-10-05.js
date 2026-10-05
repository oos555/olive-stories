/* ══════════════════════════════════════════════════════════════════════
   🛠 GAS（コード.js）の直し ── 2026-10-05
   ──────────────────────────────────────────────────────────────────────
   ひろみさん（2026-10-05）：
   「スプレッドシートに、また伝票番号の下にいろいろ詳細が出なくなってたりとか、
   　あと添付ファイルが貼り付いてないんだけど、なんでこんなことが起きてるのか…
   　見張りがいくつもあるから、その見張りが間違ったりとか古い見張りが作動したりしてると思うから、
   　見張りをチェックして、古いものがいくつもあるのであれば捨てて新しく更新するとか、
   　見張りの数も減らして機能をしっかりつけさせたものにしてほしい」

   使い方（ひろみさんのPC・PowerShell）：
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories-gas
     npx @google/clasp pull
     node gas_naoshi_2026-10-05.js コード.js
     npx @google/clasp push --force
     （Webアプリの分も効かせるとき）npx @google/clasp deploy -i AKfycbwRNgyNZ3HjU7nPSpxCn7uUiMu3MY6ZijEsCtB7Toj_7x9Fu1v5VFyMDLheNZAON4OV -d "2026-10-05 見張りの整理"

   やること（全部「文字どおりの置き換え」。見つかる回数が1回でなければ何もせずに止まります）
     ① oosYukaOnEdit の finally：🚚 いま発送する分の作り直しを【中身が変わる列】のときだけに
     ② oosYukaShipGo_：B列に「依頼／〆」を書けなかったら、A列のメモに残す（黙って通さない）
     ③ oosYukaOnEdit：▼で「発送してください（LINE通知済）」を直接えらんだ行も🔵と同じに
     ④ oosYukaSetDocLinks：発行記録の作り直しを、その場でやらず2分後に1回だけ（返事を軽く）
     ⑤ 昔の簡易トリガー onEdit（発注書16列目の色付け）を止める（名前を変えるだけ・中身は残す）
     ⑥ doGet に oosMihariIchiran / oosMihariSeiri の窓口を足す
     ⑦ 末尾に【見張りの決めごと】と 整理の関数を足す（oosMihariSeiri ほか）
   直す前に コード_before_mihari_2026-10-05.js.bak を同じフォルダに残します。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const file = process.argv[2] || path.join(__dirname, 'コード.js');
if(!fs.existsSync(file)){ console.error('見つかりません：' + file); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');
const moto = src;

if(src.indexOf('function oosMihariSeiri(') >= 0){
  console.log('もう直してあります（oosMihariSeiri があります）。何もしませんでした。');
  process.exit(0);
}

const kaeta = [];
function kae(namae, a, b){
  const n = src.split(a).length - 1;
  if(n !== 1) throw new Error(namae + '：目印が ' + n + ' 回見つかりました（1回のはず）。何も変えていません。\n目印：' + a.slice(0, 80));
  src = src.split(a).join(b);
  kaeta.push(namae);
}

/* ① finally の作り直しを絞る */
kae('① いま発送する分の作り直しは中身が変わる列だけ',
`    /* ★2026-09-28 発注書がさわられたら「🚚 いま発送する分」を作り直す（return のあとでも必ず通る） */
    try{ if(e && e.range && e.range.getSheet().getName() === OOS_YUKA_SHEET && e.range.getRow() >= 2) oosImaHassouTsukuru_(); }catch(eI){}`,
`    /* ★2026-09-28 発注書がさわられたら「🚚 いま発送する分」を作り直す（return のあとでも必ず通る） */
    /* ★2026-10-05 ひろみさん「見張りが多すぎて、間違ったり古いのが動いたりしている」：
       作り直すのは【タブの中身が変わる列】を直したときだけにしました（oosImaHassouIruKa_）。
       それまでは、送り状NO.・倉庫用メモ・本部用メモなど【どのマスを直しても】発注書の全行を読み直して
       タブを作り直していたので、倉庫さんが1マス書くたびに重い処理が走り、🔵の処理（在庫を引く・B列に依頼／〆を書く）や
       受注Ａからの取り込み・書類貼りが順番待ちで遅れ、「伝票番号の下の依頼／〆が出ない」「添付が貼られない」が起きていました。
       作り直すのは A〜K列（状態・伝票番号・商品・お届け先）・備考・発送済☑・❌キャンセル のときだけ。
       それ以外の列は、1時間ごとのタイマー（oosImaHassouJikan）がそろえます。★全列に戻さないでください。 */
    try{ if(oosImaHassouIruKa_(e)) oosImaHassouTsukuru_(); }catch(eI){}`);

/* ② 〆を書けなかったら見えるように */
kae('② 依頼／〆を書けなかったらA列のメモに残す',
`  try{ oosYukaKigenKaku_(sh, row, key, disp); }catch(eK){ try{ Logger.log('〆を書けませんでした：' + eK); }catch(_e){} }`,
`  try{ oosYukaKigenKaku_(sh, row, key, disp); }catch(eK){
    try{ Logger.log('〆を書けませんでした：' + eK); }catch(_e){}
    /* ★2026-10-05 黙って通さない：B列に書けなかったことをA列のメモに残す（ログは誰も見ないため） */
    try{ cell.setNote((cell.getNote()||'') + '\\n⚠️ B列に「依頼／〆」を書けませんでした：' + String(eK && eK.message ? eK.message : eK)); }catch(_e2){}
  }`);

/* ③ （LINE通知済）を直接えらんだ行 */
kae('③ ▼で（LINE通知済）を直接えらんでも🔵と同じ',
`      if(String(e.value||'') === OOS_YUKA_BTN_GO){ oosYukaShipGo_(sh, row); return; }
      /* ★2026-09-13 ↩️ アプリに差し戻す（ひろみさん指示）。★消さないでください */`,
`      if(String(e.value||'') === OOS_YUKA_BTN_GO){ oosYukaShipGo_(sh, row); return; }
      /* ★2026-10-05 ▼で「発送してください（LINE通知済）」を直接えらんだ行（まだ知らせていない行）も、🔵と同じに扱う。
         それまでは何も起きず（在庫も引かれず・B列に依頼／〆も書かれず・倉庫にも知らせず）、青いのに止まっていました。
         もう知らせた行（メモに📨がある）は、今までどおり何もしません。 */
      if(String(e.value||'') === OOS_YUKA_BTN_GO_TSUCHI && String(sh.getRange(row,1).getNote()||'').indexOf('📨') < 0){
        e.range.setValue(OOS_YUKA_BTN_GO); oosYukaShipGo_(sh, row); return;
      }
      /* ★2026-09-13 ↩️ アプリに差し戻す（ひろみさん指示）。★消さないでください */`);

/* ④ 書類リンクの返事を軽く */
kae('④ 発行記録の作り直しは2分後に1回だけ',
`  try{ oosSeikyuIchiranTsukuru(); }catch(eI){ try{ Logger.log("請求書一覧の作り直しに失敗: "+eI); }catch(e9){} }
  return {status:"ok", row:row, V列: moji, 入っている数: ima.length, あふれ: afure};`,
`  /* ★2026-10-05 ここで同期に作り直すのをやめ、2分後に1回だけまとめて作り直します（oosHakkouAtoYoyaku_）。
     発行記録の作り直しは、発注書の全行と受注データを読む重い処理です。受注Ａが「貼れたか」の返事を待つ時間が
     それだけ長くなり、混んでいるときはHTMLの404が返って「貼れませんでした」と出ていました（実物は貼れている）。
     「書類を貼ったとき」と「毎日5時台」の2つのきっかけは、そのまま残っています。★同期に戻さないでください。 */
  try{ oosHakkouAtoYoyaku_(); }catch(eI){ try{ Logger.log("発行記録の作り直しの予約に失敗: "+eI); }catch(e9){} }
  return {status:"ok", row:row, V列: moji, 入っている数: ima.length, あふれ: afure};`);

/* ⑤ 昔の簡易トリガーを止める */
kae('⑤ 昔の簡易トリガー onEdit を止める',
`function onEdit(e) {
  const sheet = e.source.getActiveSheet();`,
`/* ★2026-10-05 この簡易トリガーは【昔の発注書（16列目の☑）】のためのもので、いまの発注書は oosYukaOnEdit が見ています。
   メインのスプシを1マス直すたびに動いていたので、名前を変えて止めました（中身は消していません・戻すなら名前だけ戻す）。 */
function onEdit_furui_2026_10_05_(e) {
  const sheet = e.source.getActiveSheet();`);

/* ⑥ doGet の窓口 */
kae('⑥ doGet に見張りの点検・整理の窓口',
`    if(action === 'oosTriggerIchiran'){ return makeResponse(oosTriggerIchiran()); }`,
`    /* ★2026-10-05 見張り（自動実行）の点検と整理。oosMihariIchiran＝読むだけ／oosMihariSeiri＝整理する（&dry=1 で見るだけ） */
    if(action === 'oosMihariIchiran'){ return makeResponse(oosMihariIchiran()); }
    if(action === 'oosMihariSeiri'){ return makeResponse(oosMihariSeiri(e.parameter.dry === '1')); }
    if(action === 'oosTriggerIchiran'){ return makeResponse(oosTriggerIchiran()); }`);

/* ⑦ 末尾に足す */
const tsuika = `

/* ══════════════════════════════════════════════════════════════════════
   🛡 見張り（自動実行）の決めごとと、点検・整理　★2026-10-05
   ──────────────────────────────────────────────────────────────────────
   ひろみさん（2026-10-05）：「見張りがいくつもあるから、その見張りが間違ったりとか古い見張りが作動したりしてると思う。
   　見張りをチェックして、古いものがいくつもあるのであれば捨てて新しく更新するとか、
   　見張りの数も減らして機能をしっかりつけさせたものにしてほしい」

   ★ここが【自動実行の正本】です。どの見張りが要るか・要らないかは、この表だけを直します。
   　・oosMihariIchiran … 読むだけ。いま入っている自動実行を 要る／古い／二重／別ファイル／見覚えなし に分けて出す
   　・oosMihariSeiri   … 整理する。古いものを消す・二重を1本にする・別ファイルに付いたものを付け直す・足りないものを入れる
   　　　　　　　　　　　　（何回やっても同じ結果。dry=true なら見るだけ）
   　・oosMihariMiru／oosMihariNaosu … GASの編集画面から実行してログで見る（デプロイ不要）
   ★「見覚えのない」自動実行は消しません（報告だけ）。消すのはひろみさんの判断。
   ★新しい自動実行を足すときは、必ずこの表に1行足す。表に無いものは「見覚えなし」と報告されます。
   ══════════════════════════════════════════════════════════════════════ */
var OOS_MIHARI_KIMARI = [
  { fn:'basaraWatchV2',           shu:'time', naze:'30分おき：バサラの注文メールの取込と欠品の見張り（自動スイッチを通る）',
    tsukuru:function(){ ScriptApp.newTrigger('basaraWatchV2').timeBased().everyMinutes(30).create(); } },
  { fn:'oosDailyBackup',          shu:'time', naze:'毎日3時台：自動バックアップ（30個のこす）',
    tsukuru:function(){ ScriptApp.newTrigger('oosDailyBackup').timeBased().atHour(3).everyDays(1).create(); } },
  { fn:'weeklyBackup',            shu:'time', naze:'毎週月曜3時台：週のバックアップ（発注書olive-storiesも）',
    tsukuru:function(){ ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).create(); } },
  { fn:'oosRestockAutoApply',     shu:'time', naze:'毎朝6時台：臨時入庫を予定日に在庫へ反映',
    tsukuru:function(){ ScriptApp.newTrigger('oosRestockAutoApply').timeBased().atHour(6).everyDays(1).create(); } },
  { fn:'oosHonbuSync',            shu:'time', naze:'1時間ごと：本部・在庫シートを映し直す',
    tsukuru:function(){ ScriptApp.newTrigger('oosHonbuSync').timeBased().everyHours(1).create(); } },
  { fn:'oosBasaraSync',           shu:'time', naze:'1時間ごと：バサラ発注シートの▼リスト（入荷待ち表記）',
    tsukuru:function(){ ScriptApp.newTrigger('oosBasaraSync').timeBased().everyHours(1).create(); } },
  { fn:'oosBasaraInvoiceDaily',   shu:'time', naze:'毎晩23時台：月末の日だけバサラの請求書タブを作る',
    tsukuru:function(){ ScriptApp.newTrigger('oosBasaraInvoiceDaily').timeBased().atHour(23).everyDays(1).create(); } },
  { fn:'oosSeikyuIchiranTsukuru', shu:'time', naze:'毎日5時台：書類の発行記録を作り直す',
    tsukuru:function(){ ScriptApp.newTrigger('oosSeikyuIchiranTsukuru').timeBased().atHour(5).everyDays(1).create(); } },
  { fn:'oosHakkouLinkTenken',     shu:'time', naze:'毎週月曜6時台：発行記録のリンク切れ点検',
    tsukuru:function(){ ScriptApp.newTrigger('oosHakkouLinkTenken').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create(); } },
  { fn:'oosSampleJidouTimer',     shu:'time', naze:'1時間ごと：サンプルを送った注文を一覧に足す',
    tsukuru:function(){ ScriptApp.newTrigger('oosSampleJidouTimer').timeBased().everyHours(1).create(); } },
  { fn:'oosImaHassouJikan',       shu:'time', naze:'1時間ごと：🚚 いま発送する分を作り直す（日付が変わったら黄色に）',
    tsukuru:function(){ ScriptApp.newTrigger('oosImaHassouJikan').timeBased().everyHours(1).create(); } },
  { fn:'oosYukaOnEdit',           shu:'edit', naze:'入力のたび：倉庫＆OOS発送連絡スプシ（🔵・送り状NO.・発送済☑・❌キャンセル・請求書発行・予約リスト）',
    fileId:function(){ return PropertiesService.getScriptProperties().getProperty(OOS_YUKA_PROP_KEY) || ''; } },
  { fn:'oosKanriOnEdit',          shu:'edit', naze:'入力のたび：本部管理専用ゆかスプシ（請求書発行）',
    fileId:function(){ return oosKanriFileId_() || ''; } },
  { fn:'oosHonbuOnEdit',          shu:'edit', naze:'入力のたび：本部・在庫シート（🔄ボタン）',
    fileId:function(){ return PropertiesService.getScriptProperties().getProperty(OOS_HONBU_PROP_KEY) || ''; } },
  { fn:'oosBasaraSheetOnEdit',    shu:'edit', naze:'入力のたび：バサラ発注シート（受付☑・送り元・送り状NO.・請求書の確認☑）',
    fileId:function(){ return PropertiesService.getScriptProperties().getProperty(OOS_BASARA_SHEET_PROP) || ''; } }
];
/* 一時のもの（自分で消える）。あっても消さない */
var OOS_MIHARI_ICHIJI = ['oosSoukoMatomeSend', 'oosHakkouAto'];
/* 古いもの（役目が終わった）。見つけたら消す。理由も書く */
var OOS_MIHARI_FURUI = {
  'basaraWatch':        '2026-08 basaraWatchV2 に入れ替え済み（自動スイッチを通らない古い道。残っていると欠品メールが二重に動く）',
  'basaraWatchGuarded': '同上',
  'updateViewCopy':     '2026-09-15 ⑩【連結③】閲覧用スプシをやめた（誰も見ていないコピー）',
  'oosSoukoStockSync':  '2026-09-14 旧ファイル④（倉庫⇔OOS）をやめた',
  'oosSoukoOnEdit':     '2026-09-14 旧ファイル④（倉庫⇔OOS）をやめた',
  'oosRestockCheck':    '2026-08-25 oosBasaraRestockCheck に改名（同じ名前が2つあった事故の名残）',
  'oosOrderSync':       '2026-09-07 倉庫ファイルへの転記をやめた（OOS_ORDER_SYNC_ON=false）'
};
function oosMihariSeiri(dry){
  dry = (dry === true || dry === '1' || dry === 1);
  var lines = [], keshita = [], ireta = [], mondai = [];
  var ts = ScriptApp.getProjectTriggers();
  var kimari = {}; OOS_MIHARI_KIMARI.forEach(function(k){ kimari[k.fn] = k; });
  var mita = {};
  lines.push('いま入っている自動実行：' + ts.length + '本' + (dry ? '（見るだけ・何も変えません）' : ''));
  ts.forEach(function(t){
    var fn = String(t.getHandlerFunction() || ''), shu = String(t.getEventType());
    var sid = ''; try{ sid = String(t.getTriggerSourceId() || ''); }catch(e){}
    if(OOS_MIHARI_FURUI[fn]){
      lines.push('　🗑 古い：' + fn + '（' + shu + '）… ' + OOS_MIHARI_FURUI[fn]);
      if(!dry) ScriptApp.deleteTrigger(t);
      keshita.push(fn); return;
    }
    if(OOS_MIHARI_ICHIJI.indexOf(fn) >= 0){ lines.push('　⏳ 一時（自分で消えます）：' + fn); return; }
    var k = kimari[fn];
    if(!k){
      lines.push('　❓ 見覚えなし（消していません・ひろみさんの判断）：' + fn + '（' + shu + '）' + (sid ? ' ファイル ' + sid : ''));
      mondai.push('見覚えなし：' + fn); return;
    }
    if(k.shu === 'edit'){
      var want = ''; try{ want = String(k.fileId() || ''); }catch(e){}
      if(want && sid && want !== sid){
        lines.push('　🗑 別のファイルに付いている：' + fn + '（' + sid + '）→ 消して、正しいファイルに付け直します');
        if(!dry) ScriptApp.deleteTrigger(t);
        keshita.push(fn + '（別ファイル）'); return;
      }
    }
    mita[fn] = (mita[fn] || 0) + 1;
    if(mita[fn] > 1){
      lines.push('　🗑 二重：' + fn + '（' + mita[fn] + '本目）→ 1本にします');
      if(!dry) ScriptApp.deleteTrigger(t);
      keshita.push(fn + '（二重）'); return;
    }
    lines.push('　✅ 要る：' + fn + '　… ' + k.naze);
  });
  OOS_MIHARI_KIMARI.forEach(function(k){
    if(mita[k.fn]) return;
    if(k.shu === 'time'){
      lines.push('　➕ 足りない：' + k.fn + '　… ' + k.naze);
      if(!dry){ try{ k.tsukuru(); ireta.push(k.fn); }catch(e){ mondai.push(k.fn + '：' + e); } }
      return;
    }
    var id = ''; try{ id = String(k.fileId() || ''); }catch(e){}
    if(!id){ lines.push('　⚠ 足りないが、ファイルが分からないので入れられません：' + k.fn); mondai.push('ファイル不明：' + k.fn); return; }
    lines.push('　➕ 足りない：' + k.fn + '　… ' + k.naze);
    if(!dry){ try{ ScriptApp.newTrigger(k.fn).forSpreadsheet(id).onEdit().create(); ireta.push(k.fn); }catch(e){ mondai.push(k.fn + '：' + e); } }
  });
  var ato = dry ? (ts.length - keshita.length + OOS_MIHARI_KIMARI.filter(function(k){ return !mita[k.fn]; }).length) : ScriptApp.getProjectTriggers().length;
  lines.push('');
  lines.push((dry ? '整理すると ' : '整理したあと ') + ato + '本（決めごとの表は ' + OOS_MIHARI_KIMARI.length + '本）');
  if(keshita.length) lines.push((dry ? '消すもの：' : '消しました：') + keshita.join('、'));
  if(ireta.length)   lines.push('入れました：' + ireta.join('、'));
  if(mondai.length)  lines.push('気になる：' + mondai.join('／'));
  return { status:'ok', dry:dry, lines:lines, 消した:keshita, 入れた:ireta, 気になる:mondai, あと:ato };
}
function oosMihariIchiran(){ return oosMihariSeiri(true); }
/* GASの編集画面から：関数えらび → oosMihariMiru（見るだけ）／oosMihariNaosu（整理する）→ 実行 → ログを見る */
function oosMihariMiru(){ var r = oosMihariSeiri(true); Logger.log(r.lines.join('\\n')); return r; }
function oosMihariNaosu(){ var r = oosMihariSeiri(false); Logger.log(r.lines.join('\\n')); return r; }

/* 🚚 いま発送する分を作り直す必要がある編集か（A〜K列・備考・発送済☑・❌キャンセル のときだけ） ★2026-10-05 */
function oosImaHassouIruKa_(e){
  if(!e || !e.range) return false;
  if(e.range.getSheet().getName() !== OOS_YUKA_SHEET) return false;
  if(e.range.getRow() < 2) return false;
  var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
  function naka(c){ return c >= c1 && c <= c2; }
  if(c1 <= OOS_YC.name) return true;                 /* A〜K列：状態・伝票番号・商品①〜④・お届け先氏名 */
  return naka(OOS_YC.note) || naka(OOS_YC.shipped) || naka(OOS_YC.cancel);
}

/* 📄 書類の発行記録の作り直しを、2分後に1回だけ（何回貼ってもまとめて1回） ★2026-10-05 */
var OOS_HAKKOU_ATO_FN = 'oosHakkouAto';
function oosHakkouAtoYoyaku_(){
  var aru = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === OOS_HAKKOU_ATO_FN; });
  if(aru) return;
  ScriptApp.newTrigger(OOS_HAKKOU_ATO_FN).timeBased().after(2 * 60 * 1000).create();
}
function oosHakkouAto(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction() === OOS_HAKKOU_ATO_FN) ScriptApp.deleteTrigger(t); });
  try{ oosSeikyuIchiranTsukuru(); }catch(e){ try{ Logger.log('発行記録の作り直し：' + e); }catch(_e){} }
}
`;
src = src.replace(/\s*$/, '') + '\n' + tsuika;
kaeta.push('⑦ 末尾に見張りの決めごと・点検・整理を足す');

/* 控えを残してから書く */
const bak = path.join(path.dirname(file), 'コード_before_mihari_2026-10-05.js.bak');
if(!fs.existsSync(bak)) fs.writeFileSync(bak, moto);
fs.writeFileSync(file, src);

/* 文法の確かめ */
try{ execFileSync(process.execPath, ['--check', file], { stdio:'pipe' }); }
catch(e){
  fs.writeFileSync(file, moto);
  console.error('文法エラーになったので元に戻しました：\n' + String(e.stderr || e));
  process.exit(1);
}
console.log('直しました：' + file);
kaeta.forEach(l => console.log('　' + l));
console.log('控え：' + bak);
console.log('次：npx @google/clasp push --force（タイマー・onEdit はこれで効きます）');
console.log('　　Webアプリ（受注Ａの書類貼り・点検の窓口）も効かせるなら deploy -i AKfycbwRNg…（版が200で満杯なら、古い版を消してから）');
