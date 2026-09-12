/* ══════════════════════════════════════════════════════════════════════════
   🔎 張りぼて点検　2026-09-12

   ★ひろみさんの言葉（2026-09-12）
     「なぜ次から次に残っているもの、消えるものが出てくるの？張りぼてすぎないか？」
     「本当になおしてるなら、徹底的になおしたら？それが機械だからできることでは？
     　人ができないからあなたがはたらくのでしょ？いみないじゃん、私から指摘されて」
     「その見張りが信用できない見張りになってるでしょ」

   ★この見張りの役目
     いままでは【指摘された1つ】を直してきました。同じ形の穴が何十とあるのに、
     出てくるまで気づきませんでした。だから何度も同じことが起きました。

     ここでは【同じ形の穴を、機械で全部数えます】。
     いまの数を下に書いてあります。この数より増えたら落ちます。
     　・増えた → 新しい穴を作った（すぐ分かります）
     　・減った → 直した。下の数を減らして書き直します

     ★この数は「まだ残っている宿題の数」です。0 になるまで減らしていきます。
     ★数を増やす方向に書き換えないでください。それは穴を増やすことです。

   ★6つの形（どれも2026-09-12に実際に見つかったもの）
     ① 実装の【書き方】を文字で求めている見張り
        … 正しく直すと見張りが落ちる。まちがった書き方を見張りが守ってしまう。
        　 実例：区分を英語でくらべる書き方を3つの見張りが守っていた。
     ② 自分で砂場を作り、決めごとの親を入れていない見張り
        … 本物とちがう動きで通る。実例：書類の親・単価の親で発生。
     ③ ぜんぶ文字さがしだけの見張り
        … 文字があるかだけでは、中身が正しいかは分からない。
     ④ 注文の区分を【英語】で直接くらべているところ
        … 区分は日本語で保存されている（"RT" 49件）。英語だといつも false。
     ⑤ 失敗の握りつぶし（catch の中が空）
        … 押しても何も起きず、記録も残らない。
     ⑥ 日付を「日付だけの形」と思って使っているところ
        … スプシを通ると時刻つきに化ける。NaN になるか、1日ずれる。
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const NL = String.fromCharCode(10);
const CB = new RegExp('/\\*[\\s\\S]*?\\*/', 'g');
const CL = new RegExp('//[^' + NL + ']*', 'g');
const R = H.LIVE;
const T = path.join(R, 'tests');

let pass = 0, fail = 0; const fails = [];
function kazu(na, ima, kagen) {
  /* ima が kagen（いまの数）以下なら合格。増えたら落ちる */
  if (ima <= kagen) { pass++; return; }
  fail++;
  fails.push(na + '　いま ' + ima + ' か所（この前は ' + kagen + ' か所）。増えています。');
}
function ok(na, jouken) { if (jouken) pass++; else { fail++; fails.push(na); } }

function appFiles() {
  return fs.readdirSync(R).filter(function (f) {
    return (/\.html$/.test(f) && !/^mock_/.test(f)) || /^oos-.*\.js$/.test(f);
  });
}
function testFiles() {
  return fs.readdirSync(T).filter(function (f) { return /^test_.*\.js$/.test(f); });
}
function naka(p) { return fs.readFileSync(p, 'utf8').replace(CB, '').replace(CL, ''); }

/* ── ① 実装の【書き方】を文字で求めている見張り ── */
var n1 = 0;
testFiles().forEach(function (f) {
  if (f === 'test_haribote.js') return;
  var s = naka(path.join(T, f));
  [/indexOf\(\s*["'][^"']*==[^"']*["']\s*\)/g,
   /indexOf\(\s*["'][^"']*\|\|[^"']*["']\s*\)/g,
   /\/[^\/\n]*===\s*\\?['"][^\/\n]*\/\.test\(/g].forEach(function (re) {
    var m; while ((m = re.exec(s))) { n1++; }
  });
});

/* ── ② 砂場に決めごとの親を入れていない見張り ── */
var OYA = ['oos-zei.js', 'oos-kakaku.js', 'oos-shorui-kimari.js', 'oos-doc.js', 'oos-nouhin.js', 'oos-zaiko.js'];
var n2 = 0;
testFiles().forEach(function (f) {
  if (f === 'test_haribote.js') return;
  var s = naka(path.join(T, f));
  if (s.indexOf('makeSandbox') >= 0) return;
  if (s.indexOf('createContext') < 0) return;
  if (!/H\.cut\(|runInContext/.test(s)) return;
  var hitotsumo = OYA.some(function (o) { return s.indexOf(o) >= 0; });
  if (!hitotsumo) n2++;
});

/* ── ③ ぜんぶ文字さがしだけの見張り ── */
var n3 = 0;
testFiles().forEach(function (f) {
  if (f === 'test_haribote.js') return;
  var s = naka(path.join(T, f));
  var zenbu = (s.match(/\b(ok|eq|inc|t|has|no)\s*\(/g) || []).length;
  if (zenbu < 20) return;
  if ((s.match(/runInContext|H\.cut\(/g) || []).length === 0) n3++;
});

/* ── ④ 注文の区分を英語で直接くらべているところ ── */
var n4 = 0;
appFiles().forEach(function (f) {
  var s = naka(path.join(R, f));
  var re = /\b([a-zA-Z_$][\w$]*)\.customerType\s*===?\s*['"](general|wholesale1|wholesale2|rt|rtgc|basara|special|defectprice)['"]/g;
  var m; while ((m = re.exec(s))) { n4++; }
});

/* ── ⑤ 失敗の握りつぶし（catch の中が空） ── */
var n5 = 0;
appFiles().forEach(function (f) {
  var s = naka(path.join(R, f));
  var re = /catch\s*\(\s*[\w$]*\s*\)\s*\{\s*\}/g;
  var m; while ((m = re.exec(s))) { n5++; }
});

/* ── ⑥ 日付を「日付だけ」と思って使っているところ ── */
var n6 = 0;
appFiles().forEach(function (f) {
  var s = naka(path.join(R, f));
  var re = /\+\s*['"]T00:00:00['"]/g;
  var m; while ((m = re.exec(s))) { n6++; }
});

/* ══════════════════════════════════════════════════════════════
   ★いまの数（2026-09-12 時点）。ここを増やす方向に書き換えないこと。
   　直したら、この数を減らして書き直します。
   ══════════════════════════════════════════════════════════════ */
kazu('①実装の書き方を文字で求めている見張り', n1, 23);
kazu('②砂場に決めごとの親を入れていない見張り', n2, 5);
kazu('③ぜんぶ文字さがしだけの見張り', n3, 6);
kazu('④区分を英語で直接くらべているところ', n4, 9);
kazu('⑤失敗の握りつぶし（catchの中が空）', n5, 285);
kazu('⑥日付を「日付だけ」と思って使っているところ', n6, 5);

/* 決めごとの親に、区分を見分ける窓口があること（④を直す先） */
var K = H.makeSandbox({}).box.OOS_KAKAKU;
ok('決めごとの親に isRt がある', typeof (K && K.isRt) === 'function');
ok('決めごとの親に isType がある', typeof (K && K.isType) === 'function');
if (K && K.isRt) {
  ok('日本語の「RT」をRTと見分ける', K.isRt('RT') === true);
  ok('日本語の「RTGC（ゴルフ）」もRTと見分ける', K.isRt('RTGC（ゴルフ）') === true);
  ok('「定価」をRTと取りちがえない', K.isRt('定価') === false);
}

console.log('');
console.log('===== 🔎 張りぼて点検（残っている宿題の数） =====');
console.log('  ① 実装の書き方を文字で求めている見張り　… ' + n1 + ' か所');
console.log('  ② 砂場に親を入れていない見張り　　　　　… ' + n2 + ' 本');
console.log('  ③ ぜんぶ文字さがしだけの見張り　　　　　… ' + n3 + ' 本');
console.log('  ④ 区分を英語で直接くらべているところ　　… ' + n4 + ' か所');
console.log('  ⑤ 失敗の握りつぶし　　　　　　　　　　　… ' + n5 + ' か所');
console.log('  ⑥ 日付をそのまま使っているところ　　　　… ' + n6 + ' か所');
console.log('');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail) {
  console.log('--- 増えています（新しい穴を作りました）---');
  fails.forEach(function (f) { console.log('  ★ ' + f); });
  process.exit(1);
}
