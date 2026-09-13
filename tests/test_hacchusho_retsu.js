/* ══════════════════════════════════════════════════════════════════════
   🧾 発注書の列と、↩️ アプリに差し戻す（2026-09-13 ひろみさん指示）

   ★決まったこと
     ① B列（2列目）は【賞味期限】をやめて【伝票番号】にする
        （伝票番号は、それまで備考欄に文字で入っていました）
     ② 納品予定日は【お届け日指定（O列）】に入れる（備考欄から外す）
     ③ 商品の欄は【3行】
        　1行目 商品管理番号（品番＋バーコード下4桁　例 ORG500-5354）
        　2行目 商品名
        　3行目 賞味期限 ◯◯（名簿に無ければ、この行は出さない）
     ④ 備考欄に、伝票番号・納品予定日を書き戻さない
     ⑤ A列に3つ目【↩️ アプリに差し戻す（内容を直す）】を足す
        　＝ スプシからアプリへ戻す道。それまで道がありませんでした。

   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const H = require('./harness');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');
const IDX = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/index.html', 'utf8');

const title = '🧾 発注書の列と ↩️ 差し戻し（2026-09-13）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function bodyOf(src, name){
  const m = src.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
  if (!m) return '';
  let i = src.indexOf(m[0]) + m[0].length - 1, d = 0;
  for (; i < src.length; i++){ if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) break; } }
  return src.slice(src.indexOf(m[0]), i + 1);
}

/* ── ① B列＝伝票番号 ───────────────────────────────── */
ok('①列の地図で2列目は slip（伝票番号）', /slip:2/.test(GAS));
ok('①取り込みの1つ目に書くのは伝票番号',
   GAS.indexOf('String(order.slipNo') >= 0,
   '（order.exp だけに戻すと、B列がまた空になります）');
ok('①倉庫オーダー表の見出しも伝票番号',
   GAS.indexOf("'伝票番号','商品①") >= 0 && GAS.indexOf("'賞味期限','商品①") < 0);
ok('①発注書のB1を直す窓口がある（1回だけ）',
   /oosYukaMidashiNaosu\s*\(/.test(GAS));
ok('①受注Ａは伝票番号を送る', IDX.indexOf('slipNo: _slip') >= 0);
ok('①受注Ａは伝票番号を備考から拾う', /_slip\s*=\s*\(_note0\.match\(\/伝票番号/.test(IDX));

/* ── ② 納品予定日はお届け日（O列）へ ───────────────── */
ok('②納品予定日を備考から拾う', /_nouki\s*=\s*\(_note0\.match\(\/納品予定日/.test(IDX));
ok('②お届け日に納品予定日を入れる',
   /_nouki \? hizukeDake\(_nouki\)/.test(IDX),
   '（日付の指定がある注文は、そちらが優先です）');
ok('②スプシを通っても日付が化けないよう hizukeDake を通している',
   /hizukeDake\(_nouki\)/.test(IDX));

/* ── ③ 商品の欄は3行 ─────────────────────────────── */
ok('③商品管理番号（品番＋下4桁）を使っている', /dispCodeOf\(p\)/.test(IDX),
   '（p.sku だけに戻すと、バーコード下4桁が落ちます）');
ok('③3行を組み立てている', IDX.indexOf("return { name: _lines.join('\\n'), qty: qty };") >= 0);
ok('③3行目は「賞味期限 ◯◯」', IDX.indexOf("_lines.push('賞味期限 ' + _exp)") >= 0);
ok('③賞味期限は名簿から（勝手な日付を書かない）', IDX.indexOf('expiryTextForLine(l)') >= 0);
ok('③発注書のセルを折り返しにしている（3行が見えるように）',
   GAS.indexOf("sh.getRange(newRow, 3, 1, 8).setWrap(true)") >= 0);
ok('③取り置き・予約リストの商品コードも下4桁つき',
   (IDX.match(/dispCodeOf\(p\)/g) || []).length >= 2);

/* ── ④ 備考欄から外す ────────────────────────────── */
ok('④備考から伝票番号を外している', /_noteOut[\s\S]{0,400}伝票番号/.test(IDX));
ok('④備考から納品予定日を外している', /_noteOut[\s\S]{0,400}納品予定日/.test(IDX));
ok('④発注書へ送るのは、外したあとの備考', IDX.indexOf('note: _noteOut') >= 0);

/* ── ⑤ ↩️ アプリに差し戻す ───────────────────────── */
ok('⑤A列の3つ目の言葉がある', /var OOS_YUKA_BTN_BACK = /.test(GAS));
ok('⑤差し戻したあとの言葉もある', /var OOS_YUKA_BTN_BACK_DONE = /.test(GAS));
ok('⑤新しい行のプルダウンが3つ',
   GAS.indexOf('requireValueInList([OOS_YUKA_BTN_STOP, OOS_YUKA_BTN_GO, OOS_YUKA_BTN_BACK], true)') >= 0);
ok('⑤A列を見張るところに分岐がある',
   bodyOf(GAS, 'oosYukaOnEdit').indexOf('oosYukaSashimodoshi_(sh, row)') >= 0);
const sm = bodyOf(GAS, 'oosYukaSashimodoshi_');
ok('⑤本体がある', sm.length > 100);
ok('⑤発送済みの行は戻さない（いちばん先に見る）',
   sm.indexOf('OOS_YC.track-1') >= 0 &&
   sm.indexOf('OOS_YC.track-1') < sm.indexOf('oosYukaStockRestoreByKey_'),
   '（あとに置くと、発送した注文の在庫まで戻ります）');
ok('⑤在庫を戻す', sm.indexOf('oosYukaStockRestoreByKey_') >= 0);
ok('⑤受注Ａを直せる状態に戻す', sm.indexOf('oosOrderSashimodoshiByKey_') >= 0);
ok('⑤備考の印を【↩️差戻】に書きかえる（そのままだと新しい行が入らない）',
   sm.indexOf('↩️差戻') >= 0);
ok('⑤行は消さない', sm.indexOf('deleteRow') < 0);
const sk = bodyOf(GAS, 'oosOrderSashimodoshiByKey_');
ok('⑤「発注書へ送った」印を外す', sk.indexOf('delete ex.yukaImport') >= 0,
   '（これが残ると、受注Ａは送信済のままで直せません）');
ok('⑤倉庫へ送った印も外す', sk.indexOf('ex.notified = false') >= 0);
ok('⑤差し戻しの印を残す', sk.indexOf('ex.sashimodoshi') >= 0);
ok('⑤注文そのものは消さない（status を触らない）', sk.indexOf('status') < 0);
ok('⑤いまある行にも足す窓口がある', /oosYukaSashimodoshiSetup\s*\(/.test(GAS));
ok('⑤受注Ａに差し戻しの帯が出る', IDX.indexOf('↩️ 発注書から差し戻されました') >= 0);

/* ── ⑥ 【動かす】本物の差し戻しを動かして確かめる ───────── */
function ugokasu(opts){
  opts = opts || {};
  const shita = { note:'', aValue:'', bg:null, iro:null };
  const rowVals = new Array(40).fill('');
  rowVals[0]  = '発送してください';
  rowVals[20] = 'ふつう ｜ 【RT TK-20260913-1234】';     /* 21列目＝備考 */
  if(opts.track) rowVals[23] = '1234-5678-9012';         /* 24列目＝送り状NO. */
  const sh = {
    getRange(r, c, nr, nc){
      return {
        getDisplayValues(){ return [rowVals.slice(c-1, c-1+(nc||1))]; },
        getDisplayValue(){ return rowVals[c-1]; },
        getValue(){ return (c === 99) ? (opts.key || '') : rowVals[c-1]; },
        setValue(v){ if(c === 1) shita.aValue = String(v); else rowVals[c-1] = String(v); return this; },
        setNote(v){ if(c === 1) shita.note = String(v); return this; },
        setWrap(){ return this; },
        setBackground(v){ shita.bg = v; return this; },
        setFontColor(v){ shita.iro = v; return this; }
      };
    }
  };
  const box = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Boolean,
    Logger: { log(){} },
    Utilities: { formatDate(){ return '9/13 23:00'; } },
    OOS_YUKA_BTN_STOP: 'OOS未チェック 発送しないでください（登録済）',
    OOS_YUKA_BTN_BACK_DONE: '↩️ アプリで直しています',
    oosKeyColByHeader_(){ return 99; },
    oosYukaStockRestoreByKey_(k){ shita.modoshita = k; return { status:'ok', msg:'オルガニック250ml ×2本' }; },
    oosOrderSashimodoshiByKey_(k){ shita.app = k; return true; }
  };
  box.globalThis = box;
  const ctx = vm.createContext(box);
  vm.runInContext(H.cutVar(GAS, 'OOS_YC') + '\n' + H.cut(GAS, 'oosYukaSashimodoshi_') + '\n'
    + 'oosYukaSashimodoshi_(__sh, 5);', Object.assign(ctx, { __sh: sh }));
  return { shita, rowVals };
}

const R1 = ugokasu({ key:'K-1234' });
ok('⑥【動かす】A列が「↩️ アプリで直しています」になる', R1.shita.aValue === '↩️ アプリで直しています');
ok('⑥【動かす】在庫を戻している', R1.shita.modoshita === 'K-1234');
ok('⑥【動かす】受注Ａを直せる状態に戻している', R1.shita.app === 'K-1234');
ok('⑥【動かす】備考の印が【↩️差戻 …】になる',
   R1.rowVals[20].indexOf('【↩️差戻 RT TK-20260913-1234】') >= 0,
   '（' + R1.rowVals[20] + '）');
ok('⑥【動かす】行がグレーになる', !!R1.shita.bg);
ok('⑥【動かす】ふせんに、やったことが残る', R1.shita.note.indexOf('在庫を戻しました') >= 0);

const R2 = ugokasu({ key:'K-1234', track:true });
ok('⑥【動かす】発送済みの行は戻さない（赤にもどす）',
   R2.shita.aValue === 'OOS未チェック 発送しないでください（登録済）' &&
   R2.shita.note.indexOf('もう発送済み') >= 0);
ok('⑥【動かす】発送済みのときは在庫を戻さない', !R2.shita.modoshita,
   '（戻すと在庫が increase してしまいます）');

const R3 = ugokasu({ key:'' });
ok('⑥【動かす】ふだが無い行は、そう書いて残す',
   R3.shita.note.indexOf('ふだ（転記キー）がありません') >= 0);

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
