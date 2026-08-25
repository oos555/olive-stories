/* 紙袋(BAG001/BAG002)は「RT限定（卸なし）」ではない（2026-08-25 ひろみさん確定・実装済み）
   きっかけ：卸のお客様から紙袋だけの注文が来ることがあるのに、noWholesale:true のせいで
   受注登録時にエラーで止まっていた（本来このチェックはトルコ産100mlオイルの単品売りなど、
   RT限定の商品のためのもの。紙袋には関係ない）。
   本物のデータ（統合マスタNのスプレッドシート）は2026-08-25にチェックを外す形で直した。
   ここでは、各アプリが持つ「初回表示用のフォールバックデータ」も、生きたデータと矛盾しないよう
   同じ状態（noWholesale:false）にそろっていることを見張る。 */
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function ok(l, cond){ if(cond) pass++; else { fail++; fails.push(l); } }

const FILES = ['index.html', 'master.html', 'pickup.html', 'billing.html', 'mitsumori.html', 'labels.html', 'stock.html'];
FILES.forEach(function(f){
  const src = H.read(f);
  ok(f+'：BAG001のフォールバックがある', src.indexOf("sku:'BAG001'") >= 0);
  ok(f+'：BAG001はnoWholesale:false（卸で注文できる）', src.indexOf("sku:'BAG001', name:'紙袋 黒 小', group:'ギフト箱・備品', noWholesale:false") >= 0);
  ok(f+'：BAG002はnoWholesale:false（卸で注文できる）', src.indexOf("sku:'BAG002', name:'紙袋 黒 大', group:'ギフト箱・備品', noWholesale:false") >= 0);
});

/* 受注Ａの実際の判定ロジックで、卸のお客様が紙袋だけ注文してもブロックされないことを確認 */
{
  const src = H.read('index.html');
  const m = src.match(/if\(p && p\.noWholesale && o\.customerType!=='rt' && o\.customerType!=='rtgc'[^\n]*\)\{/);
  ok('受注Ａの判定ロジックが今までどおりの形で残っている（書き換えていない）', !!m);
  if(m){
    // eslint-disable-next-line no-new-func
    const check = new Function('p','o','l', 'return ' + m[0].slice(2, -1) + ';');
    ok('紙袋(noWholesale:false)は卸①でもブロックされない', check({ noWholesale:false }, { customerType:'wholesale1' }, { giftType:'' }) === false);
    ok('（対照）RT限定商品(noWholesale:true)は卸①だとブロックされる', check({ noWholesale:true }, { customerType:'wholesale1' }, { giftType:'' }) === true);
    ok('（対照）RT限定商品でもRTのお客様ならブロックされない', check({ noWholesale:true }, { customerType:'rt' }, { giftType:'' }) === false);
  }
}

console.log('===== 紙袋は「RT限定（卸なし）」ではない（2026-08-25） =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
