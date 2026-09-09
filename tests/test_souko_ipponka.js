/* ══════════════════════════════════════════════════════════════════════
   倉庫への連絡を一本化する　2026-09-10 ひろみさん指示

   ★決まったこと（ひろみさんの言葉）
     「バサラが発注した時に本部に届く。私たちが赤いボタンを【発送してください】に
     　変えた時に初めて倉庫に伝達がいく。これを全てのRTの発注も、それ以外の発注も
     　同じような流れにしてほしい。例外はなしに」

   ＝ 倉庫へ連絡が行くのは【発注書のA列を🔵にしたとき】だけ。
     受注Ａから倉庫へ直接LINEを送る道は、全部ふさぐ（ボタンは残してグレー）。

   ★順番を守った理由（2026-09-07に決めた手順）
     ① 📥「ゆかスプシに取り込む」で【ふだ（転記キー）】を付ける
     ② ふだで在庫が引けることを確かめる
     ③ そのあとで 📮「倉庫にLINEで送る」をグレーにする
     先に③をやると、卸・一般・STORESの注文が「倉庫へ流れたのに在庫が減らない」
     状態になります（ひろみさんが何度も苦労された事故そのもの）。

   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');
const IDX = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/index.html', 'utf8');
const PIC = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/pickup.html', 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function bodyOf(src, name) {
  const m = src.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
  if (!m) return '';
  let i = src.indexOf(m[0]) + m[0].length - 1, d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) break; } }
  return src.slice(src.indexOf(m[0]), i + 1);
}

/* ── ① 倉庫へLINEを出す場所は「🔵にしたとき」だけ ─────────────── */
const shipGo = bodyOf(GAS, 'oosYukaShipGo_');
ok('①🔵の処理が読めた', !!shipGo);
ok('①🔵の処理から倉庫へLINEを送っている', shipGo.indexOf('oosLineToWarehouse_') >= 0);
/* 倉庫LINEを呼んでいる場所を数える。増えていたら、新しい抜け道ができた合図。 */
const whCalls = (GAS.match(/oosLineToWarehouse_\(/g) || []).length - 1;   /* -1 は関数そのものの1行 */
ok('①倉庫へLINEを出す場所は3か所のまま（🔵／古い③の死んだ道／手で送る確認窓口）',
  whCalls === 3,
  '（いまは ' + whCalls + ' か所。増えていたら、どこかに新しい抜け道ができています）');
/* 古い③の道は、頭で止めてあることを確かめる（死んだコードのまま） */
const reqEdit = bodyOf(GAS, 'oosYukaRequestEdit_');
ok('①古い③（☑）の道は、頭で止まったまま',
  reqEdit.indexOf("stop('この☑はもう使いません") >= 0 &&
  reqEdit.indexOf("stop('この☑はもう使いません") < reqEdit.indexOf('oosLineToWarehouse_'),
  '（止め木を消すと、倉庫へ二重に連絡が行きます）');

/* ── ①-2 倉庫グループに、発送以外のお知らせが行かないこと ───────── */
/* ★sendLineGroupMessage は、送り先を書かないと【倉庫グループ】に行きます。
   2026-09-10 まで、要対応（入金・変更・追加・要返金キャンセル）のお知らせが
   ずっと倉庫グループに届いていました。本部の仕事なので本部グループへ直しました。
   ★送り先を書かない呼び出しを増やさないでください。 */
const bare = (GAS.match(/sendLineGroupMessage\([^,)]*\)/g) || [])
  .filter(function(x){ return x.indexOf('text)') < 0; });
ok('①-2 送り先を書かないLINE送信が無い（＝うっかり倉庫へ行かない）',
  bare.length === 0,
  bare.length ? ('見つかった呼び出し：' + bare.join(' / ')) : '');
ok('①-2 要対応のお知らせは本部グループへ',
  GAS.indexOf('try{ oosLineToHonbu_(lineText); }catch(e){}') >= 0,
  '（倉庫さんには関係のない、入金・返金・変更のお知らせです）');

/* ── ② 📥 が【ふだ】を付ける（先にこれ。順番を守る） ───────────── */
const imp = bodyOf(GAS, 'oosYukaImportOrder');
ok('②📥の処理が読めた', !!imp);
ok('②📥が発注書の転記キー列に【ふだ】を書いている',
  imp.indexOf('sh.getRange(newRow, oosKeyColByHeader_(sh)).setValue(_key)') >= 0,
  '（これが無いと、🔵にしても在庫が減りません）');
ok('②📥が【ふだ】を返している', /return \{status:'ok', row:newRow, key:_key\}/.test(imp));
ok('②二重よけ（dup）のときも【ふだ】を返している',
  imp.indexOf("return {status:'dup', row:i+2, key:_dk}") >= 0,
  '（返さないと、2回目に押した人の画面にふだが残りません）');

/* ── ③ ふだが無い行は、黙って通さない（気づける印） ─────────────── */
ok('③ふだが無い行には、A列に注意の印を残す',
  shipGo.indexOf('この行にはふだ（転記キー）がありません') >= 0,
  '（黙って通すと「倉庫へ流れたのに在庫が減っていない」が誰にも見えません）');
ok('③ふだが無くても倉庫は止めない（発送はできる）',
  shipGo.indexOf('この行にはふだ（転記キー）がありません') < shipGo.indexOf('oosLineToWarehouse_'),
  '（止めてしまうと、古い行が発送できなくなります）');

/* ── ④ 受注Ａ：倉庫への直接LINEは全部ふさぐ ─────────────────── */
ok('④止め木のスイッチがある（OOS_WH_LINE_OFF）', /var OOS_WH_LINE_OFF = true;/.test(IDX));
ok('④案内を出す部品がある（whLineOffNotice）', IDX.indexOf('function whLineOffNotice()') >= 0);
const nw = bodyOf(IDX, 'notifyWarehouseOne');
ok('④1件ずつ送る道が、いちばん最初で止まる',
  /^function notifyWarehouseOne\(id, force\)\{\s*if\(OOS_WH_LINE_OFF\)\{ whLineOffNotice\(\); return; \}/.test(nw),
  '（途中に置くと、在庫だけ動いてしまうことがあります）');
const nl = bodyOf(IDX, 'notifyLineShort');
ok('④まとめて送る道も、いちばん最初で止まる',
  /^function notifyLineShort\(listArg\)\{\s*\/\*[\s\S]*?\*\/\s*if\(OOS_WH_LINE_OFF\)\{ whLineOffNotice\(\); return; \}/.test(nl));
ok('④📮ボタンはグレー（消してはいない・ひろみさん指示）',
  IDX.indexOf(`'<button class="rk-wh" disabled onclick="notifyWarehouseOne(`) >= 0 &&
  IDX.indexOf('📮 倉庫にLINEで送る（いまは使いません）') >= 0);
ok('④出荷依頼書タブの「LINEに通知」もグレー',
  IDX.indexOf('id="line-notify-btn" onclick="notifyLineShort()" style="display:none" disabled') >= 0);

/* ── ⑤ 例外なし：登録した注文は、どれも自動で発注書へ ───────────── */
ok('⑤RTだけでなく、登録した注文は全部が自動で発注書へ',
  IDX.indexOf(`      if(typeof yukaImportOne==='function'){
        try{ yukaImportOne(o.id); }catch(eY){}
      }`) >= 0,
  '（RTだけにすると、一般・卸が倉庫に流れなくなります）');
ok('⑤取り置き・予約は流れない（pendingのときだけ）',
  IDX.indexOf("if(recordType==='pending'){\n    list.forEach(function(o){\n      if(typeof yukaImportOne==='function')") >= 0);
ok('⑤📥が返した【ふだ】を、受注Ａ側に控えている',
  IDX.indexOf('if(d.key) o.yukaKey = String(d.key);') >= 0,
  '（控えないと、在庫が引けず、送り状NO.も戻ってきません）');

/* ── ⑤-2 例外がないこと：注文のできる道は【4つ】。全部が発注書へ ───── */
/* ★注文が「出荷依頼（pending）」になる道は、いまこの4つです。
     ①受注の登録（registerOrder）②STORESのCSV取込 ③取り置き・予約→出荷依頼書
     ④バサラの☑（こちらはGASが直接、発注書に入れます）
   ①〜③のどれかで発注書へ入れ忘れると、倉庫への直接LINEをやめた今は
   【その注文だけ倉庫に永久に流れません】。★1つでも外さないでください。 */
ok('⑤-2 STORESのCSV取込も、自動で発注書へ',
  IDX.indexOf(`  if(imported){
    importedOrders.forEach(function(o){
      if(typeof yukaImportOne==='function'){ try{ yukaImportOne(o.id); }catch(eY){} }
    });
  }`) >= 0,
  '（入れ忘れると、STORESの注文が倉庫に流れません）');
ok('⑤-2 取り置き・予約→出荷依頼書も、自動で発注書へ',
  bodyOf(IDX, 'convertToShipping').indexOf("if(typeof yukaImportOne==='function'){ try{ yukaImportOne(o.id); }catch(eY){} }") >= 0,
  '（入れ忘れると、取り置きから出した注文が倉庫に流れません）');
ok('⑤-2 バサラはGASが直接、発注書へ入れる',
  GAS.indexOf('var imp = oosYukaImportOrder({ num:num, src:') >= 0);

/* ── ⑥ 倉庫Ｄ（pickup.html）はシンプルに ───────────────────── */
ok('⑥「不良品ほうこく」のボタンが無い', PIC.indexOf('>不良品ほうこく<') < 0);
ok('⑥「メモ」のボタンが無い', PIC.indexOf("pickup.html?mode=notes") < 0);
ok('⑥「在庫を見る」のボタンが無い', PIC.indexOf("pickup.html?mode=stock") < 0);
ok('⑥「送信履歴」のボタンが無い', PIC.indexOf("pickup.html?mode=history") < 0);
ok('⑥倉庫スプレッドシートをいつでも開けるボタンがある',
  PIC.indexOf('📗 倉庫スプレッドシートをひらく') >= 0 &&
  PIC.indexOf('const SOUKO_SHEET_URL') >= 0);
ok('⑥そのリンク先が【倉庫＆OOS発送連絡スプシ】',
  PIC.indexOf('1Y3227lo1uMbQuxGVLD65lacqVRa7M5FVRjF9Gh_wL7k') >= 0,
  '（?action=oosFilesCheck で確かめられます）');
const load = bodyOf(PIC, 'loadOrderList');
ok('⑥一覧の読み込みが軽い（loadAllDataを一緒に読まない）',
  load.indexOf('fetchWarehouseNotes()') < 0,
  '（戻すと、また一覧が重くなります）');
ok('⑥書類の画面（?id=）では今までどおり読んでいる',
  bodyOf(PIC, 'loadSingleOrder').indexOf('await fetchWarehouseNotes();') >= 0,
  '（納品書の金額とロットに必要です）');

/* ── 結果 ───────────────────────────────────────────────── */
const title = '倉庫への連絡を一本化（🔵にしたときだけ・2026-09-10 ひろみさん指示）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
