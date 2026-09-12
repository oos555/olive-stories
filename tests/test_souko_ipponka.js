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
/* ★2026-09-10（同じ日の夕方）ひろみさん指示で受注一覧のカードを痩せさせたとき、📮ボタンごと外しました。
   「今はバサラに受注確定のメールも出してないし、倉庫にLINEも流してないし、出荷依頼書も作ってない。
   　ここは全部書き換えなきゃいけないよね。この枠の外の情報と、スプシに再度取り込むボタンがあればもうそれでいい」
   ★大事なのは【倉庫へ直接LINEを出す道が塞がっていること】。それは上の①②で見張っています。
   ★受注一覧に📮ボタンを戻さないでください。 */
ok('④受注一覧に📮ボタンはもう無い', IDX.indexOf('📮 倉庫にLINEで送る') < 0);
ok('④出荷依頼書タブの「LINEに通知」もグレー',
  IDX.indexOf('id="line-notify-btn" onclick="notifyLineShort()" style="display:none" disabled') >= 0);

/* ── ⑤ 例外なし：登録した注文は、どれも自動で発注書へ ───────────── */
ok('⑤RTだけでなく、登録した注文は全部が自動で発注書へ',
  bodyOf(IDX, 'registerOrder').indexOf("if(typeof yukaImportOne==='function'){") >= 0 &&
  bodyOf(IDX, 'registerOrder').indexOf("o.customerType==='rt' && /RT伝票取込/") < 0,
  '（RTだけにすると、一般・卸が倉庫に流れなくなります）');
/* ★2026-09-12 ここは索引のソースを【改行ごと文字でコピー】して探していました。
   　そのため、ファイルの改行が CRLF になっただけで、何も壊れていないのに落ちました。
   　（2026-09-12 に実際に落ちて、原因さがしに時間を使いました）
   今：間の空白や改行がどうであっても、
   　　【pending のときだけ発注書へ流している】ことを見ます。
   ★書き方を文字でコピーする形に戻さないでください。 */
ok('⑤取り置き・予約は流れない（pendingのときだけ）',
  /if\(recordType==='pending'\)\{\s*list\.forEach\(function\(o\)\{\s*if\(typeof yukaImportOne==='function'\)/.test(IDX),
  '（pending の外に出すと、取り置き・予約まで倉庫に流れます）');
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
/* ★2026-09-10 ひろみさん：「発注書へ送る が分かりにくい。
     倉庫＆OOS発送連絡スプシの『発注書』にデーターを送る にしてボタン名も変えて。
     ちょっと長い名前だけど、これがあればわかりやすい」
   ★短くしないでください。どこへ送るのかが名前で分かることが大事です。
   実物で確認ずみ（2026-09-10）：
     ファイル【倉庫＆OOS発送連絡スプシ】1Y3227lo1uMbQuxGVLD65lacqVRa7M5FVRjF9Gh_wL7k
     タブ「発注書」gid=322782705 に、本物の道でデータが乗ることを通しで確認
     （?action=oosYukaRoundTrip　入れて・読んで・消す） */
ok('⑤-2 押せるボタンの名前に、送り先まで書いてある（1件ずつ・押せないとき）',
  (IDX.match(/>📦 倉庫＆OOS発送連絡スプシの『発注書』にデータを送る<\/button>/g) || []).length === 3 &&
  (IDX.match(/>📦 出荷依頼書へ<\/button>/g) || []).length === 0,
  '（古い名前や、短い名前に戻さないでください）');
ok('⑤-2 まとめてのボタンにも、送り先が書いてある',
  IDX.indexOf('📦 選んだ分を 倉庫＆OOS発送連絡スプシの『発注書』に送る') >= 0);
ok('⑤-2 通しで確かめる窓口がある（oosYukaRoundTrip）',
  GAS.indexOf('function oosYukaRoundTrip') >= 0 &&
  GAS.indexOf("action === 'oosYukaRoundTrip'") >= 0,
  '（入れて・読んで・消す。テスト行を残しません）');
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
   ★2026-09-12 ひろみさん確定でここが変わりました。
   ・V列（22＝同梱書類 納品書）… 書類のPDFは【全部ここ】。最大2種類まで。
   　　1つのセルの中に2つ並べて、それぞれにリンクを付けます。
   ・W列（23＝同梱書類 他あれば）… パンフレット等の【指示】。もう触りません。
   　　前は2枚目をW列に入れていて、パンフレットの指示が消えていました。
   ・PDFの置き場所は Drive の「OOS_同梱追加PDF」。リンクを知っている人は開ける設定。 */
ok('⑦リンクを貼る窓口がある（oosYukaSetDocLinks）',
  GAS.indexOf('function oosYukaSetDocLinks') >= 0 &&
  GAS.indexOf("if(action === 'yukaSetDocLinks')") >= 0);
ok('⑦書類のリンクはV列だけ。W列には書き込まない',
  bodyOf(GAS, 'oosYukaSetDocLinks').indexOf('OOS_YC.doc1') >= 0 &&
  bodyOf(GAS, 'oosYukaSetDocLinks').indexOf('OOS_YC.doc2') < 0,
  '（W列に書くと、パンフレットの指示が消えます）');
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
/* ★2026-09-10（夕方）フォルダ名を変えました。
   　「RT書類：社内・倉庫用」→「RT書類・納品書：社内・倉庫用」
   　一般・卸の納品書もここに入るようになり、名前と中身が合わなくなったためです
   　（ひろみさん：「フォルダーの名前がRT専用になってるよね？変更する必要があるね」）。
   ★フォルダは【1つだけ】のままです。増やさないでください。
   ★名前を変えるときは、古い名前を OOS_RT_DOC_FOLDER_OLDS に足すこと。
   　足さないと新しいフォルダが作られ、すでに貼ったリンクの書類がばらけます。 */
ok('⑦PDFの置き場所は「RT書類・納品書：社内・倉庫用」の1つだけ',
  GAS.indexOf("var OOS_RT_DOC_FOLDER      = 'RT書類・納品書：社内・倉庫用（リンクを知っている人が開けます）';") >= 0 &&
  bodyOf(GAS, 'oosRtDocFolder_').indexOf('f.setName(OOS_RT_DOC_FOLDER)') >= 0,
  '（前の名前のフォルダは【名前を変えるだけ】で引き継ぎます。作り直すとリンクがばらけます）');
ok('⑦前の名前は「引き継ぐ名前」に残してある（フォルダを作り直さないため）',
  GAS.indexOf("OOS_RT_DOC_FOLDER_OLDS = ['RT書類：社内・倉庫用（リンクを知っている人が開けます）'") >= 0);
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

/* ── ⑨ 分類（この注文の呼び名）── 2026-09-10 ひろみさん指示
   「田中さんの発送ですが、と言われても、どの田中さん、いつのやつ、となってしまいがち。
   　ノヴェッロ2026予約、次回入荷予約、のように分類があれば話が早い」
   ・どの注文にも付けられる（通常・旧ロット・取り置き・予約）
   ・マスタは作らない。これまで使った名前がそのまま候補になる
   ・発注書の備考欄の【いちばん先頭】に【分類】が入る（会話の合言葉）
   ★先頭から動かさないでください。見出しの近くにないと気づけません。 */
ok('⑨受注Ａに分類の入力欄がある',
  IDX.indexOf('id="o-bunrui"') >= 0 && IDX.indexOf('id="o-bunrui-list"') >= 0);
ok('⑨候補は【これまで使った名前】から作る（マスタを作らない）',
  IDX.indexOf('function bunruiCandidates()') >= 0 &&
  bodyOf(IDX, 'bunruiCandidates').indexOf('o.bunrui') >= 0,
  '（マスタ管理をやめたのは、登録の手間を増やさないためです）');
ok('⑨注文に分類が載る', IDX.indexOf('bunrui: bunrui,') >= 0);
ok('⑨発注書へ渡している', IDX.indexOf("bunrui: (o.bunrui || ''),") >= 0);
ok('⑨受注データにも控える（開き直しても消えない）',
  GAS.indexOf("bunrui: o.bunrui||''") >= 0);
ok('⑨備考欄の【いちばん先頭】に【分類】が入る',
  bodyOf(GAS, 'oosYukaImportOrder').indexOf("((String(order.bunrui||'').trim() ? '【'+String(order.bunrui).trim()+'】 ' : '')") >= 0,
  '（先頭から動かさないでください）');

/* ── ⑩ 取り置き及び発注前予約リスト（ホテル以外）── 2026-09-10 ひろみさん承認
   承認モック：mocks/mock_発注前予約リスト_2026-09-10.html 第5版
   ・置き場所は【倉庫＆OOS発送連絡スプシ】（倉庫も見える／書けるのは本部だけ）
   ・左5列を足して、6列目から先は【発注書とまったく同じ並び】
   ・上書きしません。1件ずつ追記します（ひろみさん：アプリだけに置くのが怖い）
   ★並びを変えるときは発注書と一緒に。 */
ok('⑩タブの名前が決まったとおり',
  GAS.indexOf("var OOS_YL_SHEET = '🗂 取り置き及び発注前予約リスト（ホテル以外）';") >= 0);
ok('⑩A列の言葉は2つだけ',
  GAS.indexOf("var OOS_YL_STAY  = '🗓 まだ出しません';") >= 0 &&
  GAS.indexOf("var OOS_YL_GO    = '📦 発注書へ送って出荷を依頼する';") >= 0);
ok('⑩並びが発注書と同じ（6列目から・ずれは+4）',
  /OOS_YL = { state:1, bunrui:2, zaiko:3, yotei:4, touroku:5,/.test(GAS) &&
  /name:15, zip:16, addr:17, tel:18,/.test(GAS) &&
  /note:25,/.test(GAS) && /doc1:26, doc2:27,/.test(GAS),
  '（発注書の2〜23列目と同じ順。ずらさないでください）');
ok('⑩倉庫は見るだけ（本部だけが書ける）',
  bodyOf(GAS, 'oosYoyakuListSheet_').indexOf("setDescription('本部だけが書けます（倉庫は見るだけ）')") >= 0 &&
  bodyOf(GAS, 'oosYoyakuListSheet_').indexOf('OOS_HONBU_MAIL') >= 0);
ok('⑩左2列と上2行を固定する',
  bodyOf(GAS, 'oosYoyakuListSheet_').indexOf('sh.setFrozenColumns(2)') >= 0 &&
  bodyOf(GAS, 'oosYoyakuListSheet_').indexOf('sh.setFrozenRows(2)') >= 0);
ok('⑩追記だけ（上書きしない）',
  bodyOf(GAS, 'oosYoyakuListAdd').indexOf('clearContent') < 0 &&
  bodyOf(GAS, 'oosYoyakuListAdd').indexOf('var newRow = Math.max(last, 2) + 1;') >= 0,
  '（上書きにすると、ひろみさんがいちばん心配されている消失が起きます）');
ok('⑩同じふだの行は二重に入らない',
  bodyOf(GAS, 'oosYoyakuListAdd').indexOf("return { status:'dup', row:i+3 }") >= 0);
ok('⑩分類ごとの合計を1行目に出す',
  GAS.indexOf('function oosYoyakuListSummary_') >= 0 &&
  bodyOf(GAS, 'oosYoyakuListSummary_').indexOf('📊 分類ごとの合計（自動）：') >= 0);
ok('⑩送った行は合計に数えない',
  bodyOf(GAS, 'oosYoyakuListSummary_').indexOf("indexOf('送りました') >= 0) return;") >= 0);
ok('⑩1回目は抜けを教えて止める／2回目は送る',
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('⚠️ 足りないところがあります') >= 0 &&
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('if(lack.length && !kakunin)') >= 0,
  '（スプレッドシートではダイアログを出せないので、2回選ぶ形にしました）');
ok('⑩送ると発注書のA列がいきなり🔵になる',
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('ysh.getRange(imp.row, 1).setValue(OOS_YUKA_BTN_GO)') >= 0 &&
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('oosYukaShipGo_(ysh, imp.row)') >= 0);
ok('⑩在庫が足りないときは送らず、発注書の行も消す',
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('在庫が足りないため、まだ送れません') >= 0 &&
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('ysh.deleteRow(imp.row)') >= 0);
ok('⑩受注Ａ側も通常受注に変える（売上に出すため）',
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf("oosSetOrderStatusByKey_(String(d[OOS_YL.key-1]||''), 'pending')") >= 0);
ok('⑩送った行はもう選べない（二重に送れない）',
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('cell.setDataValidation(null)') >= 0 &&
  bodyOf(GAS, 'oosYoyakuListGo_').indexOf('この行はもう送ってあります') >= 0);
/* ★2026-09-12 ここも【まちがった書き方を固定していた見張り】でした。
   前は「o.customerType === 'rt' || === 'rtgc' と書いてあること」を求めていました。
   区分は日本語で保存されているので（"RT" 49件）、英語で直接くらべると
   いつも false になり、RTの注文が止まりません。
   → 決めごとの親（OOS_KAKAKU.isRt）に聞いているかを見ます。
   　 親が日本語のRTを見分けることは tests/test_apps.js の⑤で確かめています。
   ★文字さがしで書き方を固定しないでください。 */
ok('⑩受注ＡからRTは送らない（RTは別タブ）・親に聞いている',
  bodyOf(IDX, 'yoyakuListAddOne').indexOf('OOS_KAKAKU.isRt(o.customerType)') >= 0);
ok('⑩英語で直接くらべる書き方に戻っていない',
  bodyOf(IDX, 'yoyakuListAddOne').indexOf("o.customerType === 'rt'") < 0);
ok('⑩取り置き・予約を登録したら、その場で送る',
  IDX.indexOf("if(recordType==='held' || recordType==='reserved'){") >= 0 &&
  IDX.indexOf('yoyakuListAddOne(o)') >= 0);
ok('⑩入れた印を受注データにも控える（二重に入らない）',
  GAS.indexOf('yoyakuList: o.yoyakuList||null') >= 0);
ok('⑩通しで確かめる窓口がある（oosYoyakuListRoundTrip）',
  GAS.indexOf('function oosYoyakuListRoundTrip') >= 0 &&
  GAS.indexOf("action === 'oosYoyakuListRoundTrip'") >= 0);
/* ── 結果 ───────────────────────────────────────────────── */
const title = '倉庫への連絡を一本化（🔵にしたときだけ・2026-09-10 ひろみさん指示）';

/* ── ⑪ RT書類の名前は、ゆかちゃんが付ける（2026-09-10 ひろみさん指示） ───────── */
/* ひろみさん：「取り込まれたRTの伝票は、ドライブのRT書類：社内・倉庫用に自動で入るように。
   　　　　　　その時に、書類の名前をゆかちゃんに付けさせてください。あなたが自動でするのでは
   　　　　　　なくて。そうすることで納品書と紐付いていくことになると思います」
   → 伝票と納品書に【同じ名前】を付けて、ドライブで隣どうしに並ぶようにします。 */
ok('⑪伝票は読み取ったら自動でドライブへ', IDX.indexOf('rtSaveSlipToDrive();') >= 0);
ok('⑪置き場所はRT書類フォルダ（GASが決める）', GAS.indexOf('var folder = oosRtDocFolder_();') >= 0);
ok('⑪名前の欄がある（ゆかちゃんが決める）', IDX.indexOf('id="rt-docname"') >= 0);
ok('⑪読み取ったら名前の欄が出る', IDX.indexOf('rtShowDocName();') >= 0);
ok('⑪はじめの候補を作る部品がある', IDX.indexOf('function rtDocNameSuggest(') >= 0);
ok('⑪名前を付け替える部品がある', IDX.indexOf('async function rtRenameDocs(') >= 0);
ok('⑪伝票の名前は お名前_伝票.pdf', IDX.indexOf("'_伝票.pdf'") >= 0);
ok('⑪納品書の名前は お名前_納品書.pdf', IDX.indexOf("_base + '_納品書.pdf'") >= 0);
ok('⑪古い自動の名前に戻っていない', IDX.indexOf("'納品書_' + ((rtParsed.nouhinNo") < 0);
ok('⑪GASに名前を付け替える窓口がある', GAS.indexOf('function renameExtraDoc(') >= 0);

/* ── ⑫ 手書きの修正が入った伝票（2026-09-10 ひろみさん指示） ───────── */
/* ひろみさん：「手書きで修正が入った場合、伝票だけは渡したいので読み取りに入れるけれども、
   　　　　　　手書きの修正入ってますか？って出して、入ってるって言ったら手入力してくださいって。
   　　　　　　伝票はGoogleのドライブには上げておくけれども、
   　　　　　　これで納品書を作ることはできませんっていうふうに出す。
   　　　　　　ゆかちゃんが忘れても問題が起きることはないと思う」
   なぜ必要か：読み取りは【印字の文字】しか見ません。二重線で消した金額を
   「消した」と分からず、そのまま拾います。RTは入金確認が無いので止まりません。 */
ok('⑫読み取ったら必ず聞く', IDX.indexOf('rtShowTegakiToi();') >= 0);
ok('⑫聞く枠がある', IDX.indexOf('この伝票に、手書きの修正が入っていますか？') >= 0);
ok('⑫「入っています」が押せる', IDX.indexOf('rtTegakiAnswer(true)') >= 0);
ok('⑫「印字だけです」も押せる', IDX.indexOf('rtTegakiAnswer(false)') >= 0);
ok('⑫納品書は作れないと出す', IDX.indexOf('この伝票から納品書を作ることはできません') >= 0);
ok('⑫手入力してくださいと出す', IDX.indexOf('受注登録の画面で手で入力してください') >= 0);
ok('⑫伝票はドライブに残すと書いてある', IDX.indexOf('伝票のPDFは、このままドライブに入れてあります') >= 0);
ok('⑫答えるまで先へ進めない', IDX.indexOf('rtLockNextForTegaki(true)') >= 0);
ok('⑫止めるのは「この内容で受注登録画面へ進む」', IDX.indexOf("document.getElementById('rt-go-btn')") >= 0);
ok('⑫進む関数の中でも止める（二重の守り）', IDX.indexOf('rtTegakiShusei === true') >= 0);
ok('⑫ドライブの名前にも印を付ける', IDX.indexOf('（手書き修正あり）') >= 0);
ok('⑫次の伝票では聞き直す', IDX.indexOf('前の伝票の答えを引きずらないよう') >= 0);

/* ── ⑬ RTの書類は、どんな形で入ってもRTのボックスへ ───────────── */
/* ひろみさん：「納品書と伝票は、RTは必ずどんな形で入ろうと、RTのボックスに入るように」 */
ok('⑬手入力のRTでも納品書を作る', IDX.indexOf("if(_isRt && /RT伝票取込/.test(String(o.note||''))) return;") >= 0);
ok('⑬RTを丸ごとおことわりしていない', IDX.indexOf("if(o.customerType === 'rt' || o.customerType === 'rtgc') return;   /* RTは伝票と一緒に別で貼ります */") < 0);
ok('⑬入れる先は saveExtraDoc（RT書類フォルダ）', IDX.indexOf("action:'saveExtraDoc'") >= 0);

/* ── ⑭ 取り消した注文は、発注書へ送れない（2026-09-10 夜の点検で見つけたバグ） ── */
/* 受注一覧のカードを本物の関数で組み立てて中身を見たところ、
   「🗑 発注から消した」注文にも【📥 発注書に送る】のボタンが出ていました。
   押せてしまうと、取り消したはずの注文が倉庫へ流れます。
   ★ボタンを隠すのと、送る関数の中で止めるのと、二重にしてあります。
   ★どちらも外さないでください。 */
ok('⑭取り消したものにはボタンを出さない', IDX.indexOf("var _torikeshi = (o.status === 'deleted' || o.status === 'cancelled');") >= 0);
/* ★正規表現にすると ( や ! のエスケープが崩れやすいので、文字をそのまま数えます */
ok('⑭送るボタンは3つとも守ってある', IDX.split('if(!_torikeshi) btn = ').length - 1 === 3);
ok('⑭送る関数の中でも止める（二重の守り）', IDX.indexOf("⛔ この注文は取り消されています") >= 0);
ok('⑭止めたあとに何をすればよいか書いてある', IDX.indexOf('受注登録から新しく登録してください') >= 0);
/* ★2026-09-10 ひろみさん決定：書類の置き場所は【1つだけ】。
   　「Aでいっか！ 倉庫はリンクを開くだけで、フォルダーの中までは基本的には見ないしね」
   RTの伝票・RTの納品書・一般や卸の納品書、ぜんぶ同じフォルダに入ります。
   ★置き場所を増やさないでください（分けると「伝票がない」と探すことになります）。 */
ok('⑬置き場所は1つだけ（決定を書き残してある）',
   GAS.indexOf('書類の置き場所は【この1つだけ】です') >= 0);
ok('⑬フォルダを決めている場所は1か所',
   (GAS.match(/var OOS_RT_DOC_FOLDER      = /g)||[]).length === 1);
ok('⑬一般・卸の納品書も同じ窓口（saveExtraDoc）を使う',
   IDX.indexOf("action:'saveExtraDoc', base64:b64, filename:nm") >= 0);
ok('⑬別のフォルダを作るコードを書いていない',
   GAS.indexOf('一般書類') < 0 && GAS.indexOf('卸書類') < 0);
ok('⑪窓口はelse ifでつながっている', GAS.indexOf("else if (action === 'renameExtraDoc')") >= 0);
ok('⑪RT書類フォルダの中のファイルしか名前を変えない',
   GAS.indexOf('このファイルは「') >= 0 && GAS.indexOf('の中にありません。名前は変えませんでした。') >= 0);

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
