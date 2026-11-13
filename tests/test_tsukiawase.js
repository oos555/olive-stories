/* ══════════════════════════════════════════════════════════════════════
   🔍 発注書との突き合わせ点検 ── 承認済みモック（2026-11-13 ひろみさん「これで進めて」）
   正本：mocks/mock_発注書との突き合わせ点検_2026-11-13.html

   ひろみさん：「なんでこういうことが起きるのかな、これ起きるのものすごい困るんだけど、起きないようにしてくれる」
   　　　　　　「その設計でお願い」「これで進めて」
   決め1：知らせは止め木を通らない道の3本目（呼ぶのは oosTsukiLineHonbu_ の1か所）
   決め2：点検タブは【本部管理専用ゆかスプシ】（oosKanriFile_）
   決め3：見張り2つは編集画面から oosTsukiawaseMihariTsukuru で作る

   ★このテストは「モックどおりか・勝手に増えていないか」の見張りです。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const H = require('./harness');
const GAS = H.readGas();
const MOCK = H.read('mocks/mock_発注書との突き合わせ点検_2026-11-13.html');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function cutFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  return '';
}

/* ── ① 部品がそろっている ───────────────────────────── */
['oosTsukiawaseTenken','oosTsukiawaseOnEdit','oosTsukiawaseIreNaosu_','oosTsukiawaseMihariTsukuru','oosTsukiSheet_','oosTsukiLineBun_','oosTsukiLineHonbu_','oosBasaraGyouKaraYuka_','oosTsukiHacchusho_','oosTsukiJuchu_','oosTsukiBasara_'].forEach(function(n){
  ok('①' + n + ' がある', cutFn(GAS, n).length > 0);
});

/* ── ② 点検タブ：見出しはモックの表と一字一句同じ（モック③） ── */
const midashi = (MOCK.match(/<table class="tab-table">\s*<tr>([\s\S]*?)<\/tr>/) || ['',''])[1].match(/<th>([^<]*)<\/th>/g).map(function(x){ return x.replace(/<\/?th>/g,''); });
const gasMidashi = (function(){ const m = GAS.match(/var OOS_TSUKI_MIDASHI = \[([^\]]*)\];/); return m ? m[1].split(',').map(function(x){ return x.trim().replace(/^'|'$/g,''); }) : []; })();
ok('②モックの表の見出しは11列', midashi.length === 11, '（' + midashi.length + '）');
ok('②点検タブの見出しはモックと一字一句同じ（順番も）', JSON.stringify(gasMidashi) === JSON.stringify(midashi), '（GAS：' + gasMidashi.join('|') + '）');
ok('②タブの名前は「🔍 発注書との突き合わせ」（モック③）', GAS.indexOf("var OOS_TSUKI_SHEET   = '🔍 発注書との突き合わせ';") >= 0 && MOCK.indexOf('「🔍 発注書との突き合わせ」タブ') >= 0);
ok('②タブの置き場所は【本部管理専用ゆかスプシ】（決め2）', cutFn(GAS, 'oosTsukiSheet_').indexOf('oosKanriFile_()') >= 0);
ok('②新しい行は上に足す（モック③「新しいものが上」）', cutFn(GAS, 'oosTsukiawaseTenken').indexOf('sh.insertRowBefore(2);') >= 0);
ok('②✅ になった行は消さない（行を消す処理が無い）', cutFn(GAS, 'oosTsukiawaseTenken').indexOf('deleteRow') < 0);

/* ── ③ 何を見つけるか（モック①）と直し方の文（モック③） ── */
ok('③見つけるものは3つ：発注書に無い／御請求明細に無い／二重', GAS.indexOf("var OOS_TSUKI_NANI  = { nai:'発注書に無い', meisai:'御請求明細に無い', nijuu:'二重' };") >= 0);
['A列の☑で、原さんのシートの受付済みの行から入れ直します', '受注Ａの受注一覧で「📥 発注書に送る」を押す', '発注書で片方を手で消す'].forEach(function(t){
  ok('③直し方の文がモックと同じ：' + t.slice(0, 14) + '…', GAS.indexOf(t) >= 0 && MOCK.indexOf(t) >= 0);
});
const ju = cutFn(GAS, 'oosTsukiJuchu_');
ok('③受注データは「出荷待ち」だけ見る', ju.indexOf('rec.status') >= 0 && ju.indexOf("'pending') return;") >= 0);
ok('③2026-09-10（発注書の一本化）より前は数えない', GAS.indexOf("var OOS_TSUKI_START = '2026-09-10';") >= 0 && ju.indexOf('OOS_TSUKI_START') >= 0);
ok('③🚫 記録のみ・↩️ 差し戻し中・まだ📥を押していない注文は数えない', ju.indexOf('if(rec.whSkip) return;') >= 0 && ju.indexOf('rec.sashimodoshi') >= 0 && ju.indexOf('まだ📥を押していない') >= 0);
const ba = cutFn(GAS, 'oosTsukiBasara_');
ok('③原さんのシートは「✅ 受付」の行だけ', ba.indexOf("a.indexOf('✅ 受付')") >= 0);
ok('③発送ずみ（送り状・発送日あり）の受付は「発注書に無い」に数えない', cutFn(GAS, 'oosTsukiawaseTenken').indexOf('if(!b.shipped') >= 0);

/* ── ④ 本部LINE（モック②）：見つかったときだけ・同じものは1回だけ（2026-11-13 ひろみさん）・のこす道の3本目 ── */
const tenken = cutFn(GAS, 'oosTsukiawaseTenken');
ok('④知らせるのは見つかったときだけ', tenken.indexOf('if(shiraseru.length) oosTsukiLineHonbu_(') >= 0);
ok('④同じものは見つけたときの1回だけ（知らせた日時に何か入っていれば送らない・「1日1回」の日付くらべは残っていない）', tenken.indexOf('何度も何度も送らなくて') >= 0 && tenken.indexOf('oosTsukiHiKey_') < 0 && GAS.indexOf('oosTsukiHiKey_') < 0);
ok('④✅ になった行は知らせ直さない', tenken.indexOf('OOS_TSUKI_JOUTAI_MI) return;') >= 0);
ok('④本部LINEは のこす道（oosLineToHonbuAlways_）を1か所から', cutFn(GAS, 'oosTsukiLineHonbu_').indexOf('oosLineToHonbuAlways_(text)') >= 0);
ok('④点検・入れ直しのどちらも oosTsukiLineHonbu_ を通る（直に Always_ を呼ばない）', tenken.indexOf('oosLineToHonbuAlways_') < 0 && cutFn(GAS, 'oosTsukiawaseIreNaosu_').indexOf('oosLineToHonbuAlways_') < 0);
ok('④止め木の道（oosLineToHonbu_）は使わない', tenken.indexOf('oosLineToHonbu_(') < 0);
ok('④外（倉庫・原さん・お客様）には送らない', tenken.indexOf('oosLineToWarehouse_') < 0 && tenken.indexOf('MailApp') < 0 && tenken.indexOf('GmailApp') < 0);
/* 文を本物の関数で作って、モック②の文と突き合わせる */
(function(){
  const box = { OOS_TSUKI_NANI:{ nai:'発注書に無い', meisai:'御請求明細に無い', nijuu:'二重' }, OOS_TSUKI_SHEET:'🔍 発注書との突き合わせ',
                OOS_TSUKI_NAOSHIKATA:{ basara:'A列の☑で、原さんのシートの受付済みの行から入れ直します', juchu:'受注Ａの受注一覧で「📥 発注書に送る」を押す', meisai:'原さんのシートの御請求明細をご確認ください', nijuu:'発注書で片方を手で消す' } };
  vm.createContext(box); vm.runInContext(cutFn(GAS, 'oosTsukiLineBun_'), box);
  const t1 = box.oosTsukiLineBun_('11/13 00:00', [{ nani:'発注書に無い', num:'BA-20261112-4364', name:'筒井', dedokoro:'バサラ（原さん受付 11/12 22:43）', naoshikata:box.OOS_TSUKI_NAOSHIKATA.basara, chk:true }]);
  const m1 = '🔍 発注書との突き合わせ点検（11/13 00:00）\n発注書に入っていない注文が 1件\n・BA-20261112-4364 筒井様（原さん受付 11/12 22:43）\n→【本部管理専用ゆかスプシ】の「🔍 発注書との突き合わせ」タブで、A列の☑を入れると発注書に入れ直せます。';
  ok('④（本物）バサラの「発注書に無い」の文がモック②の1つ目と一字一句同じ', t1 === m1, '\n' + t1);
  const t2 = box.oosTsukiLineBun_('11/20 09:00', [{ nani:'発注書に無い', num:'TK-20261120-1234', name:'◯◯', dedokoro:'受注Ａ（📥 11/20 08:40）', naoshikata:box.OOS_TSUKI_NAOSHIKATA.juchu, chk:false }]);
  const m2 = '🔍 発注書との突き合わせ点検（11/20 09:00）\n発注書に入っていない注文が 1件\n・TK-20261120-1234 ◯◯様（受注Ａで📥 11/20 08:40）\n→ 受注Ａの受注一覧でこの注文を開き「📥 倉庫＆OOS発送連絡スプシの『発注書』に送る」を押してください。';
  ok('④（本物）受注Ａの「発注書に無い」の文がモック②の2つ目と一字一句同じ', t2 === m2, '\n' + t2);
  const t3 = box.oosTsukiLineBun_('11/25 15:00', [{ nani:'二重', num:'BA-20261125-5678', name:'◯◯', dedokoro:'発注書 47行目・48行目', naoshikata:box.OOS_TSUKI_NAOSHIKATA.nijuu, chk:false }]);
  const m3 = '🔍 発注書との突き合わせ点検（11/25 15:00）\n発注書に同じ注文が2行あります 1件\n・BA-20261125-5678 ◯◯様（47行目・48行目）\n→ 発注書で片方の行を手で消してください（在庫が二重に引かれていないかもご確認ください）。';
  ok('④（本物）「二重」の文がモック②の3つ目と一字一句同じ', t3 === m3, '\n' + t3);
  ['発注書に入っていない注文が 1件','・BA-20261112-4364 筒井様（原さん受付 11/12 22:43）','A列の☑を入れると発注書に入れ直せます。','→ 発注書で片方の行を手で消してください（在庫が二重に引かれていないかもご確認ください）。'].forEach(function(s){
    ok('④モック②にこの文がある：' + s.slice(0, 16) + '…', MOCK.indexOf(s) >= 0);
  });
  /* バサラの注文には「受注Ａの📥」の案内を出さない（ひろみさん 11/13「バサラは受注Ａを触らない」） */
  ok('④（本物）バサラだけの知らせに「受注Ａの受注一覧」の案内は出ない', t1.indexOf('受注Ａの受注一覧') < 0);
})();

/* ── ⑤ ☑ 入れ直す（モック④）：バサラの「発注書に無い」だけ・正本から・同じ転記キー・かぎ係 ── */
const ire = cutFn(GAS, 'oosTsukiawaseIreNaosu_');
const onEdit = cutFn(GAS, 'oosTsukiawaseOnEdit');
ok('⑤☑はA列（1列目）だけ見る', onEdit.indexOf('OOS_TSUKI_COL.chk') >= 0 && GAS.indexOf('var OOS_TSUKI_COL = { chk:1,') >= 0);
ok('⑤☑で動くのは点検タブだけ', onEdit.indexOf('OOS_TSUKI_SHEET) return;') >= 0);
ok('⑤バサラの「発注書に無い」以外は戻して断る', ire.indexOf("dedokoro.indexOf('バサラ')") >= 0 && ire.indexOf('OOS_TSUKI_NANI.nai') >= 0 && ire.indexOf('この行は☑で入れ直せません（バサラの「発注書に無い」だけです）') >= 0);
ok('⑤もう対応ずみの行は入れ直さない', ire.indexOf('この行はもう対応ずみです') >= 0);
ok('⑤正本＝原さんのシートの、同じ転記キーの行から作る', ire.indexOf("oosFindRowByKey_(bsh, oosKeyColByHeader_(bsh), key)") >= 0 && ire.indexOf('oosBasaraGyouKaraYuka_(bsh, brow, num)') >= 0);
ok('⑤受付のときと同じ転記キーで入れる', ire.indexOf('order.key = key;') >= 0);
ok('⑤発注書への1行は かぎ係つきの oosYukaImportOrder を通す', ire.indexOf('oosYukaImportOrder(order)') >= 0);
ok('⑤同じ番号がもうあれば「✅ 解消（もう入っていました…）」', ire.indexOf("'✅ 解消（もう入っていました・発注書 ' + imp.row + '行目）'") >= 0);
ok('⑤入れ直したら「✅ 入れ直した（発注書 ◯行目）」', ire.indexOf("'✅ 入れ直した（発注書 ' + imp.row + '行目）'") >= 0);
ok('⑤入れ直したら本部LINEに1通（モック④）', ire.indexOf("oosTsukiLineHonbu_('✅ ' + num + ' を発注書の' + imp.row + '行目に入れ直しました") >= 0);
ok('⑤御請求明細・受注データ・在庫は触らない（その3つを書く関数を呼ばない）', ire.indexOf('oosBasaraMeisai_') < 0 && ire.indexOf('basaraAppendOrderRow_') < 0 && ire.indexOf('oosYukaStockDeductByKey_') < 0 && ire.indexOf('SHEET_ID_MAIN') < 0 && ire.indexOf('oosHonbuSync') < 0);
/* 受付の作り方と同じ言葉を使っているか（複製のずれの見張り） */
const accept = cutFn(GAS, 'oosBasaraOrderAccept_'), gyou = cutFn(GAS, 'oosBasaraGyouKaraYuka_');
["'（入荷待ち）'", "'【ギフト包装あり】'", "'【熨斗あり】'", "'✈️入荷待ちの商品を含みます（入荷しだいの発送）'", "OOS_BASARA_SENDER.name", "d[OOS_BC.memoIn-1]", "src:'バサラスター'", "'【送り主：'"].forEach(function(s){
  ok('⑤正本からの作り方は受付と同じ言葉：' + s, accept.indexOf(s) >= 0 && gyou.indexOf(s) >= 0);
});

/* ── ⑥ 見張り（トリガー）は編集画面から（決め3）・何度実行しても1組 ── */
const mih = cutFn(GAS, 'oosTsukiawaseMihariTsukuru');
ok('⑥1時間ごとの点検の見張りを作る', mih.indexOf("ScriptApp.newTrigger('oosTsukiawaseTenken').timeBased().everyHours(1).create()") >= 0);
ok('⑥点検タブの☑の見張りを、本部管理専用ゆかスプシに作る', mih.indexOf("ScriptApp.newTrigger('oosTsukiawaseOnEdit').forSpreadsheet(kanri.getId()).onEdit().create()") >= 0);
ok('⑥もうあれば作らない（二重にならない）', mih.indexOf('if(!aruT)') >= 0 && mih.indexOf('if(!aruE)') >= 0);
ok('⑥doGet／doPost から見張りを作る窓口は無い（Webアプリ経由で作らない）', !/action === '[A-Za-z]*'\)\s*return oosTsukiawaseMihariTsukuru/.test(GAS));

/* ── ⑦ 本物の点検を砂場で動かす：筒井様の形（受注データにあり・発注書に無い）を見つけ、1通送り、2回目の同じ日は送らない ── */
(function(){
  const sent = [];
  const tabRows = [];
  const tab = {
    getLastRow(){ return tabRows.length + 1; },
    getRange(r, c, nr, nc){ return {
      getValues(){ const out=[]; for(let i=0;i<(nr||1);i++){ out.push((tabRows[r-2+i]||new Array(11).fill('')).slice(c-1, c-1+(nc||1))); } return out; },
      setValues(vv){ for(let i=0;i<vv.length;i++){ tabRows[r-2+i] = vv[i].slice(); } return this; },
      setValue(v){ if(!tabRows[r-2]) tabRows[r-2]=new Array(11).fill(''); tabRows[r-2][c-1]=v; return this; },
      insertCheckboxes(){ if(!tabRows[r-2]) tabRows[r-2]=new Array(11).fill(''); tabRows[r-2][c-1]=false; return this; },
      setFontWeight(){ return this; }, setBackground(){ return this; }, setWrap(){ return this; }, setNumberFormat(){ return this; }
    }; },
    insertRowBefore(){ tabRows.unshift(new Array(11).fill('')); }, setFrozenRows(){}, setColumnWidth(){}
  };
  const box = {
    Utilities: { formatDate(d){ return '11/13 00:00'; } }, Logger:{ log(){} }, String, Number, Date, Object, Array, JSON, Math,
    OOS_TSUKI_START:'2026-09-10', OOS_TSUKI_JOUTAI_MI:'未対応', OOS_TSUKI_SHEET:'🔍 発注書との突き合わせ',
    OOS_TSUKI_NANI:{ nai:'発注書に無い', meisai:'御請求明細に無い', nijuu:'二重' }, OOS_TSUKI_MIDASHI:new Array(11).fill('x'),
    OOS_TSUKI_COL:{ chk:1, mitsuketa:2, nani:3, num:4, name:5, dedokoro:6, naoshikata:7, joutai:8, naoshita:9, shiraseta:10, key:11 },
    OOS_TSUKI_NAOSHIKATA:{ basara:'A列の☑で、原さんのシートの受付済みの行から入れ直します', juchu:'受注Ａの受注一覧で「📥 発注書に送る」を押す', meisai:'原さんのシートの御請求明細をご確認ください', nijuu:'発注書で片方を手で消す' },
    oosTsukiHacchusho_(){ return { ok:true, keyRows:{ 'K-NAKAGUCHI':[47] }, numRows:{ 'BA-20261112-2516':[{row:47,name:'中口'}] } }; },
    oosTsukiJuchu_(){ const rec = { id:'basara-1', num:'BA-20261112-4364', name:'筒井', status:'pending', registeredAt:'2026-11-12T13:43:58.700Z', source:'basara', key:'K-TSUTSUI', okutta:false, okuttaAt:'', whSkip:false, sashimodoshi:false };
                      return { ok:true, list:[rec], byKey:{ 'K-TSUTSUI':rec } }; },
    oosTsukiBasara_(){ return { ok:true, list:[{ row:13, key:'K-TSUTSUI', name:'筒井', uketsuke:'11/12 22:43', shipped:false }], meisaiNums:{ 'BA-20261112-4364':true } }; },
    oosTsukiSheet_(){ return tab; },
    oosTsukiLineHonbu_(t){ sent.push(t); }
  };
  vm.createContext(box);
  ['oosTsukiHizuke_','oosTsukiMojiDe_','oosTsukiawaseTenken','oosTsukiLineBun_'].forEach(function(n){ vm.runInContext(cutFn(GAS, n), box); });
  const r1 = box.oosTsukiawaseTenken();
  ok('⑦筒井様の形（受付ずみ・発注書に無い）を1件見つける', r1 && r1.status === 'ok' && r1.mitsuketa === 1, JSON.stringify(r1));
  ok('⑦点検タブに1行（未対応・☑つき・転記キー）', tabRows.length === 1 && tabRows[0][2] === '発注書に無い' && tabRows[0][3] === 'BA-20261112-4364' && tabRows[0][7] === '未対応' && tabRows[0][0] === false && tabRows[0][10] === 'K-TSUTSUI', JSON.stringify(tabRows[0]));
  ok('⑦本部LINEを1通', sent.length === 1 && /発注書に入っていない注文が 1件/.test(sent[0]) && /BA-20261112-4364 筒井様/.test(sent[0]));
  const r2 = box.oosTsukiawaseTenken();
  ok('⑦2回目は、見つけるが送らない（同じものは1回だけ）', r2.mitsuketa === 1 && r2.shiraseta === 0 && sent.length === 1 && tabRows.length === 1);
  /* 日付が変わっても送らない（2026-11-13 ひろみさん「何度も何度も送らなくて」） */
  box.Utilities.formatDate = function(){ return '11/14 00:07'; };
  const r2b = box.oosTsukiawaseTenken();
  ok('⑦次の日（0:07）になっても、同じものは送らない', r2b.mitsuketa === 1 && r2b.shiraseta === 0 && sent.length === 1, 'sent=' + sent.length);
  box.Utilities.formatDate = function(){ return '11/13 00:00'; };
  /* 直ったら ✅ 解消 */
  box.oosTsukiHacchusho_ = function(){ return { ok:true, keyRows:{ 'K-NAKAGUCHI':[47], 'K-TSUTSUI':[48] }, numRows:{} }; };
  const r3 = box.oosTsukiawaseTenken();
  ok('⑦発注書に入ったら「✅ 解消（…の点検で発注書にありました）」になり、送らない', r3.mitsuketa === 0 && sent.length === 1 && /^✅ 解消（/.test(String(tabRows[0][7])), String(tabRows[0][7]));
})();

/* ── ⑧ 2026-11-13 13時の事故：スプシが「11/13 11:07」を日付型に変える → 読み戻すと Date → 「今日」と一致せず毎時LINE（実際に11:07・12:07・13:07の3通）──
   砂場のスプシを本物に寄せる：文字が日付の形なら、書式が「@」（文字）でない限り Date に化ける */
(function(){
  const sent = [];
  const tabRows = [];
  const fmt = {};
  const hinichiRashii = (v) => (typeof v === 'string') && /^[0-9]{1,2}[/][0-9]{1,2} [0-9]{2}:[0-9]{2}$/.test(v);
  const bakeru = (r, c, v) => (hinichiRashii(v) && fmt[r + ':' + c] !== '@') ? new Date(2026, 10, 13, 11, 7) : v;
  const tab = {
    getLastRow(){ return tabRows.length + 1; },
    getRange(r, c, nr, nc){ return {
      getValues(){ const out=[]; for(let i=0;i<(nr||1);i++){ out.push((tabRows[r-2+i]||new Array(11).fill('')).slice(c-1, c-1+(nc||1))); } return out; },
      setValues(vv){ for(let i=0;i<vv.length;i++){ tabRows[r-2+i] = vv[i].map((v, j) => bakeru(r+i, c+j, v)); } return this; },
      setValue(v){ if(!tabRows[r-2]) tabRows[r-2]=new Array(11).fill(''); tabRows[r-2][c-1]=bakeru(r, c, v); return this; },
      setNumberFormat(f){ fmt[r + ':' + c] = f; return this; },
      insertCheckboxes(){ if(!tabRows[r-2]) tabRows[r-2]=new Array(11).fill(''); tabRows[r-2][c-1]=false; return this; },
      setFontWeight(){ return this; }, setBackground(){ return this; }, setWrap(){ return this; }
    }; },
    insertRowBefore(){ tabRows.unshift(new Array(11).fill('')); Object.keys(fmt).forEach(k => delete fmt[k]); }, setFrozenRows(){}, setColumnWidth(){}
  };
  const box = {
    Utilities: { formatDate(d, tz, pat){ return pat === 'M/d' ? '11/13' : '11/13 00:00'; } }, Logger:{ log(){} }, String, Number, Date, Object, Array, JSON, Math,
    OOS_TSUKI_START:'2026-09-10', OOS_TSUKI_JOUTAI_MI:'未対応', OOS_TSUKI_SHEET:'🔍 発注書との突き合わせ',
    OOS_TSUKI_NANI:{ nai:'発注書に無い', meisai:'御請求明細に無い', nijuu:'二重' }, OOS_TSUKI_MIDASHI:new Array(11).fill('x'),
    OOS_TSUKI_COL:{ chk:1, mitsuketa:2, nani:3, num:4, name:5, dedokoro:6, naoshikata:7, joutai:8, naoshita:9, shiraseta:10, key:11 },
    OOS_TSUKI_NAOSHIKATA:{ basara:'A列の☑で、原さんのシートの受付済みの行から入れ直します', juchu:'受注Ａの受注一覧で「📥 発注書に送る」を押す', meisai:'原さんのシートの御請求明細をご確認ください', nijuu:'発注書で片方を手で消す' },
    oosTsukiHacchusho_(){ return { ok:true, keyRows:{}, numRows:{} }; },
    oosTsukiJuchu_(){ const rec = { id:'o1', num:'RT-20260917-6266', name:'高山', status:'pending', registeredAt:'2026-09-17T13:51:53.793Z', source:'manual', key:'K-TAKAYAMA', okutta:true, okuttaAt:'2026-09-17T13:53:05.047Z', whSkip:false, sashimodoshi:false };
                      return { ok:true, list:[rec], byKey:{ 'K-TAKAYAMA':rec } }; },
    oosTsukiBasara_(){ return { ok:true, list:[], meisaiNums:{} }; },
    oosTsukiSheet_(){ return tab; },
    oosTsukiLineHonbu_(t){ sent.push(t); }
  };
  vm.createContext(box);
  ['oosTsukiHizuke_','oosTsukiMojiDe_','oosTsukiawaseTenken','oosTsukiLineBun_'].forEach(function(n){ vm.runInContext(cutFn(GAS, n), box); });
  /* (1) きょう直す前に書かれた行：知らせた日時が Date に化けている（本物の J2 と同じ状態） */
  tabRows.push(['（☑なし）', new Date(2026,10,13,11,7), '発注書に無い', 'RT-20260917-6266', '高山', '受注Ａ（📥 9/17 22:53）', '受注Ａの受注一覧で「📥 発注書に送る」を押す', '未対応', '', new Date(2026,10,13,13,7), 'K-TAKAYAMA']);
  const r1 = box.oosTsukiawaseTenken();
  ok('⑧知らせた日時が日付型に化けていても「もう知らせた」と読めて、送らない', r1 && r1.mitsuketa === 1 && r1.shiraseta === 0 && sent.length === 0, JSON.stringify(r1) + ' sent=' + sent.length);
  /* (2) 新しく見つけた行：日時の3列は文字で書く（化けない）→ 2回目も送らない */
  tabRows.length = 0;
  const r2 = box.oosTsukiawaseTenken();
  const r3 = box.oosTsukiawaseTenken();
  ok('⑧新しい行の見つけた日時・知らせた日時は文字のまま（書式@）', typeof tabRows[0][1] === 'string' && typeof tabRows[0][9] === 'string' && fmt['2:2'] === '@' && fmt['2:10'] === '@', JSON.stringify([tabRows[0][1], tabRows[0][9], fmt]));
  ok('⑧1時間後の2回目は送らない（同じものは1回だけ）', r2.shiraseta === 1 && r3.shiraseta === 0 && sent.length === 1, 'sent=' + sent.length);
})();

/* ── 結果 ───────────────────────────────────────────────── */
const title = '🔍 発注書との突き合わせ点検（承認済みモック 2026-11-13）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
