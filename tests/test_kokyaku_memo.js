/* ══════════════════════════════════════════════════════════════════════
   お客様からのメモ（AA列）と、受付後の行ロック　2026-09-09 ひろみさん指示

   ★決まったこと
     ① バサラ発注シートの 27列目（AA）＝「本部へのご連絡」欄。
        お客様が発注のときに書いた連絡は、ここに書いていただく。
     ② ☑を押した瞬間に、倉庫共有スプシの発注書【32列目＝お客様からのメモ】へ写す。
        ★この列は、バサラスター様だけでなく、今後どのお取引先でも【いつも同じ列】。
          取引先ごとに場所が変わると、見逃しが起きるため（ひろみさん指示）。
     ③ メモの有無は【単独のLINEにしない】。発注のお知らせに一言そえるだけ。
     ④ ☑を押したあとの行は、お客様が編集できないように保護する。
        変更・キャンセルはご連絡いただき、本部が保護を外して取り消す。

   ★2026-09-09 に実際に踏んだ落とし穴
     発注シートを読む幅が 25列目（送り状NO.）までだったため、
     27列目のメモが【いつも空】になっていた。列を足したら読み取り幅も広げること。
     （2026-09-07 の送り元・2026-09-09 の賞味期限と、まったく同じ型のミス）

   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ── ① 列の決めごと ───────────────────────────────────────── */
ok('①バサラ発注シートの27列目が「本部へのご連絡」（OOS_BC.memo）',
  /memo:27\s*\}/.test(GAS),
  '（AA列。ここに書いた連絡が弊社に届きます）');
ok('①倉庫スプシの32列目が「お客様からのメモ」（OOS_YC.kokyakuMemo）',
  /kokyakuMemo:32\s*\}/.test(GAS),
  '（どの取引先でも、いつもこの1列。動かすと見逃します）');
ok('①倉庫スプシに見出しを作る部品がある（oosKokyakuMemoColumn_）',
  GAS.indexOf('function oosKokyakuMemoColumn_') >= 0 &&
  GAS.indexOf("setValue('お客様からのメモ") >= 0);
/* ★2026-09-09 実際にやってしまった失敗の見張り。
   見出しを作るコードを【早期returnのうしろ】に置いたため、一度も実行されず、
   窓口は ok を返すのに列見出しが空のままでした（返事だけ見て安心した私のミス）。
   ★見出し作りは、必ず早期returnより前で呼ぶこと。 */
ok('①見出し作りが、早期returnより【前】で呼ばれている',
  (function(){
    const i = GAS.indexOf('oosKokyakuMemoColumn_(sh);');
    const j = GAS.indexOf("if(h27.indexOf('発注者') >= 0) return");
    return i >= 0 && j >= 0 && i < j;
  })(),
  '（うしろに置くと、すでに用意ずみのときに一度も作られません）');
ok('①単独で呼べる窓口がある（oosKokyakuMemoColumn）',
  GAS.indexOf('function oosKokyakuMemoColumn(') >= 0 &&
  GAS.indexOf("action === 'oosKokyakuMemoColumn'") >= 0,
  '（あとから列だけ整え直せるように）');
ok('①バサラ発注シートに見出しを作る窓口がある（oosBasaraMemoColumn）',
  GAS.indexOf('function oosBasaraMemoColumn') >= 0);

/* ── ② 読み取り幅（★実際に踏んだ落とし穴） ───────────────────── */
const body = (function () {
  const m = GAS.match(/function\s+oosBasaraOrderAccept_\s*\([^)]*\)\s*\{/);
  if (!m) return '';
  let i = GAS.indexOf(m[0]) + m[0].length - 1, d = 0;
  for (; i < GAS.length; i++) { if (GAS[i] === '{') d++; else if (GAS[i] === '}') { d--; if (!d) break; } }
  return GAS.slice(GAS.indexOf(m[0]), i + 1);
})();
ok('②☑の処理が読めた', !!body);
ok('②発注シートを【27列目まで】読んでいる',
  body.indexOf('Math.max(OOS_BC.track, OOS_BC.memo)') >= 0,
  '（OOS_BC.track までだと、27列目のメモがいつも空になります）');
ok('②25列目までに戻っていない',
  body.indexOf('sh.getRange(row,1,1,OOS_BC.track).getDisplayValues()') < 0,
  '（2026-09-09に実際にこれで空になりました。戻さないでください）');

/* ── ③ メモを渡して、書いている ─────────────────────────────── */
ok('③メモを読み出している', body.indexOf('d[OOS_BC.memo-1]') >= 0);
ok('③倉庫へ渡している', body.indexOf('kokyakuMemo:kokyakuMemo') >= 0);
ok('③倉庫スプシに書き込んでいる',
  GAS.indexOf('sh.getRange(newRow, OOS_YC.kokyakuMemo).setValue(String(order.kokyakuMemo).trim())') >= 0);

/* ── ④ LINEは単独にしない（発注のお知らせに一言） ─────────────── */
ok('④メモがあるときだけ、発注のお知らせに一言そえる',
  /kokyakuMemo \? '\\n📝 お客様からのメモに記入があります/.test(GAS),
  '（ひろみさん指示：メモ単独のLINEは飛ばさない）');
ok('④メモ専用のLINEを飛ばしていない',
  (GAS.match(/oosLineToHonbu_\([^)]*メモ/g) || []).length <= 1,
  '（お知らせが2通になると、かえって気づきにくくなります）');

/* ── ⑤ 受付後の行ロック ───────────────────────────────────── */
ok('⑤行を保護する部品がある（oosBasaraLockRow_）',
  GAS.indexOf('function oosBasaraLockRow_') >= 0);
ok('⑤☑の処理の中で、実際に保護している',
  body.indexOf('oosBasaraLockRow_(sh, row)') >= 0,
  '（ロックしないと、あとから書き換えられて誰も気づけません）');
ok('⑤保護は「受付の印をつけたあと」に行う',
  body.indexOf('oosBasaraLockRow_(sh, row)') > body.indexOf("cell.setValue('✅ 受付 "),
  '（先に保護すると、受付の印が書けなくなります）');
ok('⑤本部が保護を外す窓口がある（キャンセル・直し用）',
  GAS.indexOf('function oosBasaraUnlockRow') >= 0 &&
  GAS.indexOf("action === 'oosBasaraUnlockRow'") >= 0);

/* ── ⑥ 説明書に書いてあること ─────────────────────────────── */
ok('⑥説明書に「本部へのご連絡」欄の案内がある',
  GAS.indexOf('「本部へのご連絡」欄（AA列）にご記入ください。') >= 0);
ok('⑥説明書に「☑の前に書いてください」と書いてある',
  GAS.indexOf('☑ を押す前にご記入ください（押したあとは書き込めなくなります）') >= 0);
ok('⑥説明書に「☑のあとは編集できません」と書いてある',
  GAS.indexOf('☑ を押されたあとの行は編集できなくなります。') >= 0);
ok('⑥説明書に「変更・キャンセルはご連絡ください」と書いてある',
  GAS.indexOf('内容のご変更・キャンセルがございましたら、お手数ですがご連絡ください。') >= 0);
ok('⑥説明書に「書き直しても届きません」と書いてある',
  GAS.indexOf('シートに書き直していただいても、弊社には届きません') >= 0,
  '（ここを書かないと、書き直して伝わったつもりになります）');

/* ── 結果 ───────────────────────────────────────────────── */
const title = 'お客様からのメモ（AA列）と受付後の行ロック（2026-09-09 ひろみさん指示）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
