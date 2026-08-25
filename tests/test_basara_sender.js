/* 倉庫D（pickup.html）で、送り主がバサラではない注文の「送り主」表記や
   バサラへの自動発送連絡メールが、誤ってバサラ扱いされないかを本物の関数で試す。
   2026-08-25：ゆかさんの報告「送り主がバサラではない受注で、倉庫にLINEを送ったら
   送り主がバサラになった」の再発防止テスト。本番のデータには触らない。保存もしない。 */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname,'..','pickup.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(got === want) pass++; else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

const code = H.cut(src, 'isBasaraOrder') + '\n' + H.cut(src, 'isBasaraSenderTrusted');
const fn = new Function(code + '\nreturn {isBasaraOrder, isBasaraSenderTrusted};')();

/* ── ① 本物のバサラ注文（自動取込・source==='basara'）── */
{
  const o = { source:'basara', client:'バサラ', basaraOrderNo:'B18' };
  eq('①ゆるい判定：バサラ扱い', fn.isBasaraOrder(o), true);
  eq('①厳密な判定（送り主・自動メールに使う）：バサラ扱い', fn.isBasaraSenderTrusted(o), true);
}

/* ── ② 送り主がバサラではないのに、取引先名に「バサラ」の文字が入っている注文 ─────
   （ゆかさんの報告どおりの状況：受注一覧では正しかったのに、倉庫Dで送り主が変わった）── */
{
  const o = { source:'manual', client:'株式会社バサラ商事', senderName:'田中様' };
  eq('②ゆるい判定：文字が含まれるのでバサラ扱いになってしまう（既存の仕様）', fn.isBasaraOrder(o), true);
  eq('②厳密な判定：sourceがbasaraではないので、バサラ扱いにしない（今回の修正）', fn.isBasaraSenderTrusted(o), false);
}

/* ── ③ 送り主がバサラではないのに、メモに古いバサラ発注番号が残っている注文 ───── */
{
  const o = { source:'manual', client:'個人のお客様', basaraOrderNo:'B99' };
  eq('③ゆるい判定：発注番号が残っているのでバサラ扱いになってしまう（既存の仕様）', fn.isBasaraOrder(o), true);
  eq('③厳密な判定：sourceがbasaraではないので、バサラ扱いにしない（今回の修正）', fn.isBasaraSenderTrusted(o), false);
}

/* ── ④ STORESの注文 ─────────────────────────────────────── */
{
  const o = { source:'stores', client:'STORES 太郎' };
  eq('④ゆるい判定もバサラ扱いにしない', fn.isBasaraOrder(o), false);
  eq('④厳密な判定：STORESの注文はバサラ扱いにしない', fn.isBasaraSenderTrusted(o), false);
}

/* ── ⑤ RT（ホテル）の注文 ───────────────────────────────── */
{
  const o = { source:'rtm', client:'グランドエクシブ鳴門' };
  eq('⑤ゆるい判定もバサラ扱いにしない', fn.isBasaraOrder(o), false);
  eq('⑤厳密な判定：RTの注文はバサラ扱いにしない', fn.isBasaraSenderTrusted(o), false);
}

/* ── ⑥ 逆に、本物のバサラ注文で取引先名に「バサラ」の文字が無い場合でも、
   厳密な判定はsourceだけで正しく拾えること（sourceを軽視していないかの確認）── */
{
  const o = { source:'basara', client:'野々山様', recipientName:'野々山 千尋' };
  eq('⑥厳密な判定：取引先名にバサラの文字が無くてもsourceで正しく拾う', fn.isBasaraSenderTrusted(o), true);
}

/* ── ⑦ バサラから取り込んだ注文の取引先名を、あとから別の名前に手で直した場合
   （sourceはbasaraのまま）→ 送り主はバサラの固定表記のままでよい（sourceが正） ── */
{
  const o = { source:'basara', client:'名前を書き換えたあと', basaraOrderNo:'B20' };
  eq('⑦厳密な判定：取引先名を書き換えてもsourceがbasaraならバサラ扱いのまま', fn.isBasaraSenderTrusted(o), true);
}

/* ── ⑧ sourceが空文字・無い・大文字違いなど、うっかり紛れやすい形 ───────── */
{
  eq('⑧source未設定はバサラ扱いにしない', fn.isBasaraSenderTrusted({ client:'バサラ' }), false);
  eq('⑧sourceが空文字はバサラ扱いにしない', fn.isBasaraSenderTrusted({ source:'', client:'バサラ' }), false);
  eq('⑧sourceの大文字違い(Basara)はバサラ扱いにしない（表記ゆれを拾わない）', fn.isBasaraSenderTrusted({ source:'Basara' }), false);
}

/* ── ⑨ 注文そのものが無い（null/undefined）── */
{
  eq('⑨null注文はエラーにならずバサラ扱いにしない', fn.isBasaraSenderTrusted(null), false);
  eq('⑨undefined注文はエラーにならずバサラ扱いにしない', fn.isBasaraSenderTrusted(undefined), false);
}

/* ── ⑩ 本番の実データ全件（今日の時点で48件）と突き合わせた結果（2026-08-25実施・手動記録）───
   ゆるい判定と厳密な判定がずれた注文＝0件。今回の修正で、今ある注文の見え方は1件も変わらない
   （実際にバサラの文字を含む・発注番号が残っている注文が、今は無いことを確認済み）。
   個人情報を含むため、実データそのものはこのテストには入れない。 */

/* ── ⑪ 他の場所（送り状No.欄の出し分け・納品書の同梱判定など）を
   うっかり一緒に書き換えていないかの見張り（ソースの文字列を直接数える）───
   isBasaraSenderTrustedは「定義1回＋呼び出し2回（送り主表記／バサラへの自動メール）」の
   3回だけで使う約束。増えていたら、他の場所も知らないうちに厳密判定に変わっている。 */
{
  const trustedCount = (src.match(/isBasaraSenderTrusted\(/g) || []).length;
  eq('⑪isBasaraSenderTrustedは定義+呼び出し2箇所の3回だけで使われている', trustedCount, 3);
  const looseCount = (src.match(/isBasaraOrder\(/g) || []).length;
  eq('⑪isBasaraOrder（ゆるい判定）は、送り主表記・自動メールの2箇所を除いた分だけ残っている', looseCount, 5);
}

console.log('===== 倉庫D：送り主がバサラではない注文の見分け（本物の関数）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
