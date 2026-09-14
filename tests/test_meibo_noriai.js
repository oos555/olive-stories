/* ══════════════════════════════════════════════════════════════════════
   🚌 商品名簿の相乗り便（3往復 → 2往復）と、旧ファイル④の片づけ
   2026-09-15　ひろみさん指示「②③やって」

   ★なぜ作ったか
     GASは【1回行くだけで2.4〜2.7秒】かかります（2026-09-15 朝いちばんに実測）。
     統合マスタＮも受注Ａも、開くときに商品名簿だけを別の往復で取りに行っていました。
     それをまとめ読みに相乗りさせて、往復を1本へらしました。

   ★この見張りは【本物を動かして答えを見ます】（文字さがしだけにしない）。
     ・GASの oosMeiboNoseru_ をそのまま動かして、名簿が無いとき【null】を返すか
     ・画面の OOS_MEIBO_BIN（相乗り便の受け口）をそのまま動かして、
     　1回しか届かないか・中身が無ければ null が渡るか
     ・GASの oosYukaCancelOrder をそのまま動かして、旧ファイル④を【開かない】か

   ★守っているもの（消さないでください）
     ① 名簿の出どころを親に知らせる仕組み（OOS_MEIBO.shirase）が残っていること
        ── ここを壊すと、2026-09-12の「43件 vs 55件」（黙って古い名簿で動く）が再発します
     ② 相乗り便が来なかったときに、自分で loadProducts を取りに行く道が残っていること
     ③ GASが名簿を返せないときは【null】であること。空の配列にしてはいけません
        ── 空配列だと受け取る側が「来た」と勘違いして、55件の名簿が0件で上書きされます
     ④ 旧ファイル④【（旧・使いません）倉庫⇔OOS 発送＆連絡用】を毎日の運用で開かないこと
     ⑤ 旧ファイル④を見にいく【点検の窓口】は残っていること
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');
const MASTER = fs.readFileSync(path.join(LIVE, 'master.html'), 'utf8');
const INDEX = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '🚌 名簿の相乗り便（3往復→2往復）と旧ファイル④の片づけ（2026-09-15）';
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

/* ══════════════════════════════════════════════════════════════════════
   ① GASの oosMeiboNoseru_ を【そのまま動かす】
   　 ★ここが「無い」と「空っぽ」の分かれ目。空配列を返したら落とします。
   ══════════════════════════════════════════════════════════════════════ */
function noseruDe(kaesu){
  const box = { loadProducts: function(){ return kaesu; }, Array: Array, JSON: JSON };
  const ctx = vm.createContext(box);
  vm.runInContext(H.cut(GAS, 'oosMeiboNoseru_'), ctx);
  return vm.runInContext('oosMeiboNoseru_()', ctx);
}
const meibo55 = [];
for (let i = 0; i < 55; i++) meibo55.push({ sku: 'X' + i, name: '商品' + i });

const m1 = noseruDe({ status: 'ok', products: meibo55, extraFields: ['重さ'] });
eq('①名簿が55件あれば、そのまま55件を載せる', m1 && m1.products.length, 55);
eq('①追加の列（extraFields）も一緒に載せる', m1 && m1.extraFields, ['重さ']);

eq('①名簿が0件なら null（空配列にしない）',
   noseruDe({ status: 'ok', products: [], extraFields: [] }), null);
eq('①GASがエラーを返したら null',
   noseruDe({ status: 'error', message: '商品マスタシートが見つかりません' }), null);
eq('①返事そのものが無ければ null', noseruDe(null), null);
eq('①extraFields が無くても落ちない（空配列にそろえる）',
   noseruDe({ status: 'ok', products: meibo55 }).extraFields, []);

/* ══════════════════════════════════════════════════════════════════════
   ② 画面の OOS_MEIBO_BIN（相乗り便の受け口）を【そのまま動かす】
   ══════════════════════════════════════════════════════════════════════ */
async function binShiraberu(nm, src){
  const ctx = vm.createContext({ Promise: Promise, setTimeout: setTimeout, Array: Array });
  vm.runInContext(H.cutVar(src, 'OOS_MEIBO_BIN'), ctx);
  const bin = ctx.OOS_MEIBO_BIN;

  bin.todoke({ products: meibo55, extraFields: [] });
  bin.todoke({ products: [{ sku: 'あとから来た' }], extraFields: [] });   /* 2回目は無視されるはず */
  const tsuita = await bin.machi;

  eq('②' + nm + '：届いた名簿を受け取れる', tsuita && tsuita.products.length, 55);
  eq('②' + nm + '：2回目の到着は無視する（先に着いた便が正）',
     tsuita && tsuita.products[0].sku, 'X0');

  /* 中身が無い便（＝自分で取りに行く合図）は null になること */
  const ctx2 = vm.createContext({ Promise: Promise, setTimeout: setTimeout, Array: Array });
  vm.runInContext(H.cutVar(src, 'OOS_MEIBO_BIN'), ctx2);
  ctx2.OOS_MEIBO_BIN.todoke(undefined);
  eq('②' + nm + '：中身が無ければ null が渡る（自分で取りに行く合図）',
     await ctx2.OOS_MEIBO_BIN.machi, null);
}

/* ══════════════════════════════════════════════════════════════════════
   ③ GASの oosYukaCancelOrder を【そのまま動かす】
   　 旧ファイル④を開かないこと・運用コピーには今までどおり印が付くこと
   ══════════════════════════════════════════════════════════════════════ */
function cancelUgokasu(){
  const ashiato = { souko: 0, yuka: 0, rule: [] };
  const yukaSheet = { name: '発注書' };
  const box = {
    String: String, Number: Number, JSON: JSON, Array: Array,
    OOS_YUKA_SHEET: '発注書',
    OOS_YC: { honbuMemo: 18 },
    oosYukaFile_: function(){ return { getSheetByName: function(){ return yukaSheet; } }; },
    /* ★旧ファイル④を開こうとしたら、ここで足あとが残ります */
    oosSoukoFile_: function(){
      ashiato.souko++;
      return { getSheetByName: function(){ return { name: 'オーダー表' }; } };
    },
    oosCancelRuleAdd_: function(sh, col){ ashiato.rule.push([sh && sh.name, col]); },
    oosCancelMarkRows_: function(sh){ if (sh === yukaSheet) ashiato.yuka++; return 2; }
  };
  const ctx = vm.createContext(box);
  vm.runInContext(H.cut(GAS, 'oosYukaCancelOrder'), ctx);
  const res = vm.runInContext("oosYukaCancelOrder({num:'TK-1234'})", ctx);
  return { res: res, ashiato: ashiato };
}
const c = cancelUgokasu();
eq('③❌キャンセルは旧ファイル④を1回も開かない', c.ashiato.souko, 0);
eq('③❌キャンセルは運用コピーの発注書に印を付ける', c.ashiato.yuka, 1);
eq('③運用コピーに赤＋取り消し線のきまりを足す', c.ashiato.rule, [['発注書', 18]]);
eq('③返す形は変えていない（souko は 0 のまま）', c.res && c.res.souko, 0);
eq('③印を付けた行数は今までどおり返る', c.res && c.res.yuka, 2);
eq('③注文番号が空なら、何もせずエラーを返す',
   (function(){
     const ctx = vm.createContext({ String: String });
     vm.runInContext(H.cut(GAS, 'oosYukaCancelOrder'), ctx);
     return vm.runInContext("oosYukaCancelOrder({num:'  '}).status", ctx);
   })(), 'error');

/* ══════════════════════════════════════════════════════════════════════
   ④ 先祖返りの見張り（「無いこと」を確かめます）
   ══════════════════════════════════════════════════════════════════════ */
const load1 = H.cut(GAS, 'oosMasterLoad1');
const bundle = H.cut(GAS, 'loadBundleForOrders');
const toc = H.cut(GAS, 'oosYukaTocBuild_');

eq('④統合マスタＮのまとめ読みが、名簿を置いていかない',
   load1.indexOf('oosMeiboNoseru_()') < 0, false);
eq('④受注Ａのまとめ読みが、名簿を置いていかない',
   bundle.indexOf('oosMeiboNoseru_()') < 0, false);
eq('④名簿を載せる関数が2つに増えていない',
   (GAS.match(/function oosMeiboNoseru_/g) || []).length, 1);
eq('④目次の作り直しは旧ファイル④を開かない', /oosSoukoFile_\(\)/.test(toc), false);
eq('④旧ファイル④を呼ぶ場所がふえていない（2026-09-15＝21か所）',
   (GAS.match(/oosSoukoFile_\(\)/g) || []).length <= 21, true);

[['統合マスタＮ', MASTER], ['受注Ａ', INDEX]].forEach(function(pair){
  const nm = pair[0], src = pair[1];
  eq('④' + nm + '：名簿の出どころを親に知らせる仕組みを消していない',
     src.indexOf('OOS_MEIBO.shirase(_meiboDede, PRODUCTS.length, _meiboRiyu)') < 0, false);
  eq('④' + nm + '：相乗り便が来なかったときの後戻りを消していない',
     src.indexOf('action=loadProducts&t=') < 0, false);
  eq('④' + nm + '：受け口が2つに増えていない',
     (src.match(/var OOS_MEIBO_BIN = /g) || []).length, 1);
  eq('④' + nm + '：相乗り便が来ない道でも待ち人を起こす（2か所以上）',
     (src.match(/OOS_MEIBO_BIN\.todoke\(null\)/g) || []).length >= 2, true);
  eq('④' + nm + '：待ちきれないときの時間切れを消していない',
     src.indexOf('machikirenai') < 0, false);
});
/* ★在庫が入っていなくて途中で止まるときも、名簿だけは先に降ろします。
   　（降ろす場所が、止まる場所より【前】にあること） */
eq('④統合マスタＮ：在庫が無くて止まる前に名簿を降ろす（名簿だけは渡す）',
   MASTER.indexOf('OOS_MEIBO_BIN.todoke(k.meibo')
     > MASTER.indexOf('在庫（lots）が入っていませんでした'), false);

/* ⑤ 旧ファイル④を見にいく【点検の窓口】は残す（「旧・使いません」と報告するのが仕事） */
['oosFilesCheck', 'oosSoukoCheck', 'oosHogoIchiran'].forEach(function(fn){
  eq('⑤点検の窓口が残っている：' + fn,
     H.cut(GAS, fn).indexOf('oosSoukoFile_()') < 0, false);
});

/* ══════════════════════════════════════════════════════════════════════
   ⑥ ⑩【連結③】閲覧用をシステムから外した（2026-09-15 ひろみさん「これも外しましょう」）
   　 ・誰とも共有されていないファイル（oosFileIchiran で実測）
   　 ・自動実行にも入っていなかった（oosTriggerIchiran で実測）
   　 ★ファイル本体と関数は残してあります。外したのは【押す道】だけです。
   ══════════════════════════════════════════════════════════════════════ */
/* ★説明書き（コメント）に「戻し方」を書いてあるので、そこは除けてから見ます */
const onOpenSrc = H.cut(GAS, 'onOpen').replace(/\/\*[\s\S]*?\*\//g, '');
eq('⑥スプシのメニューから「閲覧用スプシを更新」のボタンを外した',
   /addItem\([^)]*updateViewCopy/.test(onOpenSrc), false);
eq('⑥戻せるように、関数そのものは消していない',
   (GAS.match(/function updateViewCopy\(/g) || []).length, 1);
eq('⑥スプシ一覧では「旧・使いません」と出す',
   GAS.indexOf('⑩（旧・使いません）見るだけのコピー') < 0, false);
eq('⑥外した理由と戻し方が書いてある',
   GAS.indexOf('外したこと：onOpen のメニューから') < 0, false);

/* ══════════════════════════════════════════════════════════════════════
   おしまい（②は非同期なので、ここで待ってから結果を出します）
   ══════════════════════════════════════════════════════════════════════ */
(async function(){
  await binShiraberu('統合マスタＮ', MASTER);
  await binShiraberu('受注Ａ', INDEX);

  if (fail) {
    console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
    fails.forEach(x => console.log(x));
    process.exitCode = 1;
  } else {
    console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
  }
})();
