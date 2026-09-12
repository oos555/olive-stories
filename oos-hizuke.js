/* ══════════════════════════════════════════════════════════════════════
   📅 日付の形をそろえる【親】　2026-09-12

   ★ひろみさん報告（2026-09-12）
     受注一覧のカードが「NaN月NaN日までに出荷」になっていた。

   ★原因
     日付はスプシを通ると【時刻つき】に化けます。
     　入れたとき … "2026-09-14"
     　読み戻すと … "2026-09-13T15:00:00.000Z"（日本時間の9月14日 0時）
     アプリの中には「日付だけの形」と思って
     　new Date(値 + 'T00:00:00')
     と書いているところが5か所あり、時刻つきが来ると
     "…000ZT00:00:00" という壊れた日付になって NaN になっていました。

   ★いちばん大事な注意
     先頭10文字を切るのは【まちがい】です。
     "2026-09-13T15:00:00.000Z" の先頭は9月13日ですが、日本時間では9月14日。
     1日ずれると、倉庫への出荷指示が1日早まります。
     かならず Date にしてから、日本時間の年月日を取り出してください。

   ★使い方
     　OOS_HIZUKE.dake(値)     … "2026-09-14" の形にそろえる（読めなければ空）
     　OOS_HIZUKE.asa(値)      … その日の0時の Date（読めなければ null）
     　OOS_HIZUKE.jp(値)       … "9月14日"（読めなければ空）

   ★このファイルを消さないでください。消すと、また NaN と1日ずれが出ます。
   　見張り：tests/test_haribote.js の ⑥ と tests/test_apps.js の ⑤
   ══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* 「2026-09-14」の形にそろえる。読めなければ空を返します */
  function dake(v) {
    if (v === null || v === undefined || v === '') return '';
    /* すでに Date のときもあります（スプシから来るとそうなります） */
    if (Object.prototype.toString.call(v) === '[object Date]') {
      if (isNaN(v.getTime())) return '';
      return toIso(v);
    }
    var s = String(v).trim();
    if (!s) return '';
    /* すでに「2026-09-14」の形なら、そのまま使います（余計なことをしない） */
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return toIso(d);
  }

  function toIso(d) {
    return d.getFullYear() + '-'
      + ('0' + (d.getMonth() + 1)).slice(-2) + '-'
      + ('0' + d.getDate()).slice(-2);
  }

  /* その日の0時（日本時間）の Date。読めなければ null */
  function asa(v) {
    var s = dake(v);
    if (!s) return null;
    var d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  /* 「9月14日」。読めなければ空 */
  function jp(v) {
    var d = asa(v);
    if (!d) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  root.OOS_HIZUKE = { dake: dake, asa: asa, jp: jp };
})(typeof window !== 'undefined' ? window : globalThis);
