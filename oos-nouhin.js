/* ══════════════════════════════════════════════════════════════════════════
   オリーブオイル・ストーリーズ　納品書の中身【親】　oos-nouhin.js
   2026-09-10 作成
   （ひろみさん：「一般・卸の納品書が倉庫で開けない。もう倉庫スプシは確定した
     のだから、逆算でそこに合わせていく、が正解だね」
     「ずーっとバグと抜け漏れ変更で修正ゲームになってる。それを無くそうとしてる」）

   ★このファイルが、納品書（納品書兼請求書・領収書ふくむ）の中身を決める「唯一の親」です。
   ★倉庫Ｄ（印刷する）と 受注Ａ（PDFにしてドライブへ入れる）が、ここを呼びます。
   ★同じ組み立てをHTMLに書き写してはいけません。
     写すと、片方だけ直って【倉庫が渡した紙】と【あとから送る請求書】が食い違います。

   ── 中身は、倉庫Ｄ（pickup.html）の buildInvoiceHtml から【そのまま】移しました ──
     ひろみさん・ゆかさんと決めた ★印の決めごとは、1つも変えていません。
     体裁は oos-doc.js（見積・請求書Ｍで決めたもの）、
     単価は oos-kakaku.js、消費税は oos-zei.js が決めます。

   ── 呼び方 ────────────────────────────────────────────────────────────
     OOS_NOUHIN.build(o, {
       products:    PRODUCTS,       // 商品の名簿
       priceMaster: PRICE_MASTER,   // 価格の表（統合マスタＮ）
       defaults:    DEFAULT_PRICES  // 無ければ null
     })
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* 区分のバッジ（★書類には出しません。決めごとの目印として残しています） */
  var CTYPE_BADGE = { wholesale1:'卸', wholesale2:'卸※', rt:'卸●', rtgc:'卸●', basara:'卸◆', special:'特提', defectprice:'特化' };
  var COMPANY_EMAIL   = 'office@oliveoilstories.net';
  var COMPANY_WEBSITE = 'https://oliveoilstories.net/';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* お客様向けの書類名だけを拾う（長い名前から先に見る） */
  function docTitleOf(encDoc) {
    var d = String(encDoc || '');
    /* ★並びは倉庫Ｄ（pickup.html）と同じにしてください。長い名前から先に見ます。
       並びが違うと『納品書 ＋ 請求書』のような指定で、出る表題が変わってしまいます。 */
    var names = (root.OOS_DOC_NAMES || ['納品書兼請求書', '納品書兼領収書', '請求書兼納品書', '請求書兼領収書', '領収書兼納品書', '納品書', '請求書', '領収書']);
    for (var i = 0; i < names.length; i++) { if (d.indexOf(names[i]) >= 0) return names[i]; }
    return '納品書';
  }
  function invoiceNeedsAmount(encDoc) {
    var d = String(encDoc || '');
    return d.indexOf('請求書') >= 0 || d.indexOf('領収書') >= 0;
  }
  function recipientAddressBlock(o) {
    if (o.isCompany) {
      return [o.companyName, o.deptName, [o.positionName, o.personName].filter(Boolean).join(' ')].filter(Boolean).join('<br>');
    }
    return esc(o.recipientName || o.client || '');
  }
  function docSlipNoOf(o) {
    var m = String((o && o.note) || '').match(/伝票番号\s*([0-9A-Za-z\-]+)/);
    return m ? m[1] : '';
  }
  function docDeliveryDateOf(o) {
    var m = String((o && o.note) || '').match(/納品予定日\s*([0-9]{4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2})/);
    return m ? m[1].replace(/-/g, '/') : '';
  }
  function docNumberOf(num) {
    /* 暗号は TK / BA / RT / RTG / OS1 / OS2 / IT / FT など（英字＋数字のこともある） */
    return String(num || '').replace(/^[A-Za-z]+[0-9]*[-－]/, '');
  }
  function lineTotal(l) { return (l.bottles || 0) + (l.boxes || 0) * (l.boxQty || 1); }

  /* ══════════════════════════════════════════════════════════════════════
     納品書のHTMLを組み立てる（倉庫Ｄ buildInvoiceHtml からそのまま）
     ══════════════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════════
     商品の単位（本・缶・個）★2026-09-12 ひろみさん決定
     　100ml・250ml・500ml＝本／750ml・2000ml・5000ml＝缶／3000ml＝個
     　★名簿（商品マスタ）の「単位」欄に書いてあれば、そちらが優先（人が直せます）
     決め方は【親＝oos-shorui-kimari.js】に1つだけ。ここに書き写さないでください。
     ══════════════════════════════════════════════════════════════════ */
  function tani(p) {
    var KIM = root.OOS_SHORUI;
    if (KIM && KIM.taniOf) return KIM.taniOf(p);
    return (p && p.extras && String(p.extras['単位'] || '').trim()) || '本';
  }

  function build(o, deps) {
    /* ★2026-09-10 斜めからの試験で見つけた守りもれ。注文が無いのに呼ばれると落ちていました。
       落ちると、その先の「発注書にリンクを貼る」まで止まります。★この1行を消さないでください */
    if (!o) return '';
    deps = deps || {};
    var PRODUCTS = deps.products || root.PRODUCTS || [];
    var PM = deps.priceMaster || [];
    var DEF = deps.defaults || null;
    var ZEI = root.OOS_ZEI, KAK = root.OOS_KAKAKU, DOC = root.OOS_DOC;
    if (!ZEI || !KAK || !DOC) return '';

    function findProduct(pid) { for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i] && PRODUCTS[i].id == pid) return PRODUCTS[i]; } return null; }

    /* ★2026-08-19 表題は、受注Ａで選んだ同梱書類の名前をそのまま出す
       （納品書／納品書兼請求書／請求書／領収書…）。「納品書」で固定しないでください。 */
    /* ★2026-08-19 表題は【お客様から見た書類の名前】だけ。社内の言葉（RT・卸など）は出さない */
    var docName = docTitleOf(o.enclosedDoc && o.enclosedDoc !== 'なし' ? o.enclosedDoc : '納品書');
    /* ★2026-08-19 RT（ホテル・レストラン）は、ギフトでも【金額の入った書類】を必ず入れる
       お約束なので、書類名に「請求書」が無くても金額を出す。★消さないでください */
    /* ══════════════════════════════════════════════════════════════════
       数字（金額）を載せるか　★2026-09-11 ひろみさん決定でやり方を変えました
       ──────────────────────────────────────────────────────────────────
       ひろみさん：「受注出荷Ａで同梱する可能性がある書類が6種類ある。
       　　　　　　パンフレットと、その他（自分で書く）以外は【全部数字が載る】」
       前は「請求書・領収書のときだけ金額を出す」でした（納品書だけだと出なかった）。
       いまは【決めごと（oos-shorui-kimari.js）の6種類なら載せる】に変えています。
       ★「請求書・領収書のときだけ」に戻さないでください。 */
    var KIM = root.OOS_SHORUI;
    var withAmount = KIM
      /* ★見るのは【ひろみさんが選んだ書類名】だけ。
         表題（docName）も見ると、パンフレットだけのときに既定の「納品書」に化けて
         数字が出てしまいます（2026-09-11に気づきました）。★足さないでください */
      ? KIM.sujiGaNoruKa(o.enclosedDoc)
      : (invoiceNeedsAmount(docName) || o.customerType === 'rt' || o.customerType === 'rtgc');
    /* ★2026-08-19 区分（定価・卸・バサラ等）のバッジは【書類に出さない】と決めました。
       ★この badge を title に足さないでください（社内の言葉がお客様の書類に出てしまいます）。
       ※変数だけ残っているのは、決めごとの目印としてです。 */
    var badge = CTYPE_BADGE[o.customerType] ? '<span class="badge-ctype badge-' + o.customerType + '">' + CTYPE_BADGE[o.customerType] + '</span>' : '';

    var items = [], unknown = false;
    (o.lines || []).forEach(function (l) {
      /* ★2026-09-10 中身が空の明細が混ざっていても落ちないように（斜めからの試験で見つけました） */
      if (!l) return;
      var prod = findProduct(l.productId);
      var sku = prod ? prod.sku : (l.sku || '');
      var qty = lineTotal(l);
      /* ★2026-09-12 単価は【親の1つの窓口】から取ります（unitPriceForLine）。
         無料サンプルの行を0円にする決まりも、その中に入っています。
         ★priceForSku を直に呼ぶ形に戻さないでください。戻すと無料サンプルに
         　通常の単価が載ります（2026-09-12まで、実際にそうなっていました）。 */
      var unit = (withAmount && sku) ? KAK.unitPriceForLine(o, l, sku, PM, DEF) : 0;
      /* 無料サンプルの0円は「単価が登録されていない」ではないので、警告にしません */
      if (withAmount && !unit && !KAK.muryouSampleKa(l)) unknown = true;
      items.push({
        name: l.productName || (prod && prod.name) || '',
        qty: qty,
        /* ★2026-09-11 ひろみさん指摘「本と箱の単位もない」。
           単位は商品マスタの「単位」欄から取ります（本／個／枚…）。
           箱で買われた分は「（バラ○＋○箱）」と添えます。★消さないでください */
        /* ★2026-09-11 承認済みモック：数量は二段（バラ／箱／合計本数）。
           1本なら箱は空欄、1箱ならバラは空欄。合計本数はその箱の本数。
           ★「（バラ5本＋1箱）」という1列の書き方に戻さないでください。 */
        /* ★2026-09-12 ひろみさん：「商品と単価の間に、1箱の数を書く欄を設けて。
           二段で　上の段：（参考）　下の段：1箱入り数」 */
        hakoIri: (Number(l.boxQty) || (prod && Number(prod.boxQty)) || 0),
        bara: (Number(l.bottles) || 0),
        hako: (Number(l.boxes) || 0),
        qtyText: qty + tani(prod),
        unitPrice: unit,
        amount: unit * qty,
        /* ★品番が分からない行は10%（安全側）。8%にしないでください */
        taxRate: sku ? ZEI.rateForSku(sku, PRODUCTS) : ZEI.RATE_SERVICE
      });
    });

    /* ══════════════════════════════════════════════════════════════════
       ★2026-08-24 ひろみさん確定：送料と倉庫ピッキング手数料も書類に出す。
       ・送料は【税込】で持っている → 1.1 で割り戻して税抜にし、税率10%で出す
       ・倉庫ピッキング手数料は【税抜】 → そのまま税率10%で出す
       ・金額を持っていない注文は行を出さず、備考に「送料は別途申し受けます」
       ★この かたまり を消さないでください。
       ══════════════════════════════════════════════════════════════════ */
    /* ══════════════════════════════════════════════════════════════════
       ★2026-09-11 ひろみさんのお叱りで作り直しました。
       　「請求書からまたピックアップ料金と送料が抜けていた。
       　　どうして直しても直しても、こうやって勝手に落とすの？」

       これまでの間違い：【金額が入っていれば行を出す】という作りでした。
       　受注Ａで手入力した注文には金額が入らないので、行ごと消えていました。
       これから：【納品書と請求書（領収書）の両方の言葉が入る書類には、
       　　　　　　金額が0でも必ず2行出す】。0なら「無料」「別途」と書きます。

       金額の出どころ（この順に見ます）
       　① 注文に入っていれば それ（お客様注文ページで計算ずみの分）
       　② 入っていなければ 決めごと（oos-shorui-kimari.js）から計算
       ★行を消す形に戻さないでください。tests/test_shorui_kanarazu.js が落ちます。
       ══════════════════════════════════════════════════════════════════ */
    var kanarazu = KIM ? KIM.kanarazuDasuKa(o.enclosedDoc || docName) : false;
    /* ★2026-09-11 承認済みモック：ピックアップ料金と送料は、明細ではなく
       内訳（右）の左に置く枠に入れます。 */
    var wakuRows = [];   /* 枠に出す行（ピックアップ料金・送料） */
    var zeiOnly  = [];   /* 消費税の計算にだけ使う（表には出しません） */

    /* ══════════════════════════════════════════════════════════════════
       ★2026-09-12 「0円」と「まだ決まっていない」を分けます。
       ──────────────────────────────────────────────────────────────────
       それまでは `parseInt(...) || 0` で読んでいたので、
       人が【無料サービス】をえらんで 0 を入れても「入っていない」と見なされ、
       決めごとの自動計算（卸なら250円）に上書きされていました。
       ひろみさん：「もう全部人間に選ばせて」──えらんだ0は、0のままにします。
       ★`|| 0` に戻さないでください。見張り：tests/test_ikisaki.js の ④
       ══════════════════════════════════════════════════════════════════ */
    function _yen(v) {                                  /* 未設定なら null、入っていれば数 */
      if (v === '' || v === null || v === undefined) return null;
      var n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    }
    var _shipIncl = _yen(o.shippingFee);                // 送料（税込）　null＝まだ決まっていない
    var _whFee    = _yen(o.warehouseFee);               // 倉庫ピッキング手数料（税抜）
    var _shipEranda = (_shipIncl !== null);             /* 人がえらんだか（0を含む） */
    /* まだ決まっていない注文（2026-09-12より前の注文）は、今までどおり決めごとから出す */
    if (_whFee    === null) _whFee    = (KIM ? KIM.pickupOf(o.customerType, KIM.baraAriKa(o)) : 0);
    if (_shipIncl === null) _shipIncl = (KIM ? KIM.soryoOf(String(o.addr || '')).fee : 0);

    if (withAmount) {
      /* ══════════════════════════════════════════════════════════════
         ★2026-09-11 承認済みモック（mock_書類の金額まわり_第6版）のとおり。
         ピックアップ料金と送料は【明細の表に入れず】、
         内訳（右）の左の空きに置く枠へ入れます。
         ひろみさん：「小計からご請求金額が右側にあるから、左側にスペースが
         　　　　　　空いてるから、そこに倉庫ピックアップ料金と送料を乗せて。
         　　　　　　そうするとこれ以上下に触らなくなるから」
         ★items.push に戻さないでください（明細の行が増えて1枚に収まりません）。
         ★消費税は右の内訳（10%対象）にまとめます。枠に税の行を足さないでください。
         ══════════════════════════════════════════════════════════════ */
      var _shipNet = (_shipIncl > 0) ? Math.round(_shipIncl / (1 + ZEI.RATE_SERVICE)) : 0;
      /* ★2026-09-12 ひろみさん：「無料サービスを選択したら、書類の送料にも
         　無料サービスと表示させて」
         ★「―」や空欄にしないでください（入れ忘れに見えます）。 */
      wakuRows.push({ name: '倉庫ピックアップ料金（バラ出荷）', amount: _whFee,   zeroText: '無料サービス' });
      wakuRows.push({ name: '送料',                          amount: _shipNet, zeroText: '無料サービス' });
      /* 消費税の計算には入れる（表には出しません） */
      zeiOnly.push({ amount: _whFee,   taxRate: ZEI.RATE_SERVICE });
      zeiOnly.push({ amount: _shipNet, taxRate: ZEI.RATE_SERVICE });
    }

    /* ★2026-08-19 ひろみさんと決めた文言です。★勝手に書き換えないでください。
       ・「キャンセル・変更について」の段落は入れない
       ・破損のご連絡は【到着後3日以内】
       ・「破損以外のお客様都合による変更は、食品のため承れません」 */
    var notes = [];
    /* ★2026-08-24 送料の金額を持っていない注文は、0円と思われないように一言そえる */
    /* ★2026-09-12 ただし、人が【無料サービス】をえらんだ注文には添えません。
       枠に「無料サービス」と出しているのに「別途申し受けます」と書くと、
       お客様にはどちらが本当か分かりません。★この _shipEranda の条件を外さないでください */
    if (withAmount && _shipIncl <= 0 && !_shipEranda) {
      notes.push('<div style="font-weight:700;margin-bottom:2px">■ 送料について</div>'
        + '上記の金額に送料は含まれておりません。送料は別途申し受けます。');
    }
    notes.push('<div style="font-weight:700;margin-bottom:2px">■ 破損していた場合</div>'
      + 'ご迷惑をおかけし、大変申し訳ございません。到着後3日以内に、破損の状態がわかる写真を複数枚撮影のうえ、弊社または配送会社までご連絡ください。'
      + '到着から1週間以上経過したもの、およびお客様が商品を廃棄された後のご連絡は、状況を確認できないため対応いたしかねる場合がございます。'
      + '破損以外のお客様都合による変更は、食品のため承れません。'
      + '破損による返品の際は、返品先倉庫住所を別途お知らせいたしますので、<strong>弊社宛には返品なさらないようご注意ください</strong>。');
    /* ★2026-09-10 ひろみさん指示：ギフトのご案内の枠は【全部取り除き】ました。
       　「一枚で収まらないのが分かったので、大切な人への贈り物…ここの枠は全部取り除いて。
       　　そうすると一枚で収まるようになるはずです」
       ★倉庫さんが2枚めを刷ると、その分の料金がかかります。1枚に収めるのが決まりです。
       ★この枠を戻さないでください。戻すと2枚になります。
       （お問い合わせ先のメール・サイトも、この枠と一緒に消えています） */

    var html = DOC.buildDoc({
      title: docName + (badge ? '' : ''),
      addressee: recipientAddressBlock(o) + '　様',
      zip: o.zip, addr: o.addr, tel: o.tel,
      /* ★2026-08-19 ゆかさん指摘：伝票から来た注文は【納品日】と【伝票番号】を出す。
         それ以外は 発行日と注文番号（社内の暗号は外す）。★暗号つきの番号に戻さないでください */
      metaRight: (function () {
        var slip = docSlipNoOf(o), deliv = docDeliveryDateOf(o);
        var rows = [];
        rows.push(deliv ? ('納品日：' + esc(deliv)) : ('発行日：' + new Date().toLocaleDateString('ja-JP')));
        rows.push(slip ? ('伝票番号：' + esc(slip)) : ('注文番号：' + esc(docNumberOf(o.num))));
        return rows;
      })(),
      /* ★2026-09-11 ひろみさん：「下記の通りお納めいたします。本書はご請求書を兼ねております。」
         →「いつもお世話になっております。どうぞよろしくお願いいたします。」で【統一】。
         ★書類の種類で書き分けないでください。どれも同じ1文です。 */
      lead: 'いつもお世話になっております。どうぞよろしくお願いいたします。',
      items: items,
      /* ★2026-09-11 承認済みモック：内訳（右）の左に置く枠（ピックアップ料金・送料） */
      wakuRows: wakuRows,
      /* ★消費税の計算にだけ入れる（表には出しません） */
      zeiOnly: zeiOnly,
      /* ★2026-08-19 お振込先：個人のお客様は三菱UFJ（ナカムラヒロミ）、
         会社あて（卸・RT・バサラ・特別提供など、一般以外）は三井住友（カ）オリーブオイルストーリーズ）。
         ★「isCompany だけ」で決める形に戻さないでください（RTがUFJになっていました） */
      bankIndex: (((o.customerType && o.customerType !== 'general') || o.isCompany) ? 0 : 1),
      /* ★2026-08-19 ひろみさん指示：【卸のお客様には社印（社判）が必須】。
         一般（定価）のお客様には押さない。★この判定を消さないでください */
      seal: (o.customerType && o.customerType !== 'general'),
      /* ★2026-08-19 ゆかさん報告：納品書にお振込先を出さない（RTは月末まとめ請求）。
         お振込先は【請求書・領収書を兼ねるとき】だけ出す。★戻さないでください */
      showBank: invoiceNeedsAmount(docName),
      showAmount: withAmount,
      notes: notes
    });
    if (unknown) {
      html += '<div class="no-print" style="color:#b91c1c;font-size:12px;font-weight:700;margin-top:6px">⚠ 単価が登録されていない商品があります（統合マスタＮの価格マスタをご確認ください）。金額は「―」で出しています。</div>';
    }
    /* ★2026-08-19 区分バッジ（卸●など）は【社内の印】なので、書類には出しません。
       no-print にしていてもPDFには写ってしまうため、そもそも入れません。★戻さないでください */
    return html;
  }

  /* 単価がそろっているか（PDFにする前に確かめる用）。
     0円の納品書を倉庫が刷ってしまうと、お客様に0円の紙が届きます。★必ず見てください */
  function missingPrices(o, deps) {
    /* ★2026-09-10 build と同じ守り。注文が無いのに呼ばれても落ちないように。★消さないでください */
    if (!o) return [];
    deps = deps || {};
    var PRODUCTS = deps.products || root.PRODUCTS || [];
    var PM = deps.priceMaster || [];
    var DEF = deps.defaults || null;
    var KAK = root.OOS_KAKAKU;
    var out = [];
    if (!KAK) return out;
    var docName = docTitleOf(o.enclosedDoc && o.enclosedDoc !== 'なし' ? o.enclosedDoc : '納品書');
    /* ══════════════════════════════════════════════════════════════════
       数字（金額）を載せるか　★2026-09-11 ひろみさん決定でやり方を変えました
       ──────────────────────────────────────────────────────────────────
       ひろみさん：「受注出荷Ａで同梱する可能性がある書類が6種類ある。
       　　　　　　パンフレットと、その他（自分で書く）以外は【全部数字が載る】」
       前は「請求書・領収書のときだけ金額を出す」でした（納品書だけだと出なかった）。
       いまは【決めごと（oos-shorui-kimari.js）の6種類なら載せる】に変えています。
       ★「請求書・領収書のときだけ」に戻さないでください。 */
    var KIM = root.OOS_SHORUI;
    var withAmount = KIM
      /* ★見るのは【ひろみさんが選んだ書類名】だけ。
         表題（docName）も見ると、パンフレットだけのときに既定の「納品書」に化けて
         数字が出てしまいます（2026-09-11に気づきました）。★足さないでください */
      ? KIM.sujiGaNoruKa(o.enclosedDoc)
      : (invoiceNeedsAmount(docName) || o.customerType === 'rt' || o.customerType === 'rtgc');
    if (!withAmount) return out;
    (o.lines || []).forEach(function (l) {
      if (!l) return;   /* ★空の明細はとばす */
      var prod = null;
      for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i] && PRODUCTS[i].id == l.productId) { prod = PRODUCTS[i]; break; } }
      var sku = prod ? prod.sku : (l.sku || '');
      /* ★2026-09-12 無料サンプルの行は0円が正しいので、「単価が未登録」には数えません。
         数えると、無料サンプルが1行あるだけで納品書が作れなくなります。 */
      if (KAK.muryouSampleKa && KAK.muryouSampleKa(l)) return;
      if (!sku) { out.push(l.productName || '（品番なし）'); return; }
      if (!KAK.priceForSku(sku, KAK.lineTierType(o, l), PM, DEF)) out.push((l.productName || prod && prod.name || sku));
    });
    return out;
  }

  /* この注文は納品書を同梱するか（同梱書類に「納品書」が入っているか） */
  /* ══════════════════════════════════════════════════════════════════════
     この注文は【PDFの書類を作るか】　★2026-09-12 直しました
     ──────────────────────────────────────────────────────────────────────
     ひろみさん：「同梱書類のところのPDFが添付されないんだけど」
     　（同梱書類に「請求書」をえらんだ注文で、PDFが1枚も作られていなかった）

     それまでは【「納品書」という字が入っているか】だけで決めていました。
     そのため
     　・納品書兼請求書 → 作る
     　・請求書        → ★作らない（字が入っていないため）
     　・領収書        → ★作らない
     となっていました。

     いまは【決めごとの親（oos-shorui-kimari.js）の「数字が載る6種類」】に聞きます。
     　納品書兼請求書／納品書兼領収書／RT発注伝票＋納品書／納品書／請求書／領収書
     ＝ 金額が載る書類は、ぜんぶPDFを作ります。
     ★「納品書という字が入っているか」に戻さないでください。
     見張り：tests/test_ikisaki.js の ⑰
     ══════════════════════════════════════════════════════════════════════ */
  function needsNouhin(o) {
    if (!o) return false;
    var enc = String(o.enclosedDoc || '');
    if (enc === 'なし') return false;
    if (!enc) return true;              /* 空の既定は「納品書兼請求書」（受注Ａ・倉庫Ｄと同じ） */
    var KIM = root.OOS_SHORUI;
    if (KIM && KIM.sujiGaNoruKa) return KIM.sujiGaNoruKa(enc);
    return enc.indexOf('納品書') >= 0;  /* 決めごとが読めないときだけ、昔の見かた */
  }

  root.OOS_NOUHIN = {
    CTYPE_BADGE: CTYPE_BADGE,
    COMPANY_EMAIL: COMPANY_EMAIL,
    COMPANY_WEBSITE: COMPANY_WEBSITE,
    docTitleOf: docTitleOf,
    invoiceNeedsAmount: invoiceNeedsAmount,
    recipientAddressBlock: recipientAddressBlock,
    docSlipNoOf: docSlipNoOf,
    docDeliveryDateOf: docDeliveryDateOf,
    docNumberOf: docNumberOf,
    lineTotal: lineTotal,
    build: build,
    missingPrices: missingPrices,
    needsNouhin: needsNouhin
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) { module.exports = (typeof window !== 'undefined' ? window : globalThis).OOS_NOUHIN; }
