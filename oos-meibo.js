/* ══════════════════════════════════════════════════════════════════════
   📋 商品名簿（PRODUCTS）が、いまどこから来ているかを見張る【親】　2026-09-12

   ★ひろみさんのお叱り（2026-09-12）
     「ほら。また別のがでてきた。loadAllData ほかにもあるんじゃないの？
     　0になったり、抜けてますとか言ってくるやつが。」
     「徹底的に調べて　もういい加減にしてほしい　修正ゲームはやめたい」

   ★徹底的に調べて分かったこと
     商品名簿は GAS の【loadProducts】という窓口から来ます。
     　・loadAll　　　　　　… 注文（orders）だけ
     　・loadAllData　　　　… 在庫・価格・お客様など17種類
     　・loadBundleForOrders … 上の2つをまとめたもの
     　・loadProducts　　　　… ★商品名簿。ここだけが名簿を返します
     　　（2026-09-12 実測：GAS 55件）

     ところが各アプリの中には【古い名簿が焼き付いて】います（受注Ａは43件）。
     GASから読めなかったときは、黙ってその古い名簿で動き続けていました。
     足りない12件（紙袋・オーガンジー・注ぎ口・ギフトボックス2種・
     モンテ物産オイル・ザクロソース・セット4種）は単価が引けず、
     あとから「単価が登録されていない商品があります」と言われます。

     ★いちばんの問題は【黙っていたこと】です。
     　console.warn に書くだけで、画面には何も出していませんでした。
     　だから「なぜ単価が出ないのか」が誰にも分からず、
     　同じ直しを何度も繰り返すことになりました。

   ★このファイルの役目
     名簿がどこから来たかを受け取って、
     　・GASから読めた　　　→ 何も出しません（正常）
     　・キャッシュで動いている → うすい注意を出します
     　・中の古い名簿で動いている → 赤い帯を出します（このまま書類を作らせない）
     ★このファイルを消さないでください。消すと、また黙って古い名簿で動きます。
   ══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var OBI_ID = 'oos-meibo-alarm';

  /* いまの状態。アプリが読めるように残しておきます */
  var ima = { dedokoro: '', kensu: 0, riyuu: '' };

  function keshi() {
    var b = root.document && root.document.getElementById(OBI_ID);
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  /* 帯を出す。色と形は、受注Ａの在庫アラート（oos-zaiko-alarm）に合わせています */
  function obi(iro, honbun, komoji) {
    if (!root.document || !root.document.body) return;
    keshi();
    var b = root.document.createElement('div');
    b.id = OBI_ID;
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99998;background:' + iro + ';color:#fff;'
      + 'padding:13px 18px;font-size:15px;font-weight:800;line-height:1.8;text-align:left';
    b.innerHTML = honbun
      + (komoji ? ('<div style="font-weight:600;font-size:13px;margin-top:6px">' + komoji + '</div>') : '');
    root.document.body.appendChild(b);
    root.document.body.style.paddingTop = '110px';
  }

  /* ══════════════════════════════════════════════════════════════
     アプリはここを呼びます。
     　dedokoro … 'gas'（GASから読めた）／'cache'（前に読んだ控え）／'naka'（中の古い名簿）
     　kensu　　 … いま使っている名簿の件数
     　riyuu　　 … 読めなかったときの理由（あれば）
     ══════════════════════════════════════════════════════════════ */
  function shirase(dedokoro, kensu, riyuu) {
    ima = { dedokoro: String(dedokoro || ''), kensu: Number(kensu) || 0, riyuu: String(riyuu || '') };

    if (ima.dedokoro === 'gas') { keshi(); return ima; }

    if (ima.dedokoro === 'cache') {
      obi('#b45309',
        '⚠ 商品名簿を取りに行けませんでした。<b>前に読んだ控え（' + ima.kensu + '件）で動いています。</b>',
        '新しく足した商品が出てこないことがあります。'
        + '電波の良いところで画面を開き直してください。'
        + (ima.riyuu ? '（' + ima.riyuu + '）' : ''));
      return ima;
    }

    /* 中の古い名簿＝いちばん危ない。書類の単価が引けません */
    obi('#b91c1c',
      '⚠ 商品名簿を読み込めていません。<b>このまま書類を作らないでください。</b>',
      'アプリの中に書いてある古い名簿（' + ima.kensu + '件）で動いています。'
      + '紙袋・ギフトボックス・セット商品などの単価が引けず、金額が「―」になります。'
      + '画面を開き直してください。直らないときは、この画面のまま知らせてください。'
      + (ima.riyuu ? '（' + ima.riyuu + '）' : ''));
    return ima;
  }

  function ima_() { return ima; }

  root.OOS_MEIBO = {
    shirase: shirase,
    ima: ima_,
    OBI_ID: OBI_ID
  };
})(typeof window !== 'undefined' ? window : this);
