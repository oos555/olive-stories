/* 統合マスタＮ 輸入の「フリー」の見張り（2026-08-19 ひろみさん決定）

   決めたこと：
     輸入で埋めるべき数（必須数） ＝ 予約 − 販売可能数（0本より下にはしない）
     フリー                       ＝ 予定 − 必須数    ★マイナスならマイナスで出す

   いまの販売可能数（棚にあって売れる本数）でまかなえる予約は、輸入を待たなくてよい。
   ひろみさんの検算（オルガニック750ml）：予定12／予約24／販売可能12 → フリー 0。

   ★ここまで2回直している。戻さないために両方を見張る：
     ① Math.min(予約, 予定) の切り詰めに戻さない（予約が多いとフリーが0で止まる）
     ② 販売可能数を引くのをやめない

   ただし「📦 一気に在庫へ入れる」(importAllList) は今までどおり切り詰める。
   あちらは実際に在庫を動かすので、マイナスを入れてはいけない（在庫が狂う）。 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'master.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

/* ── ① 画面の式（renderInvTable）が決めたとおりか ── */
const shown = src.match(/var availNow = [\s\S]{0,500}?else \{ preInc = '-'/);
eq('① 画面の式が見つかる', !!shown, true);
const shownSrc = shown ? shown[0] : '';
eq('① 画面のフリーに Math.min の切り詰めが戻っていない', /preInc = Math\.min/.test(shownSrc), false);
eq('① 販売可能数を引いている',   /preInc = Math\.max\(0, yoyaku - availNow\)/.test(shownSrc), true);
eq('① フリー＝予定−必須数',       /freeInc = incNum - preInc/.test(shownSrc), true);
eq('① 販売可能数は現ロットのもの', /n\.cur && typeof n\.cur\.sellable === 'number'/.test(shownSrc), true);

/* ── ② 一気に入れる側は切り詰めたまま（在庫を守る） ── */
const impl = src.match(/function importAllList\(\)[\s\S]*?\n\}/);
eq('② importAllList が見つかる', !!impl, true);
eq('② 一気に入れる側は Math.min のまま', /var pre = Math\.min\(n\.preQty \|\| 0, inc\);/.test(impl ? impl[0] : ''), true);
eq('② 一気に入れる側のフリーは inc − pre', /free:\(inc - pre\)/.test(impl ? impl[0] : ''), true);

/* ── ③ 見せ方 ── */
eq('③ マイナスは赤で出す',            /freeInc<0\)\?' style="color:#dc2626"'/.test(src), true);
eq('③ 足りない本数を言葉で出す',      /予約に対して輸入が'\+Math\.abs\(freeInc\)\+'本たりません/.test(src), true);
eq('③ 在庫でまかなえた分を言葉で出す', src.indexOf('本は今の販売可能数でまかなえます') >= 0, true);

/* ── ④ 実際の数字（画面の式をそのまま動かす） ── */
function freeOf(incoming, preQty, availNow){
  var incNum = (typeof incoming === 'number') ? incoming : 0;
  var preInc, freeInc;
  if(typeof incoming === 'number'){
    var yoyaku = preQty || 0;
    preInc = Math.max(0, yoyaku - (availNow || 0));
    freeInc = incNum - preInc;
  } else { freeInc = '-'; }
  return freeInc;
}
eq('④ ★ひろみさんの検算 予定12・予約24・販売可能12 → フリー 0', freeOf(12, 24, 12), 0);
eq('④ 予定24・予約6・販売可能0   → フリー 18', freeOf(24, 6, 0), 18);
eq('④ 予定24・予約6・販売可能35  → フリー 24（予約は在庫で全部まかなえる）', freeOf(24, 6, 35), 24);
eq('④ 予定10・予約0・販売可能0   → フリー 10', freeOf(10, 0, 0), 10);
eq('④ 予定10・予約15・販売可能0  → フリー −5', freeOf(10, 15, 0), -5);
eq('④ 予定0・予約8・販売可能0    → フリー −8', freeOf(0, 8, 0), -8);
eq('④ 予定0・予約8・販売可能8    → フリー 0',  freeOf(0, 8, 8), 0);
eq('④ セット商品はハイフンのまま', freeOf('-', 3, 0), '-');

/* ── ⑤ 一気に入れる側は、予約が多くてもマイナスにならない ── */
function implFree(inc, preQty){ var pre = Math.min(preQty || 0, inc); return inc - pre; }
eq('⑤ 予定12・予約24 でも 一気に入れるフリーは0',  implFree(12, 24), 0);
eq('⑤ 予定24・予約6  なら 一気に入れるフリーは18', implFree(24, 6), 18);

/* ── ⑥ 決めごとの言葉が消えていないか ── */
/* ★2026-08-20 画面のⓘ説明から「予定＝予約＋フリー」の一文を外した。
   新しい式（フリー＝予定−（予約−販売可能数））では、この足し算は成り立たないため
   （例：予定24・予約6・販売可能35 → フリー24。6＋24は24にならない）。
   ★足し算が今も成り立つのは【ボタン側】。そちらを見張る。
   ★あわせて、新しい式の説明が画面に出ているかも見張る。 */
function btnSplit(inc, preQty){ var pre = Math.min(preQty || 0, inc); return { hold: pre, shelf: inc - pre }; }
eq('⑥ ボタン側は 棚へ＋取り置きへ＝予定 のまま', btnSplit(24,6).shelf + btnSplit(24,6).hold, 24);
eq('⑥ 予約が予定より多くても合計は予定のまま',   btnSplit(10,30).shelf + btnSplit(10,30).hold, 10);
eq('⑥ 画面のⓘに新しい式が書いてある', src.indexOf('輸入で埋めるべき数 ＝ 予約 − 販売可能数') >= 0, true);
eq('⑥ 画面のⓘに検算の例が書いてある', src.indexOf('予定12・予約24・販売可能12 → 埋めるべき12 → フリー 0') >= 0, true);
eq('⑥ 赤いマイナスの意味が書いてある', src.indexOf('予約に対して輸入が足りません') >= 0, true);
eq('⑥ Math.min に戻すなの注意書きが残っている',       src.indexOf('Math.min には戻さない') >= 0, true);
eq('⑥ 販売可能数を引くのをやめるなの注意書きが残っている', src.indexOf('販売可能数を引くのをやめない') >= 0, true);
eq('⑥ ひろみさんの検算が注意書きに残っている',        src.indexOf('予定12／予約24／販売可能12') >= 0, true);

console.log('===== 輸入の「フリー」 =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
