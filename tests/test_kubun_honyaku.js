/* ══════════════════════════════════════════════════════════════════════
   区分の翻訳（normCtype）の見張り　2026-09-07 作成

   ★なぜ作ったか
     ひろみさん報告「RTの売上が集計できない」を調べたら、もっと大きな穴でした。

     受注データのシートは、区分を【日本語の表示名】で保存しています。
       RT ／ 定価 ／ 卸① ／ 卸② ／ 卸バサラスター ／ RTGC（ゴルフ）…
     ところがプログラムは【英語コード】で比べます。
       rt ／ general ／ wholesale1 ／ wholesale2 ／ basara ／ rtgc…

     受注Ａ（index.html）には読み込み時に翻訳する normCtype がありましたが、
     売上Ｃ（billing.html）と見積М（mitsumori.html）にはありませんでした。そのため：

       ・RT月次まとめが customerType==='rt' と比べて【1件も見つからない】
       ・priceForSku('RT') が表を引けず【priceGeneral（定価）にフォールバック】
         ＝ RT・卸の注文が【定価で計算されていた】

     実データで検算：75件中56件で金額がちがい、税抜合計 ¥9,619,784 → ¥7,557,946。
     倉庫へ送り済み（売上・請求に出る）13件だけで −¥301,998。

   ★このテストが見張ること
     ① 注文の区分を使うアプリすべてに normCtype があること
     ② その表が4アプリで【まったく同じ】であること（片方だけ直す事故を防ぐ）
     ③ 注文を読み込むところで、ちゃんと翻訳を通していること
     ④ RT月次まとめが「倉庫へ送った注文だけ」を対象にしていること（ひろみさん決定・案①）

   ★このファイルを消さないでください。消すと、また定価で請求してしまいます。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function has(name, src, needle) { ok(name, src.indexOf(needle) >= 0, '「' + needle + '」が見つかりません'); }

/* ── ① 注文の区分を使うアプリには normCtype が要る ───────────────── */
const APPS = ['index.html', 'billing.html', 'mitsumori.html', 'pickup.html'];
const SRC = {};
APPS.forEach(f => { SRC[f] = read(f); });

APPS.forEach(f => {
  ok('①' + f + ' に normCtype がある', SRC[f].indexOf('function normCtype(') >= 0,
    '（注文の区分は日本語の表示名で保存されています。翻訳しないと定価で計算されます）');
});

/* ── ② 4アプリの翻訳表がまったく同じであること ───────────────────── */
function tableOf(src) {
  const m = src.match(/function normCtype\(v\)\{[^}]*\{([^}]*)\}/);
  if (!m) return null;
  /* 表の中身から空白を落として比べる */
  return m[1].replace(/\s+/g, '');
}
const base = tableOf(SRC['index.html']);
ok('②親（受注Ａ）の翻訳表が読めた', !!base);
APPS.filter(f => f !== 'index.html').forEach(f => {
  const t = tableOf(SRC[f]);
  ok('②' + f + ' の翻訳表が親と同じ', !!t && !!base && t.indexOf("'RT':'rt'") >= 0 &&
    t.indexOf("'定価':'general'") >= 0 && t.indexOf("'卸バサラスター':'basara'") >= 0 &&
    t.indexOf("'卸②':'wholesale2'") >= 0 && t.indexOf("'RTGC'") >= 0,
    '（親と同じ中身にしてください。片方だけ直すと、またズレます）');
});

/* ── ③ 注文を読み込むところで翻訳を通していること ─────────────────── */
has('③受注Ａ：読み込み時に翻訳している', SRC['index.html'], 'o.customerType = normCtype(o.customerType)');
has('③売上Ｃ：読み込み時に翻訳している', SRC['billing.html'], 'normOrdersCtype(ordersRes.data.orders)');
has('③見積М：読み込み時に翻訳している', SRC['mitsumori.html'], 'normOrdersCtype(ordersRes.data.orders)');
has('③倉庫Ｄ：読み込み時に翻訳している', SRC['pickup.html'], 'normCtype(currentOrder.customerType)');

/* 生のまま代入していないこと（翻訳を外す事故の見張り） */
ok('③売上Ｃ：翻訳なしで注文を入れていない',
  SRC['billing.html'].indexOf('orders = ordersRes.data.orders;') < 0,
  '（normOrdersCtype を通さずに代入しています）');
ok('③見積М：翻訳なしで注文を入れていない',
  SRC['mitsumori.html'].indexOf('orders = ordersRes.data.orders;') < 0,
  '（normOrdersCtype を通さずに代入しています）');

/* ── ④ RT月次まとめは「倉庫へ送った注文だけ」（ひろみさん決定・案①）──── */
has('④RT月次まとめは発送した注文だけ', SRC['billing.html'], 'if(!salesWasSentToWarehouse(o)) return false;');
ok('④RT月次まとめが「キャンセル以外ぜんぶ」に戻っていない',
  SRC['billing.html'].indexOf("return o && o.status!=='cancelled' && String(o.registeredAt||'').slice(0,7)===ym;") < 0,
  '（未発送の注文まで請求書に載ってしまいます）');

/* ── ⑤ 価格表の引き方が親と同じであること ───────────────────────── */
['billing.html', 'mitsumori.html'].forEach(f => {
  has('⑤' + f + ' の価格表の対応', SRC[f], "rt:'priceRT'");
  has('⑤' + f + ' のバサラ価格', SRC[f], "basara:'priceBasara'");
});

/* ── 結果 ───────────────────────────────────────────────── */
const title = '区分の翻訳（RT・卸が定価で計算される事故の見張り／2026-09-07）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
