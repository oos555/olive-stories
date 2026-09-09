/* ══════════════════════════════════════════════════════════════════════
   区分（分類）の並び順と、品番の頭のきまり　2026-09-09夜 ひろみさん決定

   ★決まったこと
     ① 区分の並び順は【決めた順】。商品が1つも無い区分も選べる。
        前は「商品マスタに出てきた順」だったので、あとから作った区分が
        いつも一番うしろに来て、商品が0件の区分は消えていた。
        （ひろみさんが作った「セット」が選べなかったのは、これが理由）
     ② セットは【ギフト商品より前】。
     ③「ギフト箱・備品」は【備品-箱】【備品-バッグ】【備品-その他】の3つに分けた。
     ④ 品番の頭のきまり
          オイル … ローマ字3文字＋サイズ（ORG250・ARM500）※画面で決める
          セット … SET-　／　箱 … BOX-　／　紙袋・オーガンジー … BAG-
          その他の備品 … MISC-　／　オイル以外の売り物 … ETC-
        ★ひろみさんは「備品-その他はETC」とおっしゃったが、ETC はすでに
          【オイル以外の売り物】（ETC-001 ザクロソース）で使っているため、
          混ざらないように備品は MISC- のままにした（2026-09-09に説明ずみ）。
     ⑤ 新しいオイルは、ローマ字3文字を【ひろみさんが決める】。
        その3文字が、あとでサイズ違いが増えたときの品番のきまりになる。

   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const M = fs.readFileSync(path.join(ROOT, 'master.html'), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ── ① 区分の並び順が「決めごと」として書いてあること ──────────────
   ★2026-09-09 並び順の【親】は oos-kubun.js に引っ越しました。
     統合マスタＮ（名簿・価格リスト）と輸入・原価Ｅ（🔒原価データ）を
     同じ並びにするためです（ひろみさん指示）。
     ここも親を見ます。master.html に自前の表を書き戻したら、この見張りが落ちます。 */
let K = null;
try {
  const g = { window: {} };
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'oos-kubun.js'), 'utf8'), g);
  K = g.window.OOS_KUBUN || g.OOS_KUBUN;
} catch (e) { /* 下で落ちます */ }
ok('①区分の並び順の親（oos-kubun.js）がある', !!(K && Array.isArray(K.ORDER) && K.ORDER.length),
  '（無いと、アプリごとに自前の並びを持つことになり、必ずズレます）');
ok('①統合マスタＮは親から並びをもらっている',
  /MB_GROUP_ORDER = \(window\.OOS_KUBUN && window\.OOS_KUBUN\.ORDER\)/.test(M),
  '（自前の表に書き戻すと2か所になります）');
/* 以下の見張りは、親の並びを文字にして確かめます */
const order = K ? K.ORDER.map(function (g) { return "'" + g + "'"; }).join(',') : '';
['セット', 'ギフト商品', '備品-箱', '備品-バッグ', '備品-その他', 'アルモニア', '唐辛子オイル', 'オイル以外輸入商品'].forEach(g => {
  ok('①「' + g + '」が並び順に入っている', order.indexOf("'" + g + "'") >= 0);
});

/* ── ② セットはギフト商品より前 ───────────────────────────────── */
ok('②セットは【ギフト商品より前】',
  order.indexOf("'セット'") >= 0 && order.indexOf("'ギフト商品'") >= 0 &&
  order.indexOf("'セット'") < order.indexOf("'ギフト商品'"),
  '（ひろみさん指示：ギフト商品の前にセット商品を持ってくる）');

/* ②-2 ★2026-09-09夜 ひろみさん指示：オイル以外輸入商品は【その他オイルのすぐ後ろ】。
   オイルの仲間をひとかたまりにして、そのあとに輸入のオイル以外を置く。 */
ok('②-2 オイル以外輸入商品は【その他オイルのすぐ後ろ】',
  (function(){
    var list = (order.match(/'[^']+'/g)||[]).map(function(x){ return x.replace(/'/g,''); });
    var i = list.indexOf('その他オイル');
    return i >= 0 && list[i+1] === 'オイル以外輸入商品';
  })(),
  '（オイルの仲間のすぐ後ろに置く決めごとです）');
ok('②-2 カップオイルはそのあと',
  order.indexOf("'オイル以外輸入商品'") < order.indexOf("'カップオイル'"));

/* ── ③ 商品が0件の区分も選べること ───────────────────────────── */
ok('③商品が0件でも区分が消えない（決めた順を必ず出す）',
  /MB_GROUP_ORDER\.forEach\(function\(g\)\{ if\(!seen\[g\]\)/.test(M),
  '（消えると「備品-その他」や、作ったばかりの区分が選べません）');
ok('③表の見出しは、商品がある区分だけ出す（mGroupOrderWithItems）',
  M.indexOf('function mGroupOrderWithItems') >= 0 &&
  M.indexOf('mGroupOrderWithItems().forEach') >= 0,
  '（空の見出しが価格リストに並んでしまいます）');

/* ── ④ 種類と、品番の頭のきまり ───────────────────────────────── */
ok('④種類に「セット」がある', M.indexOf("{ code:'SET',  label:'🎁 セット（ギフトではない）' }") >= 0);
/* ★2026-08-18の決めごと：ETC はオイルのすぐ下。SETはそのあと。 */
const iOil = M.indexOf("label:'🫒 オイル'");
const iEtc = M.indexOf("label:'🍯 その他オイル以外の商品'");
const iSet = M.indexOf("label:'🎁 セット（ギフトではない）'");
ok('④ETCはオイルのすぐ下のまま（2026-08-18の決めごとを壊さない）',
  iOil >= 0 && iEtc > iOil && (iSet < 0 || iSet > iEtc),
  '（2026-09-09にセットを間へ割り込ませて、見張りに止められました）');

ok('④種類→区分の対応表がある（MB_KIND_GROUP）', M.indexOf('var MB_KIND_GROUP') >= 0);
[['SET', 'セット'], ['BOX', '備品-箱'], ['BAG', '備品-バッグ'], ['MISC', '備品-その他'], ['ETC', 'オイル以外輸入商品'], ['OIL2', 'その他オイル']].forEach(p => {
  ok('④' + p[0] + ' を選ぶと区分「' + p[1] + '」が入る',
    new RegExp(p[0] + ":'" + p[1] + "'").test(M));
});

/* ── ⑤ オイルは3文字＋サイズを人が決める ───────────────────────── */
ok('⑤オイルの品番を決める欄がある（mp-oil3 と mp-oilsize）',
  M.indexOf('id="mp-oil3"') >= 0 && M.indexOf('id="mp-oilsize"') >= 0);
ok('⑤3文字＋サイズから品番を作る計算がある（mbOilSkuChanged）',
  M.indexOf('function mbOilSkuChanged') >= 0);
ok('⑤オイルのときは番号を自動でつけない（人が3文字を決める）',
  /if\(v === 'OIL'\)\{\s*\n\s*s\.value = '';/.test(M),
  '（自動でOIL-003などを付けてしまうと、ローマ字3文字のきまりが使われません）');
ok('⑤品番がかぶったら知らせる',
  M.indexOf('はすでに使われています') >= 0);
ok('⑤同じ3文字の仲間を教える',
  M.indexOf('の仲間が ') >= 0,
  '（サイズ違いを足すとき、同じ3文字を使っていると分かるように）');

/* ── ⑥ 品番の頭のきまりが画面にも書いてあること ─────────────────── */
ok('⑥新規登録の画面に、品番の頭のきまりが出ている',
  M.indexOf('品番の頭のきまり') >= 0 &&
  M.indexOf('ローマ字3文字＋サイズ') >= 0,
  '（ひろみさん以外の人が登録するときに迷います）');

/* ── 結果 ───────────────────────────────────────────────── */
const title = '区分の並び順と品番の頭のきまり（2026-09-09夜 ひろみさん決定）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
