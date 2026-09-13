/* ══════════════════════════════════════════════════════════════════════
   🛑 倉庫への自動連絡を止めている（2026-09-13 ひろみさん指示）

   ★倉庫さんからのご連絡
     「スプレッドシートとLINEの内容が違っていて混乱するので、案内の自動連絡を
     　止めてほしい。倉庫に流している自動メールも一旦全部止めて」

   ＝ 倉庫さんが見るのは【倉庫⇔OOS　発送＆連絡用】スプレッドシートだけ。
     倉庫グループへのLINEと、倉庫アドレス宛のメールは1通も出さない。

   ★この見張りは「止め木の作りがあるか」を見ます。true/false の今の値では落ちません。
     （いつ再開しても、この見張りはそのまま使えます）
   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const H = require('./harness');
const GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js', 'utf8');

const title = '🛑 倉庫への自動連絡の止め木（2026-09-13）';
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

/* ── ① 止め木そのもの ───────────────────────────────── */
ok('①止め木の1行がある（OOS_SOUKO_RENRAKU_OFF）',
   /var OOS_SOUKO_RENRAKU_OFF = (true|false);/.test(GAS));
ok('①止め木を決めている場所は1か所だけ',
   (GAS.match(/var OOS_SOUKO_RENRAKU_OFF = /g) || []).length === 1,
   '（2か所に増えると、片方だけ直されて誰も気づけません）');
ok('①止めたことを残す置き場がある（倉庫連絡ストップ記録）',
   GAS.indexOf('function oosSoukoTomeLog_(') >= 0 && GAS.indexOf('倉庫連絡ストップ記録') >= 0);

/* ★コメントに名前が出ているだけでは通しません。「if(…)で本当に分かれている」場所を探します。
   （コメントで通してしまうと、止め木を消しても見張りが気づけません） */
function guardAt(body){
  const m = body.match(/if\s*\(\s*OOS_SOUKO_RENRAKU_OFF\s*\)/);
  return m ? body.indexOf(m[0]) : -1;
}

/* ── ② 倉庫へのLINEは、入口の先頭で止まる ───────────────── */
const wh = bodyOf(GAS, 'oosLineToWarehouse_');
ok('②倉庫LINEの入口に止め木がある（if で本当に分かれている）', guardAt(wh) >= 0);
ok('②止め木は sendLineGroupMessage より【先】にある',
   guardAt(wh) >= 0 && guardAt(wh) < wh.indexOf('sendLineGroupMessage'),
   '（あとに置くと、送ってから止めることになります）');
ok('②止めたときは off の印を返す（呼んだ側が気づける）', wh.indexOf('off:true') >= 0);

/* ── ③ 倉庫アドレス宛のメールを宛先から外す ──────────────── */
const sm = bodyOf(GAS, 'sendShipNotifyMail');
ok('③出荷のお知らせメールに止め木がある（if で本当に分かれている）', guardAt(sm) >= 0);
ok('③止め木は MailApp.sendEmail より【先】にある',
   guardAt(sm) >= 0 && guardAt(sm) < sm.indexOf('MailApp.sendEmail'));
ok('③倉庫のメールアドレスを1か所に書いてある（OOS_SOUKO_MAIL_LIST）',
   (GAS.match(/var OOS_SOUKO_MAIL_LIST = /g) || []).length === 1);
ok('③そこに倉庫（オリオサント様）のアドレスが入っている',
   /OOS_SOUKO_MAIL_LIST = \[[^\]]*reimaria\.oliosanto@gmail\.com/.test(GAS));
ok('③宛先が倉庫だけだったときは、1通も出さない', sm.indexOf('if(!emails.length) return') >= 0);

/* ── ④ 受注Ａから倉庫へ送る窓口も、止まったと正直に返す ───────── */
const sn = bodyOf(GAS, 'shipNotifyWarehouse');
ok('④shipNotifyWarehouse は「止めています」と返す', sn.indexOf('SOUKO_OFF') >= 0);
ok('④「トークンがない」と取り違えない（off の判定が先）',
   sn.indexOf('r.off') >= 0 && sn.indexOf('r.off') < sn.indexOf("r.status === 'skip'"));

/* ── ⑤ 送っていないのに「知らせました」と書かない ───────────── */
const shipGo = bodyOf(GAS, 'oosYukaShipGo_');
ok('⑤🔵のふせんは、止めている間は「知らせました」と書かない',
   /OOS_SOUKO_RENRAKU_OFF\s*\?/.test(shipGo) &&
   shipGo.indexOf('倉庫LINEは止めています') >= 0,
   '（嘘のふせんが残ると、倉庫に届いたと思い込みます）');

/* ── ⑥ 再開できる形が残っていること（消してしまわない） ───────── */
ok('⑥倉庫のLINEグループIDは消していない',
   GAS.indexOf("const LINE_GROUP_ID = 'Cd300fca34e5ec3331888c9066fa9c747';") >= 0);
ok('⑥🔵のときに送る文面は消していない', shipGo.indexOf('📦 新しい出荷依頼です') >= 0);
ok('⑥③のときに送る文面は消していない', GAS.indexOf('📦 出荷のご依頼が1件入りました') >= 0);
ok('⑥戻し方が、そばに書いてある',
   GAS.indexOf('この1行を false にして clasp push') >= 0);

/* ── ⑦ 倉庫さんの仕事の入口（スプレッドシート）は止めていない ──── */
ok('⑦発注書への書き込みは止めていない',
   guardAt(bodyOf(GAS, 'oosYukaImportOrder')) < 0);
ok('⑦在庫の引き落としは止めていない',
   shipGo.indexOf('oosYukaStockDeductByKey_') >= 0);
ok('⑦送り状NO.の書き戻しは止めていない',
   guardAt(bodyOf(GAS, 'oosYukaTrackEdit_')) < 0);

/* ══════════════════════════════════════════════════════════════════════
   ⑧ ここからは【本物の関数を動かして】確かめます（文字さがしだけにしない）
      ・止め木が true のとき … LINEもメールも本当に出ないか
      ・止め木が false のとき … ちゃんと元どおり送れるか（再開できるか）
   ══════════════════════════════════════════════════════════════════════ */
function ugokasuLine(off){
  const okuri = [];      /* LINEを送った記録 */
  const nokoshi = [];    /* 止めた記録 */
  const box = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Boolean,
    Logger: { log(){} },
    LINE_GROUP_ID: 'Cd300fca34e5ec3331888c9066fa9c747',
    sendLineGroupMessage(text, to){ okuri.push([String(text), String(to)]); return { status:'ok', code:200 }; },
    oosSoukoTomeLog_(kind, text){ nokoshi.push([String(kind), String(text)]); }
  };
  box.globalThis = box;
  const ctx = vm.createContext(box);
  vm.runInContext('var OOS_SOUKO_RENRAKU_OFF = ' + (off ? 'true' : 'false') + ';\n'
    + H.cut(GAS, 'oosLineToWarehouse_') + '\n'
    + 'var __kotae = oosLineToWarehouse_("📦 ためしの出荷依頼です");', ctx);
  return { okuri, nokoshi, kotae: box.__kotae };
}

const L1 = ugokasuLine(true);
ok('⑧【動かす】止めているとき、倉庫へのLINEは1通も出ない', L1.okuri.length === 0,
   '（' + L1.okuri.length + '通 出てしまいました）');
ok('⑧【動かす】止めたことは記録に残る', L1.nokoshi.length === 1 && L1.nokoshi[0][0] === '倉庫LINE');
ok('⑧【動かす】止めたときは off の印つきで返る', !!(L1.kotae && L1.kotae.off === true));

const L2 = ugokasuLine(false);
ok('⑧【動かす】再開（false）にすれば、ちゃんと倉庫へ送れる',
   L2.okuri.length === 1 && L2.okuri[0][1] === 'Cd300fca34e5ec3331888c9066fa9c747',
   '（戻せない作りになっていたら、ひろみさんが再開できません）');
ok('⑧【動かす】再開したときは、止めた記録は残らない', L2.nokoshi.length === 0);

function ugokasuMail(off){
  const atesaki = [];
  const box = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Boolean,
    Logger: { log(){} },
    MailApp: { sendEmail(o){ atesaki.push(String(o.to)); } },
    getNotifyEmails_(){ return ['office@oliveoilstories.net', 'reimaria.oliosanto@gmail.com']; },
    oosSoukoTomeLog_(){}
  };
  box.globalThis = box;
  const ctx = vm.createContext(box);
  vm.runInContext('var OOS_SOUKO_RENRAKU_OFF = ' + (off ? 'true' : 'false') + ';\n'
    + H.cutVar(GAS, 'OOS_SOUKO_MAIL_LIST') + '\n'
    + H.cut(GAS, 'sendShipNotifyMail') + '\n'
    + 'var __kotae = sendShipNotifyMail("📦 ためし", "本文");', ctx);
  return { atesaki, kotae: box.__kotae };
}

const M1 = ugokasuMail(true);
ok('⑧【動かす】止めているとき、倉庫のアドレスは宛先に入らない',
   M1.atesaki.join(',').indexOf('reimaria.oliosanto@gmail.com') < 0,
   '（宛先：' + M1.atesaki.join(' / ') + '）');
ok('⑧【動かす】本部（office@）へは今までどおり届く',
   M1.atesaki.length === 1 && M1.atesaki[0].indexOf('office@oliveoilstories.net') >= 0);

const M2 = ugokasuMail(false);
ok('⑧【動かす】再開（false）にすれば、倉庫のアドレスにも戻る',
   M2.atesaki.join(',').indexOf('reimaria.oliosanto@gmail.com') >= 0);

/* ══════════════════════════════════════════════════════════════════════
   ⑨ 画面の文言（2026-09-13 ひろみさん指示「変えてください」）
      止めたのに「倉庫へLINEが飛びます」と書いてあると、本部が誤解します。
   ══════════════════════════════════════════════════════════════════════ */
const IDX = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/index.html', 'utf8');
const BIL = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/billing.html', 'utf8');

ok('⑨受注Ａ：倉庫へのLINE・メールを出さないと書いてある',
   IDX.indexOf('倉庫へのLINE・メールは<strong>どこからも出しません</strong>') >= 0);
ok('⑨受注Ａ：古い「そのときはじめて倉庫へ連絡が行きます」は消えている',
   IDX.indexOf('そのときはじめて倉庫へ連絡</b>が行きます') < 0);
ok('⑨受注Ａ：🔵は【発送してください】の合図だと書いてある',
   IDX.indexOf('倉庫さんへの【発送してください】の合図') >= 0);
ok('⑨受注Ａ：図の札から「倉庫へLINE」が消えている',
   IDX.indexOf('<b>自動で 発注書・🔵・倉庫へLINE</b>') < 0 &&
   IDX.indexOf('<b>自動で 発注書へ ・ 🔵</b>') >= 0);
ok('⑨受注Ａ：📮を押したときの案内も新しい言い方',
   IDX.indexOf('2026-09-13〜 倉庫へのLINE・メールは送っていません。') >= 0);
ok('⑨受注Ａ：書類の下書き確認の案内から「LINEで倉庫へ送る前に」が消えている',
   IDX.indexOf('LINEで倉庫へ送る前に') < 0);
ok('⑨請求М：画面から「（倉庫へLINEが行きます）」が消えている',
   BIL.indexOf('発注書のA列を🔵にしたとき（倉庫へLINEが行きます）') < 0);
ok('⑨請求М：新しい言い方になっている',
   BIL.indexOf('倉庫さんは発注書を見て発送されます') >= 0);

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
