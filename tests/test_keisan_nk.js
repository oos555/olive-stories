/* ══════════════════════════════════════════════════════════════════════
   🧮 計算用（NK）：利益ヒートマップの右端の「値上げを考えるためのマス」
   2026-11-10 ひろみさん承認（モック mocks/mock_輸入E_値上げ計算用_2026-11-10.html）
   　第1版 原文「1 A　2名前は計算用　３　いる　４　いる　５確認梨で残す」
   　　①価格マスタに列を足す ②名前は「計算用」・記号NK ③「値上げ率で入れる」あり ④「今の価格とくらべて」あり ⑤確認なしで残す
   　第2版（同日）原文「計算用の中で、定価と卸と両方計算できるようにしてほしい。計算用定価、計算用卸っていうのを作りたい」
   　　⑥列は2本：計算用定価（NK-TK・12列目 priceKeisan）と計算用卸（NK-OS・13列目 priceKeisanOroshi）
   　　⑦計算用卸の販売店の儲け・掛は計算用定価から（空なら今の定価）。計算用定価の販売店の儲けは0
   　　⑧出発点：計算用定価は今の定価、計算用卸は今の卸①　⑨「🧮 計算用の組み合わせ」の行

   ここで見張ること：
   　・GAS（本物の saveAllData）：12・13列目が保存される／1マス変えても他の商品・他の欄が動かない／
   　　古い11列のシートでも壊れない／消す(null)と0になる／欄を送らない古いアプリ経由でも消えない
   　・import.html：列が右端に2本・段の定義にある・文言がモックどおり・確認なしで残す・
   　　お客様の価格の道（oos-kakaku.js）には計算用が入っていない・計算用卸の儲けが計算用定価から出る
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function ok(label, cond){ if(cond) pass++; else { fail++; fails.push(label); } }
function eq(label, got, want){
  if(got === want) pass++; else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}

/* ── GAS（手元に無ければ飛ばす。公開リポジトリには置かない） ───────────────── */
let gasSrc = null;
try{ gasSrc = H.readGas(); }catch(e){ console.log('  GASのファイルが手元にありません → ①〜⑤は飛ばしました'); }

const PM13 = ['sku','productName','priceGeneral','priceWholesale1','priceWholesale2','priceRT','priceDefect','taxRate','priceBasara','priceSpecial','priceOldLot','priceKeisan','priceKeisanOroshi'];
/* 価格マスタの身代わりシート。rowsの列数は 11（古いシート）でも 13（新しいシート）でもよい */
function makeSheet(initialRows, ncols){
  let rows = initialRows.map(r => r.slice());
  return {
    _rows: () => rows,
    getLastRow(){ return rows.length + 1; },
    getLastColumn(){ return ncols; },
    getRange(r, c, nr, nc){
      return {
        getValues(){
          if(r === 1) return [PM13.slice(0, nc)];
          return rows.slice(r-2, r-2+nr).map(x => { const y = x.slice(0, nc); while(y.length < nc) y.push(''); return y; });
        },
        setValues(v){ if(r === 1) return; rows = v.map(x => x.slice()); },
        setBackground(){ return this; }, setFontColor(){ return this; }, setFontWeight(){ return this; }
      };
    },
    clearContents(){ rows = []; },
    insertSheet(){ return this; }
  };
}
function gasBox(sheet){
  const G = H.makeSandbox({
    SpreadsheetApp: { openById(){ return { getSheetByName(n){ return (n === '価格マスタ') ? sheet : null; }, insertSheet(){ return sheet; } }; } },
    SHEET_ID_MAIN: 'x',
    loadProducts(){ throw new Error('no products in this test'); },
    Logger: { log(){} }
  });
  vm.runInContext(H.cutVar(gasSrc, 'OOS_PAYLOAD_SHEET_MAP'), G.ctx);
  ['oosGuardEmptyPayload_','saveAllData'].forEach(n => vm.runInContext(H.cut(gasSrc, n), G.ctx));
  return G;
}

if(gasSrc){
  /* ① 古い11列のシートに、計算用定価・計算用卸を入れる → 12・13列目に入る。他の商品・他の欄は動かない */
  {
    const sheet = makeSheet([
      ['ORG250','オルガニック250ml',4750,3388,3200,3800,0,0.08,3388,0,0],
      ['MEM500','メメジック500ml',9120,6228,6000,6884,0,0.08,6228,0,0]
    ], 11);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceKeisan:5200 }] });
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceKeisanOroshi:4000 }] });
    const rows = sheet._rows();
    const org = rows.find(r => r[0]==='ORG250'), mem = rows.find(r => r[0]==='MEM500');
    eq('① 計算用定価が12列目に入る', org[11], 5200);
    eq('① 計算用卸が13列目に入る（計算用定価は残る）', org[12], 4000);
    eq('① 同じ商品の定価は動かない', org[2], 4750);
    eq('① 同じ商品のバサラは動かない', org[8], 3388);
    eq('① 送っていない商品(MEM500)は残る', mem[0], 'MEM500');
    eq('① 送っていない商品の計算用は0のまま', mem[11], 0);
    eq('① 送っていない商品の計算用卸も0のまま', mem[12], 0);
    eq('① 行は13列で書かれる', org.length, 13);
  }
  /* ② 計算用を消す（null）→ 0 になる。続けて別の商品を消しても最初のが戻らない */
  {
    const sheet = makeSheet([
      ['ORG250','オルガニック250ml',4750,3388,3200,3800,0,0.08,3388,0,0,5200,4000],
      ['MEM500','メメジック500ml',9120,6228,6000,6884,0,0.08,6228,0,0,9900,7000]
    ], 13);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceKeisan:null }, { sku:'MEM500', priceKeisan:9900 }] });
    eq('② nullで消すと0になる', sheet._rows().find(r => r[0]==='ORG250')[11], 0);
    eq('② 同じ商品の計算用卸は残る', sheet._rows().find(r => r[0]==='ORG250')[12], 4000);
    eq('② 消していない方は残る', sheet._rows().find(r => r[0]==='MEM500')[11], 9900);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceKeisan:0 }, { sku:'MEM500', priceKeisanOroshi:null }] });
    eq('② 2つ目を消しても1つ目は0のまま', sheet._rows().find(r => r[0]==='ORG250')[11], 0);
    eq('② 2つ目（計算用卸）も0になる', sheet._rows().find(r => r[0]==='MEM500')[12], 0);
    eq('② 2つ目の計算用定価は残る', sheet._rows().find(r => r[0]==='MEM500')[11], 9900);
  }
  /* ③ 欄そのものを送らない古いアプリ経由でも、計算用は消えない（2026-08-12のマージの守りが12・13列目にも効く） */
  {
    const sheet = makeSheet([['TGR100','唐辛子オイル100ml',2700,2040,1900,2200,0,0.08,2040,0,0,3000,2300]], 13);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'TGR100', priceBasara:2100 }] });
    eq('③ 他の欄だけ送っても計算用定価は残る', sheet._rows()[0][11], 3000);
    eq('③ 他の欄だけ送っても計算用卸は残る', sheet._rows()[0][12], 2300);
    eq('③ 送った欄は反映される', sheet._rows()[0][8], 2100);
  }
  /* ④ 空の配列では何も消えない（EMPTY_GUARD） */
  {
    const sheet = makeSheet([['PRI250','プリモフルット250ml',4750,3388,3200,3800,0,0.08,3388,0,0,5000,3900]], 13);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [] });
    eq('④ 空配列でも価格マスタは無傷', sheet._rows()[0][11], 5000);
    eq('④ 空配列でも計算用卸も無傷', sheet._rows()[0][12], 3900);
  }
  /* ⑤ 読み込み（loadAllData）が priceKeisan / priceKeisanOroshi を返す。古い行でも落ちない（0） */
  {
    const loadSrc = H.cut(gasSrc, 'loadAllData');
    ok('⑤ loadAllData が priceKeisan を返す', /priceKeisan:\(r\.length > 11 \? r\[11\] : 0\)/.test(loadSrc));
    ok('⑤ loadAllData が priceKeisanOroshi を返す', /priceKeisanOroshi:\(r\.length > 12 \? r\[12\] : 0\)/.test(loadSrc));
    ok('⑤ saveAllData の headers に priceKeisan・priceKeisanOroshi（12・13列目）がある', /const headers = \[[^\]]*'priceOldLot','priceKeisan','priceKeisanOroshi'\]/.test(H.cut(gasSrc, 'saveAllData')));
    ok('⑤ saveAllData の _pmFields に priceKeisan・priceKeisanOroshi がある', /const _pmFields = \[[^\]]*'priceOldLot','priceKeisan','priceKeisanOroshi'\]/.test(H.cut(gasSrc, 'saveAllData')));
  }
}

/* ── import.html（画面） ────────────────────────────────────────────────── */
const im = H.read('import.html');
const hm = H.cut(im, 'renderProfitHeatmap');
const tiersSrc = H.cutVar(im, 'SIM_TIERS');
const mapSrc = H.cutVar(im, 'HM_KEY_TO_TIER');

/* ⑥ 列：右端が「計算用定価 NK-TK」「計算用卸 NK-OS」。9列の並びはそのまま */
ok('⑥ 見出しの一番右が 計算用定価（NK-TK）→ 計算用卸（NK-OS）', /特別提<br>供価格<br>[^<]*<span[^>]*>IT<\/span><\/th><th[^>]*>計算用<br>定価<br><span[^>]*>NK-TK<\/span><\/th><th[^>]*>計算用<br>卸<br><span[^>]*>NK-OS<\/span><\/th><\/tr><\/thead>/.test(hm));
ok('⑥ グループ行の colspan が 12', hm.indexOf('colspan="12"') >= 0 && hm.indexOf('colspan="11"') < 0 && hm.indexOf('colspan="10"') < 0);
ok('⑥ 列のループの最後が priceKeisan, priceKeisanOroshi（2か所）', (hm.match(/'priceSpecial','priceKeisan','priceKeisanOroshi'\]\.forEach/g) || []).length === 2);
ok('⑥ 空のマスは「＋計算」（本番の列の「＋設定」と区別）', hm.indexOf('>＋計算</td>') >= 0 && hm.indexOf('を計算できます') >= 0);
ok('⑥ 計算用卸の掛は計算用定価から（空なら定価から）', /priceKeisanOroshi[^\n]*priceRec\.priceKeisan/.test(hm) && hm.indexOf('_kakeBase') >= 0);

/* ⑦ 段の定義：keisan / keisan2 が最後・priceKeisan / priceKeisanOroshi・keisan:true・強い確認ではない */
ok('⑦ SIM_TIERS の最後が 計算用定価（NK-TK）→ 計算用卸（NK-OS）', /\{ tier:'keisan',\s*label:'計算用定価（NK-TK）',\s*field:'priceKeisan',\s*strong:false, keisan:true, kname:'計算用定価', kbase:'priceGeneral'/.test(tiersSrc) && /\{ tier:'keisan2',\s*label:'計算用卸（NK-OS）',\s*field:'priceKeisanOroshi',\s*strong:false, keisan:true, kname:'計算用卸',\s*kbase:'priceWholesale1'/.test(tiersSrc));
ok('⑦ HM_KEY_TO_TIER に priceKeisan→keisan・priceKeisanOroshi→keisan2', /priceKeisan:'keisan', priceKeisanOroshi:'keisan2'/.test(mapSrc));
ok('⑦ renderTier の master に keisan・keisan2', /keisan:\s*parseFloat\(rec\.priceKeisan\)/.test(H.cut(im, 'renderTier')) && /keisan2:\s*parseFloat\(rec\.priceKeisanOroshi\)/.test(H.cut(im, 'renderTier')));
ok('⑦ 500ml換算にも 計算用定価（NK-TK）・計算用卸（NK-OS）', /\{t:'keisan',\s*label:'計算用定価（NK-TK）'\},\s*\{t:'keisan2',\s*label:'計算用卸（NK-OS）'\}/.test(H.cut(im, 'renderPer500')));
ok('⑦ 価格マスタの最小の行に priceKeisan:0, priceKeisanOroshi:0（2か所）', (im.match(/priceKeisan:0, priceKeisanOroshi:0\}/g) || []).length === 2);

/* ⑧ 文言（モックどおり・一字一句）。計算用定価／計算用卸の名前は T.kname から */
const lsp = H.cut(im, 'loadSimPanel');
ok('⑧ 見出しは T.kname（計算用定価／計算用卸）', /tt\.textContent = T\.keisan \? T\.kname : T\.label/.test(lsp));
ok('⑧ 帯「🖐 いま計算中：」', lsp.indexOf('🖐 いま計算中： ') >= 0);
ok('⑧ ボタン「この金額を◯◯に残す」', lsp.indexOf("('この金額を' + T.kname + 'に残す')") >= 0);
ok('⑧ ボタン「🗑 ◯◯を消す」', lsp.indexOf("('🗑 ' + T.kname + 'を消す')") >= 0);
ok('⑧ バッジ「未計算」', /T\.keisan \? '未計算' : '未設定'/.test(lsp));
ok('⑧ 説明「◯◯はまだ空です（今の定価／卸① ¥… を出発点に始めます）」', lsp.indexOf("T.kname + 'はまだ空です（今の' + T.kbaseLabel + ' ¥'") >= 0 && lsp.indexOf(' を出発点に始めます）') >= 0);
ok('⑧ 出発点は T.kbase（計算用定価＝定価、計算用卸＝卸①）', /T\.keisan[^\n]*cur = parseFloat\(rec\[T\.kbase\]\)/.test(lsp));
ok('⑧ 段の表は「計算中」', /row\.keisan \? '計算中' : '調整中'/.test(H.cut(im, 'renderTier')));
ok('⑧ 利益率の行は「◯◯の利益率」', /\(T\.keisan \? T\.kname : T\.label\) \+ 'の利益率/.test(H.cut(im, 'renderTier')));
ok('⑧ 残したとき「✅ ◯◯に残しました（サーバー保存も確認済み）」', H.cut(im, 'applyRateToTierNow').indexOf("('✅ ' + T.kname + 'に残しました（サーバー保存も確認済み）')") >= 0);
ok('⑧ 消したとき「✅ ◯◯を消しました」', H.cut(im, 'clearTierPriceNow').indexOf("('✅ ' + T.kname + 'を消しました')") >= 0);
ok('⑧ 消す確認「…の ◯◯ ¥… を消します。よろしいですか？」＋「お客様の価格は変わりません」', /の '\+T\.kname\+' ¥'\+cur\.toLocaleString\(\)\+' を消します。よろしいですか？\\n\\n※お客様の価格は変わりません。/.test(H.cut(im, 'clearSelectedTier')));
ok('⑧ 元に戻す「残しました：」「消しました：」', /verb:\(T\.keisan \? '残しました' : '反映しました'\)/.test(H.cut(im, 'applyRateToTier')) && /verb:\(T\.keisan \? '消しました' : '反映しました'\)/.test(H.cut(im, 'clearSelectedTier')));
ok('⑧ 右パネルの箱：📈 値上げ率で入れる', im.indexOf('<h4 style="margin:0 0 7px;font-size:13px;font-weight:800;color:#4c1d95">📈 値上げ率で入れる</h4>') >= 0);
ok('⑧ 右パネルの箱：🔍 今の価格とくらべて（値上げ率）', im.indexOf('>🔍 今の価格とくらべて（値上げ率）</h4>') >= 0);
ok('⑧ 右パネルの行：🧮 計算用の組み合わせ', im.indexOf('id="sim-keisan-pair"') >= 0 && H.cut(im, 'renderKeisanPair').indexOf('🧮 <strong>計算用の組み合わせ</strong>') >= 0);
ok('⑧ 注意書き「ここで残した金額は計算用のメモです。お客様の価格は変わりません。」', im.indexOf('⚠️ ここで残した金額は<b>計算用のメモ</b>です。お客様の価格は変わりません。') >= 0);
ok('⑧ 記号のいみに NK-TK＝計算用定価・NK-OS＝計算用卸', im.indexOf('NK-TK＝計算用定価') >= 0 && im.indexOf('NK-OS＝計算用卸') >= 0);
ok('⑧ 4つの箱は計算用のときだけ出る', /\['sim-keisan-pct','sim-keisan-pair','sim-keisan-cmp','sim-keisan-warn'\]\.forEach/.test(lsp));

/* ⑨ 確認なしで残す（計算用だけ）。定価・卸①・RTの強い確認はそのまま */
const art = H.cut(im, 'applyRateToTier');
ok('⑨ 計算用は確認なし（ok = true）', /else if\(T\.keisan\)\{[\s\S]*?ok = true;/.test(art));
ok('⑨ 定価の「定価はほんとうに変えますか？」は残っている', art.indexOf('定価はほんとうに変えますか？') >= 0);
ok('⑨ 卸①・RTの強い確認は残っている', art.indexOf('は基本の価格です') >= 0);
ok('⑨ 残す道は既存の保存（取り直し→1マス→自己点検）をそのまま通る', art.indexOf('applyRateToTierNow(sku, T, price)') >= 0);
ok('⑨ 守り：取り直し・自己点検のコードは残っている', H.cut(im, 'applyRateToTierNow').indexOf('loadAllData&only=priceMaster') >= 0 && H.cut(im, 'applyRateToTierNow').indexOf('setFieldOnMaster(freshMaster, sku, T.field, price)') >= 0);

/* ⑩ お客様の価格の道には入れない：oos-kakaku.js（単価の親）に計算用は無い。統合マスタＮの価格リストにも出さない */
ok('⑩ oos-kakaku.js に priceKeisan は無い', H.read('oos-kakaku.js').indexOf('priceKeisan') < 0 && H.read('oos-kakaku.js').indexOf('計算用') < 0);
ok('⑩ master.html に priceKeisan は無い', H.read('master.html').indexOf('priceKeisan') < 0);
ok('⑩ billing.html / mitsumori.html / index.html に priceKeisan は無い', ['billing.html','mitsumori.html','index.html'].every(f => H.read(f).indexOf('priceKeisan') < 0));

/* ⑪ 本物の関数を動かす：今の価格とくらべて／値上げ率で入れる／計算用の組み合わせ／段の表（計算用卸の儲けは計算用定価から） */
{
  const els = {};
  const el = id => els[id] || (els[id] = { id, style:{}, innerHTML:'', textContent:'', value:'', onclick:null });
  const G = H.makeSandbox({ document: { getElementById: el, querySelector(){ return null; }, querySelectorAll(){ return []; } } });
  const REC = { priceGeneral:9121, priceWholesale1:6884, priceWholesale2:5473, priceRT:6884, priceBasara:0, priceOldLot:0, priceDefect:0, priceSpecial:0, priceKeisan:0, priceKeisanOroshi:0 };
  vm.runInContext([H.cutVar(im,'SIM_TIERS'), H.cutVar(im,'HM_KEY_TO_TIER')].join('\n') + '\n'
    + 'var currentSimSku = "ORG500"; var currentSimTier = "keisan"; var currentSimMl = 500; var currentTierPrice = 0; var currentW2Price = 0;\n'
    + 'var REC = ' + JSON.stringify(REC) + ';\n'
    + 'function priceRecForSku(){ return REC; }\nfunction getCostForSku(){ return 3200; }\nfunction esc(s){ return String(s); }\nfunction applyRateToTier(){}\n'
    + ['simTierByKey','renderKeisanCompare','renderKeisanPair','onKeisanPct','useKeisanPct','renderTier','pctSpan','marginTextColor','profitColor','renderPer500'].map(n => H.cut(im, n)).join('\n'), G.ctx);
  el('keisan-base').value = 'priceGeneral'; el('keisan-pct').value = '10';
  G.box.renderKeisanCompare(REC, 10033);
  const rows = el('keisan-cmp-rows').innerHTML;
  ok('⑪ 定価 ¥9,121 に対して ＋10.0％', rows.indexOf('定価（TK） ¥9,121') >= 0 && rows.indexOf('＋10.0％') >= 0);
  ok('⑪ 卸② ¥5,473 に対して ＋83.3％', rows.indexOf('卸②（OS2） ¥5,473') >= 0 && rows.indexOf('＋83.3％') >= 0);
  ok('⑪ 未設定のバサラは「未設定」', rows.indexOf('卸バサラスター（BA）</span><span style="color:#c9c3b5">未設定') >= 0);
  eq('⑪ 定価から10％上げると → ¥10,033', el('keisan-pct-result').textContent, '¥10,033');
  G.box.renderKeisanCompare({ priceGeneral:9121 }, 8500);
  ok('⑪ 定価より安いときは「－6.8％」', el('keisan-cmp-rows').innerHTML.indexOf('－6.8％') >= 0);

  /* 計算用定価を 10,000 で計算中（計算用卸はまだ空）→ 計算用卸の行は「-」、組み合わせは「計算用卸を入れると…」 */
  G.box.renderTier(10000, 'direct');
  let tb = el('sim-tier-tbody').innerHTML;
  ok('⑪ 段の表は10行（8段＋計算用定価＋計算用卸）', (tb.match(/<tr/g) || []).length === 10);
  ok('⑪ 計算用定価の行：販売店の儲けは ¥0（定価と同じ）', /計算用定価（NK-TK）[\s\S]*?計算中[\s\S]*?<td[^>]*>¥10,000[\s\S]*?<td[^>]*>¥6,800<\/td><td[^>]*>¥0<\/td>/.test(tb));
  ok('⑪ 卸①の行の販売店の儲けは今の定価から（¥9,121−¥6,884＝¥2,237）', tb.indexOf('¥2,237') >= 0);
  ok('⑪ 組み合わせ：計算用卸が空なら案内', el('sim-keisan-pair').innerHTML.indexOf('計算用卸を入れると、掛・販売店の儲け・うちの儲けがここに出ます') >= 0 && el('sim-keisan-pair').innerHTML.indexOf('計算用定価 <strong>¥10,000</strong>') >= 0);

  /* 計算用卸を 7,000 で計算中、計算用定価は 10,000 が残っている → 販売店の儲け＝10,000−7,000、掛＝7.0 */
  REC.priceKeisan = 10000; G.box.REC.priceKeisan = 10000;
  G.box.currentSimTier = 'keisan2';
  G.box.renderTier(7000, 'direct');
  tb = el('sim-tier-tbody').innerHTML;
  ok('⑪ 計算用卸の行：販売店の儲け ¥3,000（計算用定価 10,000 − 7,000）・7.0掛・うちの儲け ¥3,800', /計算用卸（NK-OS）[\s\S]*?計算中[\s\S]*?¥7,000 <span[^>]*>7\.0掛<\/span> ／[\s\S]*?<td[^>]*>¥3,800<\/td><td[^>]*>¥3,000<\/td>/.test(tb));
  ok('⑪ 計算用定価の行は 10,000 のまま出る', /計算用定価（NK-TK）<\/td><td[^>]*>¥10,000/.test(tb));
  ok('⑪ 卸①の行は今の定価のまま（計算用定価に引きずられない）', tb.indexOf('¥2,237') >= 0);
  const pair = el('sim-keisan-pair').innerHTML;
  ok('⑪ 組み合わせの行：計算用定価 ¥10,000 ／ 計算用卸 ¥7,000 → 7.0掛　販売店の儲け ¥3,000　うちの儲け ¥3,800', pair.indexOf('計算用定価 <strong>¥10,000</strong> ／ 計算用卸 <strong>¥7,000</strong>') >= 0 && pair.indexOf('7.0掛') >= 0 && pair.indexOf('販売店の儲け <strong style="color:#2b2a26">¥3,000</strong>') >= 0 && pair.indexOf('うちの儲け <strong>¥3,800</strong>') >= 0);
  ok('⑪ 利益率の行は「計算用卸の利益率 54.3%」', el('sim-marginline').innerHTML.replace(/<[^>]+>/g,'') === '計算用卸の利益率 54.3%');
  ok('⑪ 500ml換算に計算用卸（計算中）', el('p5-rows').innerHTML.indexOf('計算用卸（NK-OS）（計算中）') >= 0);

  /* 計算用定価が空のときは、計算用卸の儲けは今の定価から（9,121−7,000＝2,121） */
  G.box.REC.priceKeisan = 0;
  G.box.renderTier(7000, 'direct');
  ok('⑪ 計算用定価が空なら計算用卸の販売店の儲けは今の定価から ¥2,121', /計算用卸（NK-OS）[\s\S]*?<td[^>]*>¥3,800<\/td><td[^>]*>¥2,121<\/td>/.test(el('sim-tier-tbody').innerHTML));
  ok('⑪ 組み合わせの行：計算用定価は「未計算（今の定価 ¥9,121 で計算）」', el('sim-keisan-pair').innerHTML.indexOf('未計算（今の定価 ¥9,121 で計算）') >= 0);

  /* 値上げ率で入れる：卸②から15％ → 6,294 */
  el('keisan-base').value = 'priceWholesale2'; el('keisan-pct').value = '15';
  G.box.useKeisanPct();
  eq('⑪ 卸②から15％ → 6,294 を「この金額で見る」', el('sim-direct-input').value, 6294);
  el('keisan-base').value = 'priceBasara';
  eq('⑪ 未設定の価格からは「（その価格は未設定）」', (G.box.onKeisanPct(), el('keisan-pct-result').textContent), '（その価格は未設定）');
}

console.log('===== 🧮 計算用（NK）：値上げを考えるためのマス（2026-11-10・第2版 計算用定価＋計算用卸）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ★ ' + f)); }
process.exit(fail ? 1 : 0);
