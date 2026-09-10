/* ══════════════════════════════════════════════════════════════════════════
   オリーブオイル・ストーリーズ　単価の決め方【親】　oos-kakaku.js
   2026-09-10 作成（ひろみさん指示：一般・卸の納品書も、倉庫が発注書から開けるように）

   ★このファイルが、1本あたりの単価を決める「唯一の親」です。
   ★受注Ａ（納品書を作る）と 売上Ｃ（請求書を作る）は、自分では判定せず、ここを見ます。
   ★同じ判定をアプリ側のHTMLに書き写してはいけません。
     書き写すと「納品書の金額」と「請求書の金額」が黙ってズレます。
     ─ 倉庫がお客様に渡す紙と、あとから送る請求書が違う ─ という事故になります。
     （消費税で同じ事故を起こしたので、oos-zei.js と同じ形にしてあります）

   ── 決まっていること ────────────────────────────────────────────────
     ① 区分ごとに、見る値が決まっています
          定価         → priceGeneral
          卸①         → priceWholesale1
          卸②         → priceWholesale2
          RT／RTGC     → priceRT
          卸バサラスター → priceBasara
          特別提供価格 → priceSpecial
          不良品用特価 → priceDefect
     ② 卸①のお客様が、同じ商品を1回の注文で【6箱以上】買うと、
        その行だけ自動的に卸②の値段になります。
        （2026年7月・中村様と協議のうえ決定。「頑張って買ってくれた人が得をする」方式。
          4箱案も検討したが、卸①→卸②の値引き幅が20〜25%と大きく、
          条件が易しすぎると判断して6箱に決めた）
        ★この6という数字を、ここ以外に書かないでください。
     ③ 明細に「w1」「w2」の指定があれば、それが最優先です（手で決めた行）。

   ── データはここに持ちません ──────────────────────────────────────────
     価格の表（priceMaster）は、統合マスタＮ（輸入・原価Ｅ）が持っています。
     このファイルは「どう決めるか」だけを持ち、表は呼ぶ側から渡してもらいます。
     こうしておくと、表が増えても・減っても、決め方は1か所のままです。

   ★消さないでください。消すと、受注Ａも売上Ｃも単価を出せなくなります。
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* 卸①→卸② に上がる箱数。★この数字はここだけ */
  var BULK_UPGRADE_BOXES = 6;

  /* 区分 → 価格表のどの列を見るか */
  var PRICE_KEY = {
    general:     'priceGeneral',
    wholesale1:  'priceWholesale1',
    wholesale2:  'priceWholesale2',
    rt:          'priceRT',
    rtgc:        'priceRT',
    basara:      'priceBasara',
    special:     'priceSpecial',
    defectprice: 'priceDefect',
    /* 見積М（mitsumori.html）が使っている呼び方も、ここでまとめて受けます */
    hub:         'priceWholesale2',   /* 旧・貢献ハブ（廃止済み）。昔のお客様を卸②として扱う互換 */
    oldlot:      'priceOldLot',
    defect:      'priceDefect'
  };

  /* 日本語の区分名 → 英語コード（シートには日本語で入っています） */
  var CODE_OF = {
    '定価': 'general', '卸①': 'wholesale1', '卸②': 'wholesale2',
    'RT': 'rt', 'RTGC（ゴルフ）': 'rtgc', 'RTGC': 'rtgc',
    '卸バサラスター': 'basara', '特別提供価格': 'special',
    '不良在庫特価': 'defectprice', '不良品用特価': 'defectprice'
  };
  function normalizeType(v) { return CODE_OF[v] || v || 'general'; }

  /* 卸①が6箱以上なら卸②へ */
  function effectiveCustomerType(customerType, boxes) {
    var t = normalizeType(customerType);
    if (t === 'hub') return 'wholesale2';   /* 旧・貢献ハブ（廃止済み）の互換。箱数に関係なく卸② */
    if (t === 'wholesale1' && (Number(boxes) || 0) >= BULK_UPGRADE_BOXES) return 'wholesale2';
    return t;
  }

  /* この明細1行に使う区分（w1/w2の手指定が最優先） */
  function lineTierType(order, line) {
    if (line && line.giftType === 'w1') return 'wholesale1';
    if (line && line.giftType === 'w2') return 'wholesale2';
    return effectiveCustomerType(order && order.customerType, (line && line.boxes) || 0);
  }

  /* 1本あたりの単価（税抜）。見つからなければ 0 */
  function priceForSku(sku, customerType, priceMaster, defaults) {
    if (!sku) return 0;
    var row = null, i;
    if (priceMaster && priceMaster.length) {
      for (i = 0; i < priceMaster.length; i++) {
        if (priceMaster[i] && priceMaster[i].sku === sku) { row = priceMaster[i]; break; }
      }
    }
    if (!row && defaults) row = defaults[sku];
    if (!row) return 0;
    var key = PRICE_KEY[normalizeType(customerType)] || 'priceGeneral';
    return parseFloat(row[key]) || 0;
  }

  /* 明細1行の単価（区分の判定こみ）。呼ぶ側はこれ1つで足ります */
  function unitPriceForLine(order, line, sku, priceMaster, defaults) {
    return priceForSku(sku, lineTierType(order, line), priceMaster, defaults);
  }

  root.OOS_KAKAKU = {
    BULK_UPGRADE_BOXES: BULK_UPGRADE_BOXES,
    PRICE_KEY: PRICE_KEY,
    normalizeType: normalizeType,
    effectiveCustomerType: effectiveCustomerType,
    lineTierType: lineTierType,
    priceForSku: priceForSku,
    unitPriceForLine: unitPriceForLine
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) { module.exports = (typeof window !== 'undefined' ? window : globalThis).OOS_KAKAKU; }
