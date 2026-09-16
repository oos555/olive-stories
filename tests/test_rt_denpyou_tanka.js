/* ══════════════════════════════════════════════════════════════════════
   🔒 単価は【いつでも価格マスタから】── 伝票の数字を使わない
   2026-09-16　ひろみさん確定

   ★ひろみさんの言葉
     「**価格マスタから単価は使って！ 伝票は間違っていることがあるから、
     　今のやり方で合ってたの**」

   ★なぜこの見張りが要るか
     2026-09-16、私（Claude）が「RTの伝票に書かれた単価をそのまま書類に使う」
     入口（unitPriceFixed）を足しかけました。ひろみさんの指示で取りやめました。
     理由：**RTの伝票の単価は間違っていることがある。うちの正しい単価は価格マスタ。**

     同じことをもう一度やらないように、機械で見張ります。
     名前を変えても（useLinePrice / priceOverride など）同じことなので、
     「行に書いてある単価をそのまま返す」形そのものを見ます。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(LIVE, f), 'utf8');
const KAK_SRC = read('oos-kakaku.js');
const INDEX = read('index.html');

const title = '🔒 単価は価格マスタから（伝票の数字を使わない／2026-09-16）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function eq(name, got, want){
  ok(name, JSON.stringify(got) === JSON.stringify(want),
     '（出た答え：' + JSON.stringify(got) + '／ほしい答え：' + JSON.stringify(want) + '）');
}

/* ══════════════════════════════════════════════════════════════
   ① 本物の unitPriceForLine を動かす
   　 行に単価が書いてあっても、価格マスタの数字が返ること
   ══════════════════════════════════════════════════════════════ */
const ctx = vm.createContext({ String: String, Number: Number, Math: Math, Array: Array, Object: Object });
ctx.window = ctx; ctx.globalThis = ctx;
vm.runInContext(KAK_SRC, ctx);
const KAK = ctx.OOS_KAKAKU;

const PM = [{ sku: 'ORG100', priceRT: 1000, priceGeneral: 1500 }];
const order = { customerType: 'rt' };

eq('①行に単価が無ければ、価格マスタのRT価格',
   KAK.unitPriceForLine(order, { productId: 1 }, 'ORG100', PM, null), 1000);

/* ★ここが本番：行に 9999 と書いてあっても、価格マスタの 1000 が返ること */
eq('①行に単価が書いてあっても、価格マスタが勝つ',
   KAK.unitPriceForLine(order, { productId: 1, unitPrice: 9999 }, 'ORG100', PM, null), 1000);
eq('①unitPriceFixed が立っていても、価格マスタが勝つ',
   KAK.unitPriceForLine(order, { productId: 1, unitPrice: 9999, unitPriceFixed: true }, 'ORG100', PM, null), 1000);
eq('①priceOverride のような別名でも、価格マスタが勝つ',
   KAK.unitPriceForLine(order, { productId: 1, priceOverride: 9999, useLinePrice: true }, 'ORG100', PM, null), 1000);

/* 無料サンプルの0円だけは、今までどおり0（この決めごとは消さない） */
eq('①無料サンプルは0円のまま',
   KAK.unitPriceForLine(order, { productId: 1, giftType: 'sample_free' }, 'ORG100', PM, null), 0);

/* ══════════════════════════════════════════════════════════════
   ② 先祖返りの見張り（「行の単価をそのまま返す」形が戻っていないか）
   ══════════════════════════════════════════════════════════════ */
const fn = H.cut(KAK_SRC, 'unitPriceForLine');
eq('②行の単価をそのまま返す枝が無い',
   /return\s+Number\(\s*line\.unitPrice/.test(fn), false);
eq('②unitPriceFixed という言葉が、計算の中に無い',
   /unitPriceFixed/.test(fn), false);
eq('②単価を返す道は1つだけ（priceForSku）',
   (fn.match(/return /g) || []).length, 2);   /* 無料サンプルの0 と priceForSku の2つだけ */

/* ══════════════════════════════════════════════════════════════
   ③ RTの伝票取り込みが、書類に単価を渡していないこと
   ══════════════════════════════════════════════════════════════ */
const rtDocAll = H.cut(INDEX, 'rtOrderForDoc');
/* ★説明書き（コメント）には「足さないでください」と書いてあるので、
   　そこは除けてから、本当に渡していないかを見ます。 */
const rtDoc = rtDocAll.replace(/\/\*[\s\S]*?\*\//g, '');
eq('③RTの伝票取り込みは、書類に unitPrice を渡さない',
   /unitPrice\s*:/.test(rtDoc), false);
eq('③unitPriceFixed も渡さない',
   /unitPriceFixed/.test(rtDoc), false);
eq('③なぜ渡さないかが、その場に書いてある',
   rtDocAll.indexOf('価格マスタから単価は使って') < 0, false);

/* ④ 決めごとが親にも残っていること */
eq('④親に「価格マスタが正」と書いてある',
   KAK_SRC.indexOf('価格マスタから単価は使って') < 0, false);

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
