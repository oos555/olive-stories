/* ══════════════════════════════════════════════════════════════════════
   ✅ RT：この内容で登録して、発注書まで送る（1つのボタン）
   2026-09-17　ひろみさん承認ずみ
   承認済みモック：デスクトップ/システム開発用おわるまで捨てないで/
   　　　　　　　　mock_RT登録まで一気に_2026-09-17.html

   ★ひろみさんの言葉
     「RTはもう登録が終わってるわけだよね。伝票を取り込んで納品書を作ってるときに、
     　もうそこからアプリの中で**登録が済ませられる状態**なわけだから、
     　**人が打ち込むよりも正しい状態**で。
     　**納品書が作り終わって確認した段階から、すぐにスプレッドシートに情報を移していく**
     　っていう流れでいいんじゃないかな。**でも必ず書類のリンクは貼るように**」

   ★この見張りは、本物の rtIkkiGo をそのまま動かして、
     モックに描いた文言・止まり方・順番のとおりかを見ます。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '✅ RT：登録して発注書まで送る1つのボタン（2026-09-17）';
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
  const chuumon = opt.chuumon || [];
  const ctx = vm.createContext({
    console: console, Math: Math, Number: Number, String: String, Object: Object,
    Array: Array, Date: Date, parseInt: parseInt, isNaN: isNaN,
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
    /* ↓ この見張りが見るのは rtIkkiGo の段取りなので、まわりは作り物にします */
    applyRtToOrderForm: function(nokoru){ ashiato.push('applyRtToOrderForm(' + (nokoru ? 'true' : '') + ')'); },
    previewOrder: function(){ ashiato.push('previewOrder'); ctx.window._pendingOrders = opt.pending || null; },
    /* ★2026-09-24 在庫を見る前に、いちばん新しい在庫を読み直します（開いたままの画面の在庫が古いため） */
    zaikoYomiNaosu: async function(){ ashiato.push('zaikoYomiNaosu'); return true; },
    checkStockShortage: function(){ ashiato.push('checkStockShortage'); return opt.short || []; },
    docKakuninSuru: function(o, mei){ ashiato.push('docKakuninSuru:' + mei); },
    registerOrder: function(){
      ashiato.push('registerOrder');
      (opt.pending || []).forEach(function(o){ if (chuumon.indexOf(o) < 0) chuumon.push(o); });
    },
    docFudaMachi: async function(o){ ashiato.push('docFudaMachi'); if (opt.fuda !== false) o.yukaKey = 'K-test'; },
    rtAttachDocsToOrder: async function(o){ ashiato.push('rtAttachDocsToOrder'); o.nouhinDocNg = opt.hariNg || ''; }
  });
  ctx.window = ctx; ctx.globalThis = ctx;
  /* ★決めごとの親は5つとも【本物】を入れます（作り物にすると、本物とちがう動きで通ります）。
     　とくに OOS_NOUHIN.shoruiList は「RT発注伝票＋納品書」をどう数えるかの親です。
     　見張り：tests/test_mihari_soten.js の ⑥ */
  ['oos-zei.js', 'oos-kakaku.js', 'oos-shorui-kimari.js', 'oos-doc.js', 'oos-nouhin.js']
    .forEach(function(f){ vm.runInContext(fs.readFileSync(path.join(LIVE, f), 'utf8'), ctx); });
  ['rtIkkiLog','rtIkkiWaku','rtIkkiEgaku','rtIkkiClear','rtIkkiSay','rtIkkiIma','rtIkkiNijuu','rtIkkiGo','rtIkkiHariNaosu']
    .forEach(function(n){ vm.runInContext(H.cut(SRC, n), ctx); });
  vm.runInContext('var rtIkkiChu = false; var _rtIkkiKekka = ""; var _rtIkkiIma = "";', ctx);
  return { ctx: ctx, log: log, btn: btn, ashiato: ashiato, chuumon: chuumon,
           run: function(){ return vm.runInContext('rtIkkiGo()', ctx); } };
}
function chuumonTsukuru(x){
  return Object.assign({ id: 'o1', num: 'RT-20260917-0412', status: 'pending',
    note: 'RT伝票取込 ／ 伝票番号 380498', yukaKey: '',
    enclosedDoc: 'RT発注伝票＋納品書', customerType: 'rt' }, x);
}

/* 非同期なので、まとめて動かします */
(async function(){
  /* ① うまくいったとき */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})] });
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
    ok('①順番どおりに走っている（入れる→確認→在庫を読み直す→在庫→登録→ふだ→貼る）',
       s.ashiato.join(',').indexOf('applyRtToOrderForm(true),previewOrder,zaikoYomiNaosu,checkStockShortage') >= 0
       && s.ashiato.indexOf('registerOrder') < s.ashiato.indexOf('rtAttachDocsToOrder'),
       '（出た足あと：' + s.ashiato.join(' → ') + '）');
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

  /* ⑤ 書類が貼れなかった → ★登録は取り消さない（モックで承認ずみ） */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})],
      hariNg: 'RTは【納品書と発注伝票の2つ】が要ります。いま貼れていないのは：発注伝票。' });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑤登録はできている', h.indexOf('✅ 登録しました') >= 0);
    ok('⑤発注書に送ったあとで、貼りに行っている',
       s.ashiato.indexOf('docFudaMachi') < s.ashiato.indexOf('rtAttachDocsToOrder'),
       '（出た足あと：' + s.ashiato.join(' → ') + '）');
    ok('⑤★ここでも途中の工程（⏳）はのこらない', h.indexOf('⏳') < 0);
    ok('⑤貼れていないことを、はっきり出す',
       h.indexOf('いま貼れていないのは：発注伝票') >= 0);
    ok('⑤「書類を貼り直す」ボタンが出る', h.indexOf('rtIkkiHariNaosu()') >= 0);
    ok('⑤「登録は取り消していません」と書いてある',
       h.indexOf('登録は取り消していません') >= 0);
    ok('⑤取り消す処理が、どこにも無い',
       H.cut(SRC, 'rtIkkiGo').indexOf('cancelled') < 0,
       '（取り消すと、在庫とRT残高が二重に動きます）');
    ok('⑤カードにも残ると書いてある', h.indexOf('受注一覧のカードにも残ります') >= 0);
  }

  /* ⑥ 発注書に行ができなかった → 貼りに行かない */
  {
    const s = sunaba({ pending: [chuumonTsukuru({})], fuda: false });
    await s.run();
    const h = s.log.innerHTML;
    ok('⑥発注書に入っていないことを出す', h.indexOf('発注書にまだ入っていません') >= 0);
    ok('⑥貼りに行かない', s.ashiato.indexOf('rtAttachDocsToOrder') < 0);
  }

  /* ⑦ ☑を押していないときは、何もしない（二重の守り） */
  {
    const s = sunaba({ chk: false, pending: [chuumonTsukuru({})] });
    await s.run();
    ok('⑦☑が無ければ、何も走らない', s.ashiato.length === 0);
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

  if (fail) {
    console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
    fails.forEach(x => console.log(x));
    process.exitCode = 1;
  } else {
    console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
  }
})();
