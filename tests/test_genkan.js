/* 玄関のアラートが本当に機能するかを、本物の関数で試す。
   ・見張っているものが一覧に出るか
   ・在庫がない注文／送ったのに引いていない注文を拾えるか
   ・玄関の自己点検が、壊したときに ちゃんと気づくか
   本番のデータには触らない。 */
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
  const bar = el('alert-bar');
  return { made:made,
    getElementById(id){ if(id==='alert-bar') return bar; return made[id] || null; },
    createElement(){ const n = el(''); const self=n;
      return new Proxy(n, { set(t,k,v){ t[k]=v; if(k==='id') made[v]=t; return true; } }); },
    querySelectorAll(){ return []; }, querySelector(){ return null; },
    body:{ appendChild(n){ made[n.id]=n; }, style:{} }, addEventListener(){} };
}

function build(){
  const dom = makeDom();
  const { box, ctx } = H.makeSandbox({ document: dom, GAS_URL:'x', location:{ search:'' } });
  H.runZaiko(ctx);
  vm.runInContext(H.cutVar(src, 'OOS_MIHARI'), ctx);
  ['renderMihari','oosGenkanSelfCheck','oosGenkanAlarm'].forEach(n => vm.runInContext(H.cut(src, n), ctx));
  vm.runInContext('window.__oosMihariCount = {};', ctx);
  vm.runInContext('function renderAlerts(){}', ctx);
  return { box, dom };
}

/* ── ① 見張っているものが一覧に出るか ─────────────────── */
let { box, dom } = build();
eq('① 見張っているものの数', box.OOS_MIHARI.length, 5);
box.renderMihari();
const html = (dom.made['oos-mihari'] || {}).innerHTML || '';
eq('① 一覧が画面に作られる', html.length > 0, true);
eq('① 「在庫がなくて出荷できない注文」が載っている', html.indexOf('在庫がなくて出荷できない注文') >= 0, true);
eq('① 「倉庫へ送ったのに在庫を引いていない注文」が載っている', html.indexOf('倉庫へ送ったのに在庫を引いていない') >= 0, true);
eq('① 「取り置き期限が過ぎている」が載っている', html.indexOf('取り置き期限が過ぎている') >= 0, true);
eq('① 「支払期限ごえ」が載っている', html.indexOf('支払期限ごえ') >= 0, true);
eq('① まだ数えていないものは「確認中…」と出る', html.indexOf('確認中…') >= 0, true);
eq('① 「ここに書いていないものは見張っていません」と断っている', html.indexOf('見張っていません') >= 0, true);

/* ── ② 0件でも「0件」と出す（＝安心の根拠になる）───────── */
({ box, dom } = build());
box.window.__oosMihariCount = { zaikoNashi:0, notHikare:0, holdOver:0, holdSoon:0, overdue:0 };
box.renderMihari();
const h2 = (dom.made['oos-mihari'] || {}).innerHTML || '';
eq('② 0件のときも「0件」と数字が出る', (h2.match(/0件/g)||[]).length >= 5, true);
eq('② 「確認中…」は消えている', h2.indexOf('確認中…') < 0, true);

/* ── ③ 件数があれば赤い数字で出る ───────────────────── */
({ box, dom } = build());
box.window.__oosMihariCount = { zaikoNashi:2, notHikare:0, holdOver:0, holdSoon:0, overdue:0 };
box.renderMihari();
const h3 = (dom.made['oos-mihari'] || {}).innerHTML || '';
eq('③ 2件と出る', h3.indexOf('2件') >= 0, true);
eq('③ 赤で出る', h3.indexOf('#b91c1c') >= 0, true);

/* ── ④ 自己点検：正しいときは違反ゼロ ───────────────── */
({ box, dom } = build());
let v = box.oosGenkanSelfCheck();
eq('④ 正しいときは違反0件', v.length, 0);
eq('④ 赤い帯を出さない', !!dom.made['oos-genkan-alarm'], false);

/* ── ⑤ 自己点検：わざと壊すと気づくか ───────────────── */
({ box, dom } = build());
const real = box.OOS_ZAIKO.isWaitingForStock;
box.OOS_ZAIKO.isWaitingForStock = function(){ return false; };   // 何があっても「足りている」と嘘をつく
v = box.oosGenkanSelfCheck();
eq('⑤ 嘘をつくと気づく', v.length > 0, true);
eq('⑤ 赤い帯を出す', !!dom.made['oos-genkan-alarm'], true);
eq('⑤ 帯に「大丈夫と思わないでください」と書く',
   ((dom.made['oos-genkan-alarm']||{}).innerHTML||'').indexOf('思わないでください') >= 0, true);
box.OOS_ZAIKO.isWaitingForStock = real;

/* ── ⑥ 自己点検：見張り一覧が減っても気づくか ─────────── */
({ box, dom } = build());
box.OOS_MIHARI.length = 2;                                        // わざと減らす
v = box.oosGenkanSelfCheck();
eq('⑥ 見張り一覧が減ると気づく', v.some(function(s){ return s.indexOf('減っています') >= 0; }), true);

/* ── ⑦ 自己点検：親が読めないときも気づくか ─────────── */
({ box, dom } = build());
box.OOS_ZAIKO = undefined;
v = box.oosGenkanSelfCheck();
eq('⑦ 親が読めないと気づく', v.some(function(s){ return s.indexOf('oos-zaiko.js') >= 0; }), true);

/* ── ⑧ 在庫の判定そのもの（親）が正しいか ─────────────── */
({ box, dom } = build());
const P=[{id:1,sku:'T',name:'点検用',boxQty:1}];
const o={status:'pending',notified:false,stockDeducted:false,lines:[{productId:1,bottles:1,boxes:0,boxQty:1,condition:'normal'}]};
eq('⑧ 在庫0なら「出荷できない」', box.OOS_ZAIKO.isWaitingForStock(o,{lots:[{pid:1,status:'new',stock:0}],defects:[],holds:[]},P), true);
eq('⑧ 在庫があれば出さない',     box.OOS_ZAIKO.isWaitingForStock(o,{lots:[{pid:1,status:'new',stock:5}],defects:[],holds:[]},P), false);

console.log('===== 玄関のアラート =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
