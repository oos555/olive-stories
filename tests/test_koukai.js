/* ══════════════════════════════════════════════════════════════════════
   「外に出してよい」の印（2026-09-25 ひろみさん・案A）
   モック：mocks/mock_統合マスタN_外に出してよい_2026-09-25.html
   決まったこと：Q1 商品も備品も全部に✅から始める／Q2 倉庫表示と重ならない色／Q3 倉庫表示の左／
   　　　　　　　Q4 押したら お届け先リスト（原本）も入れ替える（お客様のコピーは変わらない）
   統合マスタＮの本物の関数を動かして確かめます。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const src = fs.readFileSync(path.join(__dirname, '..', 'master.html'), 'utf8');
let pass = 0, fail = 0; const fails = [];
function eq(name, a, b){ if(a === b){ pass++; } else { fail++; fails.push(name + '  期待:' + b + '  実際:' + a); } }

function sandbox(products){
  const sent = [], gets = [], status = [];
  let rendered = 0;
  const box = { console, JSON, String, Promise, Date, Object, setTimeout: (f) => { f(); return 1; }, clearTimeout(){},
    GAS_URL: 'https://gas.example/exec', PRODUCTS: products, EXTRA_FIELDS: [],
    saveProductsToCache(){}, renderMeibo(){ rendered++; }, alert(m){ status.push('alert:' + m); },
    showSyncStatus(m){ status.push(m); }, mDash(){ return '—'; },
    fetch: async (u, o) => {
      if(o && o.method === 'POST'){ sent.push(JSON.parse(o.body)); return { json: async () => ({ status:'ok' }) }; }
      gets.push(u); return { text: async () => JSON.stringify({ status:'ok', kazu: 44 }) };
    } };
  vm.createContext(box);
  /* esc は master.html では1行に書かれていて切り出せないので、同じ中身をここで用意します */
  box.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  vm.runInContext(H.cut(src, 'meiboFieldOf') + '\n' + H.cutVar(src, 'OOS_KOUKAI_COL') + ';\n'
    + ['meiboIsKoukai', 'meiboKoukaiCell', 'meiboToggleKoukai', 'meiboKoukaiHinagataIrekae'].map(n => H.cut(src, n)).join('\n')
    + '\nvar _koukaiIrekaeTimer = null;', box);
  return { box, sent, gets, status, get rendered(){ return rendered; } };
}

(async function(){
  try{
    const P = [{ sku:'ORG100', name:'オルガニック 100ml', extras:{ '外に出してよい':'○' } },
               { sku:'NEW01', name:'新しい商品', extras:{} },
               { sku:'BAG001', name:'紙袋 黒 小', extras:{ '外に出してよい':'×' } }];
    const t = sandbox(P);
    eq('① ○ の商品は「✅ 出してよい」', /✅ 出してよい/.test(t.box.meiboKoukaiCell(P[0])), true);
    eq('① 新しい商品（空）は「― 出さない」', /― 出さない/.test(t.box.meiboKoukaiCell(P[1])), true);
    eq('① × の商品は「― 出さない」', /― 出さない/.test(t.box.meiboKoukaiCell(P[2])), true);
    eq('② 色：倉庫表示（緑 #e7f1dc・赤 #fde8e8）と重ならない', !/#e7f1dc|#fde8e8/.test(t.box.meiboKoukaiCell(P[0]) + t.box.meiboKoukaiCell(P[1])), true);

    await t.box.meiboToggleKoukai('ORG100');
    for(let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));   /* 入れ替えの通信が終わるのを待つ */
    eq('③ ✅を押すと「外に出してよい」だけを × で保存', JSON.stringify(t.sent[0]), JSON.stringify({ action:'saveOneProduct', product:{ sku:'ORG100', '外に出してよい':'×' } }));
    eq('③ 画面の印もすぐ「― 出さない」に', /― 出さない/.test(t.box.meiboKoukaiCell(P[0])), true);
    eq('④ 押したら、お届け先リスト（原本）の商品も入れ替える', t.gets.some(u => /action=oosOkyakuHinagata(&|$)/.test(u) && !/kakunin|dry|tameshi|tsukurinaoshi|kokai/.test(u)), true);
    eq('④ 入れ替えたことを画面に出す', t.status.some(m => /お届け先リスト（原本）の商品を入れ替えました（44品）/.test(m)), true);
    await t.box.meiboToggleKoukai('NEW01');
    eq('③ ― を押すと ○ で保存', t.sent[1] && t.sent[1].product['外に出してよい'], '○');
  }catch(e){ fail++; fails.push('動かせませんでした：' + e.message); }

  /* ⑤ 列の場所：見出しも行も「倉庫表示」の左（Q3）。見出しの数と meiboColCount がそろっている */
  const th = src.slice(src.indexOf('<table class="tbl meibotbl"><thead><tr>'), src.indexOf('</tr></thead>', src.indexOf('<table class="tbl meibotbl"><thead><tr>')));
  eq('⑤ 見出し：外に出してよい → 倉庫表示 の順', th.indexOf('外に出して<br>よい') > 0 && th.indexOf('外に出して<br>よい') < th.indexOf('倉庫<br>表示'), true);
  const row = H.cut(src, 'renderMeibo');
  eq('⑤ 行：meiboKoukaiCell → meiboWarehouseCell の順', row.indexOf('meiboKoukaiCell(p)') > 0 && row.indexOf('meiboKoukaiCell(p)') < row.indexOf('meiboWarehouseCell(p)'), true);
  const nTh = (th.match(/<th[\s>]/g) || []).length - 1;   /* 操作（編集のときだけ出る列）を除く */
  const cc = vm.runInNewContext(H.cut(src, 'meiboColCount') + ';meiboEditMode=false;meiboColCount()', { meiboEditMode:false });
  eq('⑤ 見出しの数と meiboColCount（見るだけのとき）がそろっている', nTh, cc);
  /* ⑥ 説明とリンク（ひろみさん「このボタンなに？となりそうなので、説明とリンクを分かりやすいところに」） */
  const iSetsu = src.indexOf('「外に出してよい」の列とは？'), iTbl = src.indexOf('<table class="tbl meibotbl">');
  eq('⑥ 表のすぐ上に説明がある', iSetsu > 0 && iSetsu < iTbl && iTbl - iSetsu < 2500, true);
  eq('⑥ 説明の中にお届け先リスト（原本）へのリンク', src.slice(iSetsu, iTbl).indexOf('📄 お届け先リスト（原本）を開く') > 0, true);

  console.log('===== 外に出してよい =====');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(x => console.log('  ' + x)); }
  process.exit(fail ? 1 : 0);
})();
