/* ══════════════════════════════════════════════════════════════════════
   お客様からのメモ（備考欄・U列）と、受付後・発送後の行ロック
   2026-09-09 ひろみさん指示（最終）

   ★決まったこと
     ① バサラ発注シートで、お客様が弊社へお書きになる連絡は
        【21列目＝備考欄（U列）】。★AA列（27列目）は使いません。
        理由：このタブは保護してあり、原さんが書けるのは A列（☑）と C〜X（3〜24列）だけ。
        AA列は保護の外なので、書こうとしても弾かれていました（2026-09-09 実物で確認）。
     ② ☑を押した瞬間に、倉庫共有スプシの発注書【32列目＝お客様からのメモ】へ写す。
        ★この列は、バサラスター様だけでなく、今後どのお取引先でも【いつも同じ列】。
          取引先ごとに場所が変わると、見逃しが起きるため（ひろみさん指示）。
     ③ メモの有無は【単独のLINEにしない】。発注のお知らせに一言そえるだけ。
     ④ ☑を押したあとの行は、お客様が編集できないように保護する。
        変更・キャンセルはご連絡いただき、本部が保護を外して取り消す。
     ⑤ ★2026-09-09 追加：送り状NO.（25列目）が入った行も同じように閉める。
        発送のあとに数や金額を書き換えられると、水増し請求ができてしまうため
        （ひろみさん「決めたルールは勝手に変えないで」）。

   ★2026-09-09 に実際に踏んだ落とし穴
     ・発注シートを読む幅が 25列目までだったため、右の列がいつも空になっていた。
     ・保護は【ファイルの持ち主には効かない】。持ち主の画面で書けても壊れてはいない。
       確かめ方は ?action=oosBasaraProtCheck（誰が書けるかの一覧）。

   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ── ① 列の決めごと ───────────────────────────────────────── */
ok('①お客様の連絡欄は21列目＝備考欄（OOS_BC.memoIn）',
  /memoIn:21\s*\}/.test(GAS),
  '（U列。原さんが書ける範囲の中にあります）');
ok('①AA列（27）はもう使わない',
  !/memo:27/.test(GAS),
  '（27に戻すと、書いても弊社に届きません）');
ok('①倉庫スプシの32列目が「お客様からのメモ」（OOS_YC.kokyakuMemo）',
  /kokyakuMemo:32\s*\}/.test(GAS),
  '（どの取引先でも、いつもこの1列。動かすと見逃します）');
ok('①倉庫スプシに見出しを作る部品がある（oosKokyakuMemoColumn_）',
  GAS.indexOf('function oosKokyakuMemoColumn_') >= 0 &&
  GAS.indexOf("setValue('お客様からのメモ") >= 0);
/* ★2026-09-09 実際にやってしまった失敗の見張り。
   見出しを作るコードを【早期returnのうしろ】に置いたため、一度も実行されず、
   窓口は ok を返すのに列見出しが空のままでした（返事だけ見て安心した私のミス）。 */
ok('①見出し作りが、早期returnより【前】で呼ばれている',
  (function () {
    const i = GAS.indexOf('oosKokyakuMemoColumn_(sh);');
    const j = GAS.indexOf("if(h27.indexOf('発注者') >= 0) return");
    return i >= 0 && j >= 0 && i < j;
  })(),
  '（うしろに置くと、すでに用意ずみのときに一度も作られません）');
ok('①単独で呼べる窓口がある（oosKokyakuMemoColumn）',
  GAS.indexOf('function oosKokyakuMemoColumn(') >= 0 &&
  GAS.indexOf("action === 'oosKokyakuMemoColumn'") >= 0,
  '（あとから列だけ整え直せるように）');
ok('①発注シート側の見出しを整える窓口がある（oosBasaraMemoColumn）',
  GAS.indexOf('function oosBasaraMemoColumn') >= 0);
ok('①その窓口が、備考欄（U列）の見出しを書いている',
  GAS.indexOf("c.setValue('備考欄") >= 0 &&
  GAS.indexOf('弊社へのご連絡もこちらへ') >= 0);
ok('①その窓口が、AA列（27）を隠している',
  GAS.indexOf('sh.hideColumns(27)') >= 0,
  '（書いても届かない欄を、見えるところに残さない）');
ok('①発注シートの見張りが「備考欄」を見ている',
  GAS.indexOf("{at:OOS_BC.note,  has:['備考欄'], not:['熨斗']}") >= 0,
  '（見出しから「備考欄」の3文字を消さないでください）');

/* ── ② 読み取り幅（★実際に踏んだ落とし穴） ───────────────────── */
const body = (function () {
  const m = GAS.match(/function\s+oosBasaraOrderAccept_\s*\([^)]*\)\s*\{/);
  if (!m) return '';
  let i = GAS.indexOf(m[0]) + m[0].length - 1, d = 0;
  for (; i < GAS.length; i++) { if (GAS[i] === '{') d++; else if (GAS[i] === '}') { d--; if (!d) break; } }
  return GAS.slice(GAS.indexOf(m[0]), i + 1);
})();
ok('②☑の処理が読めた', !!body);
ok('②発注シートを【OOS_BCの一番右まで】読んでいる',
  body.indexOf('Math.max(OOS_BC.track, OOS_BC.memoIn)') >= 0,
  '（幅が足りないと、右の列がいつも空になります）');

/* ── ③ メモを渡して、書いている ─────────────────────────────── */
ok('③備考欄からメモを読み出している', body.indexOf('d[OOS_BC.memoIn-1]') >= 0);
ok('③倉庫へ渡している', body.indexOf('kokyakuMemo:kokyakuMemo') >= 0);
ok('③倉庫スプシに書き込んでいる',
  GAS.indexOf('sh.getRange(newRow, OOS_YC.kokyakuMemo).setValue(String(order.kokyakuMemo).trim())') >= 0);

/* ── ④ LINEは単独にしない（発注のお知らせに一言） ─────────────── */
ok('④メモがあるときだけ、発注のお知らせに一言そえる',
  GAS.indexOf('📝 お客様からのメモに記入があります') >= 0 &&
  GAS.indexOf('kokyakuMemo ?') >= 0,
  '（ひろみさん指示：メモ単独のLINEは飛ばさない）');
ok('④メモ専用のLINEを飛ばしていない',
  (GAS.match(/oosLineToHonbu_\([^)]*メモ/g) || []).length <= 1,
  '（お知らせが2通になると、かえって気づきにくくなります）');

/* ── ⑤ 受付後・発送後の行ロック ───────────────────────────── */
ok('⑤行を保護する部品がある（oosBasaraLockRow_）',
  GAS.indexOf('function oosBasaraLockRow_') >= 0);
ok('⑤☑の処理の中で、実際に保護している',
  body.indexOf('oosBasaraLockRow_(sh, row)') >= 0,
  '（ロックしないと、あとから書き換えられて誰も気づけません）');
ok('⑤保護は「受付の印をつけたあと」に行う',
  body.indexOf('oosBasaraLockRow_(sh, row)') > body.indexOf("cell.setValue('✅ 受付 "),
  '（先に保護すると、受付の印が書けなくなります）');
ok('⑤送り状NO.を配ったときも、その行を閉めている',
  GAS.indexOf('oosBasaraLockRow_(bsh, brow)') >= 0,
  '（発送後に書き換えられると、水増し請求ができてしまいます）');
ok('⑤手で送り状NO.を書いたときも閉めている（onEdit）',
  GAS.indexOf('if(e.range.getColumn()===OOS_BC.track && e.range.getNumColumns()===1 && e.range.getRow()>=2)') >= 0);
ok('⑤本部が保護を外す窓口がある（キャンセル・直し用）',
  GAS.indexOf('function oosBasaraUnlockRow') >= 0 &&
  GAS.indexOf("action === 'oosBasaraUnlockRow'") >= 0);
ok('⑤保護が本当に付くかを実物で試す窓口がある（oosBasaraLockTest）',
  GAS.indexOf('function oosBasaraLockTest') >= 0 &&
  GAS.indexOf("action === 'oosBasaraLockTest'") >= 0,
  '（「okが返った」で終わらせないための窓口です）');
ok('⑤誰が書けるかを読む窓口がある（oosBasaraProtCheck）',
  GAS.indexOf('function oosBasaraProtCheck') >= 0 &&
  GAS.indexOf("action === 'oosBasaraProtCheck'") >= 0);
ok('⑤「持ち主には効かない」ことがコードに書き残してある',
  GAS.indexOf('スプレッドシートの保護は、【ファイルの持ち主には効きません】') >= 0,
  '（次に同じ疑いが出たとき、すぐ思い出せるように）');

/* ── ⑥ 説明書に書いてあること ─────────────────────────────── */
ok('⑥説明書が「備考欄（U列）」を案内している',
  GAS.indexOf("T('　　「備考欄」（U列）にご記入ください。', 'hl');") >= 0);
ok('⑥説明書からAA列の案内が消えている',
  GAS.indexOf('「本部へのご連絡」欄（AA列）にご記入ください。') < 0);
ok('⑥説明書に「☑の前に書いてください」と書いてある',
  GAS.indexOf('☑ を押す前にご記入ください（押したあとは書き込めなくなります）') >= 0);
ok('⑥説明書に「☑のあとは編集できません」と書いてある',
  GAS.indexOf('☑ を押されたあとの行は編集できなくなります。') >= 0);
ok('⑥説明書に「送り状NO.が入ったら編集できない」と書いてある',
  GAS.indexOf('※ 送り状NO.が入りますと行がグレーになり、その行は編集できなくなります。') >= 0,
  '（発送後に書き換えられると、水増し請求ができてしまいます）');
ok('⑥説明書に「変更・キャンセルはご連絡ください」と書いてある',
  GAS.indexOf('内容のご変更・キャンセルがございましたら、お手数ですがご連絡ください。') >= 0);
ok('⑥説明書に「書き直しても届きません」と書いてある',
  GAS.indexOf('シートに書き直していただいても、弊社には届きません') >= 0,
  '（ここを書かないと、書き直して伝わったつもりになります）');

/* ── 結果 ───────────────────────────────────────────────── */
const title = 'お客様からのメモ（備考欄U列）と、受付後・発送後の行ロック（2026-09-09 ひろみさん指示）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
