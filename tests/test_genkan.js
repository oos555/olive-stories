/* 玄関のアラートが本当に機能するかを、本物の関数で試す。
   ・見張っているものが一覧に出るか
   ・玄関の自己点検が、壊したときに ちゃんと気づくか
   ・★2026-09-13 ひろみさん指示で外した6つが、こっそり戻っていないか（＝また重くならないか）
   本番のデータには触らない。

   ══════════════════════════════════════════════════════════════════════
   ★2026-09-13 ひろみさん指示（この日から、玄関の見張りは【2つだけ】）
   ひろみさんの言葉：「ここのアラートが多すぎて、これを更新するのにとても時間が
   かかっていて、待てなくて他のアプリの方に移動してしまうので、これを消してください」

   残す2つ： 🗄 取り置き期限が過ぎている ／ 💰 支払期限ごえ・未入金（売上C）
   外した6つ：在庫がなくて出荷できない／倉庫へ送ったのに在庫を引いていない／
   　　　　　 取り置き期限が3日以内／賞味期限まで残り8か月／裏ラベル50枚切れ／
   　　　　　 発送したのに送り状No.が入っていない
   ★勝手に戻さないでください。戻すとまた玄関が重くなります（下の⑧が見張ります）。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const H = require('./harness');
const src = fs.readFileSync(require('path').join(__dirname,'..','home.html'), 'utf8');

let pass=0, fail=0; const fails=[];
function eq(l,g,w){ if(String(g)===String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

/* 画面の身代わり（作った要素を覚えておく） */
function makeDom(){
  const made = {};
  function el(id){
    return { id:id, style:{ cssText:'' }, innerHTML:'', textContent:'',
             appendChild(){}, classList:{ add(){}, remove(){}, toggle(){} },
             parentNode:{ insertBefore(n){ made[n.id]=n; } }, nextSibling:null };
  }
  /* ★2026-09-13 アラートは #alert-garden（1つの箱）に描かれる。この2つは必ず在るものとして返す */
  made['alert-bar'] = el('alert-bar');
  made['alert-garden'] = el('alert-garden');
  return { made:made,
    getElementById(id){ return made[id] || null; },
    createElement(){ const n = el('');
      return new Proxy(n, { set(t,k,v){ t[k]=v; if(k==='id') made[v]=t; return true; } }); },
    querySelectorAll(){ return []; }, querySelector(){ return null; },
    body:{ appendChild(n){ made[n.id]=n; }, style:{} }, addEventListener(){} };
}

function build(){
  const dom = makeDom();
  const { box, ctx } = H.makeSandbox({ document: dom, GAS_URL:'x', location:{ search:'' } });
  vm.runInContext(H.cutVar(src, 'OOS_MIHARI'), ctx);
  /* alertEsc は中に正規表現があり共通の切り出し器が使えないので、その1行を丸ごと取る（本物のまま） */
  const escLine = src.match(/function alertEsc\(s\)\{[^\n]*/);
  if(!escLine) throw new Error('関数が見つからない: alertEsc');
  vm.runInContext(escLine[0], ctx);
  ['renderMihari','oosGenkanSelfCheck','oosGenkanAlarm'].forEach(n => vm.runInContext(H.cut(src, n), ctx));
  vm.runInContext('window.__oosMihariCount = {};', ctx);
  vm.runInContext('function renderAlerts(){}', ctx);
  /* 数を数える係。本体はGASを呼びに行くので、ここでは「居ること」だけを置く */
  vm.runInContext('function computeHoldAlerts(){} function computeOverdueAndMerge(){}', ctx);
  return { box, dom, ctx };
}

/* ── ① 見張っているものが一覧に出るか ─────────────────── */
let { box, dom, ctx } = build();
eq('① 見張っているものの数', box.OOS_MIHARI.length, 2);   /* ★2026-09-13 ひろみさん指示で2つ。勝手に増やさない・減らさない */
box.renderMihari();
const html = (dom.made['alert-garden'] || {}).innerHTML || '';
eq('① 一覧が画面に作られる', html.length > 0, true);
eq('① 「取り置き期限が過ぎている」が載っている', html.indexOf('取り置き期限が過ぎている') >= 0, true);
eq('① 「支払期限ごえ」が載っている', html.indexOf('支払期限ごえ') >= 0, true);
eq('① まだ数えていないものは「確認中…」と出る', html.indexOf('確認中…') >= 0, true);
eq('① 「ここに書いていないものは見張っていません」と断っている', html.indexOf('見張っていません') >= 0, true);
eq('① 箱の名前が出ている', html.indexOf('🌿 アラートガーデン') >= 0, true);
eq('① 見張っている数もそえてある', html.indexOf('いま 2個') >= 0, true);

/* ── ② 0件でも「0件」と出す（＝安心の根拠になる）───────── */
({ box, dom, ctx } = build());
box.window.__oosMihariCount = { holdOver:0, overdue:0 };
box.renderMihari();
const h2 = (dom.made['alert-garden'] || {}).innerHTML || '';
eq('② 0件のときも「0件」と数字が出る', (h2.match(/0件/g)||[]).length >= 2, true);
eq('② 「確認中…」は消えている', h2.indexOf('確認中…') < 0, true);

/* ── ③ 件数があれば赤い数字で出る ───────────────────── */
({ box, dom, ctx } = build());
box.window.__oosMihariCount = { holdOver:2, overdue:0 };
box.renderMihari();
const h3 = (dom.made['alert-garden'] || {}).innerHTML || '';
eq('③ 2件と出る', h3.indexOf('2件') >= 0, true);
eq('③ 赤で出る', h3.indexOf('#b91c1c') >= 0, true);
eq('③ 件数があるときだけ「開く →」を出す', h3.indexOf('開く →') >= 0, true);
eq('③ 上に「やること 2 件」と出る', h3.indexOf('やること 2 件') >= 0, true);
/* 0件のときは「開く →」を出さない（押しても何も無い所へ飛ばさない） */
eq('③ 0件の行には「開く →」を出さない', (h3.match(/開く →/g)||[]).length, 1);

/* ── ④ 自己点検：正しいときは違反ゼロ ───────────────── */
({ box, dom, ctx } = build());
let v = box.oosGenkanSelfCheck();
eq('④ 正しいときは違反0件', v.length, 0);
eq('④ 赤い帯を出さない', !!dom.made['oos-genkan-alarm'], false);

/* ── ⑤ 自己点検：見張りの中身が入れ替わったら気づくか ──── */
({ box, dom, ctx } = build());
vm.runInContext("OOS_MIHARI[0].key = 'nazono_mihari';", ctx);       // 取り置き期限を、別のものにすりかえる
v = box.oosGenkanSelfCheck();
eq('⑤ すりかえに気づく', v.some(function(s){ return s.indexOf('取り置き期限が過ぎている') >= 0; }), true);
eq('⑤ 赤い帯を出す', !!dom.made['oos-genkan-alarm'], true);
eq('⑤ 帯に「大丈夫と思わないでください」と書く',
   ((dom.made['oos-genkan-alarm']||{}).innerHTML||'').indexOf('思わないでください') >= 0, true);

/* ── ⑥ 自己点検：見張り一覧が減っても気づくか ─────────── */
({ box, dom, ctx } = build());
box.OOS_MIHARI.length = 1;                                        // わざと減らす
v = box.oosGenkanSelfCheck();
eq('⑥ 見張り一覧が減ると気づく', v.some(function(s){ return s.indexOf('減っています') >= 0; }), true);

/* ── ⑦ 自己点検：数える係が消えても気づくか ─────────── */
({ box, dom, ctx } = build());
vm.runInContext('computeHoldAlerts = undefined;', ctx);
v = box.oosGenkanSelfCheck();
eq('⑦ 数える係が消えると気づく', v.some(function(s){ return s.indexOf('取り置き期限を数える仕組み') >= 0; }), true);
({ box, dom, ctx } = build());
vm.runInContext('computeOverdueAndMerge = undefined;', ctx);
v = box.oosGenkanSelfCheck();
eq('⑦ 支払期限の係が消えても気づく', v.some(function(s){ return s.indexOf('支払期限ごえ') >= 0; }), true);

/* ══════ ⑧ 2026-09-13に外した6つが、こっそり戻っていないか ══════
   ★戻すと玄関がまた重くなり、ひろみさんが「待てなくて他のアプリへ移動」する状態に戻ります。
   　戻したくなったときは、ひろみさんに聞いてから、この見張りごと直してください。 */
(function(){
  const mihari = H.cutVar(src, 'OOS_MIHARI');
  ['zaikoNashi','notHikare','holdSoon','expSoon','labelLow','trackNone'].forEach(function(k){
    eq('⑧ 見張り一覧に ' + k + ' が戻っていない', mihari.indexOf("key:'" + k + "'") < 0, true);
  });
  /* いちばん重かったのは、玄関が商品マスタと在庫をまるごと取りに行っていたこと */
  eq('⑧ 玄関が商品マスタを取りに行っていない', src.indexOf('action=loadProducts') < 0, true);
  eq('⑧ 玄関が在庫のかたまりを取りに行っていない', src.indexOf('action=loadBundleForOrders') < 0, true);
  eq('⑧ computeStockAlerts が復活していない', src.indexOf('async function computeStockAlerts') < 0, true);
  /* 玄関が呼ぶのは、この2つだけ（どちらも1回ずつ） */
  eq('⑧ 支払期限ごえを数えに行く', (src.match(/computeOverdueAndMerge\(\);/g)||[]).length, 1);
  eq('⑧ 取り置き期限を数えに行く', (src.match(/computeHoldAlerts\(\);/g)||[]).length, 1);
  /* 見本（?demo=1）にも、いま出ないものを並べない */
  eq('⑧ 見本に賞味期限が残っていない', src.indexOf("label:'⏳ 賞味期限まで残り8か月を切った商品'") < 0, true);
  eq('⑧ 見本に送り状No.が残っていない', src.indexOf("label:'📮 発送したのに送り状No.が入っていない'") < 0, true);
  /* 説明書（なぜ光るの？）も、本当のことだけ書いてある */
  /* ★2026-09-13 ひろみさん指示（第2弾）：説明書は枠ごと廃止／「アラートはありません」も廃止／
     見張っているもの＝アラートで、1つの箱にまとめる。★元に戻さないでください。 */
  eq('⑧ 説明書（なぜ光るの？）は枠ごと無い', src.indexOf('garden-guide') < 0, true);
  eq('⑧ 「今のところ アラートはありません」は無い',
     src.indexOf('今のところ アラートはありません') < 0, true);
  eq('⑧ 「しずかなお庭」は無い', src.indexOf('garden-quiet') < 0, true);
  eq('⑧ たたむボタン（やることの帯）は無い', src.indexOf('alert-bar-btn') < 0, true);
  eq('⑧ 別の白い箱（見張り一覧）に分かれていない', src.indexOf("id = 'oos-mihari'") < 0, true);
  eq('⑧ アラートは1つの箱（#alert-garden）に描く',
     src.indexOf("var g = document.getElementById('alert-garden');") >= 0, true);
  eq('⑧ 箱はいつも玄関に居る（消さない）', src.indexOf("bar.style.display = 'block'") >= 0, true);
})();

/* ══════ ⑨ 在庫Ｂ（stock.html）は、ならびから隠したまま ══════
   ★2026-09-13 ひろみさん：「もう今使ってない。今後も使わないよね。いったん非表示に」
   ★ファイルは消していません。戻すときはコメントの囲みを外すだけです。 */
(function(){
/* ★2026-09-14 見積Мはまっさらにしました（ひろみさん指示）。作り直したらここを戻す */
  ['home.html','index.html','billing.html','master.html',
   /* ★2026-09-14 sales.html（お便り作戦室F）は、ひろみさんの指示でやめました
      （_backup/2026-09-14_やめたアプリ/ に控えあり）。だから一覧から外しています。 */
   /* ★2026-09-14 labels.html（ラベル図鑑）はやめました */
   'soryo.html','yuka.html',
   'rt_chef_daicho.html','genkan.html'].forEach(function(f){
    const s = H.read(f);
    /* コメント（<!-- --> の中）を外してから、リンクが生きていないかを見る */
    const naka = s.replace(/<!--[\s\S]*?-->/g, '');
    eq('⑨ ' + f + ' に在庫Ｂのリンクが出ていない', naka.indexOf('href="stock.html"') < 0, true);
    /* 戻せるように、コメントの中には残してある */
    eq('⑨ ' + f + ' に戻すための控えが残っている', s.indexOf('stock.html') >= 0, true);
  });
})();

/* ══════ ⑩ 受注Ａを直接開いたときの「玄関の鍵」（2026-09-24） ══════
   ひろみさん：「私は社長のパスワードで入れて、他の人たちは玄関のパスワードで入れる」
   前は社長のパスワードだけで照合していて、玄関のパスワードでは入れなかった
   （画面には「玄関の鍵」と出ているのに）。本物の gateUnlock を動かして確かめます。
   ★どちらか片方だけに戻さないでください。 */
async function juchuAKagi(){
  const idx = H.read('index.html');
  const KAGI = { gate:'GATE123', secret:'SECRET456' };   /* 本物のパスワードは書きません */
  async function tamesu(pw){
    const els = { 'gate-pw-input':{ value:pw }, 'gate-err':{ textContent:'' }, 'gate-ok-btn':{ disabled:false },
                  'gate-overlay':{ classList:{ remove(){}, add(){} } }, 'main-wrap':{ classList:{ add(){} } } };
    const store = {};
    const box = { JSON, String, Promise, console, GAS_URL:'x',
      document:{ getElementById:(id)=>els[id] },
      localStorage:{ setItem:(k,v)=>{ store[k]=v; }, getItem:(k)=>store[k]||null },
      fetch: async (u, opt)=>{ const b = JSON.parse(opt.body); let ok = false;
        /* ★2026-09-25 サーバー（GAS verifyPassword）と同じ：玄関は、玄関の鍵でも社長の鍵でも開く。付箋メモIへの二重の照合は外した */
        if(b.action==='verifyPassword') ok = (b.group==='gate' && (b.password===KAGI.gate || b.password===KAGI.secret));
        if(b.action==='loadStickyMemos') ok = false;
        return { json: async ()=>(ok ? {status:'ok'} : {status:'error', message:'パスワードが違います'}) }; } };
    vm.createContext(box);
    vm.runInContext(H.cutVar(idx, 'OOS_GATE_HAN') + ';\n' + H.cut(idx, 'oosPwSoroe') + '\n' + H.cut(idx, 'gateUnlock'), box);
    await box.gateUnlock();
    return store['oos_gate_ok'] === box.OOS_GATE_HAN && !!box.OOS_GATE_HAN;
  }
  eq('⑩ 受注Ａ：玄関のパスワードで開く（スタッフ）', await tamesu(KAGI.gate), true);
  eq('⑩ 受注Ａ：社長のパスワードでも開く（ひろみさん）', await tamesu(KAGI.secret), true);
  eq('⑩ 受注Ａ：ちがうパスワードでは開かない', await tamesu('chigau'), false);
  /* ══ ⑪ 全角で打っても開く（2026-09-24 ひろみさん「アトリエがまたPWが違いますといって開けない！」）══
     日本語入力のまま打つと全角になり、見た目は同じでも「違います」になっていた。 */
  eq('⑪ 受注Ａ：全角で打った玄関のパスワードでも開く', await tamesu('ＧＡＴＥ１２３'), true);
  eq('⑪ 受注Ａ：前後に空白が入っていても開く', await tamesu(' GATE123　'), true);
  /* 2026-09-25 ひろみさん「また入れない」：鍵はすべて英大文字＋数字。小文字で打っても開く */
  eq('⑪ 受注Ａ：小文字で打っても開く', await tamesu('gate123'), true);
  eq('⑪ 受注Ａ：全角の小文字で打っても開く', await tamesu('ｇａｔｅ１２３'), true);
}
/* ⑪ 玄関（home.html）の社長の鍵・マーケ（お隣）の鍵も、全角をそろえてから照合する */
async function atelierKagi(){
  const KAGI = 'SECRET456';
  /* 玄関の社長の鍵：本物の presUnlock に全角で入れて、サーバーへ半角で届くか */
  for (const [utta, mei] of [['ＳＥＣＲＥＴ４５６','全角で打っても'], ['secret456','小文字で打っても'], ['ｓｅｃｒｅｔ４５６','全角の小文字で打っても']]) {
    const hs = H.read('home.html');
    let okutta = null;
    const els = { 'pres-pw-input':{ value:utta }, 'pres-err':{ textContent:'' }, 'pres-ok-btn':{ disabled:false },
                  'pres-overlay':{ classList:{ remove(){}, add(){} } } };
    const box = { JSON, String, Promise, console, GAS_URL:'x', window:{ location:{} },
      document:{ getElementById:(id)=>els[id] || { style:{}, classList:{ add(){}, remove(){} }, textContent:'' } },
      localStorage:{ setItem(){}, getItem(){ return null; }, removeItem(){} },
      fetch: async (u, opt)=>{ const b = JSON.parse(opt.body); okutta = b.password; return { json: async ()=>(b.password === KAGI ? {status:'ok'} : {status:'error', message:'パスワードが違います'}) }; },
      oosMarkUnlocked(){}, presCloseModal(){}, presTargetHref:null };
    vm.createContext(box);
    try{
      vm.runInContext(H.cut(hs, 'oosPwSoroe') + '\n' + H.cut(hs, 'presUnlock'), box);
      await box.presUnlock();
      eq('⑪ 玄関の社長の鍵：' + mei + '、半角の大文字でサーバーへ届く', okutta, KAGI);
    }catch(e){ fail++; fails.push('⑪ 玄関の社長の鍵を動かせませんでした：' + e.message); }
  }
  /* マーケの鍵：全角で開く／サーバーが混んでいるときに「違います」と言わない・鍵を消さない */
  {
    const ms = H.read('eigyo/marketing.html');
    async function mk(pw, kotae){
      const store = { oos_unlock_secret: JSON.stringify({ p:KAGI }) };
      const els = { 'pw-input':{ value:pw }, 'pw-err':{ textContent:'', style:{} }, 'lock':{ style:{} } };
      const box = { JSON, String, Promise, console, MAIN_GAS_URL:'x',
        document:{ getElementById:(id)=>els[id] },
        localStorage:{ setItem(k, v){ store[k] = v; }, getItem(k){ return store[k] || null; }, removeItem(k){ delete store[k]; } },
        fetch: async (u, opt)=>{ const b = JSON.parse(opt.body); return { json: async ()=>(kotae || (b.password === KAGI ? {status:'ok'} : {status:'error', message:'パスワードが違います'})) }; } };
      vm.createContext(box);
      vm.runInContext(H.cut(ms, 'oosPwSoroe') + '\n' + H.cut(ms, 'oosMarkUnlocked') + '\n' + H.cut(ms, 'oosClearUnlock') + '\n' + H.cut(ms, 'checkPw'), box);
      await box.checkPw(false);
      return { err: els['pw-err'].textContent, lock: els['lock'].style.display, kagi: store.oos_unlock_secret };
    }
    try{
      const a = await mk('ＳＥＣＲＥＴ４５６');
      eq('⑪ マーケ：全角で打っても開く', a.lock, 'none');
      const b = await mk('chigau');
      eq('⑪ マーケ：本当に違うときは「違います」', /パスワードが違います/.test(b.err), true);
      const c = await mk(KAGI, { status:'error', message:'サーバーが混雑しています' });
      eq('⑪ マーケ：サーバーが混んでいるときは「違います」と言わない', /違います/.test(c.err), false);
      eq('⑪ マーケ：サーバーが混んでいるときは、保存してある鍵を消さない', !!c.kagi, true);
    }catch(e){ fail++; fails.push('⑪ マーケの鍵を動かせませんでした：' + e.message); }
  }
}

/* ══════ ⑫ 倉庫Ｄはお休み中＝開いても何も読みに行かない（2026-09-25 ひろみさん「切っておいていい。重たくならないように」）══════ */
(function(){
  const pk = H.read('pickup.html');
  const i0 = pk.indexOf('var SOUKO_D_YASUMI'), i1 = pk.indexOf("const NOSHI_IMAGE");
  const j0 = pk.indexOf('if(!SOUKO_D_YASUMI){\n  initializeProducts();') >= 0 ? pk.indexOf('if(!SOUKO_D_YASUMI){\n  initializeProducts();') : pk.indexOf('if(!SOUKO_D_YASUMI){\r\n  initializeProducts();');
  if(i0 < 0 || i1 < 0 || j0 < 0){ fail++; fails.push('⑫ 倉庫Ｄのお休みスイッチが見つかりません'); return; }
  const j1 = pk.indexOf('}', pk.indexOf('init();', j0)) + 1;
  const yonda = [], soeta = [];
  let kido = null;
  const box = { console, String,
    gateCheck(){ yonda.push('gateCheck'); }, initializeProducts(){ yonda.push('initializeProducts'); }, init(){ yonda.push('init'); },
    document:{ addEventListener(ev, fn){ if(ev === 'DOMContentLoaded') kido = fn; },
      getElementById(){ return { style:{} }; }, createElement(){ return { style:{} }; }, body:{ appendChild(x){ soeta.push(x); } } } };
  vm.createContext(box);
  vm.runInContext(pk.slice(i0, i1) + '\n' + pk.slice(j0, j1), box);
  if(kido) kido();
  eq('⑫ 倉庫Ｄ：お休みのスイッチは入っている（true）', box.SOUKO_D_YASUMI, true);
  eq('⑫ 倉庫Ｄ：開いても何も読みに行かない（鍵・商品・注文の読み込みをしない）', yonda.length, 0);
  eq('⑫ 倉庫Ｄ：お休みの案内を出す', soeta.length === 1 && /お休み中/.test(soeta[0].innerHTML), true);
})();

/* ══════ ⑬ 混んでいるだけのときに、社長の鍵を消さない（2026-09-25 ひろみさん「また入れない！同じ端末から入ってるよ」）══════
   輸入Ｅ・ひろみメモは、サーバーの答えが ok 以外なら何でも鍵を消していたので、GASが混んだだけで同じ端末でまた聞かれていました。 */
async function kagiNokosu(){
  const path = require('path');
  for (const [mei, file] of [['輸入Ｅ','import.html'], ['ひろみメモ','hiromi.html']]) {
    const hs = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    async function tamesu(kotae){
      const kieta = [];
      const el = () => ({ style:{}, classList:{ add(){}, remove(){} }, textContent:'', innerHTML:'' });
      const box = { console, JSON, String, Promise, setTimeout,
        document:{ getElementById: el, querySelectorAll(){ return []; } },
        fetch: async () => ({ json: async () => kotae }),
        post: async () => kotae,
        oosClearUnlock(g){ kieta.push(g); }, showSyncStatus(){},
        hmCacheHayaMise(){ return false; }, hmYomikomiChu(){}, hmCacheLoad(){ return null; }, hmYomenakatta(){}, hmItsuno(){ return ''; },
        SHEET_NAME:'', SHEET_IMPORTANT:'', SHEET_TODO:'', SHEET_FREE:'', GAS_URL:'x', password:'' };
      vm.createContext(box);
      vm.runInContext('var password=""; ' + H.cut(hs, 'autoUnlock'), box);
      await box.autoUnlock('KAGI');
      return kieta.length;
    }
    try{
      eq('⑬ ' + mei + '：サーバーが混んでいるだけのときは、鍵を消さない', await tamesu({ status:'error', message:'Service invoked too many times' }), 0);
      eq('⑬ ' + mei + '：本当にパスワードが違うときだけ鍵を消す', await tamesu({ status:'error', message:'パスワードが違います' }), 1);
    }catch(e){ fail++; fails.push('⑬ ' + mei + 'を動かせませんでした：' + e.message); }
  }
}

/* ══════ ⑭ 玄関は一度だけ開きなおす（2026-09-25 ひろみさん「一旦開きなおすようにさせて」パスワードを全部変えたため）══════
   玄関の印を【版】で持つ。前の印（'1'）では開かず、印は消える。3つのページの版は同じ。 */
function gateHan(){
  const path = require('path');
  const hans = {};
  for (const file of ['home.html', 'index.html', 'rt_chef_daicho.html']) {
    const hs = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const m = hs.match(/var OOS_GATE_HAN = '([^']+)'/);
    hans[file] = m ? m[1] : null;
    if (file === 'rt_chef_daicho.html') continue;
    for (const [mae, mei] of [['1', '前の印（1）'], ['kagi-2000-01-01', '古い版の印'], [null, '印なし']]) {
      const store = mae == null ? {} : { oos_gate_ok: mae };
      let deta = false;
      const box = { console,
        localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=v; }, removeItem:(k)=>{ delete store[k]; } },
        document:{ getElementById:(id)=>({ classList:{ add(){ if(id==='gate-overlay') deta = true; }, remove(){} }, focus(){} }) },
        setTimeout(){}, initAlerts(){} };
      vm.createContext(box);
      vm.runInContext(H.cutVar(hs, 'OOS_GATE_HAN') + ';\n' + H.cut(hs, 'gateCheck'), box);
      box.gateCheck();
      eq('⑭ ' + file + '：' + mei + 'では玄関がもう一度聞く', deta, true);
      eq('⑭ ' + file + '：' + mei + 'は消える（上に重ならない）', 'oos_gate_ok' in store, false);
    }
    { const store = { oos_gate_ok: hans[file] }; let deta = false;
      const box = { console, localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem(){}, removeItem:(k)=>{ delete store[k]; } },
        document:{ getElementById:(id)=>({ classList:{ add(){ if(id==='gate-overlay') deta = true; }, remove(){} }, focus(){} }) }, setTimeout(){}, initAlerts(){} };
      vm.createContext(box);
      vm.runInContext(H.cutVar(hs, 'OOS_GATE_HAN') + ';\n' + H.cut(hs, 'gateCheck'), box);
      box.gateCheck();
      eq('⑭ ' + file + '：新しい版の印なら、聞かずに開いたまま', deta, false); }
  }
  eq('⑭ 玄関の版は3つのページで同じ（玄関・受注Ａ・RT台帳）', !!hans['home.html'] && hans['home.html'] === hans['index.html'] && hans['home.html'] === hans['rt_chef_daicho.html'], true);
}
try{ gateHan(); }catch(e){ fail++; fails.push('⑭ 玄関の版を確かめられませんでした：' + e.message); }

/* ══════ ⑮ 古い社長の鍵は玄関で消す・社長の鍵があれば玄関もRT台帳も聞かない（2026-09-26 ひろみさん「社長の方のアプリ全部できかれる」）══════ */
async function kagiTashikameTest(){
  const han = (src.match(/var OOS_GATE_HAN = '([^']+)'/) || [])[1];
  function tamesu(store, kotae){
    const t = { store, show:true, alerts:0 }; const sess = {};
    const box = { console, JSON, String,
      localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=v; }, removeItem:(k)=>{ delete store[k]; } },
      sessionStorage:{ getItem:(k)=>(k in sess ? sess[k] : null), setItem:(k,v)=>{ sess[k]=v; } },
      document:{ getElementById:(id)=>({ classList:{ contains:()=> id==='gate-overlay' ? t.show : false, remove(){ if(id==='gate-overlay') t.show=false; }, add(){} } }) },
      GAS_URL:'x', initAlerts(){ t.alerts++; },
      fetch: async ()=>({ json: async ()=> kotae }) };
    vm.createContext(box);
    vm.runInContext(H.cutVar(src, 'OOS_GATE_HAN') + ';\n' + H.cut(src, 'oosSavedPw') + '\n' + H.cut(src, 'oosMarkUnlocked') + '\n' + H.cut(src, 'oosClearUnlock') + '\n'
      + H.cut(src, 'kagiTashikame') + '\n' + H.cut(src, 'kagiShachoMo'), box);
    t.box = box; return t;
  }
  const kagi = JSON.stringify({ p:'AAA' });
  { const t = tamesu({ oos_unlock_secret:kagi, oos_gate_ok:han }, { status:'error', message:'パスワードが違います' }); await t.box.kagiTashikame();
    eq('⑮ 古い社長の鍵（サーバーが違いますと言う）は玄関で消す', 'oos_unlock_secret' in t.store, false); }
  { const t = tamesu({ oos_unlock_secret:kagi, oos_gate_ok:han }, { status:'error', message:'Service invoked too many times' }); await t.box.kagiTashikame();
    eq('⑮ 混んでいるだけなら社長の鍵を消さない', 'oos_unlock_secret' in t.store, true); }
  { const t = tamesu({ oos_unlock_secret:kagi }, { status:'ok' }); await t.box.kagiTashikame();
    eq('⑮ 正しい社長の鍵があれば、玄関の枠を自動で閉じる', t.show, false);
    eq('⑮ そのとき玄関の印を今の版で立てる', t.store.oos_gate_ok, han);
    eq('⑮ 見張りは1回だけ動く', t.alerts, 1); }
  { const t = tamesu({}, { status:'ok' }); await t.box.kagiShachoMo('AAA');
    eq('⑮ 玄関で社長のパスワードを入れたら、社長の鍵としても覚える', t.store.oos_unlock_secret, kagi); }
  { const t = tamesu({ oos_unlock_secret:kagi }, { status:'error', message:'パスワードが違います' }); await t.box.kagiShachoMo('BBB');
    eq('⑮ 玄関でスタッフの鍵を入れても、今ある社長の鍵は消さない・変えない', t.store.oos_unlock_secret, kagi); }
  eq('⑮ 玄関を開いたときに社長の鍵を確かめている', /\n\s*gateCheck\(\);\s*\n\s*kagiTashikame\(\);/.test(src), true);
  eq('⑮ 玄関で開けたあと社長の鍵も覚える', /initAlerts\(\);\s*\n\s*kagiShachoMo\(pw\);/.test(src), true);
  const rt = fs.readFileSync(require('path').join(__dirname, '..', 'rt_chef_daicho.html'), 'utf8');
  { const store = { oos_unlock_secret:kagi }; let aita = 0; let okutta = null;
    const box = { console, JSON,
      localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=v; }, removeItem:(k)=>{ delete store[k]; } },
      loadPeople(){}, openMain(){ aita++; }, lockAgain(){}, pingUnlock(pw){ okutta = pw; } };
    vm.createContext(box);
    vm.runInContext('var GATE_PW="oos_rtchef_gate_pw", password="";\n' + H.cut(rt, 'savedSecret') + '\n' + H.cut(rt, 'oosSavedPw') + '\n' + H.cut(rt, 'boot'), box);
    box.boot();
    eq('⑮ RT台帳は社長の鍵があれば聞かずに開く', aita, 1);
    eq('⑮ RT台帳はその鍵をサーバーで確かめる', okutta, 'AAA'); }
}

/* ══════ ⑯ 鍵を消したら「どこで・いつ」を残し、玄関の枠に出す（2026-09-28 ひろみさん「また社長の部屋が入れない。なんで」）══════ */
function kagiKirokuTest(){
  const path = require('path');
  for (const [file, mei] of [['home.html','玄関'], ['hiromi.html','ひろみメモ'], ['import.html','輸入・原価'], ['eigyo/marketing.html','マーケ'], ['eigyo/documents.html','書類']]) {
    const hs = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const store = { oos_unlock_secret: '{"p":"A"}' };
    const box = { JSON, Date, localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=v; }, removeItem:(k)=>{ delete store[k]; } } };
    vm.createContext(box); vm.runInContext(H.cut(hs, 'oosClearUnlock'), box);
    box.oosClearUnlock('secret');
    eq('⑯ ' + mei + '：鍵を消したら、どこで消したかを残す', ('oos_unlock_secret' in store) + ' ' + (JSON.parse(store.oos_kagi_kieta || '{}').doko), 'false ' + mei);
  }
  const store = {};
  const box = { JSON, Date, isNaN, localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=v; } } };
  vm.createContext(box); vm.runInContext(H.cut(src, 'kagiKirokuBun'), box);
  eq('⑯ 記録なし → 覚えた記録がないと出る', /覚えた記録がありません/.test(box.kagiKirokuBun()), true);
  store.oos_kagi_hozon = '2026-09-28T01:00:00.000Z';
  eq('⑯ 覚えたあと消した記録なし → 保存が消えていると出る', /消した記録はありません/.test(box.kagiKirokuBun()), true);
  store.oos_kagi_kieta = JSON.stringify({ doko:'ひろみメモ', itsu:'2026-09-28T02:00:00.000Z' });
  eq('⑯ あとで消した → どこで消したかが出る', /「ひろみメモ」で鍵を消しました/.test(box.kagiKirokuBun()), true);
}
try{ kagiKirokuTest(); }catch(e){ fail++; fails.push('⑯ 動かせませんでした：' + e.message); }

/* ══════ ⑰ ゆかメモは鍵をコードに書かない・覚えた鍵で開く・混んでも消さない（2026-09-29 ひろみさん「新しいパスワード以外はもう使わない・毎回聞かれるのをなくして」）══════ */
async function yukaMemoKagiTest(){
  const path = require('path');
  const hs = fs.readFileSync(path.join(__dirname, '..', 'yuka.html'), 'utf8');
  eq('⑰ ゆかメモ：鍵をコードに書き込んでいない（APP_PASSWORD なし）', /APP_PASSWORD/.test(hs), false);
  eq('⑰ ゆかメモ：password に文字を直接入れていない', /let password\s*=\s*['"][^'"]+['"]/.test(hs), false);
  function run(saved, replies){
    const store = saved ? { oos_unlock_j: JSON.stringify({ p: saved }) } : {};
    const asked = []; const sent = [];
    const box = { JSON, String, Promise, setTimeout, SHEET_NAME:'付箋メモJ', memos:[], localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=v; }, removeItem:(k)=>{ delete store[k]; } },
      renderMemoList(){}, renderAlerts(){}, loadImportantMemos(){}, loadTodos(){}, loadBoardFromGAS(){}, showSyncStatus(){},
      post: async (b)=>{ sent.push(b.password); return replies.shift(); }, oosAskKey: async (m)=>{ asked.push(m); return 'NEWKEY'; } };
    vm.createContext(box);
    vm.runInContext(H.cut(hs, 'oosPwSoroe') + H.cut(hs, 'oosSavedPw') + H.cut(hs, 'oosMarkUnlocked') + H.cut(hs, 'oosClearUnlock') + 'var password = "";' + H.cut(hs, 'autoLoad'), box);
    return box.autoLoad().then(()=>({ asked, sent, store }));
  }
  let r = await run('OLDKEY', [{ status:'ok', data:{ memos:[] } }]);
  eq('⑰ 覚えた鍵がある → 聞かない', r.asked.length, 0);
  r = await run('OLDKEY', [{ status:'error', message:'サーバーが混んでいます' }]);
  eq('⑰ 混んでいるだけ → 鍵を消さない・聞かない', ('oos_unlock_j' in r.store) + ' ' + r.asked.length, 'true 0');
  r = await run('OLDKEY', [{ status:'error', message:'パスワードが違います' }, { status:'ok', data:{ memos:[] } }]);
  eq('⑰ 「違います」のとき → 古い鍵を消して、1回だけ聞き直す', ('oos_unlock_j' in r.store) + ' ' + r.asked.length + ' ' + r.sent.join(','), 'false 1 OLDKEY,NEWKEY');
  r = await run('', [{ status:'ok', data:{ memos:[] } }]);
  eq('⑰ 鍵がまだない端末 → 最初の1回だけ聞く', r.asked.length + ' ' + r.sent.join(','), '1 NEWKEY');
}

/* ══════ ⑱ ゆかメモ：終了にした・消したものが、開き直しても復活しない（2026-10-08 ひろみさん「完全にバグだよね。起こらないように直して。今書いてあるものは絶対に消さないで」）══════ */
async function yukaFukkatsuTest(){
  const path = require('path');
  const hs = fs.readFileSync(path.join(__dirname, '..', 'yuka.html'), 'utf8');
  /* 黙って通る形（catch の中が空）に戻っていないか：saveStickyMemo／deleteStickyMemo を post で直接送る行が無い */
  eq('⑱ ゆかメモ：メモの保存・削除を直接 post していない（全部 saveMemoSafe／deleteMemoSafe を通る）',
     (hs.match(/await post\(\{ action:'(saveStickyMemo|deleteStickyMemo)'/g) || []).length, 0);
  eq('⑱ ゆかメモ：読み込み4か所（メモ・大切・やること・伝言板）が「消したもの」を出さない', (hs.match(/oosKeshitaJanai\(/g) || []).length, 5);
  function hako(replies){
    const store = {}; const sent = []; const msgs = [];
    const box = { JSON, String, Array, Set, Promise, setTimeout, console, password:'PW',
      localStorage:{ getItem:(k)=>(k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=v; }, removeItem:(k)=>{ delete store[k]; } },
      document:{ getElementById(){ return null; }, createElement(){ return { style:{}, appendChild(){}, firstChild:{} }; }, body:{ appendChild(){} } },
      showSyncStatus(m){ msgs.push(m); },
      post: async (b)=>{ sent.push(b); const r = replies.shift(); if(r === 'HTML') throw new Error('json'); return r; } };
    vm.createContext(box);
    vm.runInContext(H.cutVar(hs, 'removedIds') + ['oosKeshitaOboeru','oosKeshitaJanai','oosNemuru','oosHozonShirase','oosHozon','oosMijikaku','saveMemoSafe','deleteMemoSafe'].map(n => H.cut(hs, n)).join('\n'), box);
    box.oosNemuru = async function(){};                 /* 待ち時間は飛ばす */
    const obi = []; box.oosHozonShirase = function(m){ obi.push(m); };
    return { box, store, sent, msgs, obi };
  }
  let h = hako(['HTML', 'HTML', 'HTML']);
  let ok1 = await h.box.saveMemoSafe('付箋メモJ', { id:'m1', text:'テスト', done:true }, 'メモの完了「テスト」');
  eq('⑱ HTMLの画面が3回返った → 失敗と分かる（黙って通らない）', ok1 + ' ' + h.sent.length, 'false 3');
  eq('⑱ そのとき赤い帯に「開き直すと元に戻ります」と出る', h.obi.some(m => /開き直すと元に戻ります/.test(m)) && /メモの完了/.test(h.obi[h.obi.length-1]), true);
  h = hako([{ status:'error', message:'サーバーが混んでいます' }, { status:'ok' }]);
  ok1 = await h.box.saveMemoSafe('付箋メモJ', { id:'m2', text:'x', done:true }, 'メモ');
  eq('⑱ 1回目が失敗でも、もう一度送って ok なら成功', ok1 + ' ' + h.sent.length + ' ' + h.obi.join('|'), 'true 2 ');
  h = hako([{ status:'error', message:'パスワードが違います' }]);
  ok1 = await h.box.saveMemoSafe('付箋メモJ', { id:'m3', text:'x' }, 'メモ');
  eq('⑱ 鍵が違うときは待っても直らないので1回でやめる', ok1 + ' ' + h.sent.length, 'false 1');
  h = hako([{ status:'ok' }, { status:'ok' }]);
  await h.box.deleteMemoSafe('付箋メモJやること', 'todo_1', 'やることを消す');
  const ok2 = await h.box.saveMemoSafe('付箋メモJやること', { id:'todo_1', text:'消したはず', done:true }, 'やること');
  eq('⑱ 消したあとに遅れて来た保存は送らない（行を作り直さない）', ok2 + ' ' + h.sent.length + ' ' + h.sent[0].action, 'false 1 deleteStickyMemo');
  eq('⑱ 消した id はサーバーに残っていても画面に出さない', h.box.oosKeshitaJanai([{ id:'todo_1' }, { id:'todo_2' }]).map(x => x.id).join(), 'todo_2');
  eq('⑱ 消した id は端末が覚える（開き直しても・他のアプリから戻っても）', JSON.parse(h.store.oos_yuka_removed_ids || '[]').join(), 'todo_1');
  /* 伝言板の保存（bdSaveItem）も、消した伝言は送らない（本物の関数を動かして見る） */
  h = hako([{ status:'ok' }]);
  vm.runInContext('var bdUnsent = {}; function renderBoard(){}\n' + H.cut(hs, 'bdSaveItem'), h.box);
  h.box.oosKeshitaOboeru('b1');
  const ok3 = await h.box.bdSaveItem({ id:'b1', text:'消した伝言' });
  const ok4 = await h.box.bdSaveItem({ id:'b2', text:'生きている伝言' });
  eq('⑱ 伝言板：消した伝言は保存し直さず、生きている伝言は送る', ok3 + ' ' + ok4 + ' ' + h.sent.map(b => b.item.id).join(), 'false true b2');
}

juchuAKagi().then(atelierKagi).then(kagiNokosu).then(kagiTashikameTest).then(yukaMemoKagiTest).then(yukaFukkatsuTest).catch(function(e){ fail++; fails.push('⑩⑪ 動かせませんでした：' + e.message); }).then(function(){
  console.log('===== 玄関のアラート =====');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
  process.exit(fail?1:0);
});
