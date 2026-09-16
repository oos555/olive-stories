/* ══════════════════════════════════════════════════════════════════════
   📤 入金チェック済みの売上を、スプシへ移す
   2026-09-16　ひろみさん指示

   ★ひろみさんの言葉
     「売上一覧は、今後どんどん増えていくから、ずっとここに載ってると
     　どんどん重たいデータになっていくんじゃないかな。
     　**入金済みでチェックが終わったものは、ここから消して、
     　スプレッドシートに載っていってほしい**」
     「**全部データが消えるのは困る**ので、最終的にスプレッドシートに
     　入金されてチェックが終わったものが載っていってれば、
     　入金が間違いなく行われたっていうチェックができる」
     「本部管理専用ゆかスプシに『入金チェック済み売上一覧表』というタブで」
     「バサラとホテル（RT）は入金チェックをしないので、**2か月経ったら**移す。
     　バサラは『バサラはスプシで完結』、RTは『RT管理はまとめ別で確認』と書いて」

   ★いちばん大事な見張り（⑤）
     **受注のデータを消してはいけません。** 消すのは売上一覧の【表示】だけ。
     注文には salesArchivedAt（移した日）の印が付くだけです。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'billing.html'), 'utf8');
const GASJS = (function(){
  const p = path.join(LIVE, '..', 'olive-stories-gas', 'コード.js');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;   /* 手元に無ければ、その分は飛ばす */
})();

const title = '📤 入金チェック済みの売上をスプシへ移す（2026-09-16）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function eq(name, got, want){
  ok(name, got === want, '（出た答え：' + JSON.stringify(got) + '／ほしい答え：' + JSON.stringify(want) + '）');
}

/* ── 本物の関数を動かす砂場 ── */
function sunaba(orders){
  const ctx = vm.createContext({
    console: console, Math: Math, Number: Number, String: String, Object: Object,
    Array: Array, Date: Date, isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
    orders: orders,
    monthlyClients: [{ company: '株式会社まとめ卸' }],
    CUSTOMER_TYPE_LABEL: { general:'定価', rt:'RT', basara:'卸バサラスター', wholesale1:'卸①' },
    orderAmount: function(o){ return Number(o.__kingaku || 0); },
    document: { getElementById: function(){ return null; } }
  });
  ctx.window = ctx; ctx.globalThis = ctx;
  /* ★決めごとの親を、砂場にかならず入れます（入れ忘れると本物とちがう動きで通ります） */
  vm.runInContext(fs.readFileSync(path.join(LIVE, 'oos-kakaku.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(LIVE, 'oos-hizuke.js'), 'utf8'), ctx);
  ['salesWasSentToWarehouse','salesExcludeReason','isSalesListTarget',
   'isBasaraOrder','isMonthlyConsolidated','orderEffectivePaid',
   'uriageTsukiKeika','uriageIkouBiko','uriageIkouTaishou','uriageIkouGyou']
    .forEach(function(n){ vm.runInContext(H.cut(SRC, n), ctx); });
  vm.runInContext(SRC.match(/var URIAGE_IKOU_TSUKI = [^\n]*\n/)[0], ctx);
  return ctx;
}
function mukashi(tsuki){   /* ◯か月前の日付（yyyy-MM-dd） */
  const d = new Date(); d.setMonth(d.getMonth() - tsuki);
  return d.toISOString().slice(0, 10);
}
function chuumon(x){
  return Object.assign({ id:'o'+Math.random(), num:'TK-1', client:'あるお客様',
    customerType:'general', paymentMode:'postpay', status:'shipped', notified:true,
    registeredAt: mukashi(0), __kingaku: 10000 }, x);
}

/* ══════════════════════════════════════════════════════════════
   ① ふつうの受注：入金チェックが済んだら移す／済んでいなければ移さない
   ══════════════════════════════════════════════════════════════ */
{
  const ctx = sunaba([]);
  function biko(o){ ctx.__o = o; return vm.runInContext('uriageIkouBiko(__o)', ctx); }
  eq('①入金✓が付いたら移す', biko(chuumon({ paymentConfirmed:true })), '入金確認済み');
  eq('①先払いも移す',         biko(chuumon({ paymentMode:'prepay' })), '入金確認済み');
  eq('①未入金は移さない',     biko(chuumon({ paymentConfirmed:false })), '');
  eq('①もう移したものは、もう一度移さない',
     biko(chuumon({ paymentConfirmed:true, salesArchivedAt:'2026-09-01' })), '');
  eq('①まだ倉庫へ送っていないものは触らない',
     biko(chuumon({ paymentConfirmed:true, notified:false, status:'' })), '');
  eq('①取り置きは触らない',   biko(chuumon({ paymentConfirmed:true, status:'held' })), '');
  eq('①キャンセルは触らない', biko(chuumon({ paymentConfirmed:true, status:'cancelled' })), '');
}

/* ══════════════════════════════════════════════════════════════
   ② バサラ・RT・卸まとめ先：入金✓は付かない。2か月たったら移す
   ══════════════════════════════════════════════════════════════ */
{
  const ctx = sunaba([]);
  function biko(o){ ctx.__o = o; return vm.runInContext('uriageIkouBiko(__o)', ctx); }
  eq('②バサラ・2か月たっていない → 移さない',
     biko(chuumon({ customerType:'basara', num:'BA-1', registeredAt: mukashi(1) })), '');
  eq('②バサラ・2か月たった → 「バサラはスプシで完結」',
     biko(chuumon({ customerType:'basara', num:'BA-1', registeredAt: mukashi(3) })), 'バサラはスプシで完結');
  eq('②RT・2か月たっていない → 移さない',
     biko(chuumon({ customerType:'rt', num:'RT-1', registeredAt: mukashi(1) })), '');
  eq('②RT・2か月たった → 「RT管理はまとめ別で確認」',
     biko(chuumon({ customerType:'rt', num:'RT-1', registeredAt: mukashi(3) })), 'RT管理はまとめ別で確認');
  eq('②卸まとめ先・2か月たった → 「卸まとめ別で確認」',
     biko(chuumon({ client:'株式会社まとめ卸', customerType:'wholesale1', registeredAt: mukashi(3) })), '卸まとめ別で確認');
  ok('②2か月の境目は、ちょうど2か月たったら移す',
     vm.runInContext('uriageTsukiKeika("' + mukashi(2) + '", 2)', ctx) === true);
  ok('②1か月11日では、まだ移さない',
     vm.runInContext('uriageTsukiKeika("' + mukashi(1) + '", 2)', ctx) === false);
  /* ★スプシを通ると、日付は "2026-09-13T15:00:00.000Z" のような時刻つきに化けます。
     　自分で先頭10文字を切る書き方だと、ここで形が合わず【いつまでも移らない】。 */
  {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    ok('②時刻つきの日付（スプシを通った形）でも、ちゃんと2か月たったと分かる',
       vm.runInContext('uriageTsukiKeika("' + d.toISOString() + '", 2)', ctx) === true,
       '（先頭10文字を切る書き方だと、ここで落ちます）');
  }
  ok('②日付が読めないものは移さない（安全側）',
     vm.runInContext('uriageTsukiKeika("", 2)', ctx) === false
     && vm.runInContext('uriageTsukiKeika("2026/09/01", 2)', ctx) === false);
  eq('②ひろみさんの決めた月数は2か月', vm.runInContext('URIAGE_IKOU_TSUKI', ctx), 2);
}

/* ══════════════════════════════════════════════════════════════
   ③ 移したものは、売上一覧に出さない（でも消えてはいない）
   ══════════════════════════════════════════════════════════════ */
{
  const ctx = sunaba([]);
  ctx.__a = chuumon({ num:'TK-A', paymentConfirmed:true });
  ctx.__b = chuumon({ num:'TK-B', paymentConfirmed:true, salesArchivedAt:'2026-09-16' });
  ok('③移していないものは、売上一覧に出る', vm.runInContext('isSalesListTarget(__a)', ctx) === true);
  ok('③移したものは、売上一覧に出ない',     vm.runInContext('isSalesListTarget(__b)', ctx) === false);
  eq('③出さない理由は「スプシへ移した」',   vm.runInContext('salesExcludeReason(__b)', ctx), 'archived');
  ok('③理由の一覧に「スプシへ移した」の説明がある',
     SRC.indexOf('📤 スプシへ移した') >= 0);
}

/* ══════════════════════════════════════════════════════════════
   ④ スプシへ送る1行の中身
   ══════════════════════════════════════════════════════════════ */
{
  const ctx = sunaba([]);
  ctx.__o = chuumon({ num:'TK-20260916-1', client:'会社名', recipientName:'お届け先さま',
                      paymentConfirmed:true, paidAt:'2026-09-10T02:03:04.000Z',
                      billingNote:'9/10 振込確認', __kingaku: 123456, registeredAt:'2026-08-01' });
  const g = vm.runInContext('uriageIkouGyou(__o)', ctx);
  eq('④注文番号', g.num, 'TK-20260916-1');
  eq('④お客様は、お届け先の名前', g.client, 'お届け先さま');
  eq('④受注日', g.date, '2026-08-01');
  eq('④金額（税込）', g.kingaku, 123456);
  eq('④入金', g.nyukin, '済');
  eq('④入金日', g.nyukinDate, '2026-09-10');
  eq('④対応状況メモ', g.memo, '9/10 振込確認');
  eq('④備考', g.biko, '入金確認済み');
}

/* ══════════════════════════════════════════════════════════════
   ⑤ ★受注のデータを消していないこと（いちばん大事）
   ══════════════════════════════════════════════════════════════ */
{
  const go = H.cut(SRC, 'uriageIkouGo');
  ok('⑤注文を配列から取りのぞく書き方が無い',
     go.indexOf('.splice(') < 0 && go.indexOf('delete ') < 0,
     '（受注のデータを消してはいけません。印を付けるだけです）');
  ok('⑤やっているのは「印を付ける」だけ', go.indexOf('salesArchivedAt = ') >= 0);
  ok('⑤スプシに書けたことを確かめてから、印を付けている',
     go.indexOf("action:'oosUriageIkou'") >= 0
     && go.indexOf("action:'oosUriageIkou'") < go.indexOf('salesArchivedAt = '),
     '（先に印を付けると、スプシに無いのに一覧から消えます）');
  ok('⑤スプシに書けなかったら「何も移していません」と言って、印を付けずにやめる',
     go.indexOf('何も移していません') >= 0
     && go.indexOf('何も移していません') < go.indexOf('salesArchivedAt = '));
  ok('⑤押す前に、かならず確かめる', go.indexOf('confirm(') >= 0);
  ok('⑤二重押しを止めている', go.indexOf('_uriageIkouChu') >= 0);
}

/* ══════════════════════════════════════════════════════════════
   ⑥ GAS側（手元にあるときだけ）：置き場所とタブの名前
   ══════════════════════════════════════════════════════════════ */
if (GASJS) {
  ok('⑥タブの名前は「入金チェック済み売上一覧表」',
     GASJS.indexOf("OOS_URIAGE_SUMI_SHEET = '入金チェック済み売上一覧表'") >= 0);
  ok('⑥置き場所は【本部管理専用ゆかスプシ】',
     /function oosUriageSumiSheet_\(\)[\s\S]{0,200}oosKanriFile_\(\)/.test(GASJS),
     '（ほかのファイルに作ると、倉庫さんから見えてしまいます）');
  ok('⑥同じ注文番号を二度書かない',
     GASJS.indexOf('oosUriageSumiAru_') >= 0);
  ok('⑥見出しの並びが決めたとおり',
     GASJS.indexOf("['注文番号','お客様','受注日','区分','支払方法','金額（税込）',") >= 0);
  /* 窓口（doPost / doGet）がつながっているか。
     名前が【2回以上】出てくること＝「受け口」と「中身」の両方がある、という見方です
     （書き方そのものを文字で決めうちにしないため）。 */
  ok('⑥窓口（doPost）がつながっている',
     (GASJS.match(/oosUriageIkou/g) || []).length >= 2,
     '（受け口か中身のどちらかがありません）');
  ok('⑥読むだけの点検窓口がある',
     (GASJS.match(/oosUriageSumiCheck/g) || []).length >= 2);
} else {
  console.log('        （GASのコード.js が手元に無いので、⑥は飛ばしました）');
}

/* ══════════════════════════════════════════════════════════════
   ⑦ ★★ いちばん危ないところ ★★
      「移したものは運ばない（sumiNuki）」で読んだ注文を、そのまま保存しない。
      saveOrders は受注データを【まるごと書き直す】ので、
      運ばれてこなかった注文が【本当に消えます】。
      → 画面を出すときの1回だけ sumiNuki を付ける。保存の前は必ず全部読む。
   ══════════════════════════════════════════════════════════════ */
{
  const SRC0 = SRC.replace(/\/\*[\s\S]*?\*\//g, '');   /* 説明文は数えない */
  const tsuki = (SRC0.match(/action=loadAll&sumiNuki=1/g) || []).length;
  const zenbu = (SRC0.match(/action=loadAll(?!&)/g) || []).length;
  eq('⑦sumiNuki を付けて読むのは、画面を出すときの1回だけ', tsuki, 1);
  ok('⑦保存の前に読むところは、ぜんぶ sumiNuki 無し（全部読む）', zenbu >= 4,
     '（いま ' + zenbu + ' か所。1か所でも sumiNuki が混ざると、受注データが消えます）');
  /* 保存している関数のなかに、sumiNuki 付きの読み込みが1つも無いこと */
  ['setOrderPaid','uriageIkouGo'].forEach(function(n){
    const fn = H.cut(SRC, n).replace(/\/\*[\s\S]*?\*\//g, '');
    ok('⑦' + n + ' は、保存の前に【全部】読んでいる', fn.indexOf('sumiNuki') < 0,
       '（ここで sumiNuki を使うと、運ばれてこなかった注文が消えます）');
    ok('⑦' + n + ' は、読み直してから保存している',
       fn.indexOf('action=loadAll') >= 0 && fn.indexOf('action=loadAll') < fn.indexOf("action:'saveOrders'"));
  });
  if (GASJS) {
    ok('⑦GAS側は、合図があるときだけ抜く',
       /function loadAll\(sumiNuki\)/.test(GASJS));
    ok('⑦GAS側は、抜いた件数を教えてくれる', GASJS.indexOf('sumiNuita') >= 0);
    ok('⑦合図が無ければ、今までどおり全部返す',
       /if\(!sumiNuki\) return true;/.test(GASJS));
  }
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
