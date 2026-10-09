/* ══════════════════════════════════════════════════════════════════════
   ✅ RT：この内容で登録して、発注書まで送る（1つのボタン）
   2026-09-17　ひろみさん承認ずみ
   承認済みモック：デスクトップ/システム開発用おわるまで捨てないで/
   　　　　　　　　mock_RT登録まで一気に_2026-09-17.html
   ★2026-10-09 ひろみさん承認：登録は【1往復】（mocks/mock_RT登録は1往復_2026-10-09.html）
   　　この見張りは、本物の rtIkkiGo と新しい部品（rtIkki1Oufuku_ ほか）を、
   　　ニセの fetch（GASの返事を作り物にする）で動かして、
   　　「1往復しかしない」「返事が読めなくても同じ荷物をもう一度送れる」
   　　「GASが断ったら手元の登録も取り下げる」「登録済みの伝票は貼り直しの道がある」を見ます。

   ★ひろみさんの言葉（2026-09-17）
     「RTはもう登録が終わってるわけだよね。伝票を取り込んで納品書を作ってるときに、
     　もうそこからアプリの中で**登録が済ませられる状態**なわけだから、
     　**人が打ち込むよりも正しい状態**で。
     　**納品書が作り終わって確認した段階から、すぐにスプレッドシートに情報を移していく**
     　っていう流れでいいんじゃないかな。**でも必ず書類のリンクは貼るように**」
   ★ひろみさんの言葉（2026-10-09）
     「12から16往復していたものが1往復で終わるようにする。それになれば、ちゃんと伝票や納品書も
     　リンクがきちんと貼り付けられて、倉庫がそれを開いてプリントアウトができる」
     「今書いてあるものは何も消さない。他のところは何も変えないでください」
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '✅ RT：登録して発注書まで送る1つのボタン（2026-09-17／1往復 2026-10-09）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ── 本物の rtIkkiGo を動かす砂場 ── */
function sunaba(opt){
  opt = opt || {};
  /* mademita … 途中でいちど出た文も全部とっておく（消えても確かめられるように） */
  const log = { mademita: [], style: {},
    insertAdjacentHTML(_, h){ this.innerHTML += h; },
    scrollIntoView(){} };
  Object.defineProperty(log, 'innerHTML', {
    get(){ return this._h || ''; },
    set(v){ this._h = v; this.mademita.push(String(v)); } });
  const btn = { id: 'rt-ikki-btn', disabled: false, style: {}, textContent: '' };
  const chk = { checked: opt.chk !== false };
  const alerts = { innerHTML: '', textContent: opt.alertText || '' };
  const ashiato = [];
  const nimotsu = [];           /* GASへ送った荷物（fetch の body） */
  const vYonda = [];            /* 発注書のV列を読みに行った回数 */
  const henji = (opt.henji || []).slice();   /* GASの返事（順番に。'HTML'＝読めない／'NET'＝通信失敗） */
  const chuumon = opt.chuumon || [];
  const ctx = vm.createContext({
    console: console, Math: Math, Number: Number, String: String, Object: Object,
    Array: Array, Date: Date, parseInt: parseInt, isNaN: isNaN, JSON: JSON, Promise: Promise, Error: Error,
    esc: function(s){ return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
    document: { getElementById: function(id){
      if (id === 'rt-ikki-log') return log;
      if (id === 'rt-ikki-btn') return btn;
      if (id === 'rt-confirm-chk') return chk;
      if (id === 'order-alerts') return alerts;
      return null;
    }},
    orders: chuumon,
    rtParsed: opt.rtParsed || { slipNo: '380498' },
    GAS_URL: 'https://gas.test/exec',
    /* ↓ この見張りが見るのは rtIkkiGo の段取りなので、まわりは作り物にします */
    applyRtToOrderForm: function(nokoru){ ashiato.push('applyRtToOrderForm(' + (nokoru ? 'true' : '') + ')'); },
    previewOrder: function(){ ashiato.push('previewOrder'); ctx.window._pendingOrders = opt.pending || null; },
    /* ★2026-09-24 在庫を見る前に、いちばん新しい在庫を読み直します（開いたままの画面の在庫が古いため） */
    zaikoYomiNaosu: async function(){ ashiato.push('zaikoYomiNaosu'); return true; },
    checkStockShortage: function(){ ashiato.push('checkStockShortage'); return opt.short || []; },
    docKakuninSuru: function(o, mei){ ashiato.push('docKakuninSuru:' + mei); },
    registerOrder: function(o){
      ashiato.push('registerOrder' + (o && o.rtIkki ? '(rtIkki)' : ''));
      (opt.pending || []).forEach(function(o){ if (chuumon.indexOf(o) < 0) chuumon.push(o); });
    },
    renderList: function(){},
    docFudaMachi: async function(o){ ashiato.push('docFudaMachi'); if (opt.fuda !== false) o.yukaKey = 'K-test'; },
    rtAttachDocsToOrder: async function(o){ ashiato.push('rtAttachDocsToOrder'); o.nouhinDocNg = opt.hariNg || ''; },
    /* ★2026-10-09 1往復の部品のまわり */
    rtBuildNotePdfB64: async function(){ ashiato.push('rtBuildNotePdfB64'); if (opt.pdfNg) throw new Error('PDF部品の読み込みがまだです'); return 'NOUHIN-B64'; },
    rtDocNameSuggest: function(){ return 'サンクチュアリコート高山_380498'; },
    rtDocBaseName: opt.baseName || '',
    rtSlipPdfB64: (opt.slipB64 === undefined) ? 'DENPYOU-B64' : opt.slipB64,
    yukaImportOne: async function(id, o){ ashiato.push('yukaImportOne' + (o && o.bodyDake ? '(bodyDake)' : '')); return { num: 'RT-20260917-0412', src: 'RT', slipNo: '380498', items: [] }; },
    docVretsu: {},
    RT_DOC_NOUHIN: '📄 納品書（ひらく）',
    RT_DOC_DENPYOU: '📄 発注伝票（ひらく）',
    docVretsuYomu: async function(){ vYonda.push(1); },
    rtDocHareteru: function(o, nafuda){ return (opt.vretsu && opt.vretsu[nafuda]) ? 'https://drive.test/' + nafuda : ''; },
    fetch: async function(url, init){
      const body = JSON.parse(init.body);
      nimotsu.push(body);
      const r = henji.length ? henji.shift() : { status: 'ok', hareta: true, vretsu: [], order: {} };
      if (r === 'NET') throw new Error('Failed to fetch');
      return { json: async function(){ if (r === 'HTML') throw new Error('Unexpected token <'); return r; } };
    }
  });
  ctx.window = ctx; ctx.globalThis = ctx;
  /* ★決めごとの親は5つとも【本物】を入れます（作り物にすると、本物とちがう動きで通ります）。
     　とくに OOS_NOUHIN.shoruiList は「RT発注伝票＋納品書」をどう数えるかの親です。
     　見張り：tests/test_mihari_soten.js の ⑥ */
  ['oos-zei.js', 'oos-kakaku.js', 'oos-shorui-kimari.js', 'oos-doc.js', 'oos-nouhin.js']
    .forEach(function(f){ vm.runInContext(fs.readFileSync(path.join(LIVE, f), 'utf8'), ctx); });
  ['RT_IKKI_1OUFUKU', '_rtIkkiNimotsu', 'RT_IKKI_MATTE']
    .forEach(function(n){ vm.runInContext(H.cutVar(SRC, n), ctx); });
  ['rtIkkiLog','rtIkkiWaku','rtIkkiEgaku','rtIkkiClear','rtIkkiSay','rtIkkiIma','rtIkkiNijuu','rtIkkiGo','rtIkkiHariNaosu',
   'rtIkkiOkuru_','rtIkkiShorui_','rtIkkiOkuriNaoshiBtn_','rtIkki1Oufuku_','rtIkkiKekkaDasu_','rtIkkiOkuriNaoshi',
   'rtIkkiHariNaoshiAnnai_','rtIkkiHariNaoshi1']
    .forEach(function(n){ vm.runInContext(H.cut(SRC, n), ctx); });
  vm.runInContext('var rtIkkiChu = false; var _rtIkkiKekka = ""; var _rtIkkiIma = "";', ctx);
  return { ctx: ctx, log: log, btn: btn, ashiato: ashiato, chuumon: chuumon, nimotsu: nimotsu, vYonda: vYonda, henji: henji,
           run: function(){ return vm.runInContext('rtIkkiGo()', ctx); },
           okuriNaoshi: function(){ return vm.runInContext('rtIkkiOkuriNaoshi()', ctx); },
           hariNaoshi1: function(id){ return vm.runInContext('rtIkkiHariNaoshi1(' + JSON.stringify(id) + ')', ctx); },
           ordersLen: function(){ return vm.runInContext('orders.length', ctx); } };
}
function chuumonTsukuru(x){
  return Object.assign({ id: 'o1', num: 'RT-20260917-0412', status: 'pending',
    note: 'RT伝票取込 ／ 伝票番号 380498', yukaKey: '',
    enclosedDoc: 'RT発注伝票＋納品書', customerType: 'rt' }, x);
}
const OK_HENJI = { status: 'ok', mode: 'toroku', hareta: true,
  vretsu: [{ '文字': '📄 納品書（ひらく）', 'リンク': 'https://drive.test/n' }, { '文字': '📄 発注伝票（ひらく）', 'リンク': 'https://drive.test/d' }],
  order: { yukaKey: 'K-gas', yukaImport: { at: '2026-10-09T00:00:00.000Z' }, extraDocUrl: 'https://drive.test/d', extraDocName: 'x_伝票.pdf', nouhinDocNg: '' } };

/* 非同期なので、まとめて動かします */
(async function(){
  /* ① うまくいったとき（GASが1回で「2つとも貼れた」と返す） */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})], henji: [OK_HENJI] });
    await s.run();
    const h = s.log.innerHTML;
    /* ★2026-09-17 ひろみさん「この工程がいろいろ書かれているのはなに？
       　裏の作業はみせなくていい」→ 途中の工程は【ためない】。結果だけ出す。 */
    ok('①「登録しました」と注文番号が出る',
       h.indexOf('✅ 登録しました') >= 0 && h.indexOf('RT-20260917-0412') >= 0);
    ok('①発注書に送ったことが、結果の中に書いてある', h.indexOf('発注書に送り、') >= 0);
    ok('①2つの書類を貼ったことが出る',
       h.indexOf('📄 納品書') >= 0 && h.indexOf('📄 発注伝票') >= 0
       && h.indexOf('2つとも貼りました') >= 0);
    ok('①読み直して確かめたことが出る', h.indexOf('発注書を読み直して確かめました') >= 0);
    ok('①★途中の工程（⏳）が、1つものこっていない', h.indexOf('⏳') < 0,
       '（出た画面：' + h.replace(/<[^>]*>/g, ' ').slice(0, 220) + '）');
    ok('①待っている間も「30秒ほど」と伝えている',
       s.log.mademita.some(function(x){ return x.indexOf('30秒ほどかかります') >= 0; }),
       '（出た途中の文：' + s.log.mademita.join(' ／ ').slice(0, 200) + '）');
    ok('①★出る枠は2つだけ（結果＋倉庫への注意）',
       (h.match(/border-radius:9px/g) || []).length === 2,
       '（出た枠の数：' + (h.match(/border-radius:9px/g) || []).length + '）');
    ok('①「倉庫へは、まだ何も行きません」と書いてある',
       h.indexOf('倉庫へは、まだ何も行きません') >= 0);
    /* ★2026-09-24 「在庫を入れたのにいつまでも在庫が足りませんが消えない」→ 在庫を見る前に読み直す */
    ok('①順番どおりに走っている（入れる→確認→在庫を読み直す→在庫→PDF→登録→荷物1回）',
       s.ashiato.join(',').indexOf('applyRtToOrderForm(true),previewOrder,zaikoYomiNaosu,checkStockShortage') >= 0
       && s.ashiato.indexOf('rtBuildNotePdfB64') < s.ashiato.indexOf('registerOrder(rtIkki)'),
       '（出た足あと：' + s.ashiato.join(' → ') + '）');
    /* ★2026-10-09 1往復 */
    ok('①★GASへの往復は【1回だけ】', s.nimotsu.length === 1, '（往復：' + s.nimotsu.length + '回）');
    ok('①★荷物は rtIkki・登録・伝票番号つき',
       s.nimotsu[0] && s.nimotsu[0].action === 'rtIkki' && s.nimotsu[0].payload.mode === 'toroku'
       && s.nimotsu[0].payload.slipNo === '380498' && s.nimotsu[0].payload.order.id === 'o1');
    ok('①★荷物に書類2つ（納品書・伝票）のPDFと名前が入っている',
       (function(){ var d = s.nimotsu[0].payload.docs; return d.length === 2
         && d[0].shu === 'nouhin' && d[0].b64 === 'NOUHIN-B64' && d[0].filename === 'サンクチュアリコート高山_380498_納品書.pdf'
         && d[1].shu === 'denpyou' && d[1].b64 === 'DENPYOU-B64' && d[1].filename === 'サンクチュアリコート高山_380498_伝票.pdf'; })(),
       '（荷物：' + JSON.stringify((s.nimotsu[0] || {}).payload && s.nimotsu[0].payload.docs).slice(0, 200) + '）');
    ok('①★発注書に入れる中身は yukaImportOne（中身だけ）から＝作り方は1か所',
       s.ashiato.indexOf('yukaImportOne(bodyDake)') >= 0 && s.nimotsu[0].payload.yukaOrder.num === 'RT-20260917-0412');
    ok('①★登録は opt.rtIkki で呼ぶ（ここでは保存も発注書への送信もしない）', s.ashiato.indexOf('registerOrder(rtIkki)') >= 0);
    ok('①★ふだ待ち・個別の貼り（古い鎖）は通らない',
       s.ashiato.indexOf('docFudaMachi') < 0 && s.ashiato.indexOf('rtAttachDocsToOrder') < 0);
    ok('①GASが返したふだ・伝票PDFのURLが注文に入る',
       s.chuumon[0].yukaKey === 'K-gas' && s.chuumon[0].extraDocUrl === 'https://drive.test/d' && s.chuumon[0].nouhinDocNg === '');
    ok('①GASが読み返したV列をカードが使える（もう1往復しない）',
       JSON.stringify(s.ctx.docVretsu['K-gas']) === JSON.stringify(OK_HENJI.vretsu));
    ok('①RTの画面に残る（受注登録画面へ切り替えない）',
       s.ashiato.indexOf('applyRtToOrderForm(true)') >= 0,
       '（切り替えると、結果の行が見えなくなります）');
    ok('①書類は「見た」としている（この画面で見て☑を押しているため）',
       s.ashiato.some(function(x){ return x.indexOf('docKakuninSuru:') === 0; }));
    ok('①終わったらボタンが戻る', s.btn.disabled === false);
  }

  /* ② 同じ伝票番号が、もう登録されている → 登録しない */
  {
    const mae = chuumonTsukuru({ id: 'o0', num: 'RT-20260916-7361' });
    const s = sunaba({ chuumon: [mae], pending: [chuumonTsukuru({})] });
    await s.run();
    const h = s.log.innerHTML;
    ok('②「登録していません」と出る', h.indexOf('⛔ <b>登録していません。</b>') >= 0);
    ok('②伝票番号と、前の注文番号が出る',
       h.indexOf('380498') >= 0 && h.indexOf('RT-20260916-7361') >= 0);
    ok('②本当に登録していない', s.ashiato.indexOf('registerOrder') < 0,
       '（出た足あと：' + s.ashiato.join(' → ') + '）');
    ok('②フォームにも入れていない', s.ashiato.length === 0);
    ok('②GASへ荷物を送っていない', s.nimotsu.length === 0);
  }

  /* ③ 受注登録の内容が足りない → 登録しない */
  {
    const s = sunaba({ pending: null, alertText: '⚠️ お客様名（発注元）を入力してください' });
    await s.run();
    const h = s.log.innerHTML;
    ok('③「登録していません」と出る', h.indexOf('⛔ <b>登録していません。</b>') >= 0);
    ok('③足りない理由を、そのまま見せる', h.indexOf('お客様名（発注元）を入力してください') >= 0);
    ok('③本当に登録していない', s.ashiato.indexOf('registerOrder') < 0);
  }

  /* ④ 在庫が足りない → 登録しない（モックの文言どおり） */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})],
      short: [{ name: 'オルガニック 100ml', need: 48, avail: 30 }] });
    await s.run();
    const h = s.log.innerHTML;
    ok('④「登録していません。在庫が足りません。」と出る',
       h.indexOf('⛔ <b>登録していません。</b>在庫が足りません。') >= 0);
    ok('④必要・販売可能・たりない本数が、モックの形で出る',
       h.indexOf('必要 48本 ／ 販売可能 30本（18本たりません）') >= 0,
       '（出た答え：' + h.replace(/<[^>]*>/g, ' ').slice(0, 200) + '）');
    ok('④本当に登録していない', s.ashiato.indexOf('registerOrder') < 0);
    ok('④「在庫を入れてから、もう一度押してください」と言う',
       h.indexOf('在庫を入れてから、もう一度押してください') >= 0);
  }

  /* ⑤ 登録はできたが、GASが「片方貼れていない」と返した → ★登録は取り消さない（モックで承認ずみ） */
  {
    const henji = { status: 'ok', mode: 'toroku', hareta: false,
      vretsu: [{ '文字': '📄 納品書（ひらく）', 'リンク': 'https://drive.test/n' }],
      order: { yukaKey: 'K-gas', yukaImport: { at: 't' }, nouhinDocNg: 'RTは【納品書と発注伝票の2つ】が要ります。いま貼れていないのは：発注伝票。PDFを保存できませんでした：発注伝票：x。もう一度［📄 同じ内容をもう一度送る］を押してください。' } };
    const s = sunaba({ pending: [chuumonTsukuru({})], henji: [henji] });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑤登録はできている', h.indexOf('✅ 登録しました') >= 0);
    ok('⑤★ここでも途中の工程（⏳）はのこらない', h.indexOf('⏳') < 0);
    ok('⑤貼れていないことを、はっきり出す（GASの文をそのまま）',
       h.indexOf('いま貼れていないのは：発注伝票') >= 0 && h.indexOf('PDFを保存できませんでした：発注伝票：x') >= 0);
    ok('⑤「同じ内容をもう一度送る」ボタンが出る', h.indexOf('rtIkkiOkuriNaoshi()') >= 0 && h.indexOf('📄 同じ内容をもう一度送る') >= 0);
    ok('⑤「登録は取り消していません」と書いてある',
       h.indexOf('登録は取り消していません') >= 0);
    ok('⑤取り消す処理が、どこにも無い',
       H.cut(SRC, 'rtIkkiGo').indexOf('cancelled') < 0,
       '（取り消すと、在庫とRT残高が二重に動きます）');
    ok('⑤カードにも残ると書いてある', h.indexOf('受注一覧のカードにも残ります') >= 0);
    ok('⑤注文にも理由が残る', s.chuumon[0].nouhinDocNg.indexOf('いま貼れていないのは：発注伝票') >= 0);
    /* 押し直すと、同じ荷物がもう一度行く */
    s.henji.push(OK_HENJI);
    await s.okuriNaoshi();
    ok('⑤押し直すと【同じ荷物】をもう一度送る（1文字も変えない）',
       s.nimotsu.length === 2 && JSON.stringify(s.nimotsu[0]) === JSON.stringify(s.nimotsu[1]));
    ok('⑤今度は貼れた', s.log.innerHTML.indexOf('2つとも貼りました') >= 0 && s.chuumon[0].nouhinDocNg === '');
  }

  /* ⑥ 返事が読めない（GASがエラー画面を返した） → 「届いたか分からない」＋同じ荷物をもう一度 */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})], henji: ['HTML', OK_HENJI] });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑥「発注書に届いたか、まだ分かりません」と出る', h.indexOf('発注書に届いたか、まだ分かりません') >= 0);
    ok('⑥「二重にはなりません」と書いてある', h.indexOf('二重にはなりません') >= 0);
    ok('⑥「同じ内容をもう一度送る」ボタンが出る', h.indexOf('rtIkkiOkuriNaoshi()') >= 0);
    ok('⑥手元の登録は残っている（カードに⚠が出る）', s.ordersLen() === 1 && s.chuumon[0].nouhinDocNg.indexOf('届いたか、まだ分かりません') >= 0);
    ok('⑥嘘をつかない（「登録しました」「貼りました」と言わない）', h.indexOf('✅ 登録しました') < 0 && h.indexOf('貼りました') < 0);
    await s.okuriNaoshi();
    ok('⑥押し直すと同じ荷物が行き、今度は「登録しました・2つとも貼りました」',
       s.nimotsu.length === 2 && JSON.stringify(s.nimotsu[0]) === JSON.stringify(s.nimotsu[1])
       && s.log.innerHTML.indexOf('✅ 登録しました') >= 0 && s.log.innerHTML.indexOf('2つとも貼りました') >= 0);
    const t = sunaba({ pending: [chuumonTsukuru({})], henji: ['NET'] });
    await t.run();
    ok('⑥通信そのものが失敗しても同じ道（落ちない・届いたか分からないと言う）', t.log.innerHTML.indexOf('発注書に届いたか、まだ分かりません') >= 0 && t.btn.disabled === false);
  }

  /* ⑦ ☑を押していないときは、何もしない（二重の守り） */
  {
    const s = sunaba({ chk: false, pending: [chuumonTsukuru({})] });
    await s.run();
    ok('⑦☑が無ければ、何も走らない', s.ashiato.length === 0 && s.nimotsu.length === 0);
  }

  /* ══════════════════════════════════════════════════════════════
     ⑧ 画面の作り（承認済みモックとの1対1）
     ══════════════════════════════════════════════════════════════ */
  {
    const ren = H.cut(SRC, 'renderRtPreview');
    ok('⑧ボタンの文字が、モックのまま',
       ren.indexOf('✅ この内容で登録して、発注書まで送る（書類2つも貼ります）') >= 0);
    ok('⑧はじめは押せない（灰色）', ren.indexOf('id="rt-ikki-btn" disabled') >= 0);
    ok('⑧白いボタン（今までどおり）も残っている',
       ren.indexOf('▶ 受注登録画面をひらいて入力する（今までどおり）') >= 0);
    ok('⑧白いボタンも、はじめは押せない', ren.indexOf('id="rt-go-btn" disabled') >= 0);
    ok('⑧☑で2つとも押せるようになる', ren.indexOf('rtKakuninChk(this.checked)') >= 0);
    /* ★2026-09-17 ひろみさん「スプシにリンクが現れるまで30秒ほどかかります、と
       　ボタンのすぐ近くに出しといてほしい。貼り付かないって、私も思っちゃったから」
       　実際にかかる時間は10秒ではなく30秒ほどでした。正直な数字に直しています。 */
    ok('⑧ボタンのすぐ近くに「30秒ほどかかります」と正直に書いてある',
       ren.indexOf('30秒ほどかかります') >= 0);
    ok('⑧何が30秒かかるのか（スプレッドシートにリンクが出るまで）が書いてある',
       ren.indexOf('スプレッドシートに 発注伝票・納品書のリンクが出るまで') >= 0);
    ok('⑧古い「10秒ほど」に戻っていない', ren.indexOf('10秒ほどかかります') < 0);
    ok('⑧結果の枠が、画面の作り直しで消えない場所にある',
       SRC.indexOf('<div id="rt-ikki-log"') >= 0 && ren.indexOf('rt-ikki-log') < 0,
       '（#rt-preview の中に置くと、作り直しで消えます）');
    const kak = H.cut(SRC, 'rtKakuninChk');
    ok('⑧☑を外すと、また押せなくなる', kak.indexOf('!on') >= 0);
    /* ★2026-09-17 ひろみさん「ボタンは青色で統一」 */
    ok('⑧押せるときのボタンは青（緑に戻っていない）',
       kak.indexOf('#2563eb') >= 0 && kak.indexOf('#4a5a2a') < 0,
       '（出た答え：' + kak.replace(/s+/g, ' ').slice(0, 200) + '）');
  }

  /* ══════════════════════════════════════════════════════════════
     ⑨ GASがはっきり断った → 手元の登録も取り下げる（何も書いていない）
     ══════════════════════════════════════════════════════════════ */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})], henji: [{ status: 'error', message: '発注書のファイルがありません' }, OK_HENJI] });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑨「発注書に送れませんでした」とGASの理由をそのまま出す',
       h.indexOf('発注書に送れませんでした') >= 0 && h.indexOf('GASの理由：「発注書のファイルがありません」') >= 0);
    ok('⑨「登録もしていません（在庫もRT残高も動いていません）」', h.indexOf('登録もしていません（在庫もRT残高も動いていません）') >= 0);
    ok('⑨手元の一覧からも取り下げている', s.ordersLen() === 0);
    ok('⑨「同じ内容をもう一度送る」ボタンが出る', h.indexOf('rtIkkiOkuriNaoshi()') >= 0);
    await s.okuriNaoshi();
    ok('⑨押し直して通ったら、手元の一覧に戻る', s.ordersLen() === 1 && s.log.innerHTML.indexOf('✅ 登録しました') >= 0);
  }

  /* ══════════════════════════════════════════════════════════════
     ⑩⑪ 登録済みの伝票を読み直したとき：行き止まりにしない（貼り直しの道）
     ══════════════════════════════════════════════════════════════ */
  {
    const mae = chuumonTsukuru({ id: 'o0', num: 'RT-20260916-7361', yukaKey: 'K0' });
    const s = sunaba({ chuumon: [mae], pending: [chuumonTsukuru({})], vretsu: {}, henji: [OK_HENJI] });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑩⛔のあとに、V列の状態（まだ／あり）を出す',
       h.indexOf('この注文の発注書のV列') >= 0 && h.indexOf('📄 納品書（まだ）') >= 0 && h.indexOf('📄 発注伝票（まだ）') >= 0);
    ok('⑩発注書を読み直してから言っている', s.vYonda.length === 1);
    ok('⑩［📄 この注文（RT-…）に、書類2つを貼り直す］が出る（文字はモックのまま）',
       h.indexOf('📄 この注文（RT-20260916-7361）に、書類2つを貼り直す') >= 0 && h.indexOf("rtIkkiHariNaoshi1('o0')") >= 0);
    ok('⑩「登録はしません（在庫もRT残高も動きません）」と書いてある', h.indexOf('登録はしません（在庫もRT残高も動きません）') >= 0);
    ok('⑩登録していない・荷物も送っていない', s.ashiato.indexOf('registerOrder') < 0 && s.nimotsu.length === 0);
    await s.hariNaoshi1('o0');
    ok('⑩貼り直しは【書類だけ】の荷物を1回（登録しない）',
       s.nimotsu.length === 1 && s.nimotsu[0].payload.mode === 'docsOnly' && s.nimotsu[0].payload.order.id === 'o0'
       && s.nimotsu[0].payload.docs.length === 2 && s.ashiato.indexOf('registerOrder') < 0);
    ok('⑩「今度は2つとも貼れました」と出る', s.log.innerHTML.indexOf('今度は2つとも貼れました') >= 0);
    ok('⑩「登録しました」とは言わない（登録していないので）', s.log.innerHTML.indexOf('✅ 登録しました') < 0);
  }
  {
    const mae = chuumonTsukuru({ id: 'o0', num: 'RT-20260916-7361', yukaKey: 'K0' });
    const s = sunaba({ chuumon: [mae], pending: [chuumonTsukuru({})],
      vretsu: { '📄 納品書（ひらく）': true, '📄 発注伝票（ひらく）': true } });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑪2つとも入っているときは「📌 もう貼れています」', h.indexOf('📌 もう貼れています') >= 0);
    ok('⑪貼り直すボタンは出ない', h.indexOf('rtIkkiHariNaoshi1(') < 0);
  }

  /* ⑫ 納品書のPDFが作れない → 登録しない（作れないまま送らない） */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})], pdfNg: true });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑫「登録していません。納品書のPDFを作れませんでした」', h.indexOf('⛔ <b>登録していません。</b>納品書のPDFを作れませんでした') >= 0);
    ok('⑫登録も荷物も無し', s.ashiato.indexOf('registerOrder(rtIkki)') < 0 && s.nimotsu.length === 0);
  }

  /* ══════════════════════════════════════════════════════════════
     ⑬ 作り（文字でも確かめる・ひろみさん「今書いてあるものは何も消さない」）
     ══════════════════════════════════════════════════════════════ */
  {
    const go = H.cut(SRC, 'rtIkkiGo');
    ok('⑬1往復のスイッチ RT_IKKI_1OUFUKU が true', /var RT_IKKI_1OUFUKU = true;/.test(SRC));
    ok('⑬rtIkkiGo は RT_IKKI_1OUFUKU で rtIkki1Oufuku_ へ', go.indexOf('if(RT_IKKI_1OUFUKU)') >= 0 && go.indexOf('rtIkki1Oufuku_(list)') >= 0);
    ok('⑬今までの道（⑥⑦⑧）は消していない（false にすれば戻れる）',
       go.indexOf('docFudaMachi(toroku[i])') >= 0 && go.indexOf('rtAttachDocsToOrder(toroku[j])') >= 0);
    const reg = H.cut(SRC, 'registerOrder');
    ok('⑬registerOrder は opt.rtIkki のとき保存しない（全消し→書き直しを通らない）', reg.indexOf("opt.rtIkki ? Promise.resolve() : syncOrdersToGAS(list)") >= 0);
    ok('⑬registerOrder は opt.rtIkki のとき発注書へ送らない（oosRtIkki が入れる）', reg.indexOf("!opt.rtIkki){") >= 0);
    const yk = H.cut(SRC, 'yukaImportOne');
    ok('⑬yukaImportOne は opt.bodyDake で中身だけ返す（作り方は1か所のまま）',
       yk.indexOf('if(opt.bodyDake) return JSON.parse(_body).order;') >= 0 && yk.indexOf("opt.bodyDake ? null : await fetchOrderFresh(id)") >= 0);
    ok('⑬GASの窓口は rtIkki（1回の荷物）', H.cut(SRC, 'rtIkki1Oufuku_').indexOf("action:'rtIkki'") >= 0);
  }

  if (fail) {
    console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
    fails.forEach(x => console.log(x));
    process.exitCode = 1;
  } else {
    console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
  }
})();
