/* ══════════════════════════════════════════════════════════════════════
   セットの商品管理番号（品番-下4桁-下4桁）の見張り　2026-09-09 作成

   ★ひろみさんの決定（2026-09-09）
     これから作る【ギフトではなくただのセット】の商品管理番号は
         そのセットの品番 のうしろに、中身の【オイル】のバーコード下4桁を、ハイフンで並べる
     例）品番 SETX ＋ オルガニック250ml（…9063）＋メメジック250ml（…9100） → SETX-9063-9100
     ・並べるのはオイルだけ。箱・紙袋・備品（BOX…／BAG…／MISC…）は番号に入れない。
       （在庫を引くためには構成に書きます。番号に出すかどうかは別の話です）
     ・並べる順は【構成に書いた順】。書き直すと番号も変わります。

     ・入れる先は【商品管理番号（STORES品番）】。バーコード（JAN）欄は空のまま。
       （2026-09-03の決定「セットにJANは作らない」を守る）
     ・作るきっかけは【名簿でセットを保存したとき、自動】。
     ・【ギフトセット】は今までどおり品番そのまま（YS100・YS250A〜C・GFT001）。
       ★付け替えると、STORESに登録済みの番号が変わってしまいます。
     ・ギフトセットの見分け方＝中身にギフト箱（BOX…）か紙袋（BAG…）が入っているもの。
     ・中身のどれかにバーコードが無いときは、番号を作らず品番のまま。

   ★このテストは、統合マスタＮの中の本物の関数を取り出して、実際に動かして確かめます。
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
function eq(name, got, want) {
  ok(name + '（' + want + '）', got === want, '→ 出たのは「' + got + '」');
}

/* ── 本物の関数を master.html から取り出して動かす ────────────────── */
function grab(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = M.match(re);
  if (!m) return null;
  let i = M.indexOf(m[0]) + m[0].length - 1, depth = 0, start = i;
  for (; i < M.length; i++) {
    if (M[i] === '{') depth++;
    else if (M[i] === '}') { depth--; if (!depth) break; }
  }
  return M.slice(M.indexOf(m[0]), i + 1);
}

const NAMES = ['mbBarcodeOfSku', 'mbIsGiftSet', 'mbIsBihin', 'mbSetTailsFrom', 'mbSetKanriFrom', 'mbKanriFrom'];
const src = NAMES.map(n => { const f = grab(n); ok('①本物の ' + n + ' が master.html にある', !!f); return f || ''; }).join('\n');

/* 本物の商品データを模した名簿（バーコードは実物と同じ） */
const PRODUCTS = [
  { sku: 'ORG250', name: 'オルガニック 250ml', extras: { 'バーコード': '8683649339063' } },
  { sku: 'MEM250', name: 'メメジック 250ml', extras: { 'バーコード': '8683649339100' } },
  { sku: 'CHF250', name: 'シェフズブレンド 250ml', extras: { 'バーコード': '8683649339230' } },
  { sku: 'ORG100', name: 'オルガニック 100ml', extras: { 'バーコード': '8681763395149' } },
  { sku: 'BOX-YS2', name: 'ギフト箱 your story 250ml×2本用（空箱）', extras: {} },
  { sku: 'BAG002', name: '紙袋 黒 大', extras: {} },
  /* ★いまギフト箱・紙袋にバーコードは無いが、将来つけるかもしれない。
     そのとき「ギフトセットは品番のまま」を守るのは、mbIsGiftSet だけになる。
     下の③-2 が、その1行が消されたら気づくための見張り。 */
  { sku: 'BOX-FUTURE', name: 'ギフト箱（将来バーコードが付いた場合）', extras: { 'バーコード': '4580256047777' } },
  { sku: 'BAG-FUTURE', name: '紙袋（将来バーコードが付いた場合）', extras: { 'バーコード': '4580256048888' } },
  { sku: 'ETC-001', name: 'ザクロソース', extras: {} }
];
const ctx = { PRODUCTS, findProductBySku: sku => PRODUCTS.find(p => p.sku === sku) };
vm.createContext(ctx);
vm.runInContext(src, ctx);

/* ── ② ただのセット → SET-下4桁-下4桁 ────────────────────────── */
eq('②オイル2本のセット', ctx.mbKanriFrom('SETX', '', [{ sku: 'ORG250', qty: 1 }, { sku: 'MEM250', qty: 1 }]), 'SETX-9063-9100');
eq('②オイル3本のセット', ctx.mbKanriFrom('SETY', '', [{ sku: 'ORG250', qty: 1 }, { sku: 'MEM250', qty: 1 }, { sku: 'CHF250', qty: 1 }]), 'SETY-9063-9100-9230');
eq('②100mlと250mlの混ぜセット', ctx.mbKanriFrom('SETZ', '', [{ sku: 'ORG100', qty: 1 }, { sku: 'CHF250', qty: 1 }]), 'SETZ-5149-9230');

/* ── ③ ギフトセットは今までどおり品番のまま ───────────────────── */
eq('③ギフト箱入り（BOX…）は品番のまま', ctx.mbKanriFrom('YS250A', '',
  [{ sku: 'ORG250', qty: 1 }, { sku: 'MEM250', qty: 1 }, { sku: 'BOX-YS2', qty: 1 }, { sku: 'BAG002', qty: 1 }]), 'YS250A');
eq('③紙袋だけ入っていても品番のまま', ctx.mbKanriFrom('YSX', '',
  [{ sku: 'ORG250', qty: 1 }, { sku: 'BAG002', qty: 1 }]), 'YSX');
/* ③-2 ★ここが本当の見張り。
   いまはギフト箱・紙袋にバーコードが無いので、「バーコードが無ければ作らない」の方でも
   たまたま品番のままになる。将来バーコードが付いたら、守るのは mbIsGiftSet だけになる。
   ★この2行が落ちたら、YS250A のような番号が勝手に付け替わり、STORESの登録とずれます。 */
eq('③-2 ギフト箱にバーコードが付いても品番のまま', ctx.mbKanriFrom('YSFUT', '',
  [{ sku: 'ORG250', qty: 1 }, { sku: 'MEM250', qty: 1 }, { sku: 'BOX-FUTURE', qty: 1 }]), 'YSFUT');
eq('③-2 紙袋にバーコードが付いても品番のまま', ctx.mbKanriFrom('YSFUT2', '',
  [{ sku: 'ORG250', qty: 1 }, { sku: 'BAG-FUTURE', qty: 1 }]), 'YSFUT2');

/* ── ④ 中身にバーコードが無ければ作らない ───────────────────── */
eq('④バーコードの無い品が混ざったら品番のまま', ctx.mbKanriFrom('SETW', '',
  [{ sku: 'ORG250', qty: 1 }, { sku: 'ETC-001', qty: 1 }]), 'SETW');
eq('④名簿に無い品が混ざったら品番のまま', ctx.mbKanriFrom('SETV', '',
  [{ sku: 'ORG250', qty: 1 }, { sku: 'NOPE', qty: 1 }]), 'SETV');

/* ── ⑤ 単品は今までどおり（品番＋バーコード下4桁）──────────────── */
eq('⑤単品（バーコードあり）', ctx.mbKanriFrom('ORG500', '8683649335354'), 'ORG500-5354');
eq('⑤単品（バーコードなし）', ctx.mbKanriFrom('BOX-YS3', ''), 'BOX-YS3');
eq('⑤セットでない呼び方でも壊れない', ctx.mbKanriFrom('ORG250', '8683649339063', []), 'ORG250-9063');

/* ── ⑥ 保存のときに、中身が分かってから番号を作り直しているか ───────── */
ok('⑥保存時にセットの番号を作り直している',
  M.indexOf("prod['STORES品番'] = mbKanriFrom(sku, prod['バーコード'], _kousei);") >= 0,
  '（構成品より先に番号を作ると、セットでも品番のままになります）');
ok('⑥入力中の表示にもセットの番号が出る',
  M.indexOf('mbSetKanriFrom(sku, _comps)') >= 0);

/* ══════════════════════════════════════════════════════════════════
   ⑧ 【保存する番号】と【画面に出す番号】が同じであること
   ──────────────────────────────────────────────────────────────────
   ★2026-09-09 に実際に見つかった穴。
     保存側は mbKanriFrom、画面側は displaySkuCode という【別の計算】で、
     displaySkuCode がセットのルールを知りませんでした。そのため
       ・保存では SET-9063-9100 になるのに、名簿の「商品管理番号」の列には
         古い番号（品番のまま）が出る
       ・「STORES品番を商品管理番号にそろえる」を押すと、
         SET-9063-9100 が「ズレている」と判定され、古い番号に戻される
       ・「セットの構成を一括保存」でも同じく戻される
     という食いちがいが起きます。
   ★2つの計算は、いつも同じ答えにしてください。
   ══════════════════════════════════════════════════════════════════ */
const dsp = grab('displaySkuCode');
ok('⑧本物の displaySkuCode が master.html にある', !!dsp);
if (dsp) {
  const ctx2 = {
    PRODUCTS,
    findProductBySku: sku => PRODUCTS.find(p => p.sku === sku),
    compsOf: p => (p && p.components) ? p.components : [],
    meiboBarcode: sku => {
      const p = PRODUCTS.find(x => x.sku === sku);
      return (p && p.extras && p.extras['バーコード']) || '';
    },
    mbSetKanriFrom: ctx.mbSetKanriFrom,
    mbSetTailsFrom: ctx.mbSetTailsFrom,
    mbIsBihin: ctx.mbIsBihin,
    mbIsGiftSet: ctx.mbIsGiftSet,
    mbBarcodeOfSku: ctx.mbBarcodeOfSku
  };
  vm.createContext(ctx2);
  vm.runInContext(dsp, ctx2);

  /* 名簿に「ただのセット」と「ギフトセット」を置いて、2つの計算を突き合わせる */
  const CASES = [
    { sku: 'SETX', comps: [{ sku: 'ORG250' }, { sku: 'MEM250' }], want: 'SETX-9063-9100' },
    { sku: 'SETY', comps: [{ sku: 'ORG250' }, { sku: 'MEM250' }, { sku: 'CHF250' }], want: 'SETY-9063-9100-9230' },
    { sku: 'YSG', comps: [{ sku: 'ORG250' }, { sku: 'MEM250' }, { sku: 'BOX-YS2' }], want: 'YSG' },
    { sku: 'YSFUT', comps: [{ sku: 'ORG250' }, { sku: 'BOX-FUTURE' }], want: 'YSFUT' },
    { sku: 'ORG250', comps: [], want: 'ORG250-9063' }
  ];
  CASES.forEach(c => {
    /* その商品を名簿に置いてから両方を呼ぶ */
    const idx = PRODUCTS.findIndex(p => p.sku === c.sku);
    const row = { sku: c.sku, name: c.sku, extras: {}, components: c.comps };
    if (idx >= 0) { row.extras = PRODUCTS[idx].extras; PRODUCTS[idx] = Object.assign({}, PRODUCTS[idx], { components: c.comps }); }
    else PRODUCTS.push(row);

    const hozon = ctx.mbKanriFrom(c.sku, (row.extras && row.extras['バーコード']) || '', c.comps);
    const gamen = ctx2.displaySkuCode(c.sku);
    eq('⑧保存する番号　' + c.sku, hozon, c.want);
    ok('⑧画面に出す番号が保存と同じ　' + c.sku + '（' + c.want + '）', gamen === hozon,
      '→ 保存は「' + hozon + '」なのに画面は「' + gamen + '」（名簿の列と、そろえるボタンがズレます）');

    if (idx < 0) PRODUCTS.pop(); else delete PRODUCTS[idx].components;
  });
}

/* ══════════════════════════════════════════════════════════════════
   ⑨ 番号を「書く場所」「出す場所」が、ぜんぶ同じ計算を通っているか
   ──────────────────────────────────────────────────────────────────
   2026-09-09 の穴は「1か所だけ別の計算になっていた」ことが原因でした。
   同じ事故を防ぐため、STORES品番に値を入れている行と、
   画面に番号を出している行を機械的に数えて、
   ぜんぶ displaySkuCode か mbKanriFrom を通っていることを確かめます。
   ★新しい書き方を足すときは、この2つのどちらかを必ず通してください。
   ══════════════════════════════════════════════════════════════════ */
{
  const lines = M.split('\n');
  const writes = [], bad = [];
  lines.forEach((line, i) => {
    if (line.indexOf("'STORES品番':") < 0) return;
    if (/checkShipUnitSaved/.test(line)) return;          // 保存できたか確かめるだけの行
    writes.push(i + 1);
    if (!/displaySkuCode\(|mbKanriFrom\(/.test(line)) bad.push((i + 1) + '行目: ' + line.trim().slice(0, 90));
  });
  ok('⑨STORES品番に値を入れている行が見つかる', writes.length >= 3, '（' + writes.length + '行）');
  ok('⑨その全部が displaySkuCode か mbKanriFrom を通っている', bad.length === 0,
    '\n            ' + bad.join('\n            ') +
    '\n           （自前で番号を組み立てると、セットのルールから外れます）');

  /* 名簿一覧の「商品管理番号」の列 */
  ok('⑨名簿一覧の商品管理番号の列は displaySkuCode を使っている',
    /esc\(displaySkuCode\(p\.sku\)\)/.test(M),
    '（列が自前計算になっていると、保存した番号と違うものが出ます）');
}

/* ── ⑦ バーコード（JAN）欄には入れていないこと ─────────────────── */
ok('⑦セットの番号をバーコード欄に書き込んでいない',
  M.indexOf("'バーコード': mbSetKanriFrom") < 0 && M.indexOf("'バーコード': mbKanriFrom") < 0,
  '（2026-09-03の決定「セットにJANは作らない」を破っています）');

/* ══════════════════════════════════════════════════════════════════
   ⑩ 説明書の言い方が「ギフトではなくただのセット」でそろっているか
   ──────────────────────────────────────────────────────────────────
   2026-09-09、説明書が3か所バラバラでした（7/29版・8/7版・いまのルール）。
   ひろみさんの決定で「ギフトではなくただのセット」という言い方に統一。
   ★ゆかちゃんが読む文なので、勝手に言い換えないでください。
   ══════════════════════════════════════════════════════════════════ */
{
  const F = fs.readFileSync(path.join(ROOT, 'gyomu_flow.html'), 'utf8');
  [['統合マスタＮ', M], ['業務フロー説明書', F]].forEach(pair => {
    ok('⑩' + pair[0] + '：「ギフトではなくただのセット」の言い方を使っている',
      pair[1].indexOf('ギフトではなくただのセット') >= 0);
    ok('⑩' + pair[0] + '：新しい形の例（-9063-9100）が載っている',
      pair[1].indexOf('-9063-9100') >= 0 && pair[1].indexOf('SET-9063-9100') < 0);
  });
  ok('⑩業務フロー説明書：古い「SKU*本数のカンマ区切り」が残っていない',
    F.indexOf('MEM250*1,PRI500*1,CHF250*1') < 0,
    '（2026-07-29の古いルールです。いまのルールと食いちがいます）');
  ok('⑩統合マスタＮ：古い「セットはセットの品番（バーコードが無いのでハイフンなし）」が残っていない',
    M.indexOf('セットはセットの品番（バーコードが無いのでハイフンなし）') < 0);
  ok('⑩そろえるボタンの確認文も新しいルールになっている',
    M.indexOf('ギフトではなくただのセットは「品番-下4桁-下4桁（オイルだけ）」') >= 0 &&
    M.indexOf('セットはセット品番になります') < 0,
    '（押す前に読む文が古いままだと、ひろみさんが違う結果を想像します）');
}

/* ── 結果 ───────────────────────────────────────────────── */
const title = 'セットの商品管理番号 SET-下4桁-下4桁（2026-09-09 ひろみさん決定）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
