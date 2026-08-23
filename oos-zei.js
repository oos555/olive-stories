/* ══════════════════════════════════════════════════════════════════════════
   オリーブオイル・ストーリーズ　消費税の決め方【親】　oos-zei.js
   2026-08-24 作成（ひろみさん指示／ゆかさん報告：芦屋ベイコートの紙袋が8%で出ていた）

   ★このファイルが、消費税の税率を決める「唯一の親」です。
   ★受注A・売上C・見積請求書M・倉庫D は、自分では判定せず、ここを見に行きます。
   ★税率のルールを直すときは、このファイルだけを直してください。
     アプリ側のHTMLに同じ判定を書き写してはいけません（＝独自のコピーを持たない）。

   ── ルール（2026-08-24 ひろみさん確定）────────────────────────────────
     8%（軽減税率）＝ 食品だけ。オリーブオイル・カップオイル・ざくろソース など。
     10%（標準税率）＝ それ以外ぜんぶ。
        紙袋・ギフト箱・オーガンジー・空瓶・注ぎ口・本・送料・倉庫手数料 など。
     セット商品は、中身に食品（オイル等）が入っていれば8%、入っていなければ10%。
        （your story／oliveNOVA は中身がオイル＋箱＋紙袋。税抜1万円以下で
          食品の割合が2/3以上なので、一体資産として8%。ひろみさん確定）

   ★★ いちばん大事なところ ★★
     「わからない商品は8%」にしてはいけません。既定は【10%】です。
     以前は「ギフト箱・備品／その他 だけ10%、あとは全部8%」という書き方でした。
     これだと ①新しく足した備品 ②グループを付け忘れた商品 が、
     黙って8%になって請求書に出てしまいます（2026-08-24に実際に見つかった穴）。

   ── 8%にしたい食品を新しく登録するときは ──────────────────────────────
     ・オイル類 … 統合マスタNの名簿で、グループを下の FOOD_GROUPS のどれかにする
     ・オイル以外の食品（ソース等）… 下の FOOD_SKUS に品番を足す
     どちらもしないと 10% で計算されます（安全側に倒しています）。

   ── GASについて（正直な注意）────────────────────────────────────────
     GAS（oosZeiRateForProduct_）だけは、サーバーの中で動くためこのファイルを
     読めません。GASには同じ判定のコピーが1つだけ残ります。
     直したときは必ず tests/test_zeiritsu.js で突き合わせてください。
   ══════════════════════════════════════════════════════════════════════════ */
(function(global){
  'use strict';

  var VERSION = '2026-08-24';

  /* 食品のグループ（統合マスタNの名簿の「グループ」欄と同じ言葉） */
  var FOOD_GROUPS = [
    'オルガニック',
    'メメジック',
    'シェフズブレンド',
    'プリモフルット',
    'ザイトゥーン',
    'アグルミ',
    'その他オイル',
    'カップオイル'
  ];

  /* グループでは food と分からない食品を、品番で名指しする。
     ★ざくろソースはグループが「その他」なので、ここに書かないと10%になります。 */
  var FOOD_SKUS = [
    'ETC-001'   // ざくろソース
  ];

  /* セット商品のグループ名（中身を見て決める） */
  var SET_GROUP = 'セット商品';

  function s(v){ return (v==null) ? '' : String(v).trim(); }

  /* 商品1つが食品かどうか。
     products は「セット商品の中身をたどる」ためだけに使います（無くても動きます）。 */
  function isFood(product, products, _depth){
    if(!product) return false;
    var sku = s(product.sku);
    if(sku && FOOD_SKUS.indexOf(sku) >= 0) return true;

    var group = s(product.group);
    if(FOOD_GROUPS.indexOf(group) >= 0) return true;

    /* セット商品：中身に食品が1つでもあれば食品あつかい（一体資産） */
    var isSet = !!product.isSet || group === SET_GROUP;
    if(isSet && (_depth||0) < 3){
      var comps = product.components || [];
      var list = products || [];
      for(var i=0; i<comps.length; i++){
        var csku = s(comps[i] && comps[i].sku);
        if(!csku) continue;
        if(FOOD_SKUS.indexOf(csku) >= 0) return true;
        for(var j=0; j<list.length; j++){
          if(s(list[j].sku) === csku){
            if(isFood(list[j], products, (_depth||0)+1)) return true;
            break;
          }
        }
      }
      /* 中身が分からないセット（名簿が読めていない等）は、
         セット商品はオイルのセットしか無いので8%のままにする。
         ★10%のセットを作ったときは、ここではなく名簿の中身を直してください。 */
      if(!comps.length) return true;
      return false;
    }
    return false;
  }

  /* 税率（0.08 / 0.10）。請求書M・売上C・倉庫Dはこの形を使います。 */
  function rateForProduct(product, products){
    return isFood(product, products) ? 0.08 : 0.10;
  }

  /* 税率（8 / 10）。受注AのRT納品書はこの形を使います。 */
  function percentForProduct(product, products){
    return isFood(product, products) ? 8 : 10;
  }

  /* 品番から。products＝名簿（PRODUCTS）。
     ★価格マスタの税率欄は【見ません】。理由：
       シートに入っている数字が食品ルールと食い違っていると、
       黙って間違った請求書が出るため。税率の正はこのファイルです。 */
  function rateForSku(sku, products){
    var list = products || [];
    var k = s(sku);
    for(var i=0; i<list.length; i++){
      if(s(list[i].sku) === k) return rateForProduct(list[i], list);
    }
    return 0.10;   // 名簿にない品番は 10%（安全側）
  }
  function percentForSku(sku, products){
    return rateForSku(sku, products) === 0.08 ? 8 : 10;
  }

  /* 送料・倉庫ピッキング手数料・ギフト包装料などは、いつでも10% */
  var RATE_SERVICE = 0.10;
  var PERCENT_SERVICE = 10;

  /* いろいろな書き方（0.08 / 8 / '8' / '8%' / 0.1 / 10 / '10%'）を
     0.08 か 0.10 に揃える。「10」と書いてあるのに8%で計算される事故を防ぐ。 */
  function normalizeRate(v){
    if(v==null || v==='') return null;
    var n = parseFloat(String(v).replace('%',''));
    if(isNaN(n)) return null;
    if(n > 1) n = n / 100;          // 8 → 0.08 ／ 10 → 0.10
    return (Math.abs(n - 0.08) < 0.001) ? 0.08 : 0.10;
  }
  function normalizePercent(v){
    var r = normalizeRate(v);
    return r === 0.08 ? 8 : 10;
  }
  /* 「これは8%か？」を1か所で判定する（=== 0.10 の書き方をやめるため） */
  function isReduced(v){ return normalizeRate(v) === 0.08; }

  /* 価格マスタの税率欄が、食品ルールと食い違っていないかを見る（点検用）。
     食い違いを見つけたら [{sku, 名簿, 価格マスタ}] を返します。 */
  function findMismatches(products, priceMaster){
    var out = [];
    (priceMaster||[]).forEach(function(row){
      if(!row || !row.sku) return;
      var pm = normalizeRate(row.taxRate);
      if(pm == null) return;
      var rule = rateForSku(row.sku, products);
      if(pm !== rule) out.push({ sku: row.sku, rule: rule, priceMaster: pm });
    });
    return out;
  }

  global.OOS_ZEI = {
    VERSION: VERSION,
    FOOD_GROUPS: FOOD_GROUPS,
    FOOD_SKUS: FOOD_SKUS,
    RATE_SERVICE: RATE_SERVICE,
    PERCENT_SERVICE: PERCENT_SERVICE,
    isFood: isFood,
    rateForProduct: rateForProduct,
    percentForProduct: percentForProduct,
    rateForSku: rateForSku,
    percentForSku: percentForSku,
    normalizeRate: normalizeRate,
    normalizePercent: normalizePercent,
    isReduced: isReduced,
    findMismatches: findMismatches
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) { module.exports = (typeof window !== 'undefined' ? window : globalThis).OOS_ZEI; }
