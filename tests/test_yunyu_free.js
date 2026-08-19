/* 統合マスタＮ 輸入の「フリー」の見張り（2026-08-19 ひろみさん指示）

   決めたこと：在庫リストの「フリー」は 予定 − 予約 をそのまま出す。
   **マイナスになるならマイナスで出す**（予約に対して輸入が足りない、という大事な合図）。
   それまでは Math.min(予約, 予定) で切り詰めていたため、
   予約が予定より多いと フリーが必ず 0 になり、となりの「予約」列と引き算が合わなかった。

   ただし「📦 一気に在庫へ入れる」(importAllList) は今までどおり切り詰める。
   あちらは実際に在庫を動かすので、マイナスを入れてはいけない（在庫が狂う）。

   本番 master.html の本物の式をそのまま読み取って確かめる（文字列としての検査を含む）。*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'master.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

/* ── ① 画面の式（renderInvTable）に切り詰めが戻っていないか ── */
const shown = src.match(/var preInc, freeInc;[\s\S]{0,400}?else \{ preInc = '-'/);
eq('① 画面の式が見つかる', !!shown, true);
const shownSrc = shown ? shown[0] : '';
eq('① 画面のフリーに Math.min が無い', /Math\.min/.test(shownSrc), false);
eq('① 画面のフリーは 予定−予約', /preInc = n\.preQty \|\| 0; freeInc = incNum - preInc;/.test(shownSrc), true);

/* ── ② 一気に入れる側は切り詰めたまま（在庫を守る） ── */
const impl = src.match(/function importAllList\(\)[\s\S]*?\n\}/);
eq('② importAllList が見つかる', !!impl, true);
eq('② 一気に入れる側は Math.min のまま', /var pre = Math\.min\(n\.preQty \|\| 0, inc\);/.test(impl ? impl[0] : ''), true);
eq('② 一気に入れる側のフリーは inc − pre', /free:\(inc - pre\)/.test(impl ? impl[0] : ''), true);

/* ── ③ マイナスのときの見せ方 ── */
eq('③ マイナスは赤で出す',       /freeInc<0\)\?' style="color:#dc2626"'/.test(src), true);
eq('③ 足りない本数を言葉で出す', /予約に対して輸入が'\+Math\.abs\(freeInc\)\+'本たりません/.test(src), true);

/* ── ④ 実際の数字（画面の式をそのまま動かす） ── */
function freeOf(incoming, preQty){
  var incNum = (typeof incoming === 'number') ? incoming : 0;
  var preInc, freeInc;
  if(typeof incoming === 'number'){ preInc = preQty || 0; freeInc = incNum - preInc; }
  else { preInc = '-'; freeInc = '-'; }
  return freeInc;
}
eq('④ 予定24・予約6 → フリー18',    freeOf(24, 6), 18);
eq('④ 予定10・予約0  → フリー10',    freeOf(10, 0), 10);
eq('④ 予定10・予約10 → フリー0',     freeOf(10, 10), 0);
eq('④ 予定10・予約15 → フリー −5',   freeOf(10, 15), -5);
eq('④ 予定0・予約8   → フリー −8',   freeOf(0, 8), -8);
eq('④ セット商品はハイフンのまま',   freeOf('-', 3), '-');

/* ── ⑤ 一気に入れる側は、予約が多くてもマイナスにならない ── */
function implFree(inc, preQty){ var pre = Math.min(preQty || 0, inc); return inc - pre; }
eq('⑤ 予定10・予約15 でも 一気に入れるフリーは0', implFree(10, 15), 0);
eq('⑤ 予定24・予約6  なら 一気に入れるフリーは18', implFree(24, 6), 18);

/* ── ⑥ 決めごとの言葉が消えていないか ── */
eq('⑥ 予定＝予約＋フリー の説明が残っている', src.indexOf('予定 ＝ 予約 ＋ フリー') >= 0, true);
eq('⑥ Math.min を戻すなという注意書きが残っている', src.indexOf('ここに Math.min を戻さないでください') >= 0, true);

console.log('===== 輸入の「フリー」 =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
