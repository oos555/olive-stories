/* ══════════════════════════════════════════════════════════════════════
   🛑 倉庫への自動連絡を止めている（2026-09-13 ひろみさん指示）

   ★倉庫さんからのご連絡
     「スプレッドシートとLINEの内容が違っていて混乱するので、案内の自動連絡を
     　止めてほしい。倉庫に流している自動メールも一旦全部止めて」

   ＝ 倉庫さんが見るのは【倉庫⇔OOS　発送＆連絡用】スプレッドシートだけ。
     倉庫グループへのLINEと、倉庫アドレス宛のメールは1通も出さない。

   ★あわせて（同じ日・ひろみさん指示）
     「受注Ａで操作した時に本部のラインに飛ばすのも、とめて」
     ＝ 受注Ａのボタンから【本部グループ】へのLINEも出さない。

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
   ⑪ 🔵のあと、倉庫へ【一文だけ】まとめて知らせる（2026-09-24 ひろみさん）
   ──────────────────────────────────────────────────────────────────────
   「A列を発送してくださいにしたとたんに、倉庫に『スプレッドシートに発送依頼を送りました。
   　よろしくお願いします』っていう簡単な一文を送る」／3分まとめ／送ったら「発送してください（LINE通知済）」
   ・止め木（OOS_SOUKO_RENRAKU_OFF）はそのまま。通すのはこの一文だけ。
   ・本物の関数を、身代わりの発注書とタイマーで動かします。
   ══════════════════════════════════════════════════════════════════════ */
ok('⑪スイッチの1行がある（OOS_SOUKO_MATOME_ON）', /var OOS_SOUKO_MATOME_ON = (true|false);/.test(GAS));
ok('⑪まとめる分は3分（ひろみさん「3分、いいね」）', /var OOS_YUKA_MATOME_MIN = 3;/.test(GAS));
ok('⑪通知済みの文言はひろみさん指定のまま', GAS.indexOf("var OOS_YUKA_BTN_GO_TSUCHI = '発送してください（LINE通知済）';") >= 0);
{
  /* 倉庫のLINEグループへ【直接】送っている場所は、止め木の入口と、この一文の係の2か所だけ */
  const direct = (GAS.match(/sendLineGroupMessage\([^)]*LINE_GROUP_ID\)/g) || []).length;
  /* 3か所＝止め木の入口（oosLineToWarehouse_）・一文のまとめ送り・送り先の確認テスト（2026-08-17・人が実行したときだけ） */
  ok('⑪倉庫のLINEへ直接送る場所は3か所だけ（止め木の入口・一文のまとめ送り・送り先の確認テスト）', direct === 3, '（いま ' + direct + ' か所）');
  const ms = bodyOf(GAS, 'oosSoukoMatomeSend');
  /* ★2026-09-24 ひろみさん「件数はいらない」 */
  ok('⑪まとめ送りの文面は一文だけ（件数も商品も書かない）',
     GAS.indexOf("var OOS_SOUKO_MATOME_TEXT = '📦 スプレッドシートに発送依頼を送りました。よろしくお願いします。';") >= 0 && /var text = OOS_SOUKO_MATOME_TEXT;/.test(ms) && ms.indexOf('disp[') < 0);
}
function ugokasuMatome(){
  const okuri = [], tr = [];
  const props = {};
  const rows = [   /* A列, 転記キー, AG列（LINEお知らせ） */
    { a:'発送してください', key:'K1', note:'', ag:'⏳ まだ知らせていません' },
    { a:'発送してください', key:'K2', note:'', ag:'⏳ まだ知らせていません' },
    { a:'OOS未チェック 発送しないでください（登録済）', key:'K3', note:'', ag:'⏳ まだ知らせていません' } ];
  const cell = (r) => ({ getValue(){ return rows[r-2].a; }, setValue(v){ rows[r-2].a = v; return this; },
    getNote(){ return rows[r-2].note; }, setNote(n){ rows[r-2].note = n; }, setDataValidation(){} });
  const agCell = (r) => ({ getValue(){ return rows[r-2].ag; }, setValue(v){ rows[r-2].ag = v; return this; }, setFontColor(){ return this; }, setFontWeight(){ return this; } });
  const sh = { getRange(r, c){ return c === 33 ? agCell(r) : cell(r); }, getConditionalFormatRules(){ return []; }, setConditionalFormatRules(){}, getMaxRows(){ return 10; } };
  const box = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Boolean,
    Logger: { log(){} },
    LINE_GROUP_ID: 'Cd300fca34e5ec3331888c9066fa9c747',
    OOS_LINE_WAREHOUSE_NAME: 'OOS出荷依頼グループ（倉庫）',
    sendLineGroupMessage(text, to){ okuri.push([String(text), String(to)]); return { status:'ok', code:200 }; },
    LockService: { getScriptLock(){ return { waitLock(){}, releaseLock(){} }; } },
    PropertiesService: { getScriptProperties(){ return { getProperty(k){ return props[k] || null; }, setProperty(k, v){ props[k] = v; }, deleteProperty(k){ delete props[k]; } }; } },
    ScriptApp: { getProjectTriggers(){ return tr.map(h => ({ getHandlerFunction(){ return h; } })); }, deleteTrigger(t){ tr.splice(tr.indexOf(t.getHandlerFunction()), 1); },
      newTrigger(h){ return { timeBased(){ return { after(){ return { create(){ tr.push(h); } }; } }; } }; } },
    Utilities: { formatDate(){ return '9/24 15:02'; } },
    SpreadsheetApp: { newDataValidation(){ const o = { requireValueInList(){ return o; }, setAllowInvalid(){ return o; }, build(){ return {}; } }; return o; },
      newConditionalFormatRule(){ const o = { whenTextEqualTo(){ return o; }, setBackground(){ return o; }, setFontColor(){ return o; }, setBold(){ return o; }, setRanges(){ return o; }, build(){ return {}; } }; return o; } },
    oosYukaFile_(){ return { getSheetByName(){ return sh; } }; },
    oosKeyColByHeader_(){ return 29; },
    oosFindRowByKey_(s, c, k){ const i = rows.findIndex(x => x.key === k); return i < 0 ? 0 : i + 2; }
  };
  box.globalThis = box;
  const ctx = vm.createContext(box);
  vm.runInContext(H.cutVar(GAS, 'OOS_YUKA_MATOME_MIN') + '\n' + H.cutVar(GAS, 'OOS_YUKA_BTN_STOP') + '\n' + H.cutVar(GAS, 'OOS_YUKA_BTN_GO') + '\n'
    + H.cutVar(GAS, 'OOS_YUKA_BTN_GO_TSUCHI') + '\n' + H.cutVar(GAS, 'OOS_YUKA_BTN_BACK') + '\n' + H.cutVar(GAS, 'OOS_MATOME_PROP') + '\n'
    + H.cutVar(GAS, 'OOS_SOUKO_MATOME_TEXT') + '\n' + H.cutVar(GAS, 'OOS_YUKA_LINE_COL') + '\n' + H.cutVar(GAS, 'OOS_YUKA_LINE_MADA') + '\n'
    + 'var OOS_YUKA_SHEET = "発注書";\n'
    + H.cut(GAS, 'oosSoukoMatomeYoyaku_') + '\n' + H.cut(GAS, 'oosSoukoMatomeSend') + '\n' + H.cut(GAS, 'oosYukaTsuchiMitame_'), ctx);
  return { box, okuri, tr, rows };
}
{
  const M = ugokasuMatome();
  M.box.oosSoukoMatomeYoyaku_('K1', 2);
  M.box.oosSoukoMatomeYoyaku_('K2', 3);
  M.box.oosSoukoMatomeYoyaku_('K3', 4);   /* 🔵にしたあと、3分以内に赤へ戻した行 */
  ok('⑪【動かす】🔵のときは、すぐには1通も出ない', M.okuri.length === 0);
  ok('⑪【動かす】タイマーは1つだけ（続けて押してもかけ直すだけ）', M.tr.length === 1 && M.tr[0] === 'oosSoukoMatomeSend');
  M.box.oosSoukoMatomeSend();
  ok('⑪【動かす】3分後に倉庫へ1通だけ', M.okuri.length === 1 && M.okuri[0][1] === 'Cd300fca34e5ec3331888c9066fa9c747');
  ok('⑪【動かす】文面は一文だけ（件数なし）',
     M.okuri[0] && M.okuri[0][0] === '📦 スプレッドシートに発送依頼を送りました。よろしくお願いします。', '（文面：' + (M.okuri[0] && M.okuri[0][0]) + '）');
  ok('⑪【動かす】知らせた行のAG列は「📨 知らせました（時刻）」', /^📨 知らせました /.test(M.rows[0].ag) && /^📨 知らせました /.test(M.rows[1].ag));
  ok('⑪【動かす】赤に戻した行のAG列の⏳は消える', M.rows[2].ag === '');
  ok('⑪【動かす】知らせた行のA列は「発送してください（LINE通知済）」', M.rows[0].a === '発送してください（LINE通知済）' && M.rows[1].a === '発送してください（LINE通知済）');
  ok('⑪【動かす】赤に戻した行はそのまま', M.rows[2].a === 'OOS未チェック 発送しないでください（登録済）');
  ok('⑪【動かす】ふせんに「📨 倉庫にLINEで知らせました」', M.rows[0].note.indexOf('📨 倉庫にLINEで知らせました') >= 0);
  M.box.oosSoukoMatomeSend();
  ok('⑪【動かす】もう一度動いても二重には送らない', M.okuri.length === 1);
  ok('⑪【動かす】タイマーは残らない', M.tr.length === 0);
}

/* ══════════════════════════════════════════════════════════════════════
   ⑩ 本部グループへのLINEを止める（2026-09-13 ひろみさん）
      「受注Ａで操作した時に本部のラインに飛ばすのも、とめて」
      → そのあと1つずつ決めていただきました。
        とめる：バサラから発注／在庫がありません／入荷のお知らせ／臨時入庫／発注書キャンセル
        のこす：🧾 バサラの請求書ができました（★これだけ止め木を通さない）
   ══════════════════════════════════════════════════════════════════════ */
ok('⑩本部への止め木の1行がある（OOS_HONBU_LINE_OFF）',
   /var OOS_HONBU_LINE_OFF = (true|false);/.test(GAS));
ok('⑩止め木を決めている場所は1か所だけ',
   (GAS.match(/var OOS_HONBU_LINE_OFF = /g) || []).length === 1);

const hb = bodyOf(GAS, 'oosLineToHonbu_');
ok('⑩本部LINEの入口に止め木がある（if で本当に分かれている）',
   /if\s*\(\s*OOS_HONBU_LINE_OFF\s*\)/.test(hb));
ok('⑩止め木は sendLineGroupMessage より【先】にある',
   hb.search(/if\s*\(\s*OOS_HONBU_LINE_OFF\s*\)/) < hb.indexOf('sendLineGroupMessage'));

/* のこす1本＝バサラの請求書。抜け道は1本だけ・使う場所も1か所だけ */
ok('⑩のこす道がある（oosLineToHonbuAlways_）',
   GAS.indexOf('function oosLineToHonbuAlways_(') >= 0);
ok('⑩のこす道を使っているのは1か所だけ',
   (GAS.match(/oosLineToHonbuAlways_\(/g) || []).length - 1 === 1,
   '（増えていたら、止めたはずのお知らせが抜けています）');
ok('⑩のこす道を使っているのは【バサラの請求書】',
   /oosLineToHonbuAlways_\('🧾 '\+ym\+'分のバサラスター請求書/.test(GAS));
ok('⑩のこす道には止め木を入れていない（請求書は止めない）',
   bodyOf(GAS, 'oosLineToHonbuAlways_').indexOf('OOS_HONBU_LINE_OFF') < 0);

/* 出口の数え上げ。増えたら「新しい抜け道ができた」合図 */
/* いまの7か所：①🔔要対応（notifyPendingAction・2026-07-27から呼び出しはコメントアウト済み）
   ②バサラ取込の社内案内 ③入荷のお知らせを送った（統合マスタＮ）④在庫がありません（受注Ａ）
   ⑤臨時入庫の自動反映 ⑥発注書でキャンセル ⑦バサラから発注（発注シートの受付） */
ok('⑩本部LINEを出す場所は7か所のまま（増えたら新しい抜け道）',
   (GAS.match(/oosLineToHonbu_\(/g) || []).length - 1 === 7,
   '（いまは ' + ((GAS.match(/oosLineToHonbu_\(/g) || []).length - 1) + ' か所）');

const zn = bodyOf(GAS, 'oosZaikoNashiSend');
ok('⑩お客様へのメールは止めていない（在庫のご連絡は今までどおり出る）',
   zn.indexOf('MailApp.sendEmail') >= 0 && zn.indexOf('oosLineToHonbu_') >= 0,
   '（止めるのは本部への事後報告LINEだけです）');

/* 本物の oosLineToHonbu_ を通して、受注Ａの「在庫がありません」を動かす */
function ugokasuHonbu(off){
  const okuri = [], nokoshi = [], mail = [];
  const box = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Boolean,
    Logger: { log(){} },
    NOTIFY_EMAIL: 'office@oliveoilstories.net',
    BASARA_STOCK_MAIL_NAME: '（株）オリーブオイル・ストーリーズ',
    LINE_INTERNAL_GROUP_ID: 'Cb9f05779ceb4af80b6a33c626bb8ea83',
    Utilities: { formatDate(){ return '2026/09/13 23:00'; } },
    MailApp: { sendEmail(o){ mail.push(String(o.to)); } },
    sendLineGroupMessage(text, to){ okuri.push([String(text), String(to)]); return { status:'ok', code:200 }; },
    oosZaikoNashiTo_(){ return { to:'hara@example.com', name:'バサラスター 原様' }; },
    oosZaikoNashiSent_(){ return false; },
    oosZaikoNashiBody_(){ return '本文'; },
    oosZaikoNashiLog_(){},
    oosSoukoTomeLog_(kind, text){ nokoshi.push([String(kind), String(text)]); }
  };
  box.globalThis = box;
  const ctx = vm.createContext(box);
  vm.runInContext('var OOS_HONBU_LINE_OFF = ' + (off ? 'true' : 'false') + ';\n'
    + H.cut(GAS, 'oosLineToHonbu_') + '\n'
    + H.cut(GAS, 'oosLineToHonbuAlways_') + '\n'
    + H.cut(GAS, 'oosZaikoNashiSend') + '\n'
    + 'var __kotae = oosZaikoNashiSend({orderNum:"TK-20260913-1234", source:"basara", items:["オルガニック 250ml"], recipient:"ためし様"});\n'
    + 'var __seikyu = oosLineToHonbuAlways_("🧾 ためしの請求書ができました");', ctx);
  return { okuri, nokoshi, mail, kotae: box.__kotae };
}

const H1 = ugokasuHonbu(true);
ok('⑩【動かす】止めているとき、受注Ａからの本部LINEは1通も出ない',
   H1.okuri.filter(function(x){ return x[0].indexOf('在庫がありません') >= 0; }).length === 0,
   '（出てしまいました）');
ok('⑩【動かす】止めたことは記録に残る', H1.nokoshi.length === 1 && H1.nokoshi[0][0] === '本部LINE');
ok('⑩【動かす】お客様への「在庫がありません」メールはちゃんと出る', H1.mail.length === 1);
ok('⑩【動かす】画面には ok が返る（ボタンがエラーにならない）',
   !!(H1.kotae && H1.kotae.status === 'ok'));
ok('⑩【動かす】止めていても【請求書の知らせ】はちゃんと本部へ飛ぶ',
   H1.okuri.filter(function(x){ return x[0].indexOf('請求書') >= 0 &&
     x[1] === 'Cb9f05779ceb4af80b6a33c626bb8ea83'; }).length === 1,
   '（ひろみさん「請求書はのこし」）');

const H2 = ugokasuHonbu(false);
ok('⑩【動かす】再開（false）にすれば、本部LINEはちゃんと飛ぶ',
   H2.okuri.filter(function(x){ return x[0].indexOf('在庫がありません') >= 0; }).length === 1);

/* ══════════════════════════════════════════════════════════════════════
   ⑨ 画面の文言（2026-09-13 ひろみさん指示「変えてください」）
      止めたのに「倉庫へLINEが飛びます」と書いてあると、本部が誤解します。
   ══════════════════════════════════════════════════════════════════════ */
const IDX = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/index.html', 'utf8');
const BIL = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/billing.html', 'utf8');

/* ★2026-09-24 🔵のあと倉庫へ一文だけ（ひろみさん指示）。ヘルプも今の流れに書き直した */
ok('⑨受注Ａ：🔵のあと3分で倉庫へ一文だけ、と書いてある', IDX.indexOf('3分後に倉庫のLINEへ一文だけ届き') >= 0);
ok('⑨受注Ａ：古い「倉庫へのLINE・メールはどこからも出しません」は消えている', IDX.indexOf('倉庫へのLINE・メールは<strong>どこからも出しません</strong>') < 0);
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
/* ★2026-09-13 ひろみさん指示：受注一覧の上の帯を、待ち時間の案内に入れかえました */
ok('⑨受注Ａ：受注一覧の帯から「倉庫への連絡は…」が消えている',
   IDX.indexOf('📮 倉庫への連絡は、<b>受注1件ずつ</b>') < 0);
ok('⑨受注Ａ：かわりに待ち時間の案内が出ている',
   IDX.indexOf('１つ１つの動作に10秒ほど時間がかかる場合があります。') >= 0);
ok('⑨請求М：画面から「（倉庫へLINEが行きます）」が消えている',
   BIL.indexOf('発注書のA列を🔵にしたとき（倉庫へLINEが行きます）') < 0);
ok('⑨請求М：新しい言い方になっている',
   BIL.indexOf('倉庫さんは発注書を見て発送されます') >= 0);

/* ★2026-09-13 ひろみさん「そこも変えて」。流れの図も直しました。
   ★「倉庫にLINE 1通」「本部にLINE 1通」に戻さないでください。 */
const ZEN = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/mocks/mock_全発注の流れ_2026-09-10.html', 'utf8');
const TOR = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/mocks/mock_取り置き予約の流れ_2026-09-10.html', 'utf8');
const SEI = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories/mocks/mock_請求の流れ_2026-09-10.html', 'utf8');

ok('⑨図（全発注）：🔵のあと一文だけ・中身は書かない、が先頭に書いてある',
   ZEN.indexOf('3分後に倉庫のLINEへ一文だけ届きます') >= 0 && ZEN.indexOf('中身（商品・本数）は書きません') >= 0);
ok('⑨図（全発注）：「倉庫へLINEが1通」がもう書かれていない',
   ZEN.indexOf('この瞬間にはじめて倉庫へLINEが1通') < 0);
/* ★数えるのは【画面に出る札】だけ（コメントの中の注意書きは数えません） */
ok('⑨図（全発注）：画面に「💬 本部にLINE 1通」の札がもう出ない',
   ZEN.indexOf('<span class="sig s-l">💬 本部にLINE 1通</span>') < 0);
ok('⑨図（取り置き・予約）：「💬 倉庫にLINE 1通」がもう書かれていない',
   TOR.indexOf('💬 倉庫にLINE 1通') < 0);
ok('⑨図（取り置き・予約）：🔵のあと一文だけ、と書いてある',
   TOR.indexOf('📨 3分後に倉庫のLINEへ一文だけ') >= 0);
ok('⑨図（請求）：のこした1本だと書いてある',
   SEI.indexOf('のこした唯一のLINE') >= 0,
   '（ひろみさん「請求書はのこし」）');

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
