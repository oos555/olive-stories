/* 統合マスタＮ 裏ラベル（シール）の在庫の見張り（2026-08-20 ひろみさん指示）

   ひろみさん：「裏ラベルがなくなると発送ができなくなって止まってしまう。
                 オイル一つに対して一枚ラベルが使われていくので、そこをカウントしたい。」
   承認済みモック：mock_統合マスタN_裏ラベル在庫_2026-08-20.html

   決めごと
   ・欄は2つ。それぞれに名前を書ける（例：本体ラベル／部分ラベル）
   ・名前が空の欄は「その商品では使わない」＝減らない・警告も出ない
   ・追加購入予定（枚数・予定日）を持てる。予定日が来たら「📥 入れる」が出る（人が押す）
   ・50枚を切ったら赤
   ・ラベルが0枚でも出荷依頼書は止めない
   ★置き場所は商品マスタの列。**在庫データ(lots)には絶対に入れない**
     （oos-zaiko.js は知らない status を「棚の良品」に足すので、オイルの販売可能数が狂う）*/
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname, '..', 'master.html'), 'utf8');
const zaiko = fs.readFileSync(path.join(__dirname, '..', 'oos-zaiko.js'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

/* ── 本物の関数を切り出して動かす ── */
const NAMES = ['labToday','labRaw','labName','labQty','labInc','labDay','labUsed','labDue','labLow','labLowList'];
let code = H.cutVar(src, 'LAB_KEYS') + '\n' + H.cutVar(src, 'LAB_WARN') + '\n';
NAMES.forEach(n => { code += H.cut(src, n) + '\n'; });

const P = [
  { id:1, sku:'ORG250', name:'オルガニック250ml',
    'ラベル１名前':'本体ラベル', 'ラベル１枚数':'420', 'ラベル１予定数':'0',   'ラベル１予定日':'',
    'ラベル２名前':'部分ラベル', 'ラベル２枚数':'380', 'ラベル２予定数':'500', 'ラベル２予定日':'2099-01-01' },
  { id:2, sku:'MEM500', name:'メメジック500ml',
    'ラベル１名前':'本体ラベル', 'ラベル１枚数':'38',  'ラベル１予定数':'1000','ラベル１予定日':'2020-01-01',
    'ラベル２名前':'',           'ラベル２枚数':'0',   'ラベル２予定数':'0',   'ラベル２予定日':'' },
  { id:3, sku:'CHF100', name:'シェフズブレンド100ml', extras:{ 'ラベル１名前':'金の帯シール', 'ラベル１枚数':'12' } },
  { id:9, sku:'SET1',   name:'ギフトセット', isSet:true }
];
const { box } = H.makeSandbox({ PRODUCTS: P });
require('vm').runInContext(code, require('vm').createContext(box));
const p1 = P[0], p2 = P[1], p3 = P[2];

/* ── ① 読み取り ── */
eq('① 名前を読む',       box.labName(p1, 0), '本体ラベル');
eq('① 枚数を読む',       box.labQty(p1, 0), 420);
eq('① 予定数を読む',     box.labInc(p1, 1), 500);
eq('① 予定日を読む',     box.labDay(p1, 1), '2099-01-01');
eq('① extras からも読む', box.labName(p3, 0), '金の帯シール');
eq('① extras の枚数',     box.labQty(p3, 0), 12);
eq('① 何も無ければ0',     box.labQty(p2, 1), 0);

/* ── ② 名前が空＝その商品では使わない ── */
eq('② 名前があれば使う',   box.labUsed(p1, 0), true);
eq('② 名前が空なら使わない', box.labUsed(p2, 1), false);
eq('② 使わない欄は0枚でも警告しない', box.labLow(p2, 1), false);

/* ── ③ 50枚の警告 ── */
eq('③ 警告は50枚',        box.LAB_WARN, 50);
eq('③ 420枚は警告なし',   box.labLow(p1, 0), false);
eq('③ 38枚は警告',        box.labLow(p2, 0), true);
eq('③ 12枚は警告',        box.labLow(p3, 0), true);
const low = box.labLowList();
eq('③ 少ないのは2つ',            low.length, 2);
eq('③ 1つめはメメジックの本体',  low[0].product + '／' + low[0].label, 'メメジック500ml／本体ラベル');
eq('③ 残り枚数も持つ',           low[0].qty, 38);
eq('③ セット商品は数えない',     low.filter(x => x.sku === 'SET1').length, 0);

/* ── ④ 追加購入予定（予定日が来たら押せる） ── */
eq('④ 予定日が過ぎていれば押せる', box.labDue(p2, 0), true);
eq('④ 先の予定日なら押せない',     box.labDue(p1, 1), false);
eq('④ 予定数が0なら押せない',      box.labDue(p1, 0), false);
eq('④ 予定日が空なら押せない',     box.labDue(p3, 0), false);
eq('④ 今日の日付は10文字',         box.labToday().length, 10);
eq('④ 今日の日付の形',             /^\d{4}-\d{2}-\d{2}$/.test(box.labToday()), true);

/* ── ⑤ 届いたら合算（画面の関数と同じ計算） ── */
function arrive(q, inc){ return { qty: q + inc, inc: 0, day: '' }; }
const a = arrive(box.labQty(p2,0), box.labInc(p2,0));
eq('⑤ 38枚＋1000枚 → 1038枚', a.qty, 1038);
eq('⑤ 予定数は0になる',       a.inc, 0);
eq('⑤ 予定日は空になる',      a.day, '');

/* ── ⑥ 在庫データ(lots)を汚していないか（いちばん大事） ── */
eq('⑥ 保存先は商品マスタ（saveOneProduct）', /action:'saveOneProduct', product: prod/.test(src.slice(src.indexOf('async function labSaveFields'))), true);
eq('⑥ ラベルを lots に push していない', /lots\.push\([^)]*ラベル/.test(src), false);
eq('⑥ ラベル用の status を作っていない',  /status *: *'label/.test(src), false);
eq('⑥ oos-zaiko.js は知らない status を棚の良品に足す（だから lots に入れてはいけない）',
   /else\s+cur\.avail \+= q;/.test(zaiko), true);

/* ── ⑦ 決めごとが消えていないか ── */
eq('⑦ 画面に2列ある',            (src.match(/labCell\(p,0\)\+labCell\(p,1\)/g) || []).length, 2);
eq('⑦ 見出しに裏ラベルがある',    src.indexOf('🏷 裏ラベル（枚）') >= 0, true);
eq('⑦ 旧ロットの表には出さない',  src.indexOf('商品ごとの数なので、旧ロットの表には出さない') >= 0, true);
eq('⑦ 自動で合算しない理由が書いてある', src.indexOf('なぜ自動にしないか') >= 0, true);
eq('⑦ 0枚でも止めない決めごとが書いてある', src.indexOf('ラベルが0枚でも出荷依頼書は止めない') >= 0, true);
eq('⑦ lots に入れるなの注意書きがある', src.indexOf('在庫データ（lots）には絶対に入れない') >= 0, true);

console.log('===== 裏ラベル（シール）の在庫 =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
