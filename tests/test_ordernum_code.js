/* 注文番号の頭の暗号（orderNumCode）が受注A・見積М・お客様の注文ページの3つで
   食い違っていないかの見張り ── 2026-08-25 発見・修正の再発防止

   見つかった実際の穴：mitsumori.html と order.html の暗号表に basara(BA)・special(IT) が
   無く、バサラ・特別提供の注文番号を作ると既定値の TK になっていた
   （3ファイルで完全一致させる、というコード中のコメントに反していた）。

   本番のファイルから本物の orderNumCode をそのまま切り出して動かす。保存先には書き込まない。 */
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

function loadOrderNumCode(file){
  const src = H.read(file);
  const fn = H.cut(src, 'orderNumCode');
  const { box, ctx } = H.makeSandbox();
  require('vm').runInContext(fn, ctx);
  return box.orderNumCode;
}

const A = loadOrderNumCode('index.html');       // 受注A（この表が基準＝いちばん新しい・すべての種類を持つ）
const M = loadOrderNumCode('mitsumori.html');   // 見積・請求М
const O = loadOrderNumCode('order.html');       // お客様の注文ページ

/* 受注Aが知っている「本当に使われている」種類は、M・orderにも同じ暗号で存在すること。
   （M側だけの互換キー hub は対象外。3ファイル共通のものだけを見張る） */
const EXPECT = { general:'TK', wholesale1:'OS1', wholesale2:'OS2', basara:'BA', special:'IT', rt:'RT', rtgc:'RTG', defectprice:'FT' };
Object.keys(EXPECT).forEach(function(t){
  const want = EXPECT[t];
  eq('①受注A(' + t + ') の暗号', A(t), want);
  eq('②見積М(' + t + ') が受注Aと同じ暗号', M(t), want);
  eq('③お客様注文(' + t + ') が受注Aと同じ暗号', O(t), want);
});

/* 未知の種類は3ファイルとも安全に既定値TKへ落ちること（クラッシュしない） */
eq('④受注A：未知の種類はTK', A('nazono-shurui'), 'TK');
eq('⑤見積М：未知の種類はTK', M('nazono-shurui'), 'TK');
eq('⑥お客様注文：未知の種類はTK', O('nazono-shurui'), 'TK');

console.log('===== 注文番号の暗号（A・M・orderの一致）の見張り =====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if(fail){ fails.forEach(function(f){ console.log('  ★ ' + f); }); process.exit(1); }
