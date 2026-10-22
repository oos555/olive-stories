/* ═══════════════════════════════════════════════════════════
   🇪🇺 仕入れ価格（€表示）── 輸入記録から作る読むだけの表（2026-10-22 ひろみさん承認）
   承認モック：mocks/mock_原価E_仕入れ価格ユーロ_2026-10-22.html
   ひろみさん：「あなたが言った通りタブを作るのではなくて、事故が起きないような形で」→「その形で」「全部それでいいので実装して」

   見張ること
     ① 表のマスに入力欄が無い（読むだけ）／数字は輸入記録と1セントも違わない
     ② 古い形（items.priceEur）も新しい形（lines.eur）も同じ表に入る／列は古い回が左
     ③ 同じ農園・同じ年月が2回あっても列は2本（上書きしない）
     ④ 昔の回（€とレートだけ・karui）は、原価データ（非公開）にも年度平均にも入らない
     ⑤ スプシのタブは A1 が「自動です」・作り直す前に控え・2回作っても同じ
     ⑥ 名簿に無い品番は「名簿なし」／まだ輸入していない名簿の商品は「（まだ輸入記録なし）」
     ⑦ 鍵・版・画面の作り
   ═══════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const LIVE = H.LIVE;
let pass = 0, fail = 0; const fails = [];
function eq(name, a, b){ if(JSON.stringify(a) === JSON.stringify(b)){ pass++; } else { fail++; fails.push(name + '  期待:' + JSON.stringify(b) + '  実際:' + JSON.stringify(a)); } }
function ok(name, c){ eq(name, !!c, true); }
const im = fs.readFileSync(path.join(LIVE, 'import.html'), 'utf8');

let gasSrc = null;
try{ gasSrc = H.readGas(); }catch(e){ console.log('  GASのファイルが手元にありません → ①〜⑥は飛ばしました'); }

/* 身代わりのシート */
function Sh(){ this.c = []; this.bg = null; this.hidden = false; }
Sh.prototype = {
  getLastRow(){ for(let r = this.c.length; r > 0; r--){ if((this.c[r-1] || []).some(v => v !== '' && v != null)) return r; } return 0; },
  getLastColumn(){ return this.c.reduce((m, r) => Math.max(m, (r || []).length), 0); },
  getDataRange(){ const s = this; return { getValues(){ return s.c.map(r => r.slice()); } }; },
  getRange(r, c, nr, nc){ const s = this; nr = nr || 1; nc = nc || 1;
    const rg = { getValues(){ const o = []; for(let i = 0; i < nr; i++){ const a = []; for(let j = 0; j < nc; j++) a.push(((s.c[r-1+i] || [])[c-1+j]) ?? ''); o.push(a); } return o; },
      getValue(){ return rg.getValues()[0][0]; },
      setValues(v){ v.forEach((row, i) => { s.c[r-1+i] = s.c[r-1+i] || []; row.forEach((x, j) => { s.c[r-1+i][c-1+j] = x; }); }); return rg; },
      setValue(v){ return rg.setValues([[v]]); }, clear(){ for(let i = 0; i < nr; i++){ if(s.c[r-1+i]) for(let j = 0; j < nc; j++) s.c[r-1+i][c-1+j] = ''; } return rg; },
      setBackgrounds(b){ s.bg = b; return rg; }, setFontWeights(){ return rg; }, setBackground(){ return rg; }, setFontColor(){ return rg; }, setFontWeight(){ return rg; }, setWrap(){ return rg; }, setNumberFormat(){ return rg; } };
    return rg; },
  clear(){ this.c = []; }, setFrozenRows(){}, setFrozenColumns(){}, setColumnWidth(){}, hideSheet(){ this.hidden = true; }, appendRow(r){ this.c.push(r.slice()); }, deleteRow(i){ this.c.splice(i-1, 1); }
};

if(gasSrc){
  const tabs = {};
  const ssObj = { getSheetByName(n){ return tabs[n] || null; }, insertSheet(n){ tabs[n] = new Sh(); return tabs[n]; }, getName(){ return 'メイン'; } };
  const ctx = vm.createContext({ console, JSON, String, Number, Object, Array, Math, RegExp, Date, parseFloat, parseInt,
    SHEET_ID_MAIN:'x', COST_DATA_PASSWORD:'S1',
    SpreadsheetApp:{ openById(){ return ssObj; } },
    Utilities:{ formatDate(d, tz, f){ return '2026-10-22 10:00'; } }, Logger:{ log(){} },
    loadProducts(){ return { status:'ok', products:[
      { sku:'ORG250', name:'オルガニック 250ml', origin:'トルコ' }, { sku:'ORG500', name:'オルガニック 500ml', origin:'トルコ' },
      { sku:'PRI250', name:'プリモフルット 250ml', origin:'イタリア' }, { sku:'CAS5L', name:'カサアルバート 5L', origin:'イタリア' },
      { sku:'ETC-002', name:'ザクロソース 100ｍｌ', origin:'トルコ' }, { sku:'PRI3L', name:'プリモフルット 3L', origin:'イタリア' },
      { sku:'BOX1', name:'ギフト箱', origin:'' } ] }; } });
  const names = ['OOS_SHIIRE_SHEET','OOS_SHIIRE_BAK','OOS_FARM_JI','OOS_SHIIRE_SHOHIN'].map(n => H.cutVar(gasSrc, n)).join('\n') + '\n'
    + ['readSheetGlobal','oosImportBatchesAll_','oosShiireMl_','oosShiireSizeJi_','oosShiireBaseName_','oosShiireTable_','loadShiirePrice','oosShiireSheetBuild_','getImportData','saveImportBatch','deleteImportBatch','oosGenkaNamae_'].map(n => H.cut(gasSrc, n)).join('\n');
  let yometa = true; try{ vm.runInContext(names, ctx); }catch(e){ yometa = false; console.log('  GASの関数を切り出せない', e.message); }
  if(yometa){
    /* 輸入記録（古い形1回・新しい形2回・同じ年月が2回・karui 1回） */
    const sh = ssObj.insertSheet('輸入記録');
    const HEAD = ['id','farm','yearMonth','exchangeRate','shippingCost','customsTax','airportFee','sagawaShipping','warehouseFee','totalOverhead','totalMl','overheadPerMl','itemsJson','notes','createdAt','packingListUrl','invoiceUrl','permitUrl','processSheetUrl','invoicePaid','paidDate','nextTimeNotes','extraJson'];
    sh.c.push(HEAD);
    const row = function(id, farm, ym, rate, items, extra, created){ const r = []; r[0] = id; r[1] = farm; r[2] = ym; r[3] = rate; r[12] = JSON.stringify(items || []); r[14] = created || ''; r[22] = extra ? JSON.stringify(extra) : ''; while(r.length < 23) r.push(''); return r.map(v => v == null ? '' : v); };
    sh.c.push(row('imp_1', 'novavera', '2024/06', 168.2, [{ sku:'ORG250', priceEur:4.30, bottles:120, costPerUnit:900 }, { sku:'ORG500', priceEur:7.90, bottles:60, costPerUnit:1500 }], null, '2024-06-01'));
    sh.c.push(row('note_2', 'novavera', '2025/03', 162.5, [], { kind:'note', status:'fixed', farm:'novavera', yearMonth:'2025/03', exchangeRate:162.5, lines:[{ sku:'ORG250', qty:100, eur:4.30 }, { sku:'ORG500', qty:50, eur:8.60 }, { sku:'XYZ99', qty:5, eur:3.00 }] }, '2025-03-01'));
    sh.c.push(row('note_3', 'novavera', '2025/03', 160.0, [], { kind:'note', status:'draft', farm:'novavera', yearMonth:'2025/03', exchangeRate:160.0, lines:[{ sku:'ORG250', qty:10, eur:4.50 }] }, '2025-03-20'));
    sh.c.push(row('note_4', 'mozzicato', '2023/05', 150.2, [], { kind:'note', status:'draft', karui:true, farm:'mozzicato', yearMonth:'2023/05', exchangeRate:150.2, lines:[{ sku:'PRI250', qty:0, eur:5.10 }] }, '2026-10-22'));

    sh.c.push(row('old_x', 'sonota', '2025/01', 160.0, [{ sku:'CAS5L', priceEur:30, bottles:4, costPerUnit:9000 }], null, '2025-01-05'));
    const t = ctx.oosShiireTable_();
    /* 農園は決めごとの順（ノバベラ→モジカート→レ・トレ・コロンネ）、その中で年月→作った順。同じ年月が2回でも2本。3農園以外の回は出ない */
    eq('② 列＝回は4本（3農園だけ）・農園→年月→作った順（同じ年月が2回でも2本）', t.cols.map(c => c.id), ['imp_1', 'note_2', 'note_3', 'note_4']);
    eq('② 列の農園名は日本語・レートつき', t.cols.map(c => c.farm + ' ' + c.ym + ' ' + c.rate), ['ノバベラ 2024/06 168.2', 'ノバベラ 2025/03 162.5', 'ノバベラ 2025/03 160', 'モジカート 2023/05 150.2']);
    ok('④ €だけの回は karui の印がつく', t.cols[3].karui === true && t.cols[0].karui === false);
    const org250 = t.rows.find(r => r.sku === 'ORG250');
    eq('① 古い形（priceEur）も新しい形（lines.eur）も同じ行に入り、数字は1セントも変わらない', org250.cells, { imp_1:4.3, note_2:4.3, note_3:4.5 });
    eq('① 商品名とサイズは名簿から分ける', [org250.farm, org250.name, org250.size, org250.meiboNashi], ['ノバベラ', 'オルガニック', '250ml', false]);
    /* ★第2版 ひろみさん「3農園の決めごとの一覧だけ・それ以外と「まだ輸入記録なし」は消す」 */
    eq('⑥ 行は決めごとの一覧の29行だけ（名簿にあっても一覧に無い PRI3L・CAS5L・ギフト箱・XYZ99 は出ない）',
       [t.rows.length, t.rows.some(r => ['PRI3L','CAS5L','BOX1','XYZ99'].indexOf(r.sku) >= 0), t.rows.some(r => /まだ輸入記録なし/.test(r.farm))], [29, false, false]);
    eq('⑥ 並びは一覧の順（ノバベラ→モジカート→レ・トレ・コロンネ）', [t.rows[0].name + ' ' + t.rows[0].size, t.rows[16].name + ' ' + t.rows[16].size, t.rows[28].name + ' ' + t.rows[28].size], ['オルガニック 100ml', 'ザクロソース 250ml', 'アルモニア 3L']);
    const zai = t.rows.find(r => r.name === 'ザイトゥーン' && r.size === '100ml');
    ok('⑥ 名簿に無いもの（ザイトゥーン 100ml）は行を出して「名簿なし」・マスは空', zai && zai.meiboNashi === true && zai.sku === '' && Object.keys(zai.cells).length === 0);
    const zak = t.rows.find(r => r.name === 'ザクロソース' && r.size === '100ml');
    ok('⑥ 名簿の全角「ｍｌ」でも結びつく（ザクロソース 100ml ＝ ETC-002）', zak && zak.sku === 'ETC-002' && zak.meiboNashi === false);
    eq('⑦ 鍵がちがえば読めない', ctx.loadShiirePrice('J1').status, 'error');
    eq('⑦ 社長の鍵で読める（表のもとが返る）', ctx.loadShiirePrice('S1').data.cols.length, 4);

    /* ⑤ スプシのタブ */
    const b1 = ctx.oosShiireSheetBuild_();
    const sp = tabs['仕入れ価格（€表示）'];
    ok('⑤ タブができる・A1は「この表は自動です」', sp && /この表は自動です/.test(String(sp.c[0][0])) && /輸入ノート/.test(String(sp.c[0][0])));
    const head = sp.c.find(r => r[0] === '農園' && /ノバベラ 2024\/06/.test(String(r[3])));
    ok('⑤ 見出し：農園・商品・サイズ・「農園 年月（1€=¥レート）」', head && /1€=¥168.2/.test(String(head[3])));
    const orgRow = sp.c.find(r => r[1] === 'オルガニック' && r[2] === '250ml');
    eq('⑤ 行：€と¥（¥＝€×レート・四捨五入）・最新€・前回との差', [orgRow[3], orgRow[4], orgRow[5], orgRow[6], orgRow[7], orgRow[8], orgRow[9], orgRow[10]], [4.3, 723, 4.3, 699, 4.5, 720, 4.5, 0.2]);
    ok('⑤ 上がったマスは赤', sp.bg && sp.bg[sp.c.indexOf(orgRow)][7] === '#fde8e8');
    const n1 = sp.c.length;
    ctx.oosShiireSheetBuild_();
    eq('⑤ 2回作っても同じ大きさ（増えない）', sp.c.length, n1);
    ok('⑤ 作り直す前に「📎 仕入れ価格のひかえ（自動）」に控える（隠しタブ）', tabs['📎 仕入れ価格のひかえ（自動）'] && tabs['📎 仕入れ価格のひかえ（自動）'].hidden === true && tabs['📎 仕入れ価格のひかえ（自動）'].c.length > 3);

    /* ④ karui は原価データに入らない（saveImportBatch の反映は costPerUnit が無い行を飛ばす） */
    const cost = ssObj.insertSheet('原価データ（非公開）'); cost.c.push(['sku','productName','costPerUnit','note']); cost.c.push(['PRI250', 'プリモフルット 250ml', 1200, '']);
    const s = ctx.saveImportBatch('S1', { id:'note_9', kind:'note', karui:true, farm:'mozzicato', yearMonth:'2022/11', exchangeRate:140, lines:[{ sku:'PRI250', qty:0, eur:4.00 }], items:[] });
    eq('④ €だけの回も輸入記録には保存できる', s.status, 'ok');
    eq('④ 原価データ（非公開）は1円も変わらない', cost.c[1], ['PRI250', 'プリモフルット 250ml', 1200, '']);
    ok('④ 保存のあと、スプシの表が作り直されて新しい回の列が入る', sp.c.some(r => /モジカート 2022\/11（€だけ）/.test(String(r[3]))));
    ok('② getImportData も同じ読み方（karui が往復する）', ctx.getImportData('S1').data.batches.find(b => b.id === 'note_9').karui === true);
    const d = ctx.deleteImportBatch('S1', 'note_9');
    ok('④ 消したら表からも消える', d.status === 'ok' && !sp.c.some(r => /2022\/11/.test(String(r[3]))));
  }
}

/* ⑦ 画面の作り */
{
  ok('⑦ タブ「🇪🇺 仕入れ価格（€表示）」がある', /showPanel\('shiire',this\)[^>]*>🇪🇺 仕入れ価格（€表示）</.test(im) && /id="panel-shiire"/.test(im));
  const render = H.cut(im, 'shiireRender'), cells = H.cut(im, 'shiireRowCells');
  ok('① 表を作る関数に入力欄が無い（読むだけ）', render.indexOf('<input') < 0 && cells.indexOf('<input') < 0 && render.indexOf('contenteditable') < 0);
  ok('① マスを押すと輸入ノートのその回をひらく（ynOpenNote／ynOpenOld）', H.cut(im, 'shiireOpen').indexOf('ynOpenNote') >= 0 && H.cut(im, 'shiireOpen').indexOf('ynOpenOld') >= 0 && cells.indexOf('shiireOpen(') >= 0);
  /* ★第2版 ひろみさん「修正ボタンを押して、本当に修正しますかと聞いてから触れるように」「下に横のバーを」 */
  ok('① 鍵：「✏️ 修正する」→ 確認（本当に修正しますか）→ 開ける', /id="sh-lock"[^>]*>✏️ 修正する（輸入ノートを開く）</.test(im) && H.cut(im, 'shiireLockToggle').indexOf('本当に修正しますか') >= 0 && H.cut(im, 'shiireLockToggle').indexOf('SH.kaishu=true') >= 0);
  ok('① 鍵がかかっていればマスを押しても輸入ノートへ飛ばない', H.cut(im, 'shiireOpen').indexOf('if(!SH.kaishu)') >= 0 && H.cut(im, 'shiireOpen').indexOf('修正するには') >= 0);
  ok('⑦ 下の横のバーがこの表にもつく（.sh-tblwrap）', im.indexOf(".tbl-wrap, .tr-tblwrap, .sh-tblwrap,") >= 0);
  ok('⑦ 開くたびに輸入記録から作り直す', H.cut(im, 'showPanel').indexOf('shiireLoad()') >= 0 && H.cut(im, 'shiireLoad').indexOf('loadShiirePrice') >= 0);
  ok('④ 昔の回は karui:true・status draft・輸入ノートの保存（ynPersist）を通る', /karui:true, farm:farm, status:'draft'/.test(H.cut(im, 'shiireKakoHozon')) && H.cut(im, 'shiireKakoHozon').indexOf('ynPersist(note)') >= 0);
  ok('④ 年度平均は karui を飛ばす', H.cut(im, 'ynNendoRows').indexOf('if(b.karui) return;') >= 0);
  ok('④ karui の回は確定にできない', H.cut(im, 'ynFix').indexOf('ynCurrent.karui') >= 0);
  ok('⑦ 読み込み中は「空」を見せない', render.indexOf('輸入記録から作っています') >= 0);
  /* 本物の shiireRender を動かす（データは表のもとの形） */
  const els = { 'sh-tbl':{ innerHTML:'', className:'', classList:{ toggle(c, on){ els['sh-tbl'].className = on ? c : ''; } } } };
  const box = { console, JSON, String, Number, Math, Object, Array, document:{ getElementById: id => els[id] || null } };
  vm.createContext(box);
  vm.runInContext(H.cutVar(im, 'SH') + '\n' + ['shEsc','shE','shY','shiireFarms','shiireRowCells','shiireRender'].map(n => H.cut(im, n)).join('\n'), box);
  vm.runInContext('SH.loaded=true; SH.cols=[{id:"a",farm:"ノバベラ",ym:"2024/06",rate:168.2},{id:"b",farm:"ノバベラ",ym:"2026/02",rate:171,karui:false}]; SH.rows=[{farm:"ノバベラ",sku:"ORG250",name:"オルガニック",size:"250ml",cells:{a:4.3,b:4.7}},{farm:"ノバベラ",sku:"MEM250",name:"メメジック",size:"250ml",cells:{a:4.6,b:4.6}}]; shiireRender();', box);
  const html = els['sh-tbl'].innerHTML;
  ok('① 上がったマスは赤＋▲9%・¥は€の下にカッコ（€×レート）', /class="eur up"[^>]*>€4\.70<span class="d">▲9%<\/span><br><span class="yen">\(¥804\)<\/span>/.test(html));
  ok('① ¥の列は無い（1回＝1列）', !/<th>¥<\/th>/.test(html) && !/colspan="2"/.test(html));
  ok('① ふだんは鍵（table.locked）', els['sh-tbl'].className === 'locked');
  ok('① 最新€と前回との差', /class="saishin">€4\.70/.test(html) && /\+€0\.40（\+9%）/.test(html));
  vm.runInContext('SH.up=true; shiireRender();', box);
  ok('⑦ 「値上がりした行だけ」でメメジック（同じ値段）は消える', /オルガニック/.test(els['sh-tbl'].innerHTML) && !/メメジック/.test(els['sh-tbl'].innerHTML));
  const vj = JSON.parse(fs.readFileSync(path.join(LIVE, 'version.json'), 'utf8')).pages;
  const m = im.match(/name="oos-version" content="([^"]+)"/);
  eq('⑦ import.html の版が version.json とそろっている', m && m[1], vj['import.html']);
  ok('⑦ 承認モックが mocks/ にある', fs.existsSync(path.join(LIVE, 'mocks', 'mock_原価E_仕入れ価格ユーロ_2026-10-22.html')));
}

console.log('🇪🇺 仕入れ価格（€表示）── 輸入記録から作る読むだけの表（2026-10-22）  PASS ' + pass + ' / FAIL ' + fail);
fails.forEach(f => console.log('  ✗ ' + f));
process.exit(fail ? 1 : 0);
