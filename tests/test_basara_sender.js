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

/* ── ④ 何も無い注文 ─────────────────────────────────────── */
{
  const o = { source:'stores', client:'STORES 太郎' };
  eq('④厳密な判定：STORESの注文はバサラ扱いにしない', fn.isBasaraSenderTrusted(o), false);
}

console.log('===== 倉庫D：送り主がバサラではない注文の見分け（本物の関数）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
