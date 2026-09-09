/* ══════════════════════════════════════════════════════════════════════
   🔒 バサラ発注の流れ ── 確定（2026-09-10 ひろみさん）

   ★ひろみさんの言葉：「バサラはこれで流れが確定したから、一切変えないで。
   　　　　　　　　　　変更しないように見張りつけて」

   確定した流れ（図：mocks/mock_バサラ発注の流れ_2026-09-10.html）
   ─────────────────────────────────────────────────────────────────────
   ① 原さんが発注シートに書く　　　　　　　→ 何も飛ばない
   ② 原さんが A列に☑　　　　　　　　　　 → 💬 本部にLINE 1通だけ
   　　　　　　　　　　　　　　　　　　　　　（メモがあれば同じLINEに一言）
   　　　　　　　　　　　　　　　　　　　　　📦 在庫が減る　🔒 行がロック
   ③ 本部が A列を🔵【発送してください】へ → 💬 倉庫にLINE 1通
   　　　　　　　　　　　　　　　　　　　　　📦 在庫の安全網（足りなければ赤に戻す）
   ④ 倉庫が送り状NO.を書く　　　　　　　　→ 何も飛ばない。シートだけが変わる
   　　　　　　　　　　　　　　　　　　　　　原さんのシートへ自動で戻る／明細は発送完了
   ⑤ 月末の最終日 夜　　　　　　　　　　　→ 💬 本部にLINE（請求書ができた）
   ⑥ 本部が「発行してください」　　　　　 → ✉️ 原さんにメール 1通
   ❌ キャンセル（発注書30列目の☑）　　　 → 📦 在庫が戻る／明細も取り消し／💬 本部にLINE
   　　　　　　　　　　　　　　　　　　　　　発送したあとは、ここでは取り消せない
   ─────────────────────────────────────────────────────────────────────

   ★このファイルは「流れを変えさせない」ための見張りです。
   　どれか1つでも落ちたら、確定した流れが変わっています。
   　直す前に、必ずひろみさんに確認してください。★消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');
const ZU  = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/mocks/mock_バサラ発注の流れ_2026-09-10.html', 'utf8');

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
const accept = bodyOf(GAS, 'oosBasaraOrderAccept_');
const onEdit = bodyOf(GAS, 'oosBasaraSheetOnEdit');
const shipGo = bodyOf(GAS, 'oosYukaShipGo_');
const cancel = bodyOf(GAS, 'oosYukaCancelCheck_');
const fanout = bodyOf(GAS, 'oosTrackFanout_');
const hakko  = bodyOf(GAS, 'oosSeikyuHakkoGo_');
const daily  = bodyOf(GAS, 'oosBasaraInvoiceBuildFor_');   /* 月末の自動作成の本体 */

/* ── ① 書いている間は、何も飛ばない ───────────────────────── */
ok('①☑を押すまでは何も起きない（A列がTRUEのときだけ受付に進む）',
  onEdit.indexOf("if(e.range.getColumn()===1 && e.range.getNumColumns()===1 && String(e.value).toUpperCase()==='TRUE')") >= 0 &&
  onEdit.indexOf('oosBasaraOrderAccept_(sh, e.range.getRow())') >= 0,
  '（書いている途中で連絡が飛ぶと、原さんが安心して書けません）');
ok('①送り元は選んだ瞬間に自動で入る（☑を待たない）',
  onEdit.indexOf("if(w==='バサラスター' || w==='ご注文者さま') oosBasaraFillSender_") >= 0);

/* ── ② ☑を押した瞬間 ──────────────────────────────────── */
ok('②受付できた', !!accept);
ok('②本部にLINEを1通だけ出す（倉庫へは出さない）',
  (accept.match(/oosLineToHonbu_\(/g) || []).length === 1 &&
  accept.indexOf('oosLineToWarehouse_') < 0,
  '（この時点で倉庫へ流すと、本部が中身を見る前に発送されます）');
ok('②その1通に「バサラスターから発注がありました」と書く',
  accept.indexOf('📦 バサラスターから発注がありました') >= 0);
ok('②メモがあるときは、同じLINEに一言そえるだけ',
  accept.indexOf('📝 お客様からのメモに記入があります') >= 0,
  '（メモ専用のLINEを別に飛ばさない・ひろみさん指示）');
ok('②原さんへのメールは出さない',
  accept.indexOf('MailApp') < 0,
  '（☑が「✅ 受付」に変わることが、そのままお返事です）');
ok('②発注書に1行入れる', accept.indexOf('oosYukaImportOrder({ num:num, src:') >= 0);
ok('②御請求明細にも1行入れる（送料800円・税抜）',
  accept.indexOf('sm.getRange(r2,1,1,5).setValues') >= 0 && accept.indexOf('800') >= 0);
ok('②📦 在庫はこの瞬間に減らす',
  accept.indexOf('oosYukaStockDeductByKey_(key)') >= 0,
  '（ひろみさん決定2026-09-04：ゆかスプシ転記と同時に確保する）');
ok('②足りない分は引かずに「在庫待ち」（ここでは止めない）',
  accept.indexOf('足りない分は引かずに') >= 0);
ok('②受付の印「✅ 受付」を書く', accept.indexOf("cell.setValue('✅ 受付 ") >= 0);
ok('②🔒 行をロックする（受付の印を書いたあと）',
  accept.indexOf('oosBasaraLockRow_(sh, row)') > accept.indexOf("cell.setValue('✅ 受付 "),
  '（先にロックすると、受付の印が書けなくなります）');
ok('②二重には流れない（もう発注済みなら止める）',
  accept.indexOf('この行はすでに発注済みです') >= 0);

/* ── ③ 本部が🔵にした瞬間 ─────────────────────────────── */
ok('③🔵の処理が読めた', !!shipGo);
ok('③倉庫にLINEを1通出す',
  (shipGo.match(/oosLineToWarehouse_\(/g) || []).length === 1);
ok('③📦 在庫の安全網（在庫待ちだった分をもう一度引く）',
  shipGo.indexOf('oosYukaStockDeductByKey_(key)') >= 0);
ok('③足りなければ赤に戻して発送させない',
  shipGo.indexOf("ded.status==='short'") >= 0 &&
  shipGo.indexOf('在庫が足りないため、まだ発送できません') >= 0,
  '（在庫が無いまま倉庫へ流すと、倉庫が混乱します）');
ok('③もう発送した行は、押しても何もしない',
  shipGo.indexOf('この行はもう発送済みです') >= 0);
ok('③キャンセルされた行は流さない',
  shipGo.indexOf('この注文はキャンセルされています') >= 0);
ok('③A列の言葉は変えない（赤と青の2つ）',
  GAS.indexOf("var OOS_YUKA_BTN_STOP = 'OOS未チェック 発送しないでください（登録済）';") >= 0 &&
  GAS.indexOf("var OOS_YUKA_BTN_GO   = '発送してください';") >= 0,
  '（言葉が変わると、原さん・倉庫・本部の合図がずれます）');

/* ── ④ 倉庫が送り状NO.を書いた ──────────────────────────── */
ok('④送り状NO.は、原さんのシートへ自動で戻る',
  fanout.indexOf('bsh.getRange(brow, oosBasaraTrackCol_(bsh)).setValue(track)') >= 0);
ok('④戻したら、その行もロックする（発送後に書き換えさせない）',
  fanout.indexOf('oosBasaraLockRow_(bsh, brow)') >= 0,
  '（発送後に数や金額を書き換えられると、水増し請求ができてしまいます）');
ok('④御請求明細が「発送完了」になる（請求は発送日ベース）',
  GAS.indexOf('function oosBasaraMeisaiShipped_') >= 0 &&
  bodyOf(GAS, 'oosBasaraMeisaiShipped_').indexOf('この月の請求書に載ります') >= 0);
ok('④原さんへの発送連絡は【自動では出さない】',
  bodyOf(GAS, 'oosYukaTrackEdit_').indexOf('basaraShipNotify') < 0 &&
  fanout.indexOf('basaraShipNotify') < 0,
  '（2026-09-09 ひろみさん決定：シートが変わるので連絡は不要）');

/* ── ⑤⑥ 請求書 ──────────────────────────────────────── */
ok('⑤月末に、本部にLINEで知らせる',
  daily.indexOf('請求書が自動で出来上がりました') >= 0 &&
  daily.indexOf('oosLineToHonbu_') >= 0);
ok('⑤月末のLINEは原さんにも倉庫にも行かない', daily.indexOf('oosLineToWarehouse_') < 0 && daily.indexOf('basaraTo_') < 0);
ok('⑤自動作成が動くのは【月末の日】だけ',
  bodyOf(GAS, 'oosBasaraInvoiceDaily').indexOf("!== '01') return {status:'ok', skipped:'月末ではありません'}") >= 0 &&
  bodyOf(GAS, 'oosBasaraInvoiceDaily').indexOf('oosBasaraInvoiceBuild()') >= 0,
  '（あしたが1日なら今日が月末、という見方です）');
ok('⑥本部が「発行してください」を押したときだけ、原さんにメール',
  hakko.indexOf('MailApp.sendEmail') >= 0 && hakko.indexOf('to: basaraTo_()') >= 0,
  '（人が押すまで外に出さない＝連絡の決まり）');

/* ── ❌ キャンセル ─────────────────────────────────────── */
ok('❌キャンセルの☑は、発注書の30列目（うっかり押しにくい端）',
  /cancel:30/.test(GAS) &&
  bodyOf(GAS, 'oosYukaOnEdit').indexOf('e.range.getColumn() === OOS_YC.cancel') >= 0);
ok('❌📦 在庫を戻す（引いたロットに、引いた本数だけ）',
  cancel.indexOf('var r = key ? oosYukaStockRestoreByKey_(key) :') >= 0,
  '（ふだのある行なら必ず戻す。条件を書きかえないでください）');
ok('❌バサラの御請求明細も取り消す',
  cancel.indexOf('oosBasaraMeisaiCancel_(m[1])') >= 0 &&
  GAS.indexOf('function oosBasaraMeisaiCancel_') >= 0,
  '（取り消さないと、キャンセルした分が請求書に載ります）');
ok('❌本部にLINEで知らせる', cancel.indexOf('oosLineToHonbu_') >= 0);
ok('❌A列は赤（発送しないでください）に戻す',
  cancel.indexOf('OOS_YUKA_BTN_STOP') >= 0);
ok('❌もう発送した行は、ここでは取り消せない',
  cancel.indexOf('もう発送した注文です。ここではキャンセルできません') >= 0,
  '（本部へご連絡いただく決まりです）');
ok('❌二重には戻さない（引いた印を見ている）',
  bodyOf(GAS, 'oosYukaStockRestoreByKey_').indexOf('この注文は在庫を引いていません') >= 0);

/* ── 備考欄（U列）とお客様からのメモ ───────────────────────── */
ok('備考欄（U列＝21列目）が、弊社への連絡欄',
  /memoIn:21/.test(GAS));
ok('そこに書かれた言葉は、倉庫スプシの32列目「お客様からのメモ」へ',
  /kokyakuMemo:32/.test(GAS) &&
  accept.indexOf('d[OOS_BC.memoIn-1]') >= 0);

/* ── 図と、プログラムが食いちがっていないか ─────────────────── */
/* ★図（ひろみさんが見て確定したもの）に書いてあることを、そのまま見張ります。
   どちらか片方だけ直すと、ここで落ちます。 */
[
  ['☑で在庫が減ると図に書いてある', 'ここで在庫が減ります'],
  ['🔵の安全網が図に書いてある', '在庫の安全網'],
  ['キャンセルで在庫が戻ると図に書いてある', '在庫が戻る'],
  ['キャンセルは30列目だと図に書いてある', '30列目'],
  ['発送後は取り消せないと図に書いてある', 'もう発送した行はここでは取り消せません'],
  ['連絡欄は備考欄（U列）だと図に書いてある', '「備考欄」（U列）'],
  ['倉庫へは32列目だと図に書いてある', '32列目'],
  ['原さんへの発送連絡はしないと図に書いてある', '原さんへの連絡はしません'],
].forEach(function (p) { ok('図：' + p[0], ZU.indexOf(p[1]) >= 0); });
ok('図に「AA列」がもう書かれていない',
  ZU.indexOf('AA列「本部へのご連絡」') < 0,
  '（2026-09-09に備考欄U列へ移しました）');

/* ── 結果 ───────────────────────────────────────────────── */
const title = '🔒 バサラ発注の流れ 確定（一切変えない・2026-09-10 ひろみさん）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  console.log('        ↑ 確定した流れが変わっています。直す前にひろみさんに確認してください。');
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
