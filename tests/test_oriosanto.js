/* ══════════════════════════════════════════════════════════════════════
   🫒 オリオサント価格（OR）：利益ヒートマップの IT の右の「れいこさん用の価格」
   2026-11-16 ひろみさん承認（モック mocks/mock_輸入E_オリオサント価格_2026-11-16.html）
   　原文「オリオサントのれいこさん用の価格をつくりたかった」「特別価格、特別提供の後ろでいいので、オリオサント価格っていう行を作ってください」→「これで進めて」
   　①価格マスタ14列目 priceOriosanto（スプシは一番右に足す。計算用の12・13列目を動かさない）
   　②画面では 特別提供価格（IT）の右・計算用定価（NK-TK）の左。記号 OR
   　③IT と同じ扱い：空は「＋設定」・軽い確認・1マスずつ消せる・掛は定価から・販売店の儲け＝定価−その価格
   　④今回は輸入Eの中だけ。oos-kakaku.js・受注A・売上C・見積M・統合マスタN には出さない

   ここで見張ること：
   　・GAS（本物の saveAllData）：14列目が保存される／1マス変えても他の商品・他の欄が動かない／
   　　古い13列のシートでも壊れない／消す(null)と0になる／欄を送らない古いアプリ経由でも消えない／空配列は無傷
   　・import.html：列が IT と NK-TK の間にある・段の定義にある・文言がモックどおり・軽い確認の道・
   　　お客様の価格の道（oos-kakaku.js など）には入っていない
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function ok(label, cond){ if(cond) pass++; else { fail++; fails.push(label); } }
function eq(label, got, want){
  if(got === want) pass++; else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}

/* ── GAS（手元に無ければ飛ばす） ───────────────────────────────────────── */
let gasSrc = null;
try{ gasSrc = H.readGas(); }catch(e){ console.log('  GASのファイルが手元にありません → ①〜⑤は飛ばしました'); }

const PM14 = ['sku','productName','priceGeneral','priceWholesale1','priceWholesale2','priceRT','priceDefect','taxRate','priceBasara','priceSpecial','priceOldLot','priceKeisan','priceKeisanOroshi','priceOriosanto'];
/* 価格マスタの身代わりシート。rowsの列数は 13（今のシート）でも 14（新しいシート）でもよい */
function makeSheet(initialRows, ncols){
  let rows = initialRows.map(r => r.slice());
  return {
    _rows: () => rows,
    getLastRow(){ return rows.length + 1; },
    getLastColumn(){ return ncols; },
    getRange(r, c, nr, nc){
      return {
        getValues(){
          if(r === 1) return [PM14.slice(0, nc)];
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
  /* ① 今の13列のシートに、オリオサント価格を入れる → 14列目に入る。他の商品・他の欄・計算用は動かない */
  {
    const sheet = makeSheet([
      ['ORG250','オルガニック250ml',4750,3388,3200,3800,0,0.08,3388,0,0,5200,4000],
      ['MEM500','メメジック500ml',9120,6228,6000,6884,0,0.08,6228,0,0,0,0]
    ], 13);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceOriosanto:3000 }] });
    const rows = sheet._rows();
    const org = rows.find(r => r[0]==='ORG250'), mem = rows.find(r => r[0]==='MEM500');
    eq('① オリオサント価格が14列目に入る', org[13], 3000);
    eq('① 同じ商品の定価は動かない', org[2], 4750);
    eq('① 同じ商品のバサラは動かない', org[8], 3388);
    eq('① 同じ商品の計算用定価（12列目）は動かない', org[11], 5200);
    eq('① 同じ商品の計算用卸（13列目）は動かない', org[12], 4000);
    eq('① 送っていない商品(MEM500)は残る', mem[0], 'MEM500');
    eq('① 送っていない商品のオリオサント価格は0のまま', mem[13], 0);
    eq('① 行は14列で書かれる', org.length, 14);
  }
  /* ② オリオサント価格を消す（null）→ 0 になる。続けて別の商品を消しても最初のが戻らない */
  {
    const sheet = makeSheet([
      ['ORG250','オルガニック250ml',4750,3388,3200,3800,0,0.08,3388,0,0,5200,4000,3000],
      ['MEM500','メメジック500ml',9120,6228,6000,6884,0,0.08,6228,0,0,0,0,6000]
    ], 14);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'ORG250', priceOriosanto:null }] });
    eq('② nullで消すと0になる', sheet._rows().find(r => r[0]==='ORG250')[13], 0);
    eq('② 同じ商品の計算用定価は残る', sheet._rows().find(r => r[0]==='ORG250')[11], 5200);
    eq('② 消していない方は残る', sheet._rows().find(r => r[0]==='MEM500')[13], 6000);
    G.box.saveAllData({ priceMaster: [{ sku:'MEM500', priceOriosanto:null }] });
    eq('② 2つ目を消しても1つ目は0のまま', sheet._rows().find(r => r[0]==='ORG250')[13], 0);
    eq('② 2つ目も0になる', sheet._rows().find(r => r[0]==='MEM500')[13], 0);
  }
  /* ③ 欄そのものを送らない古いアプリ経由でも、オリオサント価格は消えない（2026-08-12のマージの守りが14列目にも効く） */
  {
    const sheet = makeSheet([['TGR100','唐辛子オイル100ml',2700,2040,1900,2200,0,0.08,2040,0,0,3000,2300,1500]], 14);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [{ sku:'TGR100', priceBasara:2100 }] });
    eq('③ 他の欄だけ送ってもオリオサント価格は残る', sheet._rows()[0][13], 1500);
    eq('③ 他の欄だけ送っても計算用卸は残る', sheet._rows()[0][12], 2300);
    eq('③ 送った欄は反映される', sheet._rows()[0][8], 2100);
  }
  /* ④ 空の配列では何も消えない（EMPTY_GUARD） */
  {
    const sheet = makeSheet([['PRI250','プリモフルット250ml',4750,3388,3200,3800,0,0.08,3388,0,0,5000,3900,2900]], 14);
    const G = gasBox(sheet);
    G.box.saveAllData({ priceMaster: [] });
    eq('④ 空配列でもオリオサント価格は無傷', sheet._rows()[0][13], 2900);
    eq('④ 空配列でも定価も無傷', sheet._rows()[0][2], 4750);
  }
  /* ⑤ 読み込み（loadAllData）が priceOriosanto を返す。古い行でも落ちない（0） */
  {
    const loadSrc = H.cut(gasSrc, 'loadAllData');
    ok('⑤ loadAllData が priceOriosanto を返す（14列目・古い行は0）', /priceOriosanto:\(r\.length > 13 \? r\[13\] : 0\)/.test(loadSrc));
    ok('⑤ loadAllData の計算用（12・13列目）はそのまま', /priceKeisan:\(r\.length > 11 \? r\[11\] : 0\), priceKeisanOroshi:\(r\.length > 12 \? r\[12\] : 0\)/.test(loadSrc));
    ok('⑤ saveAllData の headers の最後が priceKeisanOroshi → priceOriosanto（14列目）', /const headers = \[[^\]]*'priceKeisan','priceKeisanOroshi','priceOriosanto'\]/.test(H.cut(gasSrc, 'saveAllData')));
    ok('⑤ saveAllData の _pmFields の最後が priceOriosanto', /const _pmFields = \[[^\]]*'priceKeisan','priceKeisanOroshi','priceOriosanto'\]/.test(H.cut(gasSrc, 'saveAllData')));
    ok('⑤ 守り：EMPTY_GUARD（空なら何も書かない）はそのまま', H.cut(gasSrc, 'saveAllData').indexOf('送信が空でサーバーに既存あり＝絶対に消さない') >= 0);
    /* null＝消す・''＝触らない の区別は ②③ で実際に動かして見ている（書き方ではなく動きで見張る） */
  }
}

/* ── import.html（画面） ────────────────────────────────────────────────── */
const im = H.read('import.html');
const hm = H.cut(im, 'renderProfitHeatmap');
const tiersSrc = H.cutVar(im, 'SIM_TIERS');
const mapSrc = H.cutVar(im, 'HM_KEY_TO_TIER');

/* ⑥ 列：IT の右に「オリオ サント OR」、その右が計算用定価（NK-TK）。他の列はそのまま */
ok('⑥ 見出し：特別提供価格（IT）→ オリオサント（OR）→ 計算用定価（NK-TK）の順', /特別提<br>供価格<br>[^<]*<span[^>]*>IT<\/span><\/th><th[^>]*>オリオ<br>サント<br><span[^>]*>OR<\/span><\/th><th[^>]*>計算用<br>定価<br><span[^>]*>NK-TK<\/span><\/th>/.test(hm));
ok('⑥ 見出しの左側9列はそのまま（商品・原価・TK・OS1・OS2・RT・BA・QR・FT）', /商品<\/th><th[^>]*>原価<\/th><th[^>]*>定価<br>[\s\S]*?>TK<\/span><\/th><th[^>]*>卸①<br>[\s\S]*?>OS1<\/span><\/th><th[^>]*>卸②<br>[\s\S]*?>OS2<\/span><\/th><th[^>]*>RT<br>[\s\S]*?>RT<\/span><\/th><th[^>]*>卸バサラ<br>スター<br>[\s\S]*?>BA<\/span><\/th><th[^>]*>旧ロット<br>[\s\S]*?>QR<\/span><\/th><th[^>]*>不良品<br>用特価<br>[\s\S]*?>FT<\/span><\/th>/.test(hm));
ok('⑥ グループ行の colspan が 13（商品＋原価＋11段）', hm.indexOf('colspan="13"') >= 0 && hm.indexOf('colspan="12"') < 0);
ok('⑥ 列のループに priceSpecial → priceOriosanto → priceKeisan の順（2か所）', (hm.match(/'priceSpecial','priceOriosanto','priceKeisan','priceKeisanOroshi'\]\.forEach/g) || []).length === 2);
ok('⑥ オリオサント価格の空マスは「＋設定」（keisan ではないので「＋計算」にならない）', /\{ tier:'orio',[^}]*\}/.test(tiersSrc) && !/\{ tier:'orio',[^}]*keisan:true/.test(tiersSrc) && hm.indexOf('を設定できます" style="padding:5px 6px;text-align:right;background:#f4f1ea') >= 0);
/* 掛が定価から出ることは ⑪ で本物の renderTier を動かして見ている（6,000÷9,121＝6.6掛） */

/* ⑦ 段の定義：special の次が orio、その次が keisan。priceOriosanto・strong:false */
ok('⑦ SIM_TIERS：特別提供価格（IT）→ オリオサント価格（OR）→ 計算用定価（NK-TK）', /\{ tier:'special',\s*label:'特別提供価格（IT）',\s*field:'priceSpecial',\s*strong:false \},\s*\{ tier:'orio',\s*label:'オリオサント価格（OR）',\s*field:'priceOriosanto',\s*strong:false \},[^\n]*\n\s*\{ tier:'keisan',/.test(tiersSrc));
ok('⑦ HM_KEY_TO_TIER に priceOriosanto→orio（priceSpecial と priceKeisan の間）', /priceSpecial:'special', priceOriosanto:'orio', priceKeisan:'keisan'/.test(mapSrc));
ok('⑦ renderTier の master に orio', /orio:\s*parseFloat\(rec\.priceOriosanto\)/.test(H.cut(im, 'renderTier')));
ok('⑦ 500ml換算にも オリオサント価格（OR）（IT の次）', /\{t:'special',\s*label:'特別提供価格（IT）'\},\s*\{t:'orio',\s*label:'オリオサント価格（OR）'\},\s*\{t:'keisan',/.test(H.cut(im, 'renderPer500')));
ok('⑦ 価格マスタの最小の行に priceOriosanto:0（2か所）', (im.match(/priceSpecial:0, priceOriosanto:0,/g) || []).length === 2);
ok('⑦ 記号のいみに OR＝オリオサント価格（IT の次）', /IT＝特別提供価格<\/span>\s*<span[^>]*>OR＝オリオサント価格<\/span>/.test(im));
ok('⑦ 保存のときの確認の案内「卸②・BA・QR・FT・IT・OR → 軽い確認だけ」', im.indexOf('<strong>卸②・BA・QR・FT・IT・OR</strong> → 軽い確認だけ') >= 0);

/* ⑧ 軽い確認の道（IT と同じ）：strong でも keisan でもないので else（軽い確認）に落ちる。定価・卸①・RTの強い確認はそのまま */
const art = H.cut(im, 'applyRateToTier');
ok('⑧ 軽い確認「この商品の「◯◯」価格を ¥… に反映しますか？」は残っている', art.indexOf("confirm('この商品の「'+T.label+'」価格を ¥'+price.toLocaleString()+' に反映しますか？") >= 0);
ok('⑧ 定価の「定価はほんとうに変えますか？」は残っている', art.indexOf('定価はほんとうに変えますか？') >= 0);
ok('⑧ 卸①・RTの強い確認は残っている', art.indexOf('は基本の価格です') >= 0);
ok('⑧ 保存の道は既存（取り直し→1マス→自己点検）をそのまま通る', art.indexOf('applyRateToTierNow(sku, T, price)') >= 0 && H.cut(im, 'applyRateToTierNow').indexOf('loadAllData&only=priceMaster') >= 0 && H.cut(im, 'applyRateToTierNow').indexOf('setFieldOnMaster(freshMaster, sku, T.field, price)') >= 0);
ok('⑧ 消すのは clearSelectedTier（1マスずつ・確認あり）。定価は消せないまま', H.cut(im, 'clearSelectedTier').indexOf('定価は消せません。卸①〜特別提供価格を選ぶと消せます。') >= 0 && H.cut(im, 'clearSelectedTier').indexOf('を消して、\\n＋設定（未設定）の状態に戻します。よろしいですか？') >= 0);
ok('⑧ costLoadedOk ゲートは残っている', im.indexOf('costLoadedOk') >= 0);

/* ⑨ お客様の価格の道には入れない（今回は輸入Eの中だけ） */
ok('⑨ oos-kakaku.js に priceOriosanto は無い', H.read('oos-kakaku.js').indexOf('priceOriosanto') < 0 && H.read('oos-kakaku.js').indexOf('オリオサント') < 0);
ok('⑨ master.html / billing.html / mitsumori.html / index.html に priceOriosanto は無い', ['master.html','billing.html','mitsumori.html','index.html'].every(f => H.read(f).indexOf('priceOriosanto') < 0));

/* ⑩ 計算用（NK）の決めごとはそのまま（2026-11-10）：keisan/keisan2 は最後・確認なし */
ok('⑩ SIM_TIERS の最後は 計算用定価 → 計算用卸 のまま', /\{ tier:'keisan',[^\n]*\n\s*\{ tier:'keisan2',[^\n]*\n\];/.test(tiersSrc));
ok('⑩ 計算用は確認なし（ok = true）のまま', /else if\(T\.keisan\)\{[\s\S]*?ok = true;/.test(art));

/* ⑪ 本物の関数を動かす：オリオサント価格（OR）を調整中にして段の表・500ml換算を描く */
{
  const els = {};
  const el = id => els[id] || (els[id] = { id, style:{}, innerHTML:'', textContent:'', value:'', onclick:null });
  const G = H.makeSandbox({ document: { getElementById: el, querySelector(){ return null; }, querySelectorAll(){ return []; } } });
  const REC = { priceGeneral:9121, priceWholesale1:6884, priceWholesale2:5473, priceRT:6884, priceBasara:0, priceOldLot:0, priceDefect:0, priceSpecial:0, priceOriosanto:0, priceKeisan:0, priceKeisanOroshi:0 };
  vm.runInContext([H.cutVar(im,'SIM_TIERS'), H.cutVar(im,'HM_KEY_TO_TIER')].join('\n') + '\n'
    + 'var currentSimSku = "ORG500"; var currentSimTier = "orio"; var currentSimMl = 500; var currentTierPrice = 0; var currentW2Price = 0;\n'
    + 'var REC = ' + JSON.stringify(REC) + ';\n'
    + 'function priceRecForSku(){ return REC; }\nfunction getCostForSku(){ return 3200; }\nfunction esc(s){ return String(s); }\nfunction applyRateToTier(){}\n'
    + ['simTierByKey','renderKeisanCompare','renderKeisanPair','onKeisanPct','useKeisanPct','renderTier','pctSpan','marginTextColor','profitColor','renderPer500'].map(n => H.cut(im, n)).join('\n'), G.ctx);

  eq('⑪ simTierByKey("orio") は オリオサント価格（OR）・priceOriosanto', G.box.simTierByKey('orio').label + '|' + G.box.simTierByKey('orio').field, 'オリオサント価格（OR）|priceOriosanto');
  ok('⑪ オリオサント価格は強い確認でも計算用でもない', !G.box.simTierByKey('orio').strong && !G.box.simTierByKey('orio').keisan);

  /* オリオサント価格を 6,000 で調整中 → 販売店の儲け＝定価 9,121 − 6,000 ＝ 3,121、掛 6.6、うちの儲け 2,800、利益率 46.7% */
  G.box.renderTier(6000, 'direct');
  const tb = el('sim-tier-tbody').innerHTML;
  ok('⑪ 段の表は11行（8段＋OR＋計算用定価＋計算用卸）', (tb.match(/<tr/g) || []).length === 11);
  ok('⑪ オリオサント価格の行：調整中・¥6,000・6.6掛・うちの儲け ¥2,800・販売店の儲け ¥3,121', /オリオサント価格（OR）<br><span[^>]*>調整中<\/span>[\s\S]*?¥6,000 <span[^>]*>6\.6掛<\/span> ／[\s\S]*?<td[^>]*>¥2,800<\/td><td[^>]*>¥3,121<\/td>/.test(tb));
  ok('⑪ 行の順：特別提供価格（IT）→ オリオサント価格（OR）→ 計算用定価（NK-TK）', tb.indexOf('特別提供価格（IT）') < tb.indexOf('オリオサント価格（OR）') && tb.indexOf('オリオサント価格（OR）') < tb.indexOf('計算用定価（NK-TK）'));
  ok('⑪ 卸①の行の販売店の儲けは今の定価から（¥9,121−¥6,884＝¥2,237）', tb.indexOf('¥2,237') >= 0);
  ok('⑪ 利益率の行は「オリオサント価格（OR）の利益率 46.7%」', el('sim-marginline').innerHTML.replace(/<[^>]+>/g,'') === 'オリオサント価格（OR）の利益率 46.7%');
  ok('⑪ 500ml換算に オリオサント価格（OR）（調整中） ¥6,000', /オリオサント価格（OR）（調整中）<\/span><span[^>]*>¥6,000<\/span>/.test(el('p5-rows').innerHTML));

  /* 計算用定価が入っていても、オリオサント価格の掛・販売店の儲けは「今の定価」から（計算用に引きずられない） */
  G.box.REC.priceKeisan = 10000;
  G.box.renderTier(6000, 'direct');
  ok('⑪ 計算用定価が10,000でも、オリオサント価格の販売店の儲けは今の定価から ¥3,121 のまま', /オリオサント価格（OR）[\s\S]*?<td[^>]*>¥2,800<\/td><td[^>]*>¥3,121<\/td>/.test(el('sim-tier-tbody').innerHTML));
}

console.log('===== 🫒 オリオサント価格（OR）：IT の右の れいこさん用の価格（2026-11-16）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ★ ' + f)); }
process.exit(fail ? 1 : 0);
