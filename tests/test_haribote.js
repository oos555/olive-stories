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

/* ── ① 実装の【書き方】を文字で求めている見張り ──
   ★2026-09-12 測り方を精密にしました。
   「古い書き方が【残っていないこと】を見る」のは、先祖返りを捕まえる
   　正しい使い方なので、数に入れません（例：… < 0, true ／ !/…/.test(…)）。
   　害があるのは「実装がその書き方で【書かれていること】を求める」ほうです。
   　そちらは、正しく直したときに落ちて、まちがった書き方を守ってしまいます。 */
var n1 = 0;
testFiles().forEach(function (f) {
  if (f === 'test_haribote.js') return;
  var s = naka(path.join(T, f));
  var gyou = s.split(NL);
  gyou.forEach(function (line, i) {
    /* その行と、次の行までをひとかたまりで見る（見張りは2行に折り返すことが多い） */
    var katamari = line + (gyou[i + 1] || '');
    /* ★引用符の【中身】をきちんと取り出してから見ます。
       　前は「indexOf(\"… === 'rt'\")」のように引用符が2種類混ざると
       　途中で止まって数えられませんでした（わざと増やす破壊テストで見つけました）。 */
    var maru = false;
    var reStr = /(?:indexOf|includes)\(\s*(["'])((?:\\.|(?!\1)[\s\S])*?)\1/g;
    var mm;
    while ((mm = reStr.exec(line))) {
      if (/===|!==|\|\||&&|=>|function\s+[A-Za-z_$]/.test(mm[2])) { maru = true; break; }
    }
    if (!maru) {
      /* 正規表現リテラルで、実装のコードの形を探しているもの */
      var reLit = /\/(?:\\.|\[[^\]]*\]|[^\/\n\\])+\/\s*\.test\(/g;
      var ml;
      while ((ml = reLit.exec(line))) {
        if (/===|!==|\\\|\\\||&&/.test(ml[0])) { maru = true; break; }
      }
    }
    if (!maru) return;
    /* 「無いこと」を求めているなら、先祖返りの見張り＝正しい使い方 */
    var naiKoto = /<\s*0\s*,\s*true/.test(katamari)   /* indexOf(...) < 0, true */
               || /,\s*false\s*\)/.test(katamari)      /* inc(..., false) */
               || /!\s*\//.test(line)                   /* !/…/.test(…) */
               || /!\s*[A-Za-z_$]/.test(line.replace(/^\s*/, '').slice(0, 3));
    if (!naiKoto) n1++;
  });
});

/* ── ② 砂場に決めごとの親を入れていない見張り ── */
var OYA = ['oos-zei.js', 'oos-kakaku.js', 'oos-shorui-kimari.js', 'oos-doc.js', 'oos-nouhin.js', 'oos-zaiko.js'];
/* ★2026-09-12 数え方を精密にしました。
   前は「親を1つも入れずに、何かを動かしている」だけで数えていたので、
   GASの関数や、親を使わない処理を動かしているだけのものまで数えていました。
   いまは【動かしている関数の中で親（OOS_◯◯）を使っているのに、
   砂場に入れていない】ものだけを数えます。
   ★ここを緩めないでください。緩めると、本物とちがう動きで通る見張りを見逃します。 */
var n2 = 0;
testFiles().forEach(function (f) {
  if (f === 'test_haribote.js') return;
  var s = naka(path.join(T, f));
  if (s.indexOf('makeSandbox') >= 0) return;   /* 親は自動で入る */
  if (s.indexOf('createContext') < 0) return;  /* 砂場を作っていない */
  var haitteru = OYA.some(function (o) { return s.indexOf(o) >= 0; });
  if (haitteru) return;                        /* 自分で入れている */

  /* 変数名 → その変数が読んでいるファイル */
  var dokokara = {};
  var reR = /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*H\.read\(\s*['"]([^'"]+)['"]/g;
  var mr;
  while ((mr = reR.exec(s))) { dokokara[mr[1]] = mr[2]; }

  /* 切り出している関数の中で、親を使っているものがあるか */
  var iru = false;
  var reC = /H\.cut\(\s*([A-Za-z_$][\w$]*)\s*,\s*['"]([^'"]+)['"]/g;
  var mc;
  while ((mc = reC.exec(s))) {
    var moto = dokokara[mc[1]];
    if (!moto) continue;
    var chu = '';
    try { chu = H.cut(H.read(moto), mc[2]); } catch (e) { continue; }
    if (/OOS_[A-Z_]+/.test(chu)) { iru = true; break; }
  }
  if (iru) n2++;
});

/* ── ③ ぜんぶ文字さがしだけの見張り ── */
var n3 = 0;
testFiles().forEach(function (f) {
  if (f === 'test_haribote.js') return;
  var s = naka(path.join(T, f));
  var zenbu = (s.match(/\b(ok|eq|inc|t|has|no)\s*\(/g) || []).length;
  if (zenbu < 20) return;
  /* ★2026-09-12 makeSandbox も「動かしている」に入れます。
     　決めごとの親を動かして答えを見るのも、りっぱな「動かす見張り」です。 */
  /* ★2026-09-12 「本物から式を取り出して new Function で動かす」形も、
     　立派に【動かして答えを見る】見張りなので入れます。 */
  if ((s.match(/runInContext|H\.cut\(|makeSandbox|new Function\(/g) || []).length === 0) n3++;
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
  /* ★親ファイル自身（oos-hizuke.js）は数えません。
     　そこは「日付だけの形にそろえたあと」に組み立てている、正しい使い方です。
     　数えるのは「そろえずに、いきなり組み立てている」ところです。 */
  if (f === 'oos-hizuke.js') return;
  var s = naka(path.join(R, f));
  var re = /\+\s*['"]T00:00:00['"]/g;
  var m; while ((m = re.exec(s))) { n6++; }
});

/* ══════════════════════════════════════════════════════════════
   ★いまの数（2026-09-12 時点）。ここを増やす方向に書き換えないこと。
   　直したら、この数を減らして書き直します。
   ══════════════════════════════════════════════════════════════ */
/* ★2026-09-12 数え方を直したら、15ではなく【147か所】ありました。
   　前の数え方は、探す文字の中に引用符が2種類混ざると途中で止まり、
   　ほとんどを見落としていました（わざと増やす破壊テストで見つけました）。
   　＝この点検そのものが張りぼてでした。数えられる形に直して、本当の数を書きます。 */
kazu('①実装の書き方を文字で求めている見張り', n1, 147);
/* ★2026-09-12 精密に数え直したら 0 でした（5本とも、親を使わない処理を
   　動かしているだけでした）。これ以上増やさないでください。
   　増えたら「本物とちがう動きで通る見張り」を作ったということです。 */
kazu('②砂場に決めごとの親を入れていない見張り', n2, 0);
/* ★2026-09-12 区分の翻訳の見張りに【動かして答えを見る】項目を30ほど足しました。
   　文字を残したまま中身だけ壊す（'RT': 'general' にする）と落ちることを確かめました。
   　文字さがしだけでは、絶対に捕まえられない壊し方です。 */
kazu('③ぜんぶ文字さがしだけの見張り', n3, 4);
kazu('④区分を英語で直接くらべているところ', n4, 0);
/* ★2026-09-12 受注登録ボタンの中の4か所を、失敗を知らせる入口（oosShippai）に
   　通しました。285 → 283。ここから減らしていきます。
   ★人が押すボタンの中では、空の catch を書かないでください。
   　押した人に何も伝わらず、原因も追えなくなります。 */
kazu('⑤失敗の握りつぶし（catchの中が空）', n5, 283);

/* 失敗を知らせる入口があること（減らす先） */
{
  var _ix = H.read('index.html');
  ok('失敗を知らせる入口（oosShippai）がある',
     _ix.indexOf('function oosShippai(') >= 0);
  ok('受注登録の4か所が、その入口を通っている',
     (_ix.split('oosShippai(').length - 1) >= 5);
}
/* ★2026-09-12 5か所ぜんぶ、日付の親（oos-hizuke.js）に通しました。
   　これ以上ここを増やさないでください。増やすと NaN と1日ずれが戻ります。 */
kazu('⑥日付を「日付だけ」と思って使っているところ', n6, 0);

/* 日付の親が正しく動くこと（1日ずれを捕まえる） */
{
  var _B = { console: console }; _B.window = _B; _B.globalThis = _B;
  var _C = require('vm').createContext(_B);
  try { require('vm').runInContext(H.read('oos-hizuke.js'), _C); } catch (e) {}
  var _Z = _B.OOS_HIZUKE;
  ok('日付の親（oos-hizuke.js）がある', !!(_Z && _Z.dake));
  if (_Z && _Z.dake) {
    ok('時刻つきを日本時間の日付にする（1日ずらさない）', _Z.dake('2026-09-13T15:00:00.000Z') === '2026-09-14');
    ok('先頭10文字を切る作りになっていない', _Z.dake('2026-09-13T15:00:00.000Z') !== '2026-09-13');
    ok('もともと日付だけなら、そのまま', _Z.dake('2026-09-14') === '2026-09-14');
    ok('読めない値なら空', _Z.dake('あいうえお') === '');
    ok('日本語で出せる', _Z.jp('2026-09-13T15:00:00.000Z') === '9月14日');
  }
}

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
