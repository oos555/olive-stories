/* 裏ラベル（シール）の在庫の見張り（2026-08-20 ひろみさん指示）

   ひろみさん：「裏ラベルがなくなると発送ができなくなって止まってしまう。
                 オイル一つに対して一枚ラベルが使われていくので、そこをカウントしたい。」
   承認済みモック：mock_統合マスタN_裏ラベル在庫_2026-08-20.html

   決めごと
   ・欄は2つ。それぞれに名前を書ける（例：本体ラベル／部分ラベル）
   ・名前が空の欄は「その商品では使わない」＝減らない・警告も出ない
   ・追加購入予定（枚数・予定日）を持てる。予定日が来たら「📥 入れる」が出る（人が押す）
   ・50枚を切ったら赤／玄関のアラートにも出す
   ・**ラベルが0枚でも出荷依頼書は止めない**（無いときは倉庫に作成を依頼するため）
   ・オイルが減るのと同じタイミング・同じ本数だけ減る。キャンセルで戻る
   ★式の親は oos-zaiko.js（OOS_ZAIKO.LABEL）ただ1つ。アプリ側に書き写さない
   ★置き場所は商品マスタの列。**在庫データ(lots)には絶対に入れない**
     （oos-zaiko.js は知らない status を「棚の良品」に足すので、オイルの販売可能数が狂う）*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./harness');
const P_ = f => path.join(__dirname, '..', f);
const zaiko  = fs.readFileSync(P_('oos-zaiko.js'), 'utf8');
const master = fs.readFileSync(P_('master.html'), 'utf8');
const juchu  = fs.readFileSync(P_('index.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

/* ── 親（oos-zaiko.js）を本物のまま動かす ── */
const P = [
  { id:1, sku:'ORG250', name:'オルガニック250ml',
    'ラベル１名前':'本体ラベル', 'ラベル１枚数':'420', 'ラベル１予定数':'0',   'ラベル１予定日':'',
    'ラベル２名前':'部分ラベル', 'ラベル２枚数':'380', 'ラベル２予定数':'500', 'ラベル２予定日':'2099-01-01' },
  { id:2, sku:'MEM500', name:'メメジック500ml',
    'ラベル１名前':'本体ラベル', 'ラベル１枚数':'38',  'ラベル１予定数':'1000','ラベル１予定日':'2020-01-01',
    'ラベル２名前':'',           'ラベル２枚数':'0',   'ラベル２予定数':'0',   'ラベル２予定日':'' },
  { id:3, sku:'CHF100', name:'シェフズブレンド100ml', extras:{ 'ラベル１名前':'金の帯シール', 'ラベル１枚数':'12' } },
  /* ★セット商品にもラベルは要る（セット用の箱ラベルなど・2026-08-20 ひろみさん指示） */
  { id:9, sku:'SET1', name:'ギフトセット', isSet:true, components:[{sku:'ORG250',qty:1}],
    'ラベル１名前':'セット箱ラベル', 'ラベル１枚数':'20' }
];
const { box } = H.makeSandbox({ PRODUCTS: P });
vm.runInContext(zaiko, vm.createContext(box));          /* 親をそのまま読み込む */
const LAB = box.OOS_ZAIKO && box.OOS_ZAIKO.LABEL;
const p1 = P[0], p2 = P[1], p3 = P[2];

eq('◎ 親に裏ラベルの窓口がある', !!LAB, true);

/* ── ① 読み取り（親の式） ── */
eq('① 名前を読む',        LAB.name(p1, 0), '本体ラベル');
eq('① 枚数を読む',        LAB.qty(p1, 0), 420);
eq('① 予定数を読む',      LAB.incoming(p1, 1), 500);
eq('① 予定日を読む',      LAB.day(p1, 1), '2099-01-01');
eq('① extras からも読む', LAB.name(p3, 0), '金の帯シール');
eq('① extras の枚数',     LAB.qty(p3, 0), 12);
eq('① 何も無ければ0',     LAB.qty(p2, 1), 0);

/* ── ② 名前が空＝その商品では使わない ── */
eq('② 名前があれば使う',     LAB.used(p1, 0), true);
eq('② 名前が空なら使わない', LAB.used(p2, 1), false);
eq('② 使わない欄は0枚でも警告しない', LAB.isLow(p2, 1), false);

/* ── ③ 50枚の警告 ── */
eq('③ 警告は50枚',      LAB.WARN, 50);
eq('③ 420枚は警告なし', LAB.isLow(p1, 0), false);
eq('③ 38枚は警告',      LAB.isLow(p2, 0), true);
eq('③ 12枚は警告',      LAB.isLow(p3, 0), true);
const low = LAB.lowList(P);
eq('③ 少ないのは3つ（セット商品も数える）', low.length, 3);
eq('③ 1つめはメメジックの本体', low[0].product + '／' + low[0].label, 'メメジック500ml／本体ラベル');
eq('③ 残り枚数も持つ',          low[0].qty, 38);
eq('③ ★セット商品も数える',      low.filter(x => x.sku === 'SET1').length, 1);
 eq('③ セットのラベル名', (low.find(x => x.sku === 'SET1')||{}).label, 'セット箱ラベル');

/* ── ④ 追加購入予定（予定日が来たら押せる） ── */
eq('④ 予定日が過ぎていれば押せる', LAB.isDue(p2, 0), true);
eq('④ 先の予定日なら押せない',     LAB.isDue(p1, 1), false);
eq('④ 予定数が0なら押せない',      LAB.isDue(p1, 0), false);
eq('④ 予定日が空なら押せない',     LAB.isDue(p3, 0), false);
eq('④ 今日の日付の形',             /^\d{4}-\d{2}-\d{2}$/.test(LAB.today()), true);

/* ── ⑤ 統合マスタＮは親を呼ぶだけ（式を書き写していないか） ── */
eq('⑤ LAB_KEYS は親から',  /const LAB_KEYS = OOS_ZAIKO\.LABEL\.KEYS;/.test(master), true);
eq('⑤ LAB_WARN は親から',  /const LAB_WARN = OOS_ZAIKO\.LABEL\.WARN;/.test(master), true);
eq('⑤ 50 を書き写していない',        /LAB_WARN = 50/.test(master), false);
eq('⑤ 列の名前を書き写していない',   /master:ラベル１枚数/.test('master:' + master.replace(/OOS_ZAIKO[^\n]*/g, '')) , false);
eq('⑤ 画面に2列ある',               (master.match(/labCell\(p,0\)\+labCell\(p,1\)/g) || []).length, 2);
eq('⑤ 見出しに裏ラベルがある',       master.indexOf('🏷 裏ラベル（枚）') >= 0, true);
eq('⑤ 旧ロットの表には出さない',     master.indexOf('商品ごとの数なので、旧ロットの表には出さない') >= 0, true);
eq('⑤ 自動で合算しない理由が書いてある', master.indexOf('なぜ自動にしないか') >= 0, true);

/* ── ⑥ 受注Ａ：出荷で減る／キャンセルで戻る（本物の関数を動かす） ── */
const juchuCode = 'var __labDirty = {};\n' + H.cut(juchu, 'labDeductForProduct') + '\n' + H.cut(juchu, 'labSetQty') + '\n';
vm.runInContext(juchuCode, vm.createContext(box));
box.findProduct = function(id){ return P.find(x => String(x.id) === String(id)); };

const log = [];
box.labDeductForProduct(p1, 6, log);
eq('⑥ オイル6本 → ラベル①が6枚減る', LAB.qty(p1, 0), 414);
eq('⑥ 2枚貼る商品はラベル②も6枚減る', LAB.qty(p1, 1), 374);
eq('⑥ 減らした記録が2件のこる',        log.filter(e => e.kind === 'label').length, 2);

const log2 = [];
box.labDeductForProduct(p2, 5, log2);
eq('⑥ 使わない欄（名前が空）は減らない', LAB.qty(p2, 1), 0);
eq('⑥ 使う欄だけ減る',                   LAB.qty(p2, 0), 33);
eq('⑥ 記録も1件だけ',                    log2.length, 1);

/* 0枚を下回っても止めない（ひろみさん指示）＝マイナスのまま記録する */
const log3 = [];
box.labDeductForProduct(p3, 100, log3);
eq('⑥ 0枚を下回っても止めない（マイナスで残る）', LAB.qty(p3, 0), -88);

/* 戻す（キャンセル・🗑発注から消した） */
log.filter(e => e.kind === 'label').forEach(function(e){
  const lp = P.find(x => x.id === e.pid);
  box.labSetQty(lp, e.i, LAB.qty(lp, e.i) + e.qty);
});
eq('⑥ キャンセルでラベル①が戻る', LAB.qty(p1, 0), 420);
eq('⑥ キャンセルでラベル②も戻る', LAB.qty(p1, 1), 380);

/* ── ⑦ 受注Ａの決めごとが消えていないか ── */
eq('⑦ 出荷でラベルを減らす行がある', /labDeductForProduct\(prod, t\.qty, log\)/.test(juchu), true);
eq('⑦ キャンセルでラベルを戻す行がある', /e\.kind==='label'/.test(juchu), true);
eq('⑦ 在庫と同じときに保存する',        /labPersistDirty\(\);\s+\/\* ★2026-08-20/.test(juchu), true);
eq('⑦ 見張りがラベルを戻す控えを持つ',  juchu.indexOf('裏ラベルの枚数も控えて必ず戻す') >= 0, true);
eq('⑦ 見張りのぶんは保存しない',        juchu.indexOf('見張りのぶんは保存しない') >= 0, true);
eq('⑦ 0枚でも止めない決めごとが書いてある', juchu.indexOf('0枚を下回っても止めない') >= 0, true);
/* ★セット商品 */
eq('⑦ セット商品そのもののラベルも減らす行がある', juchu.indexOf('p.isSet && typeof labDeductForProduct') >= 0, true);
eq('⑦ 統合マスタＮでセット商品にも枠を出す', master.indexOf('セット商品にもラベルの枠を出す') >= 0, true);
eq('⑦ 親でセット商品を外していない（lowList）', zaiko.indexOf('セット商品にもラベルは要る') >= 0, true);
eq('⑦ 親が isSet で外していない',              /if\(!p \|\| p\.isSet\) return;/.test(zaiko), false);
const setP = P[3];
const logS = [];
box.labDeductForProduct(setP, 3, logS);
eq('⑦ セット3個 → セットのラベルが3枚減る', LAB.qty(setP, 0), 17);

/* ── ⑧ 2人が同時に開いても二重に入らない見張り（2026-08-20 ひろみさん指示） ── */
eq('⑧ ラベルの📥は押す前に最新を読み直す', master.indexOf('function labFetchFresh') >= 0, true);
eq('⑧ 食い違ったら入れずに止める',         master.indexOf('二重には入れていません') >= 0, true);
eq('⑧ 連打よけがある',                     master.indexOf('btns[b].disabled = true') >= 0, true);
eq('⑧ 輸入の一気入れも読み直す',           master.indexOf('function impFetchFreshIncoming') >= 0, true);
eq('⑧ 在庫を動かす本体が分かれている',     master.indexOf('function doImportAllApply') >= 0, true);
eq('⑧ ボタンは今までどおり doImportAll を呼ぶ', (master.match(/onclick="doImportAll\(\)"/g)||[]).length, 1);
eq('⑧ 読み直せなかったときは声かけを促す', master.indexOf('もう1人が先に入れていないか、声をかけて') >= 0, true);
eq('⑧ 統合マスタＮに無い bust() を使っていない', master.indexOf('bust(') >= 0, false);
eq('⑧ 読み直しは統合マスタＮのやり方（&t=）', master.indexOf("action=loadProducts&t=") >= 0, true);

/* ── ⑧ 玄関のアラート（50枚を切ったら出す） ── */
const genkan = fs.readFileSync(P_('home.html'), 'utf8');
eq('⑧ 玄関に受け口がある',       genkan.indexOf('window.__oosLabelLow') >= 0, true);
eq('⑧ 玄関が親を呼んでいる',     genkan.indexOf('OOS_ZAIKO.LABEL.lowList(PRODUCTS)') >= 0, true);
eq('⑧ 見張り一覧に出る',         genkan.indexOf("key:'labelLow'") >= 0, true);
eq('⑧ アラートに混ぜている',     genkan.indexOf('.concat(window.__oosLabelLow||[])') >= 0, true);
eq('⑧ 玄関が式を書き写していない', /LABEL_WARN|< 50/.test(genkan), false);

/* ── ⑧ 在庫データ(lots)を汚していないか（いちばん大事） ── */
eq('⑧ 保存先は商品マスタ（saveOneProduct）', /action:'saveOneProduct', product: prod/.test(juchu), true);
eq('⑧ ラベルを lots に push していない',     /lots\.push\([^)]*ラベル/.test(juchu + master), false);
eq('⑧ ラベル用の status を作っていない',      /status *: *'label/.test(juchu + master + zaiko), false);
eq('⑧ 親は知らない status を棚の良品に足す（だから lots に入れてはいけない）',
   /else\s+cur\.avail \+= q;/.test(zaiko), true);
eq('⑧ 親の注意書きが残っている', zaiko.indexOf('在庫データ(lots)には絶対に入れない') >= 0, true);

console.log('===== 裏ラベル（シール）の在庫 =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
