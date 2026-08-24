/* 輸入Ｅ 輸入ノートの詳細画面を、本物の ynRenderDetail() で実際に描いてHTMLに書き出す。
   JavaScriptが作る画面は compare_mock.js からは見えないので、
   いちど本物に描かせてから道具にかけるための道具。

   使い方:
     node tests/render_yunyu_note.js 出したいファイル.html

   数字は本物の請求書 00193・パッキングリスト（総重量 464.00 kg）を使う。 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const R = require('path').join(__dirname, '..') + '/';
const H = require('./harness');
const src = fs.readFileSync(R + 'import.html', 'utf8');

const RAW = [
  ['ORG250','オルガニック 250ml',380,6.65], ['ORG500','オルガニック 500ml',60,12.50],
  ['ORG750','オルガニック 750ml',12,15.50], ['MEM250','メメジック 250ml',60,6.40],
  ['MEM500','メメジック 500ml',12,11.95],   ['MEM750','メメジック 750ml',24,14.85],
  ['CHF250','シェフズブレンド 250ml',20,6.75], ['ETC-001','ざくろソース 250ml',24,5.50],
  ['MISC002','空瓶 500ml',72,3.00],
];

let out = '';
const el = () => ({ style:{}, set innerHTML(v){ out = v; }, get innerHTML(){ return out; },
                    textContent:'', appendChild(){}, querySelector(){ return null; },
                    setAttribute(){}, removeAttribute(){} });

const box = H.makeSandbox({}).box;
box.document = { getElementById(id){ return id === 'yn-detail' ? el() : null; },
                 querySelectorAll(){ return []; }, createElement(){ return el(); },
                 addEventListener(){}, body:{ appendChild(){} } };
box.localStorage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
const ctx = vm.createContext(box);

/* 本物の部品を切り出す */
['YN_W_PREFIX','YN_W_ML','YN_W_SKU','YN_DRAFT_KEY','FARM_LABEL'].forEach(function(v){
  try{ vm.runInContext(H.cutVar(src, v), ctx); }catch(e){}
});
['ynMlOfSku','ynWeightFor','ynApplyWeightRule','ynWeightLocked','ynCalc','ynFmt','ynEur',
 'ynField','ynFarmLabel','ynDraftLoad','ynDraftAtText','ynRenderDetail'].forEach(function(f){
  try{ vm.runInContext(H.cut(src, f), ctx); }catch(e){ console.log('（切り出せず: ' + f + '）'); }
});

/* 画面まわりの身代わり（本物でないものだけ） */
vm.runInContext([
  'function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }',
  'function ynProductOptions(sel){ return "<option>"+String(sel||"")+"</option>"; }',
  'function ynPrevNote(){ return null; }',
  /* ★2026-08-24 本物のページと同じ名前（OOS_PRODUCTS）にする。
     PRODUCTS を注入していたせいで、本物には無い変数を使うバグをテストが見逃した。★PRODUCTSに戻さないでください */
  'var OOS_PRODUCTS = ' + JSON.stringify(RAW.map(function(r,i){ return { id:i+1, sku:r[0], name:r[1] }; })) + ';',
  'var ynDirty = false;'
].join('\n'), ctx);

box.ynCurrent = {
  id:'render-test', farm:'novavera', yearMonth:'2026-08', exchangeRate:176, packKg:464.00,
  status:'draft',
  exp:{ airEur:2000, airDiscEur:'', airDiscMemo:'', taxImport:221600, taxCustoms:'', taxOther:'',
        sagawaAirport:60000, sagawaTransport:80000, warehouse:60000, otherJp:'', otherJpMemo:'' },
  adjEur:'', adjMemo:'', notes:'',
  lines: RAW.map(function(r){
    const w = box.ynWeightFor(r[0]);
    return { sku:r[0], qty:r[2], eur:r[3], ml:(w?w.ml:0), g:(w?w.total:0) };
  })
};

box.ynRenderDetail();

const dest = process.argv[2] || (R + 'tests/_render_yunyu_note.html');
fs.writeFileSync(dest, '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
  + '<title>輸入ノート（本物の画面を描き出したもの）</title></head><body>\n' + out + '\n</body></html>');
console.log('本物の画面を描き出しました: ' + dest + '（' + out.length + ' 文字）');
