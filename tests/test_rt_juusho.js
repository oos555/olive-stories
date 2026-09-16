/* ══════════════════════════════════════════════════════════════════════
   🏠 RTの伝票：住所が2〜3行にまたがっていても、全部読む
   2026-09-16　ひろみさん指摘

   ★ひろみさんの言葉
     「**伝票に乗っている住所が途中までしか入っていない。
     　RTは住所が2〜3行にまたがっていることがある**」

   ★実際に起きていたこと（サンクチュアリコート高山の伝票 380789）
     伝票：〒506-0055 岐阜県 ／ 高山市上岡本町 ／ 1丁目124−1
     入っていた住所：「岐阜県 高山市上岡本町」
     → **「1丁目124−1」が落ちていた。** 番地が無いと荷物が届きません。

     原因：市区町村が入った【最初の1行】を見つけたら、そこで読み取りを止めていた。

   ★この見張りは、本物の parseRtSlip をそのまま動かします。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '🏠 RTの伝票：住所が2〜3行でも全部読む（2026-09-16）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function eq(name, got, want){
  ok(name, got === want, '（出た答え：「' + got + '」／ほしい答え：「' + want + '」）');
}

/* ── 本物の parseRtSlip を動かす砂場 ── */
const ctx = vm.createContext({
  console: console, Math: Math, String: String, Number: Number, Array: Array,
  parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, Object: Object,
  PRODUCTS: [],
  RT_CODE_MAP: {},
  findProduct: function(){ return null; },
  OOS_ZEI: { percentForProduct: function(){ return 10; } }
});
ctx.window = ctx; ctx.globalThis = ctx;
vm.runInContext(H.cut(INDEX, 'parseRtSlip'), ctx);
function yomu(lines){
  ctx.__lines = lines;
  return vm.runInContext('parseRtSlip(__lines)', ctx);
}

/* ══════════════════════════════════════════════════════════════
   ① ひろみさんの伝票（380789）そのもの ── 3行にまたがる住所
   ══════════════════════════════════════════════════════════════ */
{
  const r = yomu([
    '株式会社オリーブオイル・ストーリーズ | サンクチュアリコート高山',
    '〒506-0055　岐阜県',
    '高山市上岡本町',
    '1丁目124−1',
    'TEL:0577-40-0116 FAX:0577-40-0126',
    'コメント',
    '410 -1321 your story 100ml×3本セット 10本 7,110円 71,100円',
    '納品金額（税抜）'
  ]);
  eq('①郵便番号', r.zip, '506-0055');
  eq('①住所が3行ぜんぶ入る', r.addr, '岐阜県 高山市上岡本町 1丁目124−1');
  ok('①TEL・FAXの行は住所に混ざっていない', r.addr.indexOf('TEL') < 0 && r.addr.indexOf('FAX') < 0);
  ok('①コメントの行も混ざっていない', r.addr.indexOf('コメント') < 0);
}

/* ══════════════════════════════════════════════════════════════
   ② 1行で終わる住所（今までどおり読めること）
   ══════════════════════════════════════════════════════════════ */
{
  const r = yomu([
    '株式会社オリーブオイル・ストーリーズ | 東京ベイコート倶楽部',
    '〒135-8560　東京都',
    '江東区有明3-1-15',
    'TEL:03-0000-0000',
    '納品金額（税抜）'
  ]);
  eq('②1行の住所も、そのまま読める', r.addr, '東京都 江東区有明3-1-15');
}

/* ══════════════════════════════════════════════════════════════
   ③ 建物名つき（2行目が番地・3行目が建物）
   ══════════════════════════════════════════════════════════════ */
{
  const r = yomu([
    '株式会社オリーブオイル・ストーリーズ | ローズルーム名古屋',
    '〒450-0002　愛知県',
    '名古屋市中村区名駅',
    '4-7-1',
    'ミッドランドスクエア40階',
    'TEL:052-000-0000',
    '納品金額（税抜）'
  ]);
  ok('③番地が入っている', r.addr.indexOf('4-7-1') >= 0, '（出た答え：' + r.addr + '）');
  ok('③建物名も入っている', r.addr.indexOf('ミッドランドスクエア40階') >= 0, '（出た答え：' + r.addr + '）');
  ok('③TELは入っていない', r.addr.indexOf('TEL') < 0);
}

/* ══════════════════════════════════════════════════════════════
   ④ 住所のあとに会社名などが続いても、そこで止まる
   ══════════════════════════════════════════════════════════════ */
{
  const r = yomu([
    '株式会社オリーブオイル・ストーリーズ | エクシブ蓼科',
    '〒391-0301　長野県',
    '茅野市北山4035-1',
    '株式会社リゾートトラスト',
    '伝票番号 999999',
    '納品金額（税抜）'
  ]);
  eq('④会社名は住所に入れない', r.addr, '長野県 茅野市北山4035-1');
}

/* ══════════════════════════════════════════════════════════════
   ⑤ 先祖返りの見張り（1行で止める形に戻っていないか）
   ══════════════════════════════════════════════════════════════ */
{
  const fn = H.cut(INDEX, 'parseRtSlip').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('⑤1行見つけたら break、の形に戻っていない',
     /\{\s*addrRest\s*=\s*s;\s*break;\s*\}/.test(fn) === false,
     '（住所を1行で打ち切る書き方が戻っています）');
  ok('⑤住所の続きを集める処理がある', fn.indexOf('_atsume') >= 0);
  ok('⑤やめる合図（TEL・FAXなど）が決めてある', fn.indexOf('RT_ADDR_TOME') >= 0);
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
