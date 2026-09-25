/* ══════════════════════════════════════════════════════════════════════
   統合マスタＮ 2026-09-25 の直し（ひろみさん）
   ① 単位表示：全部の商品に書いた。「間違えたら私が修正できるように、選べるようにしてほしい」→ 表の中の▼で選んで保存
   ② 小口卸取引先：「合計本数は不要」
   ③ ログのタブ：「使ってないと、タブに書いて置いて。そのうち消そう」
   統合マスタＮの本物の関数を動かして確かめます。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname, '..', 'master.html'), 'utf8');
let pass = 0, fail = 0; const fails = [];
function eq(name, a, b){ if(a === b){ pass++; } else { fail++; fails.push(name + '  期待:' + b + '  実際:' + a); } }

(async function(){
  try{
    const sent = [], status = [];
    const P = [{ sku:'ORG100', name:'オルガニック 100ml', group:'オルガニック', extras:{ '単位表示':'瓶' } },
               { sku:'ETC-001', name:'ザクロソース', group:'オイル以外輸入商品', extras:{} }];
    const box = { console, JSON, String, Object, Promise, GAS_URL:'https://gas.example/exec', PRODUCTS:P, EXTRA_FIELDS:[],
      OOS_SHORUI:{ taniOf: (p) => { const e = (p.extras||{}); return String(e['単位表示']||e['単位']||'').trim() || '本'; } },
      saveProductsToCache(){}, renderMeibo(){}, alert(m){ status.push('alert:'+m); }, showSyncStatus(m){ status.push(m); }, mDash(){ return '—'; },
      fetch: async (u, o) => { sent.push(JSON.parse(o.body)); return { json: async () => ({ status:'ok' }) }; } };
    box.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    vm.createContext(box);
    vm.runInContext(H.cutVar(src, 'OOS_TANI_ERABU') + ';\n' + H.cut(src, 'meiboTaniCell') + '\n' + H.cut(src, 'meiboTaniErabu'), box);
    const c1 = box.meiboTaniCell(P[0]);
    eq('① 単位は▼（選ぶ形）', /^<select /.test(c1), true);
    eq('① いまの単位（瓶）が選ばれている', /<option value="瓶" selected>瓶<\/option>/.test(c1), true);
    eq('① 選べる単位：瓶・缶・個・冊・枚・箱・セット・本', ['瓶','缶','個','冊','枚','箱','セット','本'].every(t => c1.indexOf('<option value="'+t+'"') >= 0), true);
    const c2 = box.meiboTaniCell(P[1]);
    eq('① 書いていない商品は「（自動：…）」が選ばれている', /<option value="" selected>（自動：本）<\/option>/.test(c2), true);
    await box.meiboTaniErabu('ORG100', '個', null);
    eq('① 選ぶと「単位表示」だけを保存', JSON.stringify(sent[0]), JSON.stringify({ action:'saveOneProduct', product:{ sku:'ORG100', '単位表示':'個' } }));
    eq('① 画面の単位もすぐ変わる', box.meiboTaniCell(P[0]).indexOf('<option value="個" selected>') >= 0, true);
    await box.meiboTaniErabu('ORG100', '', null);
    eq('① 「（自動）」を選ぶと空で保存', sent[1] && sent[1].product['単位表示'], '');
  }catch(e){ fail++; fails.push('① 動かせませんでした：' + e.message); }

  /* 編集画面も選ぶ形 */
  eq('① 名簿を直す画面の単位表示も▼', src.indexOf('<select id="mp-tani">') > 0 && src.indexOf("fg('単位表示（空でOK）','mp-tani'") < 0, true);

  /* ② 小口卸取引先：合計本数の列が無い（本物の renderPartnerMatrix を動かす） */
  try{
    const els = { 'partner-matrix-head': { innerHTML:'' }, 'partner-matrix-body': { innerHTML:'' } };
    const box2 = { console, document:{ getElementById: id => els[id] },
      salesPartners:[{ id:'a', name:'葛西さん' }], PRODUCTS:[{ sku:'ORG100', name:'オルガニック 100ml', group:'オルガニック' }],
      mGroupOrder: () => ['オルガニック'], mIsActive: () => true, mPriceFor: () => null, partnerPriceFor: () => 1000,
      partnerSoldQty: () => 3, yen: n => '¥' + n };
    box2.esc = s => String(s == null ? '' : s);
    vm.createContext(box2);
    vm.runInContext(H.cut(src, 'renderPartnerMatrix'), box2);
    box2.renderPartnerMatrix();
    eq('② 小口卸取引先の見出しに「合計本数」が無い', els['partner-matrix-head'].innerHTML.indexOf('合計本数') < 0 && /葛西さん/.test(els['partner-matrix-head'].innerHTML), true);
    eq('② 区分の行は 商品＋取引先の数 のはば', /colspan="2"/.test(els['partner-matrix-body'].innerHTML), true);
  }catch(e){ fail++; fails.push('② 動かせませんでした：' + e.message); }

  /* ③ ログのタブ */
  eq('③ ログのタブに「使っていません」', /showPanel\('ilog',this\)[^>]*>🕓 ログ（使っていません）<\/button>/.test(src), true);

  console.log('===== 統合マスタＮ 単位・小口・ログ（2026-09-25） =====');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(x => console.log('  ' + x)); }
  process.exit(fail ? 1 : 0);
})();
