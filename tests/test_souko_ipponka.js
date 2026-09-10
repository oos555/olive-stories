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
  bodyOf(IDX, 'registerOrder').indexOf("if(typeof yukaImportOne==='function'){") >= 0 &&
  bodyOf(IDX, 'registerOrder').indexOf("o.customerType==='rt' && /RT伝票取込/") < 0,
  '（RTだけにすると、一般・卸が倉庫に流れなくなります）');
ok('⑤取り置き・予約は流れない（pendingのときだけ）',
  IDX.indexOf("if(recordType==='pending'){\n    list.forEach(function(o){\n      if(typeof yukaImportOne==='function')") >= 0);
ok('⑤📥が返した【ふだ】を、受注Ａ側に控えている',
  IDX.indexOf('if(d.key) o.yukaKey = String(d.key);') >= 0,
  '（控えないと、在庫が引けず、送り状NO.も戻ってきません）');

/* ── ⑤-2 倉庫へ出す注文の道は【3つ】。ストアーズだけは通らない ─────── */
/* ★倉庫が発送する注文が発注書に入る道は、いまこの3つです。
     ①受注の登録（registerOrder）②取り置き・予約→出荷依頼書
     ③バサラの☑（こちらはGASが直接、発注書に入れます）
   どれかで入れ忘れると、倉庫への直接LINEをやめた今は
   【その注文だけ倉庫に永久に流れません】。★1つでも外さないでください。

   ★★ストアーズだけは別です（2026-09-10 ひろみさんのご指摘）
     「ストアーズはアプリも通らないしスプシも通らない。倉庫が直接ストアーズを見て
     　発送するから、ストアーズ内で完結する。1週間に1回、発送ずみのCSVを
     　在庫の管理だけのために取り込む。これは発送済だから倉庫連絡は不要」
     → CSV取込では【発注書へ送らない】【発送済にする】【記録のみの印を付ける】。 */
ok('⑤-2 ストアーズのCSV取込は、発注書へ送らない',
  IDX.indexOf("importedOrders.forEach(function(o){") < 0 &&
  IDX.indexOf('ここで yukaImportOne を呼ばないでください') >= 0,
  '（送ると、もう発送ずみの注文が倉庫へ二重に行きます）');
ok('⑤-2 ストアーズは取り込んだ時点で【発送済】',
  IDX.indexOf("status: 'shipped', source: 'stores',") >= 0,
  '（pendingのままだと、売上一覧に1件も出ません）');
ok('⑤-2 ストアーズには【記録のみ】の印が最初から付く',
  IDX.indexOf("whSkip: { state:'skip', at:new Date().toISOString(), by:'ストアーズ取込（発送ずみ）' }") >= 0,
  '（付けないと、赤い「未送信」として残りつづけます）');
ok('⑤-2 ストアーズが売上一覧に出る条件を満たす',
  /salesWasSentToWarehouse[\s\S]{0,200}o\.status === 'shipped'/.test(
    fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/billing.html', 'utf8')),
  '（売上一覧は notified／shippedAt／status===shipped のどれかで判定しています）');
/* ★2026-09-10 ひろみさん指示：もう出荷依頼書は使わないので、
     ボタンの名前を「📦 発注書へ送る」に変え、押したあと出荷依頼書タブへ飛ばないようにした。
   ★このとき【まとめて出す道】に yukaImportOne が抜けているのを見つけました。
     まとめて出した分だけ、倉庫に永久に流れないところでした。1件ずつと両方を見張ります。 */
ok('⑤-2 【まとめて】発注書へ送るも、自動で発注書へ',
  bodyOf(IDX, 'convertSelectedHoldToShipping').indexOf('list.forEach(function(o){ try{ yukaImportOne(o.id); }catch(eY){} });') >= 0,
  '（2026-09-10 に見つけた抜け。まとめて出した分だけ倉庫に流れませんでした）');
/* ★コメント（注意書き）を外してから見ます。
   2026-09-10、見張りが自分の「★gotoSlip を戻さないでください」の文を拾って落ちました。
   同じ失敗を今日2回しています。★この noComment を外さないでください。 */
function noComment(src){ return String(src||'').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' '); }
ok('⑤-2 押したあと、出荷依頼書タブへ飛ばない（1件ずつも、まとめても）',
  noComment(bodyOf(IDX, 'convertToShipping')).indexOf('gotoSlip(') < 0 &&
  noComment(bodyOf(IDX, 'convertSelectedHoldToShipping')).indexOf('gotoSlip(') < 0,
  '（飛ぶと「これで倉庫に行った」と思ってしまいます）');
/* ★見るのは【実際に押せるボタン】だけ。説明パネルの中の文は数えません
   （バサラの説明パネルに古い言い方が残っていますが、バサラは触らない決まりのため）。 */
ok('⑤-2 押せるボタンの名前は「📦 発注書へ送る」（1件ずつ・まとめて・押せないとき）',
  (IDX.match(/>📦 発注書へ送る<\/button>/g) || []).length === 3 &&
  (IDX.match(/>📦 出荷依頼書へ<\/button>/g) || []).length === 0,
  '（古い名前に戻さないでください）');
ok('⑤-2 押したあとのお知らせが、倉庫にはまだ行かないと伝えている',
  IDX.indexOf('倉庫にはまだ行きません（発注書のA列を🔵にすると倉庫へ連絡が行きます）') >= 0);
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

/* ── ⑦ RTの書類は、発注書の行にリンクで貼る（メール・LINEはやめた）─────
   ★2026-09-10 ひろみさん決定
     「RT同梱書類　取り込んだ伝票と、伝票から作った納品書のリンクが入ったら最高です。
     　それを倉庫が見て印刷します」
     「ご提案どおり（メール・LINEをやめて、発注書にリンクを貼る）にしたい」
   ・V列（22＝同梱書類 納品書）　… 伝票から作った納品書PDF
   ・W列（23＝同梱書類 他あれば）… 取り込んだ発注伝票PDF　★見出しはそのまま（ひろみさん決定）
   ・PDFの置き場所は Drive の「OOS_同梱追加PDF」。リンクを知っている人は開ける設定。 */
ok('⑦リンクを貼る窓口がある（oosYukaSetDocLinks）',
  GAS.indexOf('function oosYukaSetDocLinks') >= 0 &&
  GAS.indexOf("if(action === 'yukaSetDocLinks')") >= 0);
ok('⑦V列（doc1）＝納品書、W列（doc2）＝発注伝票',
  bodyOf(GAS, 'oosYukaSetDocLinks').indexOf('put(OOS_YC.doc1, String(p.nouhinName') >= 0 &&
  bodyOf(GAS, 'oosYukaSetDocLinks').indexOf('put(OOS_YC.doc2, String(p.hokaName') >= 0,
  '（入れかえると、倉庫が見出しと中身のちがう書類を印刷します）');
ok('⑦ふだ（転記キー）で行を探す（まちがった行に貼らない）',
  bodyOf(GAS, 'oosYukaSetDocLinks').indexOf('oosFindRowByKey_(sh, oosKeyColByHeader_(sh), key)') >= 0);
ok('⑦ふだが無いときは何もしない',
  bodyOf(GAS, 'oosYukaSetDocLinks').indexOf('ふだ（転記キー）がありません') >= 0);
/* ★2026-09-10 ひろみさん決定（ここは一度まちがえて直した所です・★読んでください）
     「実際に倉庫で書類を開いて、そして印刷するのはれい子さんです。
     　れい子さんやれい子さんのスタッフが開くので、私たちは印刷はしません」
     「納品書と伝票は別の場所に置きません。この RT書類：社内・倉庫用 の中に
     　RTの伝票とRTの納品書を入れていくので、分けないでね」
     「同じ場所に置いておかないと、納品書と伝票を見るときに別のところに見に行かなきゃいけないでしょう?」

   ＝ 置き場所は【1つだけ】／見るのは【リンクを知っている人】。
   ★いちど『決めた人だけ』に絞ったら、れい子さんが開けなくなりました。絞らないこと。
   ★フォルダを増やさないこと。 */
ok('⑦PDFの置き場所は「RT書類：社内・倉庫用」の1つだけ',
  GAS.indexOf("var OOS_RT_DOC_FOLDER      = 'RT書類：社内・倉庫用（リンクを知っている人が開けます）';") >= 0 &&
  bodyOf(GAS, 'oosRtDocFolder_').indexOf('f.setName(OOS_RT_DOC_FOLDER)') >= 0,
  '（前の名前のフォルダは【名前を変えるだけ】で引き継ぎます。作り直すとリンクがばらけます）');
ok('⑦伝票も納品書も、同じフォルダに入る',
  bodyOf(GAS, 'saveExtraDoc').indexOf('oosRtDocFolder_()') >= 0 &&
  bodyOf(GAS, 'saveInvoiceToDrive').indexOf('oosRtDocFolder_()') >= 0,
  '（分けると、見るときに2か所を見に行くことになります）');
ok('⑦フォルダを増やしていない（納品書用の別フォルダが無い）',
  GAS.indexOf('OOS_NOUHIN_FOLDER') < 0);
ok('⑦倉庫のアドレスが登録してある（info@oliosanto.jp）',
  GAS.indexOf("var OOS_SOUKO_MAIL = ['info@oliosanto.jp'];") >= 0 &&
  bodyOf(GAS, 'oosRtDocShare_').indexOf('item.addViewer(mail)') >= 0,
  '（倉庫のみなさんが全員で使うアドレス。2026-09-10 ひろみさんに教えていただきました）');
ok('⑦倉庫のれい子さんたちが、ログインなしでも開ける',
  bodyOf(GAS, 'oosRtDocShare_').indexOf('setSharing(DriveApp.Access.ANYONE_WITH_LINK') >= 0 &&
  bodyOf(GAS, 'oosRtDocShare_').indexOf('DriveApp.Access.PRIVATE') < 0,
  '（PRIVATEに戻すと、れい子さんが印刷できなくなります）');
ok('⑦いまある書類にも行き渡らせる窓口がある（oosRtDocFolderSecure）',
  GAS.indexOf('function oosRtDocFolderSecure') >= 0 &&
  GAS.indexOf("action === 'oosRtDocFolderSecure'") >= 0);
ok('⑦フォルダの中身を確かめる窓口がある',
  GAS.indexOf("action === 'oosRtDocFolderCheck'") >= 0);
ok('⑦読み違えた記録が残してある（同じまちがいをしないため）',
  GAS.indexOf('ここは私（Claude）が読み違えたところです') >= 0);
ok('⑦倉庫Ｄのカードにも、そのリンクがボタンで出る',
  bodyOf(GAS, 'oosKonpoOrders').indexOf('getRichTextValues()') >= 0,
  '（発注書のV列・W列のリンクを読んでいます）');
ok('⑦受注Ａ：発注書に入ってから貼る（順番）',
  IDX.indexOf('Promise.resolve(yukaImportOne(o.id)).then(function(){') >= 0 &&
  IDX.indexOf('rtAttachDocsToOrder(o)') >= 0,
  '（先に貼ろうとすると、貼る先の行がまだありません）');
ok('⑦受注Ａ：貼る部品がある（rtAttachDocsToOrder）',
  IDX.indexOf('async function rtAttachDocsToOrder(o)') >= 0);
ok('⑦受注Ａ：RTの伝票から作った注文だけに貼る',
  bodyOf(IDX, 'rtAttachDocsToOrder').indexOf('/RT伝票取込/.test(String(o.note') >= 0);
ok('⑦倉庫へのメール・LINEはやめた（rt-mailerを呼ばない）',
  /^async function rtDoSendDocs\(\)\{\s*\/\*[\s\S]*?\*\/\s*alert\(\[/.test('async ' + bodyOf(IDX, 'rtDoSendDocs')),
  '（倉庫へ連絡が行くのは🔵にしたときだけ、という決まりです）');
ok('⑦納品書PDFのURLを受注データに控えている',
  GAS.indexOf("nouhinDocUrl: o.nouhinDocUrl||''") >= 0,
  '（控えないと、画面を開き直すと分からなくなります）');

/* ── ⑧ 倉庫が書けるのは3列だけ（発注書タブの保護）───────────────
   ★2026-09-10 ひろみさん指示（★前にも言われていたのに、できていませんでした）
     「送り状ナンバーと発送済みと倉庫用のメモ、ここは倉庫は書けるけど、
     　それ以外が書けないようにしないと、どんどん送るでしょ」
   ・倉庫（info@oliosanto.jp）が書けるのは
     　送り状NO.（24）／発送済（25）／倉庫用メモ（26）の3列だけ
   ・とくに【A列】は触らせない。🔵にすると倉庫へLINEが飛び、赤に戻すと発送が止まります
   ・本部（ひろみさん・ゆかちゃん）は今までどおり全部書けます
   ★保護を外さないでください。外すと、倉庫が発注そのものを動かせてしまいます。 */
ok('⑧保護をかける部品がある（oosSoukoSheetProtect）',
  GAS.indexOf('function oosSoukoSheetProtect') >= 0 &&
  GAS.indexOf("action === 'oosSoukoSheetProtect'") >= 0);
ok('⑧倉庫に開けるのは【送り状NO.から3列】だけ',
  bodyOf(GAS, 'oosSoukoSheetProtect').indexOf('pr.setUnprotectedRanges([ sh.getRange(2, OOS_YC.track, rows, 3) ])') >= 0,
  '（ここを広げると、倉庫が本部の列まで書けてしまいます）');
ok('⑧「書ける人」は本部だけ（倉庫のアドレスを入れない）',
  GAS.indexOf("var OOS_HONBU_MAIL = ['yuka.miyab@gmail.com'];") >= 0 &&
  bodyOf(GAS, 'oosSoukoSheetProtect').indexOf('OOS_SOUKO_MAIL') < 0,
  '（倉庫を「書ける人」に入れると、保護が意味を失います）');
ok('⑧付けたあと、実物を読み返して返す',
  bodyOf(GAS, 'oosSoukoSheetProtect').indexOf('var after = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)') >= 0,
  '（「okが返った」で終わらせないため）');
ok('⑧倉庫のアドレスが発注書の編集者に入る窓口がある',
  GAS.indexOf('function oosShareSoukoSheet') >= 0 &&
  bodyOf(GAS, 'oosShareSoukoSheet').indexOf('f.addEditor(mail)') >= 0);
ok('⑧バサラの請求書発行タブに【入金】の☑がある',
  GAS.indexOf('var OOS_SEIKYU_NYUKIN   = 8;') >= 0 &&
  GAS.indexOf('function oosSeikyuNyukinColumn_') >= 0 &&
  GAS.indexOf("action === 'oosSeikyuNyukinColumn'") >= 0,
  '（2026-09-10 ひろみさん指示：入金したらここに☑）');
ok('⑧入金の☑を入れたら、行がグレーになるだけ',
  GAS.indexOf("whenFormulaSatisfied('=$H3=TRUE')") >= 0 &&
  bodyOf(GAS, 'oosKanriOnEdit').indexOf('OOS_SEIKYU_NYUKIN') < 0,
  '（メールもLINEも飛ばしません。何かを足さないでください）');
ok('⑧新しい請求書の行にも☑が置かれる',
  bodyOf(GAS, 'oosSeikyuHakkoAdd_').indexOf('s.getRange(row, OOS_SEIKYU_NYUKIN).insertCheckboxes()') >= 0);
ok('⑧送り状NO.・発送済・倉庫用メモ の列番号が変わっていない',
  /track:24, shipped:25, soukoMemo:26/.test(GAS),
  '（列を動かしたら、保護の範囲も付け直してください）');

/* ── 結果 ───────────────────────────────────────────────── */
const title = '倉庫への連絡を一本化（🔵にしたときだけ・2026-09-10 ひろみさん指示）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
