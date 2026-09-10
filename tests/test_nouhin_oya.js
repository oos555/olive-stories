/* ══════════════════════════════════════════════════════════════════════
   📄 納品書の【親】oos-nouhin.js と、金額が請求書と合うかの見張り（2026-09-10）

   ★きっかけ（ひろみさん）
     「一般・卸の納品書が倉庫で開けません。もう倉庫スプシは確定したのだから、
     　逆算でそこに合わせていく、が正解だね」
     「ずーっとバグと抜け漏れ変更で修正ゲームになってる。
     　スプシを使うことでそれを無くそうとしてるから、このあたりしっかり頼む」

   ★いちばん怖いこと
     倉庫がお客様に渡す【納品書の金額】と、あとから送る【請求書の金額】がズレること。
     ズレると、お客様に2つの違う数字が届きます。取り返しがつきません。
     　→ このファイルは、同じ注文で【1円まで一致するか】を毎回たしかめます。

   ★写しを作らない
     単価は oos-kakaku.js、消費税は oos-zei.js、体裁は oos-doc.js、
     納品書の中身は oos-nouhin.js。アプリ側のHTMLに同じ判定を書き写さないこと。

   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(l + '  期待:' + w + '  実際:' + g); } }
function ok(l, g, d){ if(g) pass++; else { fail++; fails.push(l + (d ? '  ' + d : '')); } }
function inc(l, text, needle, want){ eq(l, String(text || '').indexOf(needle) >= 0, want); }

const IDX = H.read('index.html');
const PIC = H.read('pickup.html');
const BIL = H.read('billing.html');
const OYA = H.read('oos-nouhin.js');

/* ══ ① 親があって、写しが残っていない ══════════════════════ */
ok('①納品書の親（oos-nouhin.js）がある', fs.existsSync(path.join(__dirname, '..', 'oos-nouhin.js')));
inc('①親は build を出している',        OYA, 'root.OOS_NOUHIN = {', true);
inc('①倉庫Ｄは親を読んでいる',          PIC, 'oos-nouhin.js?v=', true);
inc('①受注Ａも親を読んでいる',          IDX, 'oos-nouhin.js?v=', true);
inc('①倉庫Ｄは親を呼ぶだけ',            PIC, 'return OOS_NOUHIN.build(o, {', true);
ok('①倉庫Ｄに納品書の組み立ての写しが残っていない',
   PIC.indexOf('本書はご請求書を兼ねております') < 0, '（親と二重になっています）');
ok('①受注Ａに納品書の組み立ての写しが無い',
   IDX.indexOf('本書はご請求書を兼ねております') < 0, '（親と二重になっています）');
ok('①受注Ａは親を呼んでPDFにしている', IDX.indexOf('OOS_NOUHIN.build(o, nouhinDeps())') >= 0);

/* ══ 砂場（本物の親を、そのまま動かす） ══════════════════════ */
function mkEl(){ return { id:'', innerHTML:'', textContent:'', style:{}, setAttribute(){}, appendChild(){},
  classList:{add(){},remove(){}}, querySelector(){return null;}, querySelectorAll(){return [];} }; }
const doc = { getElementById(){ return null; }, createElement(){ return mkEl(); },
  head:{ appendChild(){} }, body:{ appendChild(){}, removeChild(){} },
  querySelector(){ return null; }, querySelectorAll(){ return []; } };
const box = { console, Math, Date, JSON, parseInt, parseFloat, isNaN, String, Number,
  Object, Array, Boolean, RegExp, Error, document: doc };
box.window = box; box.globalThis = box;
const ctx = vm.createContext(box);
['oos-zei.js', 'oos-kakaku.js', 'oos-doc.js', 'oos-nouhin.js'].forEach(function(f){
  vm.runInContext(H.read(f), ctx);
});

/* 商品と価格（本番と同じ形。8%の食品と10%の備品を混ぜてあります） */
const PRODUCTS = [
  { id:1, sku:'ORG250', name:'オルガニック 250ml', group:'オルガニック', boxQty:12 },
  { id:2, sku:'MEM500', name:'メメジック 500ml', group:'メメジック', boxQty:12 },   /* 8%の食品 */
  { id:9, sku:'BAG001', name:'紙袋 黒 小',        group:'備品-バッグ',    boxQty:50 },   /* 10%の備品 */
  { id:3, sku:'ORG100', name:'オルガニック 100ml', group:'オルガニック',   boxQty:24 }    /* ★端数の出る単価にしてあります */
];
const PM = [
  { sku:'ORG250', priceGeneral:2550, priceWholesale1:1800, priceWholesale2:1600, priceRT:1920, priceBasara:1700, priceSpecial:2000, priceDefect:900 },
  { sku:'MEM500', priceGeneral:3600, priceWholesale1:2600, priceWholesale2:2300, priceRT:2750, priceBasara:2400, priceSpecial:2900, priceDefect:1200 },
  { sku:'BAG001', priceGeneral:100,  priceWholesale1:80,   priceWholesale2:70,   priceRT:80,   priceBasara:80,   priceSpecial:90,   priceDefect:50 },
  /* ★2530×3=7590。7590の8%は607.2 → 四捨五入で607。切り上げ(608)・切り捨て(607)と見分けるための行です。
     ★この単価を、割り切れる数字に変えないでください（端数のまちがいに気づけなくなります） */
  { sku:'ORG100', priceGeneral:2530, priceWholesale1:1790, priceWholesale2:1590, priceRT:1910, priceBasara:1690, priceSpecial:1990, priceDefect:890 }
];
box.__deps = { products: PRODUCTS, priceMaster: PM, defaults: null };
function nouhin(o){ box.__o = o; return vm.runInContext('OOS_NOUHIN.build(__o, __deps)', ctx); }
function missing(o){ box.__o = o; return vm.runInContext('OOS_NOUHIN.missingPrices(__o, __deps)', ctx); }
function needs(o){ box.__o = o; return vm.runInContext('OOS_NOUHIN.needsNouhin(__o)', ctx); }

/* ══ 売上Ｃ（請求書）の本物の金額計算を、そのまま切り出す ══════ */
const bilBox = H.makeSandbox({ document: H.ANY });
let bilCode = '';
['DEFAULT_PRICES'].forEach(function(n){ bilCode += H.cutVar(BIL, n) + '\n'; });
['findProduct', 'findProductBySku', 'defaultTaxRateForGroup', 'effectiveCustomerType',
 'lineTierType', 'priceForSku', 'taxRateForSku', 'orderAmount'].forEach(function(n){ bilCode += H.cut(BIL, n) + '\n'; });
bilBox.box.PRODUCTS = PRODUCTS; bilBox.box.priceMaster = PM; bilBox.box.products = PRODUCTS;
vm.runInContext(bilCode, bilBox.ctx);
function seikyu(o){ bilBox.box.__o = o; return vm.runInContext('orderAmount(__o)', bilBox.ctx); }

/* 納品書のHTMLから「ご請求金額（税込）」を読み取る */
function nouhinTotal(html){
  var m = String(html).match(/ご請求金額（税込）<\/span><span class="amt">([^<]*)</);
  if(!m) return null;
  return parseInt(String(m[1]).replace(/[^0-9]/g, ''), 10);
}

function mkOrder(x){
  return Object.assign({
    num:'TK-20260910-1234', client:'宮西 杏奈', recipientName:'宮西 杏奈',
    customerType:'general', enclosedDoc:'納品書兼請求書',
    zip:'150-0001', addr:'東京都渋谷区1-1-1', tel:'03-1111-2222',
    lines:[{ productId:1, sku:'ORG250', productName:'オルガニック 250ml', bottles:6, boxes:0, boxQty:12 }]
  }, x || {});
}

/* ══ ② 納品書ができる ══════════════════════════════════════ */
{
  const h = nouhin(mkOrder({}));
  ok('②納品書のHTMLができる', h.length > 1000);
  inc('②表題は選んだ書類名',       h, '納品書兼請求書', true);
  inc('②お届け先が出る',           h, '宮西 杏奈', true);
  inc('②商品名が出る',             h, 'オルガニック 250ml', true);
  inc('②注文番号は暗号を外して出す', h, '注文番号：20260910-1234', true);
  inc('②請求書を兼ねる文言',       h, '本書はご請求書を兼ねております', true);
  inc('②破損のご案内（3日以内）',   h, '到着後3日以内', true);
  inc('②食品のため承れません',      h, '食品のため承れません', true);
  /* ★タグの中（CSSのクラス名や社印の画像データ）には英字がたくさん入るので、
     お客様が読む【本文だけ】を見ます。RT・卸などの社内の言葉が出ていないか。 */
  const honbun = h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ');
  inc('②本文に社内の言葉（RT）を出さない', honbun, 'RT', false);
  inc('②本文に社内の言葉（卸）を出さない', honbun, '卸', false);
  inc('②区分のバッジを出さない',    h, 'badge-ctype', false);
}

/* ══ ③ ★いちばん大事★ 納品書と請求書の金額が1円まで一致する ══ */
{
  const pats = [
    ['定価・6本',                 mkOrder({ customerType:'general' })],
    ['卸①・2箱',                 mkOrder({ customerType:'wholesale1', lines:[{productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:0,boxes:2,boxQty:12}] })],
    ['卸①・6箱（卸②に上がる）',  mkOrder({ customerType:'wholesale1', lines:[{productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:0,boxes:6,boxQty:12}] })],
    ['卸②・バラ＋箱',            mkOrder({ customerType:'wholesale2', lines:[{productId:2,sku:'MEM500',productName:'メメジック 500ml',bottles:5,boxes:1,boxQty:12}] })],
    ['RT（金額あり）',            mkOrder({ customerType:'rt', enclosedDoc:'納品書' })],
    ['特別提供価格',              mkOrder({ customerType:'special' })],
    ['8%と10%が混ざる',           mkOrder({ customerType:'general', lines:[
        {productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:3,boxes:0,boxQty:12},
        {productId:9,sku:'BAG001',productName:'紙袋 黒 小',bottles:2,boxes:0,boxQty:50}] })],
    ['w1指定の行がまざる',        mkOrder({ customerType:'general', lines:[
        {productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:4,boxes:0,boxQty:12,giftType:'w1'},
        {productId:2,sku:'MEM500',productName:'メメジック 500ml',bottles:2,boxes:0,boxQty:12}] })],
    ['3商品・多め',               mkOrder({ customerType:'wholesale2', lines:[
        {productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:0,boxes:3,boxQty:12},
        {productId:2,sku:'MEM500',productName:'メメジック 500ml',bottles:7,boxes:0,boxQty:12},
        {productId:9,sku:'BAG001',productName:'紙袋 黒 小',bottles:10,boxes:0,boxQty:50}] })]
  ];
  pats.forEach(function(p){
    const nam = p[0], o = p[1];
    const t1 = nouhinTotal(nouhin(o));
    const t2 = seikyu(o);
    eq('③【' + nam + '】納品書と請求書の合計が同じ', t1, t2);
  });
}

/* ══ ③-2 ★手で計算した金額そのものと比べる★ ══════════════════
   ③（納品書と請求書の一致）だけでは足りません。どちらも同じ親（oos-kakaku.js）を
   呼ぶので、【親を壊すと両方が同じように壊れて、やはり一致してしまう】からです。
   実際に9通り壊して試したところ、③は3通りしか気づけませんでした（2026-09-10）。
   そこで、紙と鉛筆で出した金額そのものを書いておきます。
   ★この数字を、コードの出す答えに合わせて書き換えないでください。
     合わなくなったら、まずコードを疑ってください。
   ══════════════════════════════════════════════════════════════ */
{
  /* 価格（この見張りの中だけの決め）：ORG250 定価2550・卸①1800・卸②1600・RT1920・特提2000
                                       MEM500 定価3600・卸①2600・卸②2300
                                       BAG001 定価100（10%の備品） */
  const tebiki = [
    ['定価 ORG250×6本　2550×6=15300　+8%=1224', mkOrder({ customerType:'general' }), 16524],
    ['卸① 2箱=24本　1800×24=43200　+8%=3456',
      mkOrder({ customerType:'wholesale1', lines:[{productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:0,boxes:2,boxQty:12}] }), 46656],
    ['卸①6箱→卸②に上がる 1600×72=115200　+8%=9216',
      mkOrder({ customerType:'wholesale1', lines:[{productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:0,boxes:6,boxQty:12}] }), 124416],
    ['RT 1920×6=11520　+8%=921（切り捨てず四捨五入で921.6→922）',
      mkOrder({ customerType:'rt', enclosedDoc:'納品書' }), 12442],
    ['特別提供価格 2000×6=12000　+8%=960', mkOrder({ customerType:'special' }), 12960],
    ['w1指定の行＋定価の行 1800×4=7200(8%576) + 3600×2=7200(8%576)',
      mkOrder({ customerType:'general', lines:[
        {productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:4,boxes:0,boxQty:12,giftType:'w1'},
        {productId:2,sku:'MEM500',productName:'メメジック 500ml',bottles:2,boxes:0,boxQty:12}] }), 15552],
    ['8%と10%が混ざる 2550×3=7650(8%612) + 100×2=200(10%20)',
      mkOrder({ customerType:'general', lines:[
        {productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:3,boxes:0,boxQty:12},
        {productId:9,sku:'BAG001',productName:'紙袋 黒 小',bottles:2,boxes:0,boxQty:50}] }), 8482],
    /* ★端数：2530×3=7590　7590×0.08=607.2 → 四捨五入で607（切り上げなら608）
       ★この行があるおかげで、消費税の端数のまちがいに気づけます。消さないでください */
    ["端数が出る 2530×3=7590　8%は607.2→607",
      mkOrder({ customerType:'general', lines:[
        {productId:3,sku:'ORG100',productName:'オルガニック 100ml',bottles:3,boxes:0,boxQty:24}] }), 8197]
  ];
  tebiki.forEach(function(t){
    eq('③-2 手計算【' + t[0] + '】', nouhinTotal(nouhin(t[1])), t[2]);
    eq('③-2 請求書も同じ【' + t[0] + '】', seikyu(t[1]), t[2]);
  });
}

/* ══ ③-3 品番が分からない行は10%（安全側）══════════════════════
   8%にすると、消費税を少なく請求してしまいます。★8%にしないでください。 */
{
  /* 品番が無い行は単価も出せないので、単価を出せる行と混ぜて、税率だけを見ます。
     RTは「納品書」でも金額を出す決まりなので、RTで確かめます。 */
  const o = mkOrder({ customerType:'rt', enclosedDoc:'納品書',
    lines:[{ productId:1, sku:'ORG250', productName:'オルガニック 250ml', bottles:5, boxes:0, boxQty:12 }] });
  /* 1920×5=9600　+8%=768　→ 10368 */
  eq('③-3 食品は8%（9600の8%は768）', nouhinTotal(nouhin(o)), 10368);
  const o2 = mkOrder({ customerType:'rt', enclosedDoc:'納品書',
    lines:[{ productId:9, sku:'BAG001', productName:'紙袋 黒 小', bottles:10, boxes:0, boxQty:50 }] });
  /* 80×10=800　+10%=80　→ 880（紙袋は10%。8%だと864になってしまいます） */
  eq('③-3 紙袋は10%（800の10%は80）', nouhinTotal(nouhin(o2)), 880);
}

/* ══ ④ 送料・倉庫手数料が入っても一致する ══════════════════ */
{
  /* 売上Ｃの orderAmount は商品だけを数えます（送料は請求書の別行）。
     納品書は送料も1行に入れるので、差は【送料＋手数料の税込】ぶんだけ。
     ★この差が変わっていないか（＝どちらかが勝手に足し引きしていないか）を見ます。 */
  const o = mkOrder({ shippingFee: 880, warehouseFee: 500 });
  const t1 = nouhinTotal(nouhin(o));
  const t2 = seikyu(o);
  const shipNet = Math.round(880 / 1.1);
  const sa = Math.round(shipNet * 1.1) + Math.round(500 * 1.1);
  eq('④送料と手数料のぶんだけ、納品書のほうが多い', t1 - t2, sa);
  inc('④納品書に送料の行が出る',       nouhin(o), '送料', true);
  inc('④納品書に手数料の行が出る',     nouhin(o), '倉庫ピッキング手数料', true);
  inc('④送料が無いときは一言そえる',   nouhin(mkOrder({})), '送料は別途申し受けます', true);
  inc('④送料があるときは その一言を出さない', nouhin(o), '送料は別途申し受けます', false);
}

/* ══ ⑤ 単価が無いときは、作らない ══════════════════════════ */
{
  const o = mkOrder({ lines:[{ productId:99, sku:'NOPE', productName:'知らない商品', bottles:3, boxes:0, boxQty:12 }] });
  const m = missing(o);
  eq('⑤単価が無い商品を見つける', m.length, 1);
  eq('⑤その商品の名前を返す',     m[0], '知らない商品');
  eq('⑤ちゃんと登録されていれば空', missing(mkOrder({})).length, 0);
  inc('⑤受注Ａは単価が無ければPDFを作らない', IDX, 'if(miss.length){', true);
  inc('⑤そのとき理由を出す',                  IDX, '単価が未登録', true);
}

/* ══ ⑥ どの注文に納品書を入れるか ══════════════════════════ */
{
  eq('⑥「なし」なら入れない（バサラ）', needs(mkOrder({ enclosedDoc:'なし' })), false);
  eq('⑥空なら入れる（既定は納品書兼請求書）', needs(mkOrder({ enclosedDoc:'' })), true);
  eq('⑥「納品書」なら入れる',           needs(mkOrder({ enclosedDoc:'納品書' })), true);
  eq('⑥「納品書兼請求書」なら入れる',    needs(mkOrder({ enclosedDoc:'納品書兼請求書' })), true);
  eq('⑥「請求書」だけなら入れない',      needs(mkOrder({ enclosedDoc:'請求書' })), false);
  /* ★2026-09-10（夕方）ひろみさん指示で直しました。
     　「納品書と伝票は、RTは必ずどんな形で入ろうと、RTのボックスに入るように」
     前は【RTなら全部おことわり】だったので、伝票から作っていないRT（手入力）は
     納品書が1枚も作られていませんでした。いまは【伝票から作ったRTだけ】おことわりします。
     ★「RTなら全部おことわり」に戻さないでください。 */
  inc('⑥伝票から作ったRTだけ、こちらでは貼らない', IDX,
      "if(_isRt && /RT伝票取込/.test(String(o.note||''))) return;", true);
  ok('⑥RTを丸ごとおことわりしていない',
     IDX.indexOf("if(o.customerType === 'rt' || o.customerType === 'rtgc') return;   /* RTは伝票と一緒に別で貼ります */") < 0);
  inc('⑥もう貼ってあれば作り直さない',   IDX, 'if(o.nouhinDocUrl) return;', true);
  inc('⑥ふだが無ければ貼らない',         IDX, 'if(!o.yukaKey) return;', true);
}

/* ══ ⑦ 金額を出す・出さないの決めごと ══════════════════════ */
{
  const nashi = nouhin(mkOrder({ customerType:'general', enclosedDoc:'納品書' }));
  inc('⑦「納品書」だけなら金額を出さない',   nashi, 'ご請求金額（税込）', false);
  inc('⑦そのときの文言',                     nashi, 'この度はお買い上げいただき', true);
  const rt = nouhin(mkOrder({ customerType:'rt', enclosedDoc:'納品書' }));
  inc('⑦RTは「納品書」でも金額を出す',        rt, 'ご請求金額（税込）', true);
  const seik = nouhin(mkOrder({ customerType:'general', enclosedDoc:'納品書兼請求書' }));
  inc('⑦請求書を兼ねるときはお振込先を出す',  seik, '三菱UFJ', true);
  inc('⑦納品書だけのときはお振込先を出さない', nashi, '三菱UFJ', false);
  const oroshi = nouhin(mkOrder({ customerType:'wholesale1', enclosedDoc:'納品書兼請求書' }));
  inc('⑦卸のお客様は三井住友（会社あて）',    oroshi, '三井住友', true);
}

/* ══ ⑧ 決めごとが親に残っているか（読むだけ） ══════════════ */
inc('⑧「納品書」で固定しない',           OYA, '「納品書」で固定しないでください', true);
inc('⑧RTは金額を必ず出す',               OYA, 'ギフトでも【金額の入った書類】を必ず入れる', true);
inc('⑧品番が分からない行は10%',          OYA, '8%にしないでください', true);
inc('⑧送料は税込を割り戻す',             OYA, '1.1 で割り戻して税抜にし', true);
inc('⑧isCompanyだけで決めない',          OYA, 'isCompany だけ」で決める形に戻さないでください', true);
inc('⑧卸には社印',                       OYA, '卸のお客様には社印', true);
inc('⑧区分バッジは書類に出さない',        OYA, '社内の言葉がお客様の書類に出てしまいます', true);
inc('⑧単価は親（oos-kakaku）に聞く',      OYA, 'KAK.priceForSku(', true);
inc('⑧消費税は親（oos-zei）に聞く',       OYA, 'ZEI.rateForSku(', true);
ok('⑧親のなかに価格表の写しが無い',       OYA.indexOf("rt:'priceRT'") < 0 && OYA.indexOf('priceGeneral') < 0);

console.log('===== 📄 納品書の親と、請求書との金額一致 =====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(function(f){ console.log('  ' + f); }); }
process.exit(fail ? 1 : 0);
