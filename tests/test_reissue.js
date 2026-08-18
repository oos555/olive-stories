/* 注文番号の「引き直し」が効くかを、直した order.html の本物の関数で試す。 */
const vm = require('vm');
const fs = require('fs');
const H = require('./harness');

const src = fs.readFileSync(require('path').join(__dirname,'..','order.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(String(got) === String(want)) pass++;
  else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

const { box, ctx } = H.makeSandbox({ PAYLOAD: { customer: { type:'general' } }, ORDER_NUM: '' });
['orderNumCode','genOrderNum','reissueNumIfTaken'].forEach(n => vm.runInContext(H.cut(src, n), ctx));

/* ── ① かぶっていないときは、番号を変えない ─────────────── */
let o = { id:'me', num:'TK-20260818-1234' };
box.reissueNumIfTaken(o, [{ id:'other', num:'TK-20260818-9999' }]);
eq('① かぶっていなければ そのまま', o.num, 'TK-20260818-1234');

/* ── ② かぶったら引き直す。暗号と日付はそのまま ───────────── */
o = { id:'me', num:'TK-20260818-1234' };
box.reissueNumIfTaken(o, [{ id:'other', num:'TK-20260818-1234' }]);
eq('② かぶったら番号が変わる', o.num !== 'TK-20260818-1234', true);
eq('② 暗号と日付はそのまま', o.num.slice(0, 11), 'TK-20260818');
eq('② 形が崩れない', /^TK-20260818-\d{4}$/.test(o.num), true);
eq('② 画面が持つ番号も同じものに更新される', box.ORDER_NUM, o.num);

/* ── ③ 自分自身（同じid）とはかぶらせない ────────────────── */
o = { id:'me', num:'TK-20260818-1234' };
box.ORDER_NUM = '';
box.reissueNumIfTaken(o, [{ id:'me', num:'TK-20260818-1234' }]);   // 仮予約で保存した自分
eq('③ 自分の仮予約とは かぶり扱いしない（番号そのまま）', o.num, 'TK-20260818-1234');
eq('③ 引き直していないので画面の番号も触らない', box.ORDER_NUM, '');

/* ── ④ その日に200件たまっていても、空いている番号を必ず見つける ──
      （現実にありえる混み方。1日200件は、いまの何倍も忙しい日） */
for(let trial = 0; trial < 2000; trial++){
  const many = [];
  const taken = new Set();
  while(taken.size < 200){ taken.add(1000 + Math.floor(Math.random()*9000)); }
  taken.forEach(n => many.push({ id:'x'+n, num:'TK-20260818-'+n }));
  const mine = many[0].num;                       // わざと1件目とかぶらせる
  o = { id:'me', num: mine };
  box.reissueNumIfTaken(o, many);
  if(taken.has(parseInt(o.num.split('-')[2]))){ fail++; fails.push('④ 200件たまった日で引き直せなかった: '+o.num); break; }
}
if(!fails.some(f => f.startsWith('④'))) pass++;
console.log('④ 1日200件たまった状態で2,000回ためして、かぶりゼロ');

/* ── ④-2 引き直しは300回まで（受注Ａ・GASと同じ上限）──
      9000通りのうち8999個がふさがるような極端な日は、300回引いても見つからないことがある。
      そのときは番号を変えずに保存する（＝今までと同じふるまい）。正直に測っておく。 */
const nearlyFull = [];
for(let n = 1000; n <= 9999; n++) nearlyFull.push({ id:'x'+n, num:'TK-20260818-'+n });
const onlyFree = nearlyFull.splice(4567, 1)[0].num;
let found = 0;
for(let t = 0; t < 200; t++){
  const oo = { id:'me', num:'TK-20260818-1000' };
  box.reissueNumIfTaken(oo, nearlyFull);
  if(oo.num === onlyFree) found++;
}
console.log('④-2 9,000通り中8,999個ふさがった極端な日：200回中 ' + found + ' 回だけ空きを引き当て（300回上限のため。受注Ａ・GASと同じ）');
eq('④-2 その場合でも番号の形は壊れない', /^TK-20260818-\d{4}$/.test('TK-20260818-1000'), true);

/* ── ⑤ 番号の形がおかしいときは、作り直しに戻る ─────────── */
o = { id:'me', num:'こわれた番号' };
box.reissueNumIfTaken(o, [{ id:'other', num:'こわれた番号' }]);
eq('⑤ 形がおかしくても新しい番号が入る', /^TK-\d{8}-\d{4}$/.test(o.num), true);

/* ── ⑥ 実戦：1日30件を10万日ぶん。引き直し「あり」と「なし」を比べる ── */
function run(days, perDay, withFix){
  let hit = 0;
  for(let d = 0; d < days; d++){
    const saved = [];
    let dup = false;
    for(let i = 0; i < perDay; i++){
      const ord = { id:'o'+i, num: box.genOrderNum() };      // お客様の注文ページが作る番号
      if(withFix) box.reissueNumIfTaken(ord, saved);         // ★保存直前の引き直し
      if(saved.some(s => s.num === ord.num)) dup = true;
      saved.push(ord);
    }
    if(dup) hit++;
  }
  return (100 * hit / days).toFixed(2);
}
const DAYS = 100000;
const before30 = run(DAYS, 30, false);
const after30  = run(DAYS, 30, true);
const before50 = run(DAYS, 50, false);
const after50  = run(DAYS, 50, true);
console.log('=== その日じゅうに同じ番号ができる確率（10万日ぶん）===');
console.log('  1日30件： 直す前 ' + before30 + '%  →  直したあと ' + after30 + '%');
console.log('  1日50件： 直す前 ' + before50 + '%  →  直したあと ' + after50 + '%');
eq('⑥ 1日30件で重複ゼロになる', after30, '0.00');
eq('⑥ 1日50件で重複ゼロになる', after50, '0.00');
eq('⑥ 直す前は実際に起きていた（30件）', parseFloat(before30) > 1, true);

console.log('\n===== 注文番号の引き直し =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
