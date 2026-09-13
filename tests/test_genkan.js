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
  ['home.html','index.html','billing.html','master.html','mitsumori.html',
   'labels.html','soryo.html','yuka.html','sales.html','nakamura.html',
   'rt_chef_daicho.html','genkan.html'].forEach(function(f){
    const s = H.read(f);
    /* コメント（<!-- --> の中）を外してから、リンクが生きていないかを見る */
    const naka = s.replace(/<!--[\s\S]*?-->/g, '');
    eq('⑨ ' + f + ' に在庫Ｂのリンクが出ていない', naka.indexOf('href="stock.html"') < 0, true);
    /* 戻せるように、コメントの中には残してある */
    eq('⑨ ' + f + ' に戻すための控えが残っている', s.indexOf('stock.html') >= 0, true);
  });
})();

console.log('===== 玄関のアラート =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
