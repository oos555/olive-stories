/* ══════════════════════════════════════════════════════════════════════════
   オリーブオイル・ストーリーズ　項目のゆくえ【親】　oos-ikisaki.js
   2026-09-12 作成（ひろみさん指示）

   ★受注Ａに入れた項目が【どこへ行くのか】を、この1枚にだけ書きます。

   ── なぜこれが要るのか ────────────────────────────────────────────────
     行き先は【3つ】あります。
       ① 発注書スプシ（【倉庫＆OOS発送連絡スプシ】の「発注書」タブ・32列）
          　倉庫はこれを見ながら処理します。★倉庫への連絡は、ここだけです。
       ② お客様の書類（納品書・請求書・領収書…）
          　oos-nouhin.js ＋ oos-doc.js ＋ oos-kakaku.js ＋ oos-zei.js が作ります。
       ③ 倉庫Ｄアプリの画面（pickup.html ＝ ピッキングの紙）
          　★これはスプシを読んでいません。受注Ａのデータを直接読んでいます。
          　だから「スプシに無いのに倉庫Ｄには出る」項目があります。

     この3つのつなぎ目が、いままで【4つのファイルに散っていました】。
       ・発注書が何列で何列目が何か   → GAS の OOS_YC
       ・そこへ何を送っているか       → index.html の yukaImportOne
       ・書類が読む項目               → oos-nouhin.js
       ・倉庫Ｄの画面に出るもの       → pickup.html
     互いを指していないので、ズレても何も落ちませんでした。
     実際に次の穴が、気づかれないまま残っていました（2026-09-12に見つけました）。
       ・えらんだ倉庫ピックアップ料金・送料が、どこにも保存されていなかった
       ・時間指定（16列目）が、ずっと空のまま倉庫へ送られていた
       ・商品1行ごとのメモが、どこへも行かないのに倉庫Ｄにだけ出ていた

   ── この表の使い方 ────────────────────────────────────────────────
     見張り tests/test_ikisaki.js が、この表を読んで【実物】と突き合わせます。
       ① 列の名前と数   … tests/data/発注書の見出し_実物.json と照合
       ② ①へ行くもの   … 本物の oosYukaImportOrder を動かして、その列に届くか
       ③ ②へ行くもの   … 本物の OOS_NOUHIN.build() のHTMLに出ているか
       ④ ×と書いたもの … 勝手にどこかへ出ていないか
       ⑤ 封             … この表が書き換わっていないか（tests/data/ゆくえ表の封.json）

   ★この表を直したら、封（tests/data/ゆくえ表の封.json）も一緒に直してください。
   　直さないと見張りが落ちます。それは「表が変わった」ことを必ず見えるようにするためです。

   ★行を消さないでください。「どこにも行かない」ものも、書いておくことに意味があります。
   　書いていないと、次に私（Claude）が推測して、また間違えます。
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════
     Ａ表　発注書スプシの 32列（実物の見出しのとおり・1列も抜かさない）
     ──────────────────────────────────────────────────────────────────────
       retsu    … 列の番号（実物）
       midashi  … 実物の見出し（これが変わったら見張りが落ちます）
       dare     … 誰が書くか
       juchuA   … 受注Ａのどの項目から入るか（''＝受注Ａからは入らない）
       shorui   … お客様の書類のどこに出るか（''＝書類には出ない）
     ══════════════════════════════════════════════════════════════════════ */
  var SOUKO_RETSU = [
    { retsu:1,  midashi:'状態を選択してください',
      dare:'GASが🔴を入れる／本部が🔵に変える', juchuA:'', shorui:'',
      memo:'🔵にしたときだけ倉庫へLINE。在庫もそこで引かれます' },

    { retsu:2,  midashi:'賞味期限',
      dare:'人が手で入れる', juchuA:'', shorui:'',
      memo:'★受注Ａからは空で送っています（わざと。分かるときに手で入れる決まり）' },

    { retsu:3,  midashi:'商品① コード 品名', dare:'受注Ａが自動',
      juchuA:'lines[0] 品番＋商品名', shorui:'明細の「商品」' },
    { retsu:4,  midashi:'商品① 数',          dare:'受注Ａが自動',
      juchuA:'lines[0] 合計本数＋単位＋（◯箱）', shorui:'明細の「バラ」「箱」「合計本数」' },
    { retsu:5,  midashi:'商品② コード 品名', dare:'受注Ａが自動',
      juchuA:'lines[1] 品番＋商品名', shorui:'明細2行目の「商品」' },
    { retsu:6,  midashi:'商品② 数',          dare:'受注Ａが自動',
      juchuA:'lines[1] 合計本数＋単位＋（◯箱）', shorui:'明細2行目の数量' },
    { retsu:7,  midashi:'商品③ コード 品名', dare:'受注Ａが自動',
      juchuA:'lines[2] 品番＋商品名', shorui:'明細3行目の「商品」' },
    { retsu:8,  midashi:'商品③ 数',          dare:'受注Ａが自動',
      juchuA:'lines[2] 合計本数＋単位＋（◯箱）', shorui:'明細3行目の数量' },
    { retsu:9,  midashi:'商品④ コード 品名', dare:'受注Ａが自動',
      juchuA:'lines[3] 品番＋商品名', shorui:'明細4行目の「商品」' },
    { retsu:10, midashi:'商品④ 数',          dare:'受注Ａが自動',
      juchuA:'lines[3] 合計本数＋単位＋（◯箱）', shorui:'明細4行目の数量',
      memo:'★商品の列は4つまで。5つ目以降は21列目の備考欄に文字で入ります（書類は行数の制限なし）' },

    { retsu:11, midashi:'【お届け先】氏名',     dare:'受注Ａ', juchuA:'recipientName', shorui:'宛名' },
    { retsu:12, midashi:'【お届け先】 郵便番号', dare:'受注Ａ', juchuA:'zip',           shorui:'宛名の住所' },
    { retsu:13, midashi:'【お届け先】住所',     dare:'受注Ａ', juchuA:'addr',
      shorui:'宛名の住所 ＋ 送料の判定（沖縄・北海道）' },
    { retsu:14, midashi:'【お届け先】電話',     dare:'受注Ａ', juchuA:'tel',           shorui:'宛名' },

    { retsu:15, midashi:'お届け日指定 (空白は指定なし）', dare:'受注Ａ',
      juchuA:'leadDate（日付を指定したときだけ）', shorui:'' },
    { retsu:16, midashi:'時間指定', dare:'受注Ａ', juchuA:'delivTime', shorui:'',
      memo:'★2026-09-12 ここは長いあいだ空のままでした（time:"" と送っていた）。倉庫は時間指定を知りませんでした' },

    { retsu:17, midashi:'【送り元】 氏名',     dare:'受注Ａ', juchuA:'senderName', shorui:'' },
    { retsu:18, midashi:'【送り元】 郵便番号', dare:'受注Ａ', juchuA:'senderZip',  shorui:'' },
    { retsu:19, midashi:'【送り元】 住所',     dare:'受注Ａ', juchuA:'senderAddr', shorui:'' },
    { retsu:20, midashi:'【送り元】 電話',     dare:'受注Ａ', juchuA:'senderTel',  shorui:'',
      memo:'送り状の「ご依頼主」欄に要ります。納品書には出しません' },

    { retsu:21, midashi:'備考欄', dare:'受注Ａが自動で組み立てる',
      juchuA:'【分類】＋📦梱包＋備考(note)＋5つ目以降の商品＋【出どころ 注文番号】',
      shorui:'備考(note)だけ読みます（「納品予定日 ◯」「伝票番号 ◯」をこの文から抜き出す）' },

    { retsu:22, midashi:'同梱書類 納品書 （作成したら入ります）', dare:'受注Ａ',
      juchuA:'同梱書類のうち「納品書」が付くもの', shorui:'書類の表題（納品書／納品書兼請求書…）' },
    { retsu:23, midashi:'同梱書類 他あれば', dare:'受注Ａ',
      juchuA:'同梱書類のうち納品書以外（パンフレット等）', shorui:'' },

    { retsu:24, midashi:'送り状NO.ご記入お願いします。', dare:'倉庫', juchuA:'', shorui:'',
      memo:'倉庫が書くと受注Ａへ自動で戻ります' },
    { retsu:25, midashi:'発送済ボタン',   dare:'倉庫', juchuA:'', shorui:'' },
    { retsu:26, midashi:'倉庫用メモ',     dare:'倉庫', juchuA:'', shorui:'' },
    { retsu:27, midashi:'発注者 （選択必須）', dare:'GASが自動',
      juchuA:'出どころから バサラ／RT／その他', shorui:'' },
    { retsu:28, midashi:'転記キー（自動・さわらない）', dare:'GASが自動', juchuA:'', shorui:'',
      memo:'ふだ。これが無いと🔵にしても在庫が減りません' },
    { retsu:29, midashi:'梱包チェック（自動・さわらない）', dare:'GASが自動', juchuA:'', shorui:'',
      memo:'倉庫Ｄの「✅梱包終了」の印' },
    { retsu:30, midashi:'❌ このオーダーを キャンセルする （☑を入れると在庫が戻ります）',
      dare:'本部', juchuA:'', shorui:'' },
    { retsu:31, midashi:'本部用メモ （自由に書く）', dare:'本部', juchuA:'', shorui:'' },
    { retsu:32, midashi:'お客様からのメモ （発注時に先方が記入）',
      dare:'バサラ発注シート（先方が記入）', juchuA:'', shorui:'',
      memo:'★受注Ａからは入りません（手で入れる注文には「先方が発注時に書いたメモ」が無いため、入力欄もありません）。'
         + 'バサラの発注シートの備考を GAS が読んで入れます。'
         + '取引先が誰でも必ずこの1列に集める決まり（2026-09-09）。列を動かさないでください' }
  ];

  /* ══════════════════════════════════════════════════════════════════════
     Ｂ表　倉庫（発注書）には行かないが、【お客様の書類には出る】もの
     ──────────────────────────────────────────────────────────────────────
     ★ここがいちばん抜けやすいところです。
     　発注書のどの列にも入らないので、発注書を見ているだけでは気づけません。
       na     … 項目
       juchuA … 受注Ａのどこ（注文に保存される名前）
       shorui … 書類のどこに出るか
       oya    … 決めている親ファイル
       hissu  … true＝書類に【必ず】出る（金額が0でも枠を出す）
     ══════════════════════════════════════════════════════════════════════ */
  var SHORUI_DAKE = [
    { na:'区分（定価・卸①・卸②・RT・バサラ・特別提供・不良特価）', juchuA:'customerType',
      shorui:'出ません。単価を決めるのに使います', oya:'oos-kakaku.js' },
    { na:'単価',       juchuA:'（価格マスタから引く）', shorui:'明細の「単価」',   oya:'oos-kakaku.js' },
    { na:'金額',       juchuA:'（単価×合計本数）',     shorui:'明細の「金額」',   oya:'oos-kakaku.js' },
    { na:'1箱入り数',  juchuA:'lines[].boxQty',        shorui:'明細の「（参考）1箱入り数」', oya:'商品マスタ' },
    { na:'単位（本・缶・個）', juchuA:'（商品から引く）',
      shorui:'「合計本数」に付く（3缶・1個…）', oya:'oos-shorui-kimari.js' },
    { na:'卸①価格／卸②価格（手で指定）', juchuA:'lines[].giftType = w1 / w2',
      shorui:'出ません。その行だけ単価を変えます', oya:'oos-kakaku.js' },
    { na:'無料サンプル／有償サンプル', juchuA:'lines[].giftType = sample_free / sample_paid',
      shorui:'出ません。単価に効きます', oya:'oos-kakaku.js' },
    { na:'倉庫ピックアップ料金', juchuA:'warehouseFee',
      shorui:'枠（必ず・0円なら「無料サービス」）', oya:'oos-shorui-kimari.js', hissu:true },
    { na:'送料', juchuA:'shippingFee',
      shorui:'枠（必ず・0円なら「無料サービス」）', oya:'oos-shorui-kimari.js', hissu:true },
    { na:'消費税（8％／10％）', juchuA:'（商品から引く）',
      shorui:'内訳に8％分・10％分をまとめて', oya:'oos-zei.js' },
    { na:'会社名・部署・役職・ご担当', juchuA:'isCompany / companyName / deptName / positionName / personName',
      shorui:'宛名（◯◯株式会社　△△部　□□様）', oya:'oos-nouhin.js' },
    { na:'注文番号', juchuA:'num', shorui:'書類の番号（暗号は外して出す）', oya:'oos-nouhin.js' },
    { na:'当社の名前・住所・ロゴ・社判', juchuA:'（注文の項目ではありません）',
      shorui:'書類の上と下', oya:'oos-doc.js' }
  ];

  /* ══════════════════════════════════════════════════════════════════════
     Ｃ表　発注書スプシには行かないもの
     ──────────────────────────────────────────────────────────────────────
       souko   … 発注書へ行くか（false＝行かない）
       shorui  … 書類に出るか（false＝出ない）
       soukoD  … 倉庫Ｄアプリの画面に出るか
       hoka    … ほかの行き先
     ★soukoD を true にしたものは、倉庫Ｄに出ていても正しい、という意味です。
     　false のものが倉庫Ｄに出ていたら、見張りが落ちます。
     ══════════════════════════════════════════════════════════════════════ */
  var DOKO_NIMO = [
    { na:'メモ（商品1行ごと）', juchuA:'lines[].memo',
      souko:false, shorui:false, soukoD:false,
      hoka:'どこにも行きません',
      memo:'★2026-09-12 倉庫Ｄのピッキング一覧にだけ1行残っていました（決めごと「倉庫Ｄはシンプルに」に反する残り）' },
    { na:'状態（正規・旧ロット・不良＋程度）', juchuA:'lines[].condition / defectLevel / defectLotKind',
      souko:false, shorui:false, soukoD:true, hoka:'在庫（どのロットから引くか）' },
    { na:'のし（表書き・お名前・社名・役職）', juchuA:'noshi',
      souko:false, shorui:false, soukoD:true, hoka:'倉庫が印刷して貼ります' },
    { na:'支払い（前金・後払い・入金済）', juchuA:'paymentMode / paymentConfirmed',
      souko:false, shorui:false, soukoD:false, hoka:'売上Ｃ（入金チェック）' },
    { na:'取り置き・予約（期限・入荷予定日）', juchuA:'status / holdUntilDate / expectedDate',
      souko:false, shorui:false, soukoD:false, hoka:'🗂 取り置き及び発注前予約リスト' }
  ];

  /* 発注書へ行く（＝Ａ表で juchuA が書かれている）列だけ */
  function soukoIkuRetsu() {
    return SOUKO_RETSU.filter(function (r) { return String(r.juchuA || '').trim() !== ''; });
  }
  /* 書類に出る（＝Ａ表で shorui が書かれている）列だけ */
  function shoruiNiDeruRetsu() {
    return SOUKO_RETSU.filter(function (r) { return String(r.shorui || '').trim() !== ''; });
  }
  /* 書類に必ず枠が出るもの（金額が0でも出す） */
  function kanarazuWaku() {
    return SHORUI_DAKE.filter(function (r) { return r.hissu === true; });
  }

  /* 封（この表の中身から出す数字）。表を1文字でも変えると変わります */
  function fuu() {
    var s = JSON.stringify([SOUKO_RETSU, SHORUI_DAKE, DOKO_NIMO]);
    var h = 0, i;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 2147483647; }
    return { kazu: SOUKO_RETSU.length + SHORUI_DAKE.length + DOKO_NIMO.length,
             moji: s.length, fuu: h };
  }

  root.OOS_IKISAKI = {
    SOUKO_RETSU: SOUKO_RETSU,
    SHORUI_DAKE: SHORUI_DAKE,
    DOKO_NIMO: DOKO_NIMO,
    soukoIkuRetsu: soukoIkuRetsu,
    shoruiNiDeruRetsu: shoruiNiDeruRetsu,
    kanarazuWaku: kanarazuWaku,
    fuu: fuu
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) { module.exports = (typeof window !== 'undefined' ? window : globalThis).OOS_IKISAKI; }
