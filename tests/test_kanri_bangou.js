/* ══════════════════════════════════════════════════════════════════════
   🏷 商品管理番号（品番＋バーコード下4桁）── 親とアプリとGASが同じ答えを出すか
   2026-09-16　ひろみさん指示

   ★なぜ作ったか
     ひろみさん「3つ同じことをやっているのは、ちょっと事故が起きやすい」
     　　　　　「とにかくアプリと揃えて。ずれてたり、壊れたりしないようにしたい」

     2026-09-16 まで、この計算は【3つのアプリに書き写されて】いました
     （統合マスタＮ／受注Ａ／倉庫Ｄ）。そのときは答えが一致していましたが、
     どれか1つを直したら、ほかが古いまま残る形でした。
     → 親（oos-kubun.js）に一本化し、アプリは呼ぶだけにしました。
     → GASだけは親を読めないので、唯一のコピー（oosKanriBangou_）を持ちます。

   ★この見張りがすること
     ① 親・3つのアプリ・GAS の【5つ】に同じ商品を流して、同じ答えになるか
     ② アプリの中に計算が書き戻されていないか（先祖返りの見張り）
     ③ 決めごとそのもの（ハイフンを出さない・下4桁・バーコードの探す順）
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(LIVE, f), 'utf8');
const MASTER = read('master.html');
const INDEX = read('index.html');
const PICKUP = read('pickup.html');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');

const title = '🏷 商品管理番号（親・アプリ3つ・GASが同じ答えか／2026-09-16）';
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

/* ── 親（oos-kubun.js）を動かす ── */
const ctxOya = vm.createContext({ String: String, Map: Map });
vm.runInContext(read('oos-kubun.js'), ctxOya);
const OYA = ctxOya.OOS_KUBUN;
const oya = p => { ctxOya.__p = p; return vm.runInContext('OOS_KUBUN.kanriBangou(__p)', ctxOya); };

/* ── GASの唯一のコピーを動かす ── */
const ctxGas = vm.createContext({ String: String });
vm.runInContext(H.cut(GAS, 'oosBarcodeOf_') + '\n' + H.cut(GAS, 'oosShita4_') + '\n' + H.cut(GAS, 'oosKanriBangou_'), ctxGas);
const gas = p => { ctxGas.__p = p; return vm.runInContext('oosKanriBangou_(__p)', ctxGas); };

/* ── 受注Ａ・倉庫Ｄ（親を呼ぶだけになっているはず） ── */
function appRunner(src){
  const ctx = vm.createContext({ String: String, Map: Map, OOS_KUBUN: OYA });
  vm.runInContext(H.cut(src, 'pBarcodeOf') + '\n' + H.cut(src, 'dispCodeOf'), ctx);
  return p => { ctx.__p = p; return vm.runInContext('dispCodeOf(__p)', ctx); };
}
const juchuA = appRunner(INDEX);
const soukoD = appRunner(PICKUP);

/* ── 統合マスタＮ（セットの枝を通ってから親を呼ぶ） ── */
const ctxN = vm.createContext({
  String: String, OOS_KUBUN: OYA,
  meiboBarcode: sku => (ctxN.__bc && ctxN.__bc[sku]) || '',
  findProductBySku: () => null,
  compsOf: () => [],
  mbSetKanriFrom: () => ''
});
vm.runInContext(H.cut(MASTER, 'displaySkuCode'), ctxN);
const masterN = p => {
  ctxN.__bc = {}; ctxN.__bc[p.sku] = OYA.barcodeOf(p);
  ctxN.__s = p.sku;
  return vm.runInContext('displaySkuCode(__s)', ctxN);
};

/* ══════════════════════════════════════════════════════════════
   ① 5つが同じ答えを出すか（作り物のデータで、いろいろな形を試す）
   ══════════════════════════════════════════════════════════════ */
const MIHON = [
  { sku:'ORG100', extras:{ 'バーコード':'8681763395149' } },          /* ふつう */
  { sku:'MEM100', extras:{ 'バーコード':'8681763395132' } },
  { sku:'CHF250', extras:{ 'バーコード':'8683649339230' } },
  { sku:'MEM750', extras:{} },                                        /* バーコード無し */
  { sku:'ORG5L' },                                                    /* extras そのものが無い */
  { sku:'BOX-YS3', extras:{ 'バーコード':'' } },                       /* 空っぽ */
  { sku:'TEST1',  extras:{ 'バーコード':'123' } },                     /* 4桁に足りない */
  { sku:'TEST2',  extras:{ 'バーコード':'4580-256-047012' } },         /* ハイフン入り */
  { sku:'TEST3',  extras:{ 'バーコード':' 8683649339179 ' } },         /* 前後に空白 */
  { sku:'TEST4',  jan:'4580256047043' },                              /* jan から */
  { sku:'TEST5',  barcode:'4580256047050' },                          /* barcode から */
  { sku:'TEST6',  'バーコード':'8388765689077' },                      /* 直に持っている */
  { sku:'TEST7',  extras:{ 'バーコード':'AB12CD34' } }                 /* 英字まじり */
];
MIHON.forEach(function(p){
  const o = oya(p), g = gas(p), a = juchuA(p), d = soukoD(p), n = masterN(p);
  eq('①' + p.sku + '：受注Ａが親と同じ', a, o);
  eq('①' + p.sku + '：倉庫Ｄが親と同じ', d, o);
  eq('①' + p.sku + '：統合マスタＮが親と同じ', n, o);
  eq('①' + p.sku + '：GASが親と同じ', g, o);
});

/* ══════════════════════════════════════════════════════════════
   ② 決めごとそのもの
   ══════════════════════════════════════════════════════════════ */
eq('②ふつうは 品番-下4桁', oya({ sku:'ORG100', extras:{ 'バーコード':'8681763395149' } }), 'ORG100-5149');
eq('②バーコードが無ければ品番だけ（ハイフンを出さない）', oya({ sku:'MEM750' }), 'MEM750');
eq('②4桁に足りないときも品番だけ', oya({ sku:'TEST1', extras:{ 'バーコード':'123' } }), 'TEST1');
eq('②ハイフンや空白は取り除いてから下4桁', oya({ sku:'X', extras:{ 'バーコード':'4580-256-047012' } }), 'X-7012');
eq('②品番が無ければ空', oya({ extras:{ 'バーコード':'8681763395149' } }), '');
eq('②商品そのものが無ければ空', oya(null), '');
eq('②バーコードを探す順は バーコード欄 → jan → barcode',
   OYA.barcodeOf({ sku:'X', extras:{ 'バーコード':'111' }, jan:'222', barcode:'333' }), '111');
eq('②バーコード欄が空なら jan を見る', OYA.barcodeOf({ sku:'X', jan:'222', barcode:'333' }), '222');
eq('②jan も無ければ barcode を見る', OYA.barcodeOf({ sku:'X', barcode:'333' }), '333');

/* ══════════════════════════════════════════════════════════════
   ③ 先祖返りの見張り（アプリの中に計算が書き戻されていないか）
   ══════════════════════════════════════════════════════════════ */
eq('③受注Ａは親を呼ぶだけ（自分で下4桁を切っていない）',
   /slice\(-4\)/.test(H.cut(INDEX, 'dispCodeOf') + H.cut(INDEX, 'pBarcodeOf')), false);
eq('③倉庫Ｄは親を呼ぶだけ（自分で下4桁を切っていない）',
   /slice\(-4\)/.test(H.cut(PICKUP, 'dispCodeOf') + H.cut(PICKUP, 'pBarcodeOf')), false);
eq('③統合マスタＮは親を呼ぶだけ（自分で下4桁を切っていない）',
   /slice\(-4\)/.test(H.cut(MASTER, 'displaySkuCode')), false);
eq('③受注Ａの出荷依頼書も親から下4桁をもらう',
   H.cut(INDEX, 'lineCodeHtmlA').indexOf('OOS_KUBUN.shita4') < 0, false);
eq('③倉庫Ｄのピッキングも親から下4桁をもらう',
   H.cut(PICKUP, 'lineBarcode4').indexOf('OOS_KUBUN.shita4') < 0, false);

/* ★2026-09-16 親は【必ず合言葉（?v=）付き】で読み込みます。
   　付いていないと、親を直したのにブラウザが古い控えを使い、
   　「kanriBangou なんて無い」で画面が止まります（2026-09-16 に気づいた穴）。 */
eq('③3つのアプリとも 親（oos-kubun.js）を合言葉つきで読み込んでいる',
   [MASTER, INDEX, PICKUP].filter(s => /<script src="oos-kubun\.js\?v=[A-Za-z0-9._-]+"><\/script>/.test(s)).length, 3);
eq('③合言葉なしで読み込んでいるアプリは無い',
   [MASTER, INDEX, PICKUP].some(s => s.indexOf('<script src="oos-kubun.js"></script>') >= 0), false);

eq('③GASのコピーは1つだけ', (GAS.match(/function oosKanriBangou_/g) || []).length, 1);
eq('③親の書いてある場所も1つだけ',
   (read('oos-kubun.js').match(/function kanriBangou/g) || []).length, 1);

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
