/* ══════════════════════════════════════════════════════════════════════
   📄 書類に【必ず載るもの】が、本当に載っているか　2026-09-11

   ★ひろみさんのお叱り（2026-09-11）
     「請求書からまたピックアップ料金と送料が抜けていた。本と箱の単位もない。
     　どうして直しても直しても直しても、こうやって勝手に落とすの？」
     「ルールを決めても、ルールを書いてあるアプリを作っても、それでも間違えて、
     　あなたがどんどん直して私の求めていない方向に書類を変えていく。
     　どうすればそれがなくなるのか、やり方を探してください」

   ★この見張りの考え方（今までと違うところ）
     これまでの見張りは「決めた文言があるか」「写しが残っていないか」を見ていました。
     ＝【Claudeが理解した範囲】しか守れません。理解が間違っていれば見張りも間違う。

     この見張りは、ひろみさんが読んで直せる決めごとのファイル
     　　oos-shorui-kimari.js の KANARAZU（必ず載るもの）
     を【読み込んで】、実際にできた書類と突き合わせます。
     　→ 表に書いたものが書類から消えたら、必ず落ちます。
     　→ Claudeが書類のコードをどう書き換えても、消せません。
     　→ 載せるものを増やしたいときは、ひろみさんが表に1行足すだけです。

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

/* ══ 砂場（本物の親をそのまま動かす） ══════════════════════ */
function mkEl(){ return { style:{}, setAttribute(){}, appendChild(){}, classList:{add(){},remove(){}} }; }
const doc = { getElementById(){ return null; }, createElement(){ return mkEl(); },
  head:{ appendChild(){} }, body:{ appendChild(){}, removeChild(){} } };
const box = { console, Math, Date, JSON, parseInt, parseFloat, isNaN, String, Number,
  Object, Array, Boolean, RegExp, Error, document: doc };
box.window = box; box.globalThis = box;
const ctx = vm.createContext(box);
['oos-zei.js', 'oos-kakaku.js', 'oos-shorui-kimari.js', 'oos-doc.js', 'oos-nouhin.js'].forEach(function(f){
  vm.runInContext(H.read(f), ctx);
});

const PRODUCTS = [
  { id:1, sku:'ORG250', name:'オルガニック 250ml', group:'オルガニック', boxQty:20, extras:{} },
  { id:2, sku:'GFT001', name:'カップオイル3個ギフトセット', group:'ギフト商品', boxQty:10, isSet:true,
    components:[{sku:'ORG250',qty:1}], extras:{ '単位':'個' } }   /* ★単位が「個」の商品 */
];
const PM = [
  { sku:'ORG250', priceGeneral:4750, priceWholesale1:3800, priceWholesale2:2850, priceRT:3800 },
  { sku:'GFT001', priceGeneral:3300, priceWholesale1:2600, priceWholesale2:2400, priceRT:2600 }
];
box.__d = { products: PRODUCTS, priceMaster: PM, defaults: null };
function nouhin(o){ box.__o = o; return vm.runInContext('OOS_NOUHIN.build(__o, __d)', ctx); }
/* ★2026-09-12 承認済みモック（第7版）で、ピックアップ料金と送料は
   【明細の表の外】＝内訳の左の枠に移りました。
   だから明細の行だけでなく、枠の行も一緒に見ます。
   ★明細だけを見る形に戻さないでください（枠にあるのに「抜けた」と出ます）。 */
function gyou(html){
  var s = String(html);
  var meisai = [...s.matchAll(/<tr><td style="text-align:center">\d+<\/td><td>([^<]*)<\/td>/g)].map(function(m){ return m[1]; });
  var waku   = [...s.matchAll(/<tr><td>([^<]*)<\/td><td class="wn">/g)].map(function(m){ return m[1]; });
  return meisai.concat(waku);
}
function goukei(html){
  var m = String(html).match(/ご請求金額（税込）<\/span><span class="amt">([^<]*)</);
  return m ? parseInt(String(m[1]).replace(/[^0-9]/g,''),10) : null;
}
function mkOrder(x){
  return Object.assign({
    num:'TK-20260911-1', client:'山田 花子', recipientName:'山田 花子',
    customerType:'general', enclosedDoc:'納品書兼請求書',
    zip:'150-0002', addr:'東京都渋谷区渋谷1-2-3', tel:'03-1234-5678',
    lines:[{ productId:1, sku:'ORG250', productName:'オルガニック 250ml', bottles:3, boxes:0, boxQty:20 }]
  }, x || {});
}

/* ══ ① 決めごとのファイルがあり、表が読める ══════════════ */
const KIM = vm.runInContext('OOS_SHORUI', ctx);
ok('①決めごとのファイル（oos-shorui-kimari.js）がある', fs.existsSync(path.join(__dirname, '..', 'oos-shorui-kimari.js')));
ok('①「必ず載るもの」の表が読める', KIM && Array.isArray(KIM.KANARAZU) && KIM.KANARAZU.length > 0);
ok('①表には2つ以上ある（ピッキング手数料・送料）', KIM.KANARAZU.length >= 2);

/* ══ ② ★いちばん大事★ 表に書いたものが、書類に必ず載る ══════
   「納品書」と「請求書（領収書）」の両方の言葉が入る書類ぜんぶで試します。
   金額が0でも、金額を持っていない注文でも、行は消えません。 */
{
  /* ★2026-09-11 ひろみさん：「受注出荷Ａで同梱する可能性がある書類が6種類ある。
     　パンフレットと、その他（自分で書く）以外は全部数字が載る」
     受注Ａで選べる6種類を、そのまま並べてあります（index.html の PKG_DOCS と同じ）。
     ★減らさないでください。 */
  const shorui = ['納品書', '請求書', '領収書', '納品書兼請求書', '納品書兼領収書', 'RT発注伝票＋納品書',
                  '請求書兼納品書', '請求書兼領収書', '納品書 ＋ パンフレット', ''];
  const aite = [
    ['一般（ピッキングは無料）', { customerType:'general' }],
    ['卸①（250円）',           { customerType:'wholesale1' }],
    ['卸②（250円）',           { customerType:'wholesale2' }],
    ['RT（700円）',            { customerType:'rt' }],
    ['バサラ',                 { customerType:'basara' }],
    ['金額を持っていない注文',   {}],
    ['送料を持っている注文',     { shippingFee:880, warehouseFee:250 }],
    ['箱だけ（バラなし）',       { lines:[{productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:0,boxes:2,boxQty:20}] }],
    ['北海道あて',             { addr:'北海道札幌市中央区1-1' }],
    ['沖縄あて',               { addr:'沖縄県那覇市1-1' }]
  ];
  let nuketa = [];
  shorui.forEach(function(sh){
    aite.forEach(function(a){
      const o = mkOrder(Object.assign({ enclosedDoc: sh }, a[1]));
      const rows = gyou(nouhin(o));
      KIM.KANARAZU.forEach(function(k){
        const atta = rows.some(function(r){ return r.indexOf(k.name) >= 0; });
        if(!atta) nuketa.push(sh + '／' + a[0] + '／' + k.name);
      });
    });
  });
  eq('②表に書いたものが、書類6種類×相手10通り ぜんぶに載っている', nuketa.length, 0);
  if(nuketa.length) nuketa.slice(0,6).forEach(function(x){ fails.push('　　抜けた：' + x); });
}

/* ══ ③ 金額が0でも、行は消さず「無料」「別途」と書く ══════ */
{
  const h = nouhin(mkOrder({ customerType:'general' }));   /* 一般＝ピッキングは無料 */
  const rows = gyou(h);
  ok('③一般でもピッキングの行は出る', rows.some(function(r){ return r.indexOf('倉庫ピックアップ料金') >= 0; }));
  inc('③0円のところは「無料」と書く', h, '無料', true);
  ok('③送料の行も出る', rows.some(function(r){ return r.indexOf('送料') >= 0; }));
}

/* ══ ④ 金額が、決めごとのとおりに入る ══════════════════════
   ★紙と鉛筆で出した数字です。実装に合わせて書き換えないでください。
     ORG250 定価4750×3本＝14250（8%→1140）
     送料 東京＝880円（税込）→ 税抜800＋税80
     ピッキング 一般＝0／卸①②＝250＋税25／RT＝700＋税70 */
{
  eq('④一般・東京　14250+1140+800+80',            goukei(nouhin(mkOrder({ customerType:'general' }))), 16270);
  eq('④卸①・東京　11400+912+800+80+250+25',       goukei(nouhin(mkOrder({ customerType:'wholesale1' }))), 13467);
  eq('④卸②・東京　8550+684+800+80+250+25',        goukei(nouhin(mkOrder({ customerType:'wholesale2' }))), 10389);
  eq('④RT・東京　11400+912+800+80+700+70',        goukei(nouhin(mkOrder({ customerType:'rt' }))), 13962);
  eq('④一般・北海道　送料1100（税抜1000＋税100）', goukei(nouhin(mkOrder({ addr:'北海道札幌市1-1' }))), 16490);
  eq('④一般・沖縄　送料1100',                     goukei(nouhin(mkOrder({ addr:'沖縄県那覇市1-1' }))), 16490);
  /* 注文が金額を持っているときは、そちらが優先 */
  eq('④注文が持っている送料が優先される（¥1,500税込）',
     goukei(nouhin(mkOrder({ shippingFee:1500 }))), 16270 - 880 + 1500);
}

/* ══ ⑤ 単位（本・個・箱）══════════════════════════════════
   ひろみさん：「本と箱の単位もない」
   単位は商品マスタの「単位」欄から。無ければ「本」。箱は添えて出す。 */
{
  const h1 = nouhin(mkOrder({}));
  inc('⑤オイルは「本」',           h1, '3本', true);
  const h2 = nouhin(mkOrder({ lines:[{productId:1,sku:'ORG250',productName:'オルガニック 250ml',bottles:5,boxes:2,boxQty:20}] }));
  /* ★2026-09-12 承認済みモック（第7版）：数量は二段（バラ／箱／合計本数）になりました。
     「（バラ5本＋2箱）」という1列の書き方はもうありません。
     ★1列に戻さないでください。 */
  inc('⑤見出しが二段になっている（バラ）',   h2, '>バラ<', true);
  inc('⑤見出しが二段になっている（箱）',     h2, '>箱<', true);
  inc('⑤見出しが二段になっている（合計本数）', h2, '>合計本数<', true);
  inc('⑤1列の古い書き方は使わない',          h2, '（バラ5本＋2箱）', false);
  const h3 = nouhin(mkOrder({ lines:[{productId:2,sku:'GFT001',productName:'カップオイル3個ギフトセット',bottles:4,boxes:0,boxQty:10}] }));
  inc('⑤単位が「個」の商品は「個」', h3, '4個', true);
  inc('⑤「個」の商品を「本」と書かない', h3, '4本', false);
}

/* ══ ⑥ パンフレットと「その他」には、数字を載せない ══════════
   ひろみさん：「パンフレットと、その他（自分で書く）以外は全部数字が載る」
   ★2026-09-11に変えました。前は「納品書だけなら金額を出さない」でしたが、
   　ひろみさんの決めごとは【6種類ぜんぶに数字】です。★戻さないでください。 */
{
  const h1 = nouhin(mkOrder({ enclosedDoc:'納品書', customerType:'general' }));
  const r1 = gyou(h1);
  ok('⑥納品書だけでも送料の行は出る',       r1.some(function(r){ return r.indexOf('送料') >= 0; }));
  ok('⑥納品書だけでもピッキングの行は出る', r1.some(function(r){ return r.indexOf('倉庫ピックアップ') >= 0; }));
  inc('⑥納品書だけでも金額は出る', h1, 'ご請求金額（税込）', true);
  ['パンフレット', 'その他', 'なし'].forEach(function(e){
    const h2 = nouhin(mkOrder({ enclosedDoc:e }));
    const r2 = gyou(h2);
    inc('⑥「' + e + '」には金額を出さない', h2, 'ご請求金額（税込）', false);
    ok('⑥「' + e + '」には送料の行も出さない', !r2.some(function(r){ return r.indexOf('送料') >= 0; }));
  });
}

/* ══ ⑦ 決めごとの中身（ひろみさんが決めた数字） ══════════ */
eq('⑦送料 北海道 1100', KIM.SORYO_ZEIKOMI['北海道'], 1100);
eq('⑦送料 沖縄県 1100', KIM.SORYO_ZEIKOMI['沖縄県'], 1100);
eq('⑦送料 その他 880',  KIM.SORYO_ZEIKOMI['その他'], 880);
eq('⑦ピッキング RT 700',    KIM.PICKUP_ZEINUKI.rt, 700);
eq('⑦ピッキング 卸① 250',   KIM.PICKUP_ZEINUKI.wholesale1, 250);
eq('⑦ピッキング 卸② 250',   KIM.PICKUP_ZEINUKI.wholesale2, 250);
eq('⑦ピッキング 一般 0',     KIM.PICKUP_ZEINUKI.general, 0);
eq('⑦バラが無ければ0（卸①でも）', KIM.pickupOf('wholesale1', false), 0);
eq('⑦日本語の区分でも通る（RT）',   KIM.pickupOf('RT', true), 700);

/* ══ ⑧ 親を読んでいるか（アプリ側） ══════════════════════ */
['index.html', 'pickup.html'].forEach(function(f){
  inc('⑧' + f + ' は決めごとを読んでいる', H.read(f), 'oos-shorui-kimari.js?v=', true);
});
inc('⑧納品書の親は決めごとを使っている', H.read('oos-nouhin.js'), 'root.OOS_SHORUI', true);
inc('⑧「金額があれば出す」に戻っていない', H.read('oos-nouhin.js'),
    'if (withAmount && _shipIncl > 0) {', false);

console.log('===== 📄 書類に【必ず載るもの】（2026-09-11）=====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(function(f){ console.log('  ' + f); }); }
process.exit(fail ? 1 : 0);
