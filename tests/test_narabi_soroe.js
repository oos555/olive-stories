/* ══════════════════════════════════════════════════════════════════════
   統合マスタＮと輸入・原価Ｅの【商品の並び】をそろえる　2026-09-09 ひろみさん指示

   ★ひろみさんの言葉
     「統合マスタと原価データの並び、商品の並びは常に一緒にしておいてください。
       ここずれてると見間違うので、必ず一緒にして。
       合わせるのは統合マスタに合わせて。理由は統合マスタで商品が増えていくので。」

   ★どう作ったか
     並び順の決めごとは oos-kubun.js（親）に【1か所だけ】書いています。
     統合マスタＮ（master.html）も 輸入・原価Ｅ（import.html）も、そこから受け取ります。
     並び順を2か所に書くと、片方だけ直したときに必ずズレます
     （2026-09-09に、番号の計算が2か所にあってズレた事故を実際に起こしました）。

   ★このファイルを消さないでください。消すと、また並びがバラバラになります。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ── ① 親のファイルがあること ─────────────────────────────────── */
let K = null;
try {
  const g = { window: {} };
  vm.createContext(g);
  vm.runInContext(read('oos-kubun.js'), g);
  K = g.window.OOS_KUBUN || g.OOS_KUBUN;
} catch (e) { /* 下で落ちます */ }
ok('①並び順の親 oos-kubun.js がある', !!K,
  '（無いと、並び順をそれぞれのアプリが自前で持つことになり、必ずズレます）');
ok('①親に区分の並び（ORDER）がある', !!(K && Array.isArray(K.ORDER) && K.ORDER.length));
ok('①親に商品を並べる部品（sortProducts）がある', !!(K && typeof K.sortProducts === 'function'));

/* ── ② 両方のアプリが親を読み込んでいること ───────────────────── */
['master.html', 'import.html'].forEach(f => {
  ok('②' + f + ' が oos-kubun.js を読み込んでいる',
    read(f).indexOf('<script src="oos-kubun.js"></script>') >= 0,
    '（読み込みが消えると、そのアプリだけ並びが変わります）');
});
ok('②統合マスタＮは親から並びをもらっている',
  /MB_GROUP_ORDER = \(window\.OOS_KUBUN && window\.OOS_KUBUN\.ORDER\)/.test(read('master.html')),
  '（自前の表に書き戻すと2か所になります）');
ok('②輸入・原価Ｅは親の sortProducts で並べている',
  read('import.html').indexOf('window.OOS_KUBUN.sortProducts(OOS_PRODUCTS)') >= 0,
  '（商品マスタの並びのままだと、統合マスタとズレます）');

/* ── ③ 実際に並べて、1件目から最後まで一致すること ───────────────── */
if (K) {
  /* 本物の商品データを模した名簿（わざと区分の順とバラバラに並べておく） */
  const PRODUCTS = [
    { sku: 'BOX-YS3', group: '備品-箱', active: true },
    { sku: 'ORG250', group: 'オルガニック', active: true },
    { sku: 'SET-002', group: 'セット', active: true },
    { sku: 'ETC-001', group: 'オイル以外輸入商品', active: true },
    { sku: 'ORG100', group: 'オルガニック', active: true },
    { sku: 'YS100', group: 'ギフト商品', active: true },
    { sku: 'CAS5L', group: 'その他オイル', active: true },
    { sku: 'BAG001', group: '備品-バッグ', active: true },
    { sku: 'MEM250', group: 'メメジック', active: true },
    { sku: 'NEWGRP', group: 'あとから作った区分', active: true }
  ];

  /* 統合マスタＮの並び（区分の順 → 区分の中は登録順） */
  const M = read('master.html');
  function grab(src, n) {
    const m = src.match(new RegExp('function\\s+' + n + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let i = src.indexOf(m[0]) + m[0].length - 1, d = 0;
    for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) break; } }
    return src.slice(src.indexOf(m[0]), i + 1);
  }
  const cm = { PRODUCTS, MB_GROUP_ORDER: K.ORDER };
  vm.createContext(cm);
  vm.runInContext(grab(M, 'mGroupOrder') + '\n' + grab(M, 'mGroupOrderWithItems'), cm);
  const masterOrder = [];
  cm.mGroupOrderWithItems().forEach(gr => {
    PRODUCTS.filter(p => (p.group || 'その他') === gr && p.active !== false).forEach(p => masterOrder.push(p.sku));
  });

  /* 原価データの並び */
  const costOrder = K.sortProducts(PRODUCTS).filter(p => p.active !== false).map(p => p.sku);

  ok('③件数が同じ', masterOrder.length === costOrder.length,
    '（統合マスタ ' + masterOrder.length + '件／原価データ ' + costOrder.length + '件）');
  const same = masterOrder.length === costOrder.length && masterOrder.every((s, i) => s === costOrder[i]);
  ok('③1件目から最後まで、まったく同じ並び', same,
    '\n            統合マスタ：' + masterOrder.join(' → ') +
    '\n            原価データ：' + costOrder.join(' → '));

  /* ── ④ 決めごとの並びが守られていること ─────────────────────── */
  const io = s => costOrder.indexOf(s);
  ok('④セットはギフト商品より前', io('SET-002') >= 0 && io('YS100') >= 0 && io('SET-002') < io('YS100'));
  ok('④オイル以外輸入商品は、その他オイルのすぐ後ろ',
    io('CAS5L') >= 0 && io('ETC-001') === io('CAS5L') + 1);
  ok('④あとから作った区分は、いちばんうしろ',
    io('NEWGRP') === costOrder.length - 1,
    '（消えてしまうのではなく、うしろに足されるのが決めごとです）');
  ok('④同じ区分の中は、登録した順のまま',
    io('ORG250') < io('ORG100'),
    '（名簿に ORG250 → ORG100 の順で入っているので、そのままの順で出ます）');
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ 掛け率シミュレーションを、原価が届く前に描かないこと
   ──────────────────────────────────────────────────────────────────
   ★2026-09-09 実際に起こした不具合。
     applyProductsE（商品一覧が届いたとき）に renderRateSimulation を足したところ、
     原価がまだ空のうちに1回描かれ、「開いた最初の1回だけ自動で1件出す」印
     （simAutoPickDone）を使い切ってしまい、そのあと原価が届いても何も出なくなった。
     ＝ひろみさんの画面で【掛け率シミュレーションが空っぽ】になった。
   ══════════════════════════════════════════════════════════════════ */
{
  const IMP = fs.readFileSync(path.join(ROOT, 'import.html'), 'utf8');
  const ap = IMP.slice(IMP.indexOf('function applyProductsE'), IMP.indexOf('async function initializeProductsE'));
  /* ★コメントの中の説明文まで拾わないよう、コメントを取り除いてから見ます。
     （2026-09-09に、自分が書いた注意書きの文字を拾って空振りしました） */
  const apCode = ap.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  ok('⑤applyProductsE から掛け率シミュレーションを呼んでいない',
    apCode.indexOf('renderRateSimulation') < 0,
    '（原価より先に呼ぶと、シミュレーションが空っぽになります）');
  ok('⑤原価が読めていないうちは自動で選ばない（守り）',
    IMP.indexOf("if(typeof costLoadedOk !== 'undefined' && !costLoadedOk) return;") >= 0,
    '（印を使い切ると、原価が届いたあと何も出なくなります）');
  ok('⑤原価データの表とお知らせは、これからも描き直す',
    apCode.indexOf('renderCostProductTable') >= 0 && apCode.indexOf('renderCostMissingAlert') >= 0,
    '（名簿で作った商品が原価データに出てこなくなります）');
  ok('⑤並び順の親が読めないときは、黙らずに知らせる',
    IMP.indexOf('oosKubunOyaWarn_') >= 0 &&
    IMP.indexOf('並び順の親ファイル（oos-kubun.js）が読み込めていません') >= 0,
    '（黙って違う並びで出すと、原因が分からなくなります）');
}

/* ── 結果 ───────────────────────────────────────────────── */
const title = '統合マスタＮと輸入・原価Ｅの商品の並びをそろえる（2026-09-09 ひろみさん指示）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
