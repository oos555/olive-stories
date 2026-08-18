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
eq('① 見張っているものの数', box.OOS_MIHARI.length, 6);   /* ★2026-08-18 賞味期限8か月を追加。減らしてはいけない */
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
box.window.__oosMihariCount = { zaikoNashi:0, notHikare:0, holdOver:0, holdSoon:0, overdue:0, expSoon:0 };
box.renderMihari();
const h2 = (dom.made['oos-mihari'] || {}).innerHTML || '';
eq('② 0件のときも「0件」と数字が出る', (h2.match(/0件/g)||[]).length >= 5, true);
eq('② 「確認中…」は消えている', h2.indexOf('確認中…') < 0, true);

/* ── ③ 件数があれば赤い数字で出る ───────────────────── */
({ box, dom } = build());
box.window.__oosMihariCount = { zaikoNashi:2, notHikare:0, holdOver:0, holdSoon:0, overdue:0, expSoon:0 };
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


/* ══════ ⑨ 賞味期限まで残り8か月を切った商品（2026-08-18 ひろみさん指示） ══════
   「賞味期限ぎりぎりに連絡をもらっても困る。8か月前になったらアラート欲しい」
   数えるのは【商品の数】。ロットの数ではない。★消さないでください */
(function(){
  var ecode = '';
  ['oosParseExpiry','oosExpSoonProducts'].forEach(function(n){
    try{ ecode += H.cut(src, n) + String.fromCharCode(10); }catch(e){ fail++; fails.push('★ 関数が消えています: '+n); }
  });
  var er = H.makeSandbox({}); var ectx = er.ctx; var ebox = er.box;
  try{ vm.runInContext(H.cutVar(src, 'OOS_EXP_MONTHS'), ectx); }catch(e){ fail++; fails.push('★ OOS_EXP_MONTHS が消えています'); }
  try{ vm.runInContext(ecode, ectx); }catch(e){ fail++; fails.push('★ 賞味期限の関数が動きません: '+e.message); }
  eq('⑨ 8か月のままか', ebox.OOS_EXP_MONTHS, 8);
  function ym(mo){ var d=new Date(); d.setMonth(d.getMonth()+mo); return d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate(); }
  var P=[{id:1,sku:'A'},{id:2,sku:'B'}];
  eq('⑨ 7か月後は数える',   ebox.oosExpSoonProducts([{pid:1,status:'new',stock:10,expiry:ym(7)}],P).length, 1);
  eq('⑨ 9か月後は数えない', ebox.oosExpSoonProducts([{pid:1,status:'new',stock:10,expiry:ym(9)}],P).length, 0);
  eq('⑨ すでに切れたものも数える', ebox.oosExpSoonProducts([{pid:1,status:'new',stock:10,expiry:ym(-2)}],P).length, 1);
  eq('⑨ 在庫0は数えない',   ebox.oosExpSoonProducts([{pid:1,status:'new',stock:0,expiry:ym(1)}],P).length, 0);
  eq('⑨ 廃棄は数えない',     ebox.oosExpSoonProducts([{pid:1,status:'discard',stock:9,expiry:ym(1)}],P).length, 0);
  eq('⑨ 輸入予定は数えない', ebox.oosExpSoonProducts([{pid:1,status:'incoming',stock:9,expiry:ym(1)}],P).length, 0);
  eq('⑨ 期限が読めないものは数えない', ebox.oosExpSoonProducts([{pid:1,status:'new',stock:9,expiry:''}],P).length, 0);
  eq('⑨ ★同じ商品にロットが2つでも1商品',
     ebox.oosExpSoonProducts([{pid:1,status:'new',stock:9,expiry:ym(1)},{pid:1,status:'old',stock:9,expiry:ym(2)}],P).length, 1);
  eq('⑨ 商品が2つなら2',
     ebox.oosExpSoonProducts([{pid:1,status:'new',stock:9,expiry:ym(1)},{pid:2,status:'new',stock:9,expiry:ym(2)}],P).length, 2);
  eq('⑨ 2027-01 の形も読める', !!ebox.oosParseExpiry('2027-01'), true);
  eq('⑨ 2028.9.15 の形も読める', !!ebox.oosParseExpiry('2028.9.15'), true);
  eq('⑨ 見張り一覧に入っている', src.indexOf("key:'expSoon'") >= 0, true);
  eq('⑨ 見本にも入っている', src.indexOf('⏳ 賞味期限まで残り8か月を切った商品') >= 0, true);
  eq('⑨ お庭に混ぜている', src.indexOf('__oosExpSoon') >= 0, true);
})();

console.log('===== 玄関のアラート =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
