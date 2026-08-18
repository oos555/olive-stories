/* GAS だけは oos-zaiko.js を読めないので、同じ計算のコピーが1つ残っている。
   その GAS の本物の関数（basaraComputeStock_）に、oos-zaiko.js と同じデータを与えて
   同じ販売可能数が出るかを突き合わせる。GASには一切書き込まない（読むだけ）。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

/* GASのファイルは【公開リポジトリに置きません】（パスワードとLINEのIDが入っているため）。
   手元の作業フォルダにあれば読み、無ければこのテストは飛ばします。
   置き場所：%USERPROFILE%\OneDrive\ドキュメント\olive-stories-gas\コード.js（clasp pull で作られます） */
function readGasSource(){
  const os = require('os');
  const cands = [
    path.join(__dirname, 'gas', 'コード.js'),
    path.join(os.homedir(), 'OneDrive', 'ドキュメント', 'olive-stories-gas', 'コード.js')
  ];
  for(const c of cands){ if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); }
  console.log('（GASのファイルが手元にないので、このテストは飛ばしました）');
  console.log('　clasp pull で olive-stories-gas に取ってくると走ります。');
  process.exit(0);
}
const gasSrc = readGasSource();

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(got === want) pass++;
  else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

/* ── 両方に同じデータを渡す ─────────────────────────── */
const PRODUCTS = [
  { id:1, sku:'ORG100', name:'オルガニック100ml', boxQty:12 },
  { id:2, sku:'ORG250', name:'オルガニック250ml', boxQty:12 },
  { id:9, sku:'SET-A',  name:'ギフトセットA', isSet:true, components:[{sku:'ORG100',qty:2},{sku:'ORG250',qty:1}] }
];
const LOTS = [
  { pid:1, stock:45, status:'new' },
  { pid:1, stock:38, status:'old' },
  { pid:1, stock:1,  status:'hold_old' },
  { pid:1, stock:3,  status:'discard' },
  { pid:1, stock:9,  status:'incoming' },
  { pid:1, stock:2,  status:'hold' },
  { pid:2, stock:20, status:'new' },
  { pid:2, stock:4,  status:'discard_old' }
];
const DEFECTS = [
  { pid:1, level:'lv1', qty:2, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'cur' },
  { pid:1, level:'lv3', qty:3, shippedQty:0, status:'open', source:'staff', reviewed:true, lotKind:'old' },
  { pid:1, level:'lv2', qty:4, shippedQty:0, status:'open', source:'warehouse', reviewed:false, lotKind:'cur' },
  { pid:2, level:'lv1', qty:1, shippedQty:0, status:'resolved', source:'staff', reviewed:true, lotKind:'cur' }
];
const HELD_ORDERS = [
  { lines: [{ productId:1, bottles:10, boxes:0 }] },
  { lines: [{ productId:9, bottles:2,  boxes:0 }] }   // セット2個 → ORG100を4本・ORG250を2本おさえる
];

/* ── ①【親】oos-zaiko.js の答え ─────────────────────── */
const Z = H.makeSandbox({});
H.runZaiko(Z.ctx);
const holdsForZaiko = (function(){
  const m = {};
  HELD_ORDERS.forEach(function(o){
    o.lines.forEach(function(l){
      const p = PRODUCTS.find(x => x.id === l.productId);
      const qty = (l.bottles||0) + (l.boxes||0)*(l.boxQty||p.boxQty||1);
      if(p.isSet){ p.components.forEach(function(c){ const cp = PRODUCTS.find(x=>x.sku===c.sku); m[cp.id] = (m[cp.id]||0) + qty*(c.qty||1); }); }
      else { m[p.id] = (m[p.id]||0) + qty; }
    });
  });
  return Object.keys(m).map(k => ({ pid: parseInt(k), qty: m[k] }));
})();
const zData = { lots: LOTS, defects: DEFECTS, holds: holdsForZaiko };
const oya = {};
['ORG100','ORG250','SET-A'].forEach(s => { oya[s] = Z.box.OOS_ZAIKO.availableForSku(s, zData, PRODUCTS); });

/* ── ②【GAS】本物の basaraComputeStock_ を、シートの身代わりで動かす ── */
const sheetStub = {
  getSheetByName(name){
    if(name !== '受注データ') return null;
    return {
      getLastRow(){ return HELD_ORDERS.length + 1; },
      getRange(){ return { getValues(){
        return HELD_ORDERS.map(function(o){
          const r = new Array(20).fill('');
          r[0] = 'id'; r[11] = 'held'; r[19] = JSON.stringify({ lines: o.lines });
          return r;
        });
      } }; }
    };
  }
};
const G = H.makeSandbox({
  SpreadsheetApp: { openById(){ return sheetStub; } },
  SHEET_ID_MAIN: 'x',
  loadProducts(){ return { products: PRODUCTS }; },
  readSheetGlobal(ss, name){
    if(name === '在庫データ')     return LOTS.map(l => ({ pid:l.pid, stock:l.stock, status:l.status }));
    if(name === '不良在庫データ') return DEFECTS.map(d => Object.assign({}, d));
    return [];
  },
  Logger: { log(){} }
});
vm.runInContext(H.cut(gasSrc, 'basaraComputeStock_'), G.ctx);
const calc = G.box.basaraComputeStock_();

['ORG100','ORG250','SET-A'].forEach(function(s){
  eq(`GAS と oos-zaiko.js の販売可能数が一致（${s}）`, calc.available(s), oya[s]);
});
eq('参考：ORG100 の販売可能数', oya['ORG100'], 45 - (10 + 4));
eq('参考：ORG250 の販売可能数', oya['ORG250'], 20 - 2);
eq('参考：SET-A の販売可能数（中身の少ないほう）', oya['SET-A'], Math.min(Math.floor((45-14)/2), 20-2));

/* 取り置きを増やしたら両方とも同じだけ減るか */
HELD_ORDERS[0].lines[0].bottles = 30;
const holds2 = holdsForZaiko.map(h => h.pid === 1 ? { pid:1, qty: h.qty + 20 } : h);
const oya2 = Z.box.OOS_ZAIKO.availableForSku('ORG100', { lots: LOTS, defects: DEFECTS, holds: holds2 }, PRODUCTS);
const calc2 = G.box.basaraComputeStock_();
eq('取り置きを増やしても GAS と親が一致', calc2.available('ORG100'), oya2);
eq('参考：ORG100 は 45−34 = 11', oya2, 11);

/* 取り置きが在庫より多いとき、両方とも 0 で止まるか（マイナスにしない） */
HELD_ORDERS[0].lines[0].bottles = 999;
const holds3 = [{ pid:1, qty:1003 }, { pid:2, qty:2 }];
const oya3 = Z.box.OOS_ZAIKO.availableForSku('ORG100', { lots: LOTS, defects: DEFECTS, holds: holds3 }, PRODUCTS);
const calc3 = G.box.basaraComputeStock_();
eq('取り置き過多でも GAS と親が一致（0で止まる）', calc3.available('ORG100'), oya3);
eq('参考：0 で止まる', oya3, 0);

console.log('===== GAS と oos-zaiko.js の突き合わせ =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
