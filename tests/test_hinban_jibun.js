/* ══════════════════════════════════════════════════════════════════════
   ✏️ 名簿の品番を「自動」でも「自分で決める」でもよい　2026-10-29 ひろみさん指示
   承認済みモック: mocks/mock_master_名簿_品番を自分で決める_2026-10-29.html

   ひろみさんの言葉：
     「Your Story みたいなギフトボックスは最初に YS100 とかつけてから、その下に管理番号を作りたい。
       自動でつける場合と手動にする場合と両方選べるように。あるいは自動で作ってもらって、
       それを手直しして上から自分が好きな数字にもできるように」

   ★決まったこと
     ① 新規のときだけ「✏️ 自分で決める」「🔄 自動にもどす」が出る。
        いまある商品の品番は今までどおり直せない（注文・在庫・価格が品番でつながっているため）。
        お知らせから「名簿に入れる →」で品番が先に決まって開いたときも、ボタンは出ない。
     ② 自動の付け方（mbNextSku）は1文字も変えない。
     ③ 商品管理番号の作り方（mbKanriFrom）も変えない。品番が何であっても同じ計算。
     ④ 打った字は 大文字の英数字とハイフン だけにそろえる（全角→半角）。
     ⑤ 保存で止めるもの：空／すでに名簿か価格リストにある品番／
        種類が箱・紙袋・備品なのに頭が BOX-／BAG-／MISC- でないもの。
        自分で決めたときは、自動の「付け直しました」はしない。
     ⑥ 保存の形は増やさない。GASの変更なし。

   ★本物の関数（meiboEditRowHtml・mbKindChanged・meiboSaveRow・meiboStartNew …）を
     そのまま切り出して動かします。テスト用に書き直した別物ではありません。
   ★このファイルを消さないでください。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const { read, cut, cutVar, makeSandbox } = require('./harness');
const M = read('master.html');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}

/* ── 画面のにせもの（id ごとに value を持つだけ） ─────────────────── */
const els = {};
function el(id){
  if(!els[id]) els[id] = { value:'', textContent:'', style:{}, options:[], selectedOptions:[{ textContent:'📦 箱・ギフトボックス' }],
                           readOnly:true, placeholder:'', checked:false, focus(){} };
  return els[id];
}
const alerts = [];
let fetched = 0;
const { ctx } = makeSandbox({
  document: { getElementById: el, querySelectorAll(){ return []; } },
  alert(msg){ alerts.push(String(msg)); },
  fetch(){ fetched++; return Promise.resolve({ json(){ return Promise.resolve({ status:'ok' }); } }); },
  PRODUCTS: [ { sku:'ORG500', name:'オルガニック 500ml' }, { sku:'YS100', name:'your story' }, { sku:'BOX-001' }, { sku:'SET-002' } ],
  priceMaster: [ { sku:'OIL-003' } ],
  lots: [], invLoading: false,
  esc(s){ return String(s == null ? '' : s); },
  mGroupOrder(){ return ['セット', '備品-箱']; },
  OOS_TANI_ERABU: ['本', '個'],
  compsOf(){ return []; }, kouseiRowHtml(){ return ''; }, mkCollectKousei(){ return []; },
  containerFor(){ return ''; }, shipUnitOf(){ return ''; }, originOf(){ return ''; }, farmOf(){ return ''; },
  meiboBarcode(){ return ''; }, meiboPageUrl(){ return ''; }, storesHinbanOf(){ return ''; }, taniOf(){ return ''; }, meiboFieldOf(){ return ''; },
  mbPreviewKanri(){}, mbToggleOilFields(){}, meiboClearDraft(){}, renderMeibo(){},
  meiboAddingNew: false, meiboEditingSku: null, meiboEditMode: true
});
const src = [
  cutVar(M, 'meiboNewSkuPrefill'), cutVar(M, 'mbSkuManual'), cutVar(M, 'MB_BIHIN_HEAD'),
  cutVar(M, 'MB_KINDS'), cutVar(M, 'MB_KIND_GROUP'), cutVar(M, 'MB_FIXED'),
  cut(M, 'mbFixedLeft'), cut(M, 'mbUsedSkus'), cut(M, 'mbNextSku'), cut(M, 'mbShowOilFields'),
  cut(M, 'mbKindChanged'), cut(M, 'mbOilSkuChanged'),
  cut(M, 'mbSkuManualOn'), cut(M, 'mbSkuAutoBack'), cut(M, 'mbSkuNormalize'), cut(M, 'mbSkuTyped'),
  cut(M, 'mbSkuManualProblem'), cut(M, 'mbSkuCheck'),
  cut(M, 'mbBarcodeOfSku'), cut(M, 'mbIsGiftSet'), cut(M, 'mbIsBihin'), cut(M, 'mbSetTailsFrom'), cut(M, 'mbSetKanriFrom'), cut(M, 'mbKanriFrom'),
  cut(M, 'meiboMainLot'), cut(M, 'meiboEditRowHtml'), cut(M, 'meiboStartNew'), cut(M, 'meiboSaveRow')
].join('\n');
vm.runInContext(src, ctx);
const run = (code) => vm.runInContext(code, ctx);

/* ── ① 画面：新規のときだけボタンが出る（本物の meiboEditRowHtml を動かす） ── */
run("meiboAddingNew = true; meiboNewSkuPrefill = '';");
const htmlNew = run("meiboEditRowHtml(null, {})");
ok('①新規：「✏️ 自分で決める」ボタンが出る', htmlNew.indexOf('✏️ 自分で決める</button>') >= 0);
ok('①新規：「🔄 自動にもどす」ボタンが出る（最初はかくれている）', /id="mp-sku-auto-btn"[^>]*style="display:none"/.test(htmlNew));
ok('①新規：品番欄は最初 readonly（🅰自動）', /id="mp-sku" value="" readonly/.test(htmlNew));
ok('①新規：「※いまは🅰自動です」', htmlNew.indexOf('※いまは🅰自動です') >= 0);
ok('①新規：種類のラベルはモックの文言', htmlNew.indexOf('種類　※🅰自動のときは、これで品番が付きます') >= 0);
ok('①新規：（🅱自分で決めるときは、種類は選んでも選ばなくてもよい…）の案内', htmlNew.indexOf('（🅱自分で決めるときは、種類は選んでも選ばなくてもよい。区分を合わせたいときだけ選ぶ）') >= 0);
ok('①新規：「品番は、いちど保存すると あとから変えられません。」の注意', htmlNew.indexOf('品番は、いちど保存すると あとから変えられません。') >= 0);
ok('①新規：品番の頭のきまりに「自分で決めるとき（例 ギフトセット YS100）」の行', htmlNew.indexOf('自分で決めるとき（例 ギフトセット <b>YS100</b>）') >= 0);

run("meiboAddingNew = false;");
const htmlEdit = run("meiboEditRowHtml({ sku:'ORG500', name:'オルガニック 500ml', group:'オルガニック' }, {})");
ok('①直す：ボタンは出ない', htmlEdit.indexOf('✏️ 自分で決める</button>') < 0 && htmlEdit.indexOf('🔄 自動にもどす</button>') < 0);
ok('①直す：説明は今までどおり「品番（sku）だけ自動でつきます。」（ボタンの無い画面で「押すと書けます」と言わない）', htmlEdit.indexOf('品番（sku）だけ自動でつきます。') >= 0 && htmlEdit.indexOf('押すと書けます') < 0);
ok('①直す：品番欄は今までどおり「※自動でつきます・手では直せません」で readonly',
  htmlEdit.indexOf('品番（sku）　※自動でつきます・手では直せません</label><input type="text" id="mp-sku" value="ORG500" readonly') >= 0);
ok('①直す：あとから変えられませんの注意は出ない（直す画面には要らない）', htmlEdit.indexOf('品番は、いちど保存すると') < 0);

run("meiboAddingNew = true; meiboNewSkuPrefill = 'OIL-003';");
const htmlPre = run("meiboEditRowHtml(null, {})");
ok('①お知らせから品番つきで開いたとき：ボタンは出ない（品番は先に決まっている）', htmlPre.indexOf('✏️ 自分で決める</button>') < 0 && htmlPre.indexOf('押すと書けます') < 0);
ok('①お知らせから品番つきで開いたとき：品番は OIL-003 で readonly', /id="mp-sku" value="OIL-003" readonly/.test(htmlPre));

/* ── ② 自動の付け方は変わらない ───────────────────────────────── */
ok('②自動：BOX は BOX-002（BOX-001 のつぎ）', run("mbNextSku('BOX')") === 'BOX-002');
ok('②自動：SET は SET-003', run("mbNextSku('SET')") === 'SET-003');
ok('②自動：OIL（単発）は OIL-004（価格リストの OIL-003 も見る）', run("mbNextSku('OIL')") === 'OIL-004');
ok('②自動：ETC は ETC-001', run("mbNextSku('ETC')") === 'ETC-001');

/* ── ④ 打った字をそろえる ─────────────────────────────────────── */
ok('④小文字 → 大文字', run("mbSkuNormalize('ys100')") === 'YS100');
ok('④全角 → 半角', run("mbSkuNormalize('ＹＳ１００')") === 'YS100');
ok('④スペース・記号は消える', run("mbSkuNormalize('ys 100/a')") === 'YS100A');
ok('④全角ハイフン → 半角', run("mbSkuNormalize('ARM－SET1')") === 'ARM-SET1');
run("mbSkuManual = true; document.getElementById('mp-sku').value = 'ｙｓ３００'; mbSkuTyped();");
ok('④欄に打った瞬間にそろう（ｙｓ３００ → YS300）', el('mp-sku').value === 'YS300');

/* ── 種類を変えても、自分で決めた品番を上書きしない（本物の mbKindChanged） ── */
run("mbSkuManual = true; document.getElementById('mp-sku').value = 'YS300'; document.getElementById('mp-kind').value = 'BOX'; mbKindChanged();");
ok('🅱自分で決めているあいだは、種類を変えても品番は YS300 のまま', el('mp-sku').value === 'YS300');
ok('🅱そのときオイルの3文字欄はかくれる', el('mp-oilsku').style.display === 'none');
run("mbSkuManual = false; mbKindChanged();");
ok('🅰自動にもどすと、種類（箱）から BOX-002 が付く', el('mp-sku').value === 'BOX-002');
run("mbSkuManual = true; document.getElementById('mp-sku').value = 'YS300'; document.getElementById('mp-oil3').value='ARM'; document.getElementById('mp-oilsize').value='500'; mbOilSkuChanged();");
ok('🅱自分で決めているあいだは、3文字＋サイズでも上書きしない', el('mp-sku').value === 'YS300');

/* ── 「✏️ 自分で決める」「🔄 自動にもどす」のボタンの動き ─────────── */
run("mbSkuManual = false; document.getElementById('mp-sku').readOnly = true; mbSkuManualOn();");
ok('✏️ 押すと欄が書ける（readonly が外れる）', el('mp-sku').readOnly === false && run('mbSkuManual') === true);
ok('✏️ 押すと「※いまは🅱自分で決めています…」', el('mp-sku-mode').textContent === '※いまは🅱自分で決めています（自動で付いた番号も上から書き直せます）');
ok('✏️ 押すと欄の例は「例：YS100」', el('mp-sku').placeholder === '例：YS100');
run("document.getElementById('mp-kind').value = 'SET'; mbSkuAutoBack();");
ok('🔄 押すと欄は readonly に戻り、種類（セット）から SET-003 が付く', el('mp-sku').readOnly === true && el('mp-sku').value === 'SET-003');
ok('🔄 押すと「※いまは🅰自動です」', el('mp-sku-mode').textContent === '※いまは🅰自動です');

/* ── ⑤ 止める／通す（本物の mbSkuManualProblem） ─────────────────── */
run("document.getElementById('mp-kind').value = ''");
ok('⑤空は止める', run("mbSkuManualProblem('')").indexOf('品番を入れてください') === 0);
ok('⑤名簿にある品番（YS100）は止める', run("mbSkuManualProblem('YS100')").indexOf('すでに使われています') > 0);
ok('⑤小文字で打っても重複を見つける（ys100）', run("mbSkuManualProblem('ys100')").indexOf('すでに使われています') > 0);
ok('⑤価格リストにある品番（OIL-003）も止める', run("mbSkuManualProblem('OIL-003')").indexOf('すでに使われています') > 0);
ok('⑤新しい品番（GFT002）は通す', run("mbSkuManualProblem('GFT002')") === '');
ok('⑤種類なしで YS200 は通す', run("mbSkuManualProblem('YS200')") === '');
run("document.getElementById('mp-kind').value = 'BOX'");
ok('⑤種類が箱なのに頭が BOX- でない（GB01）は止める', run("mbSkuManualProblem('GB01')").indexOf('頭を「BOX-」') > 0);
ok('⑤種類が箱で BOX-GIFT1 は通す', run("mbSkuManualProblem('BOX-GIFT1')") === '');
run("document.getElementById('mp-kind').value = 'BAG'");
ok('⑤種類が紙袋なのに頭が BAG- でない は止める', run("mbSkuManualProblem('FUKURO1')").indexOf('頭を「BAG-」') > 0);
run("document.getElementById('mp-kind').value = 'MISC'");
ok('⑤種類が備品なのに頭が MISC- でない は止める', run("mbSkuManualProblem('ETC-9')").indexOf('頭を「MISC-」') > 0);
run("document.getElementById('mp-kind').value = 'SET'");
ok('⑤種類がセットなら頭は自由（YS300 は通す）', run("mbSkuManualProblem('YS300')") === '');

/* ── ⑤ 保存のところ（本物の meiboSaveRow を動かす。保存はにせものの fetch） ── */
async function saveWith(manual, sku, kind){
  alerts.length = 0; fetched = 0;
  run("meiboAddingNew = true; mbSkuManual = " + (manual ? 'true' : 'false') + ";");
  el('mp-sku').value = sku; el('mp-name').value = 'テスト商品'; el('mp-kind').value = kind;
  await run("meiboSaveRow()");
}
(async function(){
  await saveWith(true, 'YS100', 'SET');
  ok('⑤保存：自分で決めた YS100（重複）は止まる', alerts.length === 1 && alerts[0].indexOf('すでに使われています') > 0, JSON.stringify(alerts));
  ok('⑤保存：止まったときは自動の付け直しをしない（品番は YS100 のまま）', el('mp-sku').value === 'YS100');
  ok('⑤保存：止まったので送らない', fetched === 0);

  await saveWith(true, '', 'SET');
  ok('⑤保存：自分で決めるのに空なら「品番を入れてください（例：YS100）」', alerts[0] === '品番を入れてください（例：YS100）', JSON.stringify(alerts));
  ok('⑤保存：空なので送らない', fetched === 0);

  await saveWith(true, 'GB01', 'BOX');
  ok('⑤保存：箱なのに頭が BOX- でないと止まる', alerts.length === 1 && alerts[0].indexOf('頭を「BOX-」') > 0, JSON.stringify(alerts));

  await saveWith(false, 'SET-002', 'SET');
  ok('⑤保存：🅰自動のときの重複は今までどおり「付け直しました」（SET-003）', alerts.length === 1 && alerts[0].indexOf('付け直しました') > 0 && el('mp-sku').value === 'SET-003', JSON.stringify(alerts));
  ok('⑤保存：付け直したのでまだ送らない', fetched === 0);

  /* ── 新しく開くときは🅰自動から（本物の meiboStartNew） ── */
  run("mbSkuManual = true; meiboStartNew('');");
  ok('新しく開くときは🅰自動から（mbSkuManual=false）', run('mbSkuManual') === false);

  /* ── ③ 商品管理番号は品番が何であっても同じ計算 ── */
  ok('③YS300 ＋ バーコード …7050 → YS300-7050', run("mbKanriFrom('YS300','4580256047050')") === 'YS300-7050');
  ok('③YS300 でバーコード無し → YS300 のまま', run("mbKanriFrom('YS300','')") === 'YS300');
  ok('③自動の BOX-002 でも同じ計算（バーコード無し → そのまま）', run("mbKanriFrom('BOX-002','')") === 'BOX-002');

  /* ── ⑥ 保存の形は増えていない（prod に新しい項目を足していない） ── */
  const saveSrc = cut(M, 'meiboSaveRow');
  ok('⑥saveOneProduct に送る項目に 品番の決め方 を足していない', !/skuManual|hinbanMode/.test(saveSrc));

  console.log('===== ✏️ 名簿の品番を自分で決める（2026-10-29） =====');
  if (fails.length) console.log(fails.join('\n'));
  console.log('PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
})();
