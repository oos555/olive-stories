/* 🧮 輸入準備計算室「🅱 輸入する本数から計算」の見張り（2026-11-04・承認済みモック mocks/mock_輸入E_準備計算_輸入本数から_2026-11-04.html）
   本物の import.html から prep* を抜き出して動かす。答え合わせの相手はモックの数字。
   使い方： node tests/test_prep_bottles.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const REPO = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'import.html'), 'utf8').replace(/\r\n/g, '\n');

function slice(from, to){
  const a = html.indexOf(from); if(a < 0) throw new Error('not found: ' + from);
  const b = html.indexOf(to, a); if(b < 0) throw new Error('not found: ' + to);
  return html.slice(a, b);
}
let code = '';
code += slice('var PREP_PRODUCTS = [', 'function prepRender(){');
code += slice('function prepSetHowMode(', '/* ===== 保存：この端末');
code += slice('var PREP_LS_KEY=', 'function prepSaveLocal(){');
code += slice('function prepClearForNext(){', 'function prepGasStatus(');
code += slice('function prepMigNote(n){', '\n');

const calls = [];
const ctx = {
  console, Math, JSON, Number, String, Array, Object, Date, isNaN, parseInt,
  localStorage: { setItem(){}, removeItem(){}, getItem(){ return null; } },
  document: { getElementById(){ return null; } },
  window: {}, OOS_PRODUCTS: [],
  confirm(){ return true; }, alert(m){ calls.push('alert:'+m); },
  showSyncStatus(){}, prepGasSaveSoon(){ calls.push('gasSoon'); }, prepGasSave(){ calls.push('gasSave'); },
  prepRender(){ calls.push('render'); }, prepRenderHistory(){}, prepRenderTableMemo(){},
  prepMcell(id,f,l,v){ return String(v==null?'—':v); }, prepRemoveProduct(){}, prepSetManual(){}, prepManualOn(){}, prepManualOff(){},
};
vm.createContext(ctx);
vm.runInContext(code, ctx);
vm.runInContext('function prepSaveLocal(){ calls.push("saveLocal"); }', ctx);
ctx.calls = calls;

let pass = 0, fail = 0;
function ok(cond, msg){ if(cond){ pass++; console.log('  PASS ' + msg); } else { fail++; console.log('  FAIL ' + msg); } }
const run = (s) => vm.runInContext(s, ctx);

/* ── モックの例（入数は PREP_PRODUCTS のまま）── */
const MOCK = {
  ORG100:{imp:470, box:20, n:480, yobi:10, res:120, sell:360},
  ORG250:{imp:380, box:19, n:380, yobi:0,  res:300, sell:80},
  ORG500:{imp:61,  box:6,  n:72,  yobi:11, res:48,  sell:24},
  ORG750:{imp:23,  box:2,  n:24,  yobi:1,  res:24,  sell:0},
  ORG2L: {imp:18,  box:3,  n:18,  yobi:0,  res:18,  sell:0},
  ORG5L: {imp:null,box:0,  n:0,   yobi:0,  res:null,sell:0},
  MEM100:{imp:480, box:20, n:480, yobi:0,  res:72,  sell:408},
  MEM250:{imp:41,  box:3,  n:60,  yobi:19, res:40,  sell:20},
  MEM500:{imp:12,  box:1,  n:12,  yobi:0,  res:null,sell:12},
  MEM750:{imp:24,  box:2,  n:24,  yobi:0,  res:24,  sell:0},
  CHF250:{imp:20,  box:1,  n:20,  yobi:0,  res:40,  sell:-20},
  MISC002:{imp:72, box:6,  n:72,  yobi:0,  res:null,sell:72},
  ZAKURO:{imp:25,  box:2,  n:48,  yobi:23, res:null,sell:48},
};
console.log('テスト1：🅱 モックの数字がそのまま出る');
/* まっさら（0）から始めて、モックの数字だけ入れる。MISC002・ZAKURO は入数が無いので保存と同じ 12・24 を入れる */
run('prepClearForNext(); prepRemoved=[]; prepAdded=[]; prepHowMode="bottles";');
run('prepFind("MISC002").box=12; prepFind("ZAKURO").box=24;');
Object.keys(MOCK).forEach(id => { const m = MOCK[id]; run('prepFind('+JSON.stringify(id)+').impN='+JSON.stringify(m.imp)+'; prepFind('+JSON.stringify(id)+').res='+JSON.stringify(m.res)+';'); });
const rows = run('prepCalc()');
const by = {}; rows.forEach(r => by[r.p.id] = r);
Object.keys(MOCK).forEach(id => {
  const m = MOCK[id], r = by[id];
  ok(r && (r.finalBox||0) === m.box && r.finalN === m.n && r.yobi === m.yobi && r.sell === m.sell,
     id + '：'+(m.imp==null?'空':m.imp+'本')+' → ' + m.box + '箱・' + m.n + '本・予備' + m.yobi + '・販売できる数' + m.sell + '（実際 ' + (r?[(r.finalBox||0), r.finalN, r.yobi, r.sell].join('/'):'なし') + '）');
});
const sumNF = (f) => rows.filter(r => !r.noFarm).reduce((a, r) => a + (r[f]||0), 0);
ok(sumNF('impN') === 1626, '合計 ① 輸入する本数 1,626');
ok(rows.filter(r=>!r.noFarm).reduce((a,r)=>a+((r.finalBox!=null)?r.finalBox:0),0) === 85, '合計 最終箱数 85箱');
ok(sumNF('finalN') === 1690, '合計 最終本数 1,690');
ok(sumNF('yobi') === 64, '合計 予備 64本');
ok(rows.reduce((a,r)=>a+(r.res||0),0) === 686, '合計 予約数 686');
ok(rows.reduce((a,r)=>a+(r.sell||0),0) === 1004, '合計 販売できる数 1,004');
ok(by.YS100.noFarm === true && by.YS100.finalN === 0, 'セット品（農園に出さない）は 0 のまま');

console.log('テスト2：予備の文言');
const yobiHtml = (id) => run('prepYobiHtml(prepCalc().filter(function(r){return r.p.id==='+JSON.stringify(id)+';})[0])');
ok(yobiHtml('ORG750').indexOf('1本') >= 0 && yobiHtml('ORG750').indexOf('24 − 23（1本足りなかった分）') >= 0, 'ORG750 23本 → 「1本」「24 − 23（1本足りなかった分）」');
ok(yobiHtml('ZAKURO').indexOf('23本') >= 0 && yobiHtml('ZAKURO').indexOf('48 − 25（1本多かった分）') >= 0, 'ザクロ 25本 → 「23本」「48 − 25（1本多かった分）」');
ok(yobiHtml('MEM250').indexOf('19本') >= 0 && yobiHtml('MEM250').indexOf('60 − 41（1本多かった分）') >= 0, 'MEM250 41本 → 「19本」「60 − 41（1本多かった分）」');
ok(yobiHtml('ORG100').indexOf('10本') >= 0 && yobiHtml('ORG100').indexOf('480 − 470') >= 0 && yobiHtml('ORG100').indexOf('分）') < 0, 'ORG100 470本 → 「10本」「480 − 470」（理由なし）');
ok(yobiHtml('ORG250').indexOf('ぴったり') >= 0, 'ORG250 380本 → 「ぴったり」');
ok(yobiHtml('ORG5L').indexOf('—') >= 0, '空 → 「—」');

console.log('テスト3：表の列（モックと同じ順・同じ文言）');
const table = run('prepBottlesTableHtml(prepCalc())');
const ths = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g,'').replace(/\s+/g,''));
const want = ['商品名','品番','容量','容器','入数','①輸入する本数(入力)','🚚農園に発注＝輸入するのはここ⬇️','予備箱にぴったりでない分','②予約数(入力・あとから)','販売できる数最終本数−予約数','農園に発注しない','⬇️最終箱数','⬇️最終本数'];
ok(JSON.stringify(ths) === JSON.stringify(want), '見出し13個が順番どおり ' + JSON.stringify(ths));
ok(table.indexOf('🅱 の流れ：① <b>輸入する本数</b>を入れる → 箱数・予備はひとりでに出る → ② あとから<b>予約数</b>を入れる → <b>販売できる数</b>が出る') >= 0, '流れの一文');
ok(table.indexOf('✏ 手で決める') >= 0 && table.indexOf('🗑') >= 0, '「✏ 手で決める」「🗑」はそのまま');
ok(table.indexOf('color:#c00') >= 0, '予約が多いときは赤いマイナス（CHF250 -20）');

console.log('テスト4：🅰 はそのまま／切り替えが共有保存に残る／まっさらで ① も消える');
run('prepHowMode="target"; prepFind("ORG100").stock=525; prepFind("ORG100").res=120; prepFind("ORG100").target=365;');
const a = run('prepCalc().filter(function(r){return r.p.id==="ORG100";})[0]');
ok(a.want === 0 && a.finalN === 0, '🅰 ORG100：在庫525・予約120・目標365 → 足りない分0（前回と同じ式）');
run('prepFind("ORG100").target=500;');
const a2 = run('prepCalc().filter(function(r){return r.p.id==="ORG100";})[0]');
ok(a2.want === 95 && a2.finalBox === 4 && a2.finalN === 96, '🅰 ORG100：目標500 → 95本 → 4箱 96本（前回と同じ式）');
run('prepSetHowMode("bottles")');
ok(run('prepBuildState().howMode') === 'bottles' && calls.indexOf('saveLocal') >= 0, '切り替えると保存される（howMode）');
ok(run('prepBuildState().p.ORG100.impN') === 470, '① 輸入する本数が保存に入る（impN）');
run('prepApplyState({v:1,howMode:"target",p:{ORG100:{impN:7}}})');
ok(run('prepHowMode') === 'target' && run('prepFind("ORG100").impN') === 7, '読み戻しで howMode と impN が戻る');
run('prepHowMode="bottles"; prepClearForNext();');
ok(run('prepCalc().every(function(r){return r.finalN===0 && (r.p.impN==null);})') && run('prepHowMode') === 'bottles', 'まっさらで ① も空・やり方は残る');

console.log('\n結果: PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
