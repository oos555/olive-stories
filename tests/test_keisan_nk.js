/* ══════════════════════════════════════════════════════════════════════
   🧮 計算用（NK）：利益ヒートマップの右端の「値上げを考えるためのマス」
   2026-11-10 ひろみさん承認（モック mocks/mock_輸入E_値上げ計算用_2026-11-10.html）
   　原文「1 A　2名前は計算用　３　いる　４　いる　５確認梨で残す」
   　①価格マスタに列を1本足す（priceKeisan・12列目） ②名前は「計算用」・記号NK
   　③「値上げ率で入れる」あり ④「今の価格とくらべて」あり ⑤確認なしで残す

   ここで見張ること：
   　・GAS（本物の saveAllData）：12列目が保存される／1マス変えても他の商品・他の欄が動かない／
   　　古い11列のシートでも壊れない／消す(null)と0になる／欄を送らない古いアプリ経由でも消えない
   　・import.html：列が右端にある・段の定義にある・文言がモックどおり・確認なしで残す・
   　　お客様の価格の道（oos-kakaku.js）には計算用が入っていない
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

const PM12 = ['sku','productName','priceGeneral','priceWholesale1','priceWholesale2','priceRT','priceDefect','taxRate','priceBasara','priceSpecial','priceOldLot','priceKeisan'];
/* 価格マスタの身代わりシート。rowsの列数は 11（古いシート）でも 12（新しいシート）でもよい */
function makeSheet(initialRows, ncols){
  let rows = initialRows.map(r => r.slice());
  return {
    _rows: () => rows,
    getLastRow(){ return rows.length + 1; },
    getLastColumn(){ return ncols; },
    getRange(r, c, nr, nc){
      return {
        getValues(){
          if(r === 1) return [PM12.slice(0, nc)];
          /* 本物のシートと同じく、無い列は '' で返す */
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
  /* ① 古い11列のシートに、計算用を1マスだけ入れる → 12列目に入る。他の商品・他の欄は動かない */
  {
    const sheet = makeSheet([
      ['ORG250','オルガニック250ml',4750,3388,3200,3800,0,0.08,3388,0,0],
      ['MEM500','メメジック500ml',9120,6228,6000,6884,0,0.08,6228,0,0]
    ], 11);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceKeisan:5200 }] });
    const rows = sheet._rows();
    const org = rows.find(r => r[0]==='ORG250'), mem = rows.find(r => r[0]==='MEM500');
    eq('① 計算用が12列目に入る', org[11], 5200);
    eq('① 同じ商品の定価は動かない', org[2], 4750);
    eq('① 同じ商品のバサラは動かない', org[8], 3388);
    eq('① 送っていない商品(MEM500)は残る', mem[0], 'MEM500');
    eq('① 送っていない商品の計算用は0のまま', mem[11], 0);
    eq('① 行は12列で書かれる', org.length, 12);
  }
  /* ② 計算用を消す（null）→ 0 になる。続けて別の商品を消しても最初のが戻らない */
  {
    const sheet = makeSheet([
      ['ORG250','オルガニック250ml',4750,3388,3200,3800,0,0.08,3388,0,0,5200],
      ['MEM500','メメジック500ml',9120,6228,6000,6884,0,0.08,6228,0,0,9900]
    ], 12);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceKeisan:null }, { sku:'MEM500', priceKeisan:9900 }] });
    eq('② nullで消すと0になる', sheet._rows().find(r => r[0]==='ORG250')[11], 0);
    eq('② 消していない方は残る', sheet._rows().find(r => r[0]==='MEM500')[11], 9900);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceKeisan:0 }, { sku:'MEM500', priceKeisan:null }] });
    eq('② 2つ目を消しても1つ目は0のまま', sheet._rows().find(r => r[0]==='ORG250')[11], 0);
    eq('② 2つ目も0になる', sheet._rows().find(r => r[0]==='MEM500')[11], 0);
  }
  /* ③ 欄そのものを送らない古いアプリ経由でも、計算用は消えない（2026-08-12のマージの守りが12列目にも効く） */
  {
    const sheet = makeSheet([['TGR100','唐辛子オイル100ml',2700,2040,1900,2200,0,0.08,2040,0,0,3000]], 12);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'TGR100', priceBasara:2100 }] });
    eq('③ 他の欄だけ送っても計算用は残る', sheet._rows()[0][11], 3000);
    eq('③ 送った欄は反映される', sheet._rows()[0][8], 2100);
  }
  /* ④ 空の配列では何も消えない（EMPTY_GUARD） */
  {
    const sheet = makeSheet([['PRI250','プリモフルット250ml',4750,3388,3200,3800,0,0.08,3388,0,0,5000]], 12);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [] });
    eq('④ 空配列でも価格マスタは無傷', sheet._rows()[0][11], 5000);
  }
  /* ⑤ 読み込み（loadAllData）が priceKeisan を返す。古い11列の行でも落ちない（0） */
  {
    const loadSrc = H.cut(gasSrc, 'loadAllData');
    ok('⑤ loadAllData が priceKeisan を返す', /priceKeisan:\(r\.length > 11 \? r\[11\] : 0\)/.test(loadSrc));
    ok('⑤ saveAllData の headers に priceKeisan（12列目）がある', /const headers = \[[^\]]*'priceOldLot','priceKeisan'\]/.test(H.cut(gasSrc, 'saveAllData')));
    ok('⑤ saveAllData の _pmFields に priceKeisan がある', /const _pmFields = \[[^\]]*'priceOldLot','priceKeisan'\]/.test(H.cut(gasSrc, 'saveAllData')));
  }
}

/* ── import.html（画面） ────────────────────────────────────────────────── */
const im = H.read('import.html');
const hm = H.cut(im, 'renderProfitHeatmap');
const tiersSrc = H.cutVar(im, 'SIM_TIERS');
const mapSrc = H.cutVar(im, 'HM_KEY_TO_TIER');

/* ⑥ 列：右端が「計算用 NK」。9列の並びはそのまま（定価→卸①→卸②→RT→バサラ→旧ロット→不良品用特価→特別提供価格→計算用） */
ok('⑥ 見出しの一番右が 計算用（NK）', /特別提<br>供価格<br>[^<]*<span[^>]*>IT<\/span><\/th><th[^>]*>計算用<br><span[^>]*>NK<\/span><\/th><\/tr><\/thead>/.test(hm));
ok('⑥ グループ行の colspan が 11', hm.indexOf('colspan="11"') >= 0 && hm.indexOf('colspan="10"') < 0);
ok('⑥ 列のループに priceKeisan が最後にある（2か所）', (hm.match(/'priceDefect','priceSpecial','priceKeisan'\]\.forEach/g) || []).length === 2);
ok('⑥ 空のマスは「＋計算」（本番の列の「＋設定」と区別）', hm.indexOf('>＋計算</td>') >= 0 && hm.indexOf('押すと右で計算用を計算できます') >= 0);
ok('⑥ ＋計算のマスは押すと右で計算用が開く', /data-tier="keisan" onclick="heatmapCellClick\(\\''\+p\.sku\+'\\',\\'keisan\\'\)"/.test(hm));

/* ⑦ 段の定義：keisan が最後・priceKeisan・keisan:true・強い確認ではない */
ok('⑦ SIM_TIERS の最後が 計算用（NK）', /\{ tier:'special',[^\n]*\},\s*\{ tier:'keisan',\s*label:'計算用（NK）',\s*field:'priceKeisan',\s*strong:false, keisan:true \}/.test(tiersSrc));
ok('⑦ HM_KEY_TO_TIER に priceKeisan→keisan', /priceKeisan:'keisan'/.test(mapSrc));
ok('⑦ renderTier の master に keisan', /keisan:\s*parseFloat\(rec\.priceKeisan\)/.test(H.cut(im, 'renderTier')));
ok('⑦ 500ml換算にも 計算用（NK）', /\{t:'keisan',\s*label:'計算用（NK）'\}/.test(H.cut(im, 'renderPer500')));
ok('⑦ 価格マスタの最小の行に priceKeisan:0（2か所）', (im.match(/priceSpecial:0(?:, priceOldLot:0)?, priceKeisan:0\}/g) || []).length === 2);

/* ⑧ 文言（モックどおり・一字一句） */
const lsp = H.cut(im, 'loadSimPanel');
ok('⑧ 見出し「計算用シミュレーション」', /tt\.textContent = T\.keisan \? '計算用' : T\.label/.test(lsp));
ok('⑧ 帯「🖐 いま計算中：」', lsp.indexOf('🖐 いま計算中： ') >= 0);
ok('⑧ ボタン「この金額を計算用に残す」', lsp.indexOf("'この金額を計算用に残す'") >= 0);
ok('⑧ ボタン「🗑 計算用を消す」', lsp.indexOf("'🗑 計算用を消す'") >= 0);
ok('⑧ バッジ「未計算」', /T\.keisan \? '未計算' : '未設定'/.test(lsp));
ok('⑧ 説明「計算用はまだ空です（今の定価 ¥… を出発点に始めます）」', lsp.indexOf('計算用はまだ空です（今の定価 ¥') >= 0 && lsp.indexOf(' を出発点に始めます）') >= 0);
ok('⑧ 出発点は今の定価', /T\.keisan[^\n]*cur = parseFloat\(rec\.priceGeneral\)/.test(lsp));
ok('⑧ 段の表は「計算中」', /row\.keisan \? '計算中' : '調整中'/.test(H.cut(im, 'renderTier')));
ok('⑧ 利益率の行は「計算用の利益率」', /\(T\.keisan \? '計算用' : T\.label\) \+ 'の利益率/.test(H.cut(im, 'renderTier')));
ok('⑧ 残したとき「✅ 計算用に残しました（サーバー保存も確認済み）」', H.cut(im, 'applyRateToTierNow').indexOf("'✅ 計算用に残しました（サーバー保存も確認済み）'") >= 0);
ok('⑧ 消したとき「✅ 計算用を消しました」', H.cut(im, 'clearTierPriceNow').indexOf("'✅ 計算用を消しました'") >= 0);
ok('⑧ 消す確認「…の 計算用 ¥… を消します。よろしいですか？」＋「お客様の価格は変わりません」', /の 計算用 ¥'\+cur\.toLocaleString\(\)\+' を消します。よろしいですか？\\n\\n※お客様の価格は変わりません。/.test(H.cut(im, 'clearSelectedTier')));
ok('⑧ 元に戻す「残しました：」「消しました：」', /verb:\(T\.keisan \? '残しました' : '反映しました'\)/.test(H.cut(im, 'applyRateToTier')) && /verb:\(T\.keisan \? '消しました' : '反映しました'\)/.test(H.cut(im, 'clearSelectedTier')));
ok('⑧ 右パネルの箱：📈 値上げ率で入れる', im.indexOf('<h4 style="margin:0 0 7px;font-size:13px;font-weight:800;color:#4c1d95">📈 値上げ率で入れる</h4>') >= 0);
ok('⑧ 右パネルの箱：🔍 今の価格とくらべて（値上げ率）', im.indexOf('>🔍 今の価格とくらべて（値上げ率）</h4>') >= 0);
ok('⑧ 注意書き「ここで残した金額は計算用のメモです。お客様の価格は変わりません。」', im.indexOf('⚠️ ここで残した金額は<b>計算用のメモ</b>です。お客様の価格は変わりません。') >= 0);
ok('⑧ 記号のいみに NK＝計算用', im.indexOf('NK＝計算用') >= 0);
ok('⑧ 3つの箱は計算用のときだけ出る', /\['sim-keisan-pct','sim-keisan-cmp','sim-keisan-warn'\]\.forEach/.test(lsp));

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

/* ⑪ 本物の関数を動かす：今の価格とくらべて（値上げ率）／値上げ率で入れる */
{
  const els = {};
  const el = id => els[id] || (els[id] = { id, style:{}, innerHTML:'', textContent:'', value:'' });
  const G = H.makeSandbox({ document: { getElementById: el, querySelector(){ return null; }, querySelectorAll(){ return []; } } });
  vm.runInContext('var currentSimSku = "ORG500"; var currentSimTier = "keisan";\n'
    + 'function priceRecForSku(){ return { priceGeneral:9121, priceWholesale1:6884, priceWholesale2:5473, priceRT:6884, priceBasara:0 }; }\n'
    + H.cut(im, 'renderKeisanCompare') + '\n' + H.cut(im, 'onKeisanPct') + '\n' + H.cut(im, 'useKeisanPct') + '\n'
    + 'function renderTier(p, from){ renderTier.last = [p, from]; }', G.ctx);
  el('keisan-base').value = 'priceGeneral'; el('keisan-pct').value = '10';
  G.box.renderKeisanCompare({ priceGeneral:9121, priceWholesale1:6884, priceWholesale2:5473, priceRT:6884, priceBasara:0 }, 10033);
  const rows = el('keisan-cmp-rows').innerHTML;
  ok('⑪ 定価 ¥9,121 に対して ＋10.0％', rows.indexOf('定価（TK） ¥9,121') >= 0 && rows.indexOf('＋10.0％') >= 0);
  ok('⑪ 卸② ¥5,473 に対して ＋83.3％', rows.indexOf('卸②（OS2） ¥5,473') >= 0 && rows.indexOf('＋83.3％') >= 0);
  ok('⑪ 未設定のバサラは「未設定」', rows.indexOf('卸バサラスター（BA）</span><span style="color:#c9c3b5">未設定') >= 0);
  eq('⑪ 定価から10％上げると → ¥10,033', el('keisan-pct-result').textContent, '¥10,033');
  el('keisan-base').value = 'priceWholesale2'; el('keisan-pct').value = '15';
  G.box.useKeisanPct();
  eq('⑪ 卸②から15％ → 6,294 を「この金額で見る」', G.box.renderTier.last[0], 6294);
  eq('⑪ 入口の印は pct', G.box.renderTier.last[1], 'pct');
  el('keisan-base').value = 'priceBasara';
  eq('⑪ 未設定の価格からは「（その価格は未設定）」', (G.box.onKeisanPct(), el('keisan-pct-result').textContent), '（その価格は未設定）');
  G.box.renderKeisanCompare({ priceGeneral:9121 }, 8500);
  ok('⑪ 定価より安いときは「－6.8％」', el('keisan-cmp-rows').innerHTML.indexOf('－6.8％') >= 0);
}

console.log('===== 🧮 計算用（NK）：値上げを考えるためのマス（2026-11-10）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ★ ' + f)); }
process.exit(fail ? 1 : 0);
