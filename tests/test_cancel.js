/* 出荷依頼書に移したあとキャンセルしたら、在庫はちゃんと戻るのか。
   本番 index.html の本物の関数で確かめる。保存は一切しない（persist系は身代わり）。 */
const vm = require('vm');
const fs = require('fs');
const H = require('./harness');
const src = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');

let pass=0, fail=0; const fails=[];
function eq(l,g,w){ if(String(g)===String(w)) pass++; else { fail++; fails.push(`${l}  期待:${w}  実際:${g}`); } }

const NAMES=['findProduct','findProductBySku','isActiveDefect','buildHoldsForZaiko','computeAvailable',
 'lotStockFor','defectStockFor','condAvail','defectBuckets','condValueOfLine','condLabelOfLine','condRemainFor',
 'shortagesNow','orderShortages','isZaikoMachi',
 'deductFromLots','deductFromDefects','deductStockForOrder',
 'restoreStockForOrder','applyStockDeductOnSend','undoStockForOrder','lineTotal',
 'convertToShipping','cancelOrder'];
let code=''; NAMES.forEach(n=>{ code += H.cut(src,n)+'\n'; });
const STUB={};
['renderList','updateSummary','syncOrdersToGAS','showSyncStatus','persistStockDeduct','addLog','esc',
 'scheduleAutoSave','renderSlipSelect','gotoSlip','renderHoldPreLists','persistStockDeltas',
 'buildStockDeltas'].forEach(n=>STUB[n]=function(){ return []; });

function fresh(){
  const {box,ctx}=H.makeSandbox(Object.assign({},STUB,{
    PRODUCTS:[{id:1,sku:'ORG250',name:'オルガニック250ml',boxQty:12}],
    lots:[
      {id:'CUR-A',pid:1,status:'new',expiry:'2026-12-01',stock:5},
      {id:'CUR-B',pid:1,status:'new',expiry:'2027-01-01',stock:10},
      {id:'OLD', pid:1,status:'old',expiry:'2026-06-01',stock:8}
    ],
    defects:[
      {id:'D-cur-lv1',pid:1,qty:4,shippedQty:0,level:'lv1',status:'pending',reviewed:true,lotKind:'cur',processedAt:'2026-08-01'},
      {id:'D-old-lv3',pid:1,qty:3,shippedQty:0,level:'lv3',status:'pending',reviewed:true,lotKind:'old',processedAt:'2026-07-01'}
    ],
    orders:[], holds:[], idSeq:1
  }));
  H.runZaiko(ctx);
  vm.runInContext(H.cutVar(src,'DEFECT_LEVELS'),ctx);
  vm.runInContext(code,ctx);
  return box;
}
const L=(b,id)=>{const l=b.lots.find(x=>x.id===id);return l?(l.stock||0):-1;};
const D=(b,id)=>{const d=b.defects.find(x=>x.id===id);return d?((d.qty||0)-(d.shippedQty||0)):-1;};

/* ── ① 予約 →「出荷依頼書へ」→ キャンセル ─────────────── */
let b=fresh();
b.orders.push({id:'r1',num:'TK-1',status:'reserved',stockDeducted:false,stockLog:[],
  lines:[{productId:1,bottles:7,boxes:0,boxQty:1,condition:'normal'}]});
eq('① 予約中の販売可能', b.computeAvailable('ORG250'), 15);
b.convertToShipping('r1');
eq('① 出荷依頼書へ移すと 販売可能 8', b.computeAvailable('ORG250'), 8);
eq('① 期限の早いロットから 5→0', L(b,'CUR-A'), 0);
eq('① 次のロットが 10→8',        L(b,'CUR-B'), 8);
eq('① 旧ロットは触らない 8',      L(b,'OLD'),   8);
b.cancelOrder('r1');
eq('① キャンセルで 販売可能 15 に戻る', b.computeAvailable('ORG250'), 15);
eq('① 元のロットに戻る CUR-A 5',       L(b,'CUR-A'), 5);
eq('① 元のロットに戻る CUR-B 10',      L(b,'CUR-B'), 10);
eq('① 旧ロットは増えない 8',           L(b,'OLD'),   8);
eq('① 注文はキャンセル扱い',           b.orders[0].status, 'cancelled');
eq('① 引いた印が外れる',               b.orders[0].stockDeducted, false);

/* ── ② 2回キャンセルしても増えない ───────────────────── */
b.cancelOrder('r1');
eq('② もう一度キャンセルしても 15 のまま', b.computeAvailable('ORG250'), 15);
eq('② ロットも増えない CUR-A 5',           L(b,'CUR-A'), 5);

/* ── ③ 旧ロット指定の注文をキャンセル ───────────────── */
b=fresh();
b.orders.push({id:'r2',num:'TK-2',status:'reserved',stockDeducted:false,stockLog:[],
  lines:[{productId:1,bottles:3,boxes:0,boxQty:1,condition:'old'}]});
b.convertToShipping('r2');
eq('③ 旧ロット 8→5', L(b,'OLD'), 5);
b.cancelOrder('r2');
eq('③ キャンセルで 旧ロット 8 に戻る', L(b,'OLD'), 8);
eq('③ 現ロットは動かない CUR-A 5',     L(b,'CUR-A'), 5);

/* ── ④ 不良品（程度×ロット）の注文をキャンセル ───────── */
b=fresh();
b.orders.push({id:'r3',num:'TK-3',status:'reserved',stockDeducted:false,stockLog:[],
  lines:[{productId:1,bottles:2,boxes:0,boxQty:1,condition:'defect',defectLevel:'lv3',defectLotKind:'old'}]});
b.convertToShipping('r3');
eq('④ 重(旧) 3→1', D(b,'D-old-lv3'), 1);
eq('④ 軽(現) 4 は動かない', D(b,'D-cur-lv1'), 4);
b.cancelOrder('r3');
eq('④ キャンセルで 重(旧) 3 に戻る', D(b,'D-old-lv3'), 3);
eq('④ 軽(現) 4 のまま',              D(b,'D-cur-lv1'), 4);
eq('④ 良品は増えない CUR-A 5',       L(b,'CUR-A'), 5);

/* ── ⑤ 倉庫へ送ったあとのキャンセルでも戻る ───────────── */
b=fresh();
b.orders.push({id:'r4',num:'TK-4',status:'pending',stockDeducted:false,stockLog:[],
  lines:[{productId:1,bottles:4,boxes:0,boxQty:1,condition:'normal'}]});
b.applyStockDeductOnSend(b.orders[0]);
b.orders[0].notified = true;
eq('⑤ 倉庫へ送った後 販売可能 11', b.computeAvailable('ORG250'), 11);
b.cancelOrder('r4');
eq('⑤ キャンセルで 15 に戻る', b.computeAvailable('ORG250'), 15);

/* ── ⑥ そもそも引いていない注文をキャンセルしても増えない ── */
b=fresh();
b.orders.push({id:'r5',num:'TK-5',status:'reserved',stockDeducted:false,stockLog:[],
  lines:[{productId:1,bottles:4,boxes:0,boxQty:1,condition:'normal'}]});
b.cancelOrder('r5');
eq('⑥ 予約のままキャンセル → 15 のまま', b.computeAvailable('ORG250'), 15);
eq('⑥ ロットも増えない CUR-A 5',          L(b,'CUR-A'), 5);

/* ── ⑧ 状態「多少傷アリOK」は【正規（現ロット）】から引き、キャンセルで戻る（2026-09-24） ──
   在庫の計算は正規と同じ（condition:'normal'）。目印 kizuOk が付くだけです。 */
b=fresh();
b.orders.push({id:'k1',num:'TK-K1',status:'reserved',stockDeducted:false,stockLog:[],
  lines:[{productId:1,bottles:3,boxes:0,boxQty:1,condition:'normal',kizuOk:true}]});
b.convertToShipping('k1');
eq('⑧ 多少傷アリOK は現ロットから引く CUR-A 5→2', L(b,'CUR-A'), 2);
eq('⑧ 旧ロットには触らない 8',                    L(b,'OLD'),   8);
eq('⑧ 不良品には触らない（現・軽 4）',              D(b,'D-cur-lv1'), 4);
b.cancelOrder('k1');
eq('⑧ キャンセルで現ロットに戻る CUR-A 5',          L(b,'CUR-A'), 5);

/* ── ⑦ 発注書の❌キャンセル☑・↩️差し戻し（GAS）でも、裏ラベルが戻るか（2026-09-24） ──
   ひろみさん「キャンセルでラベルも戻す。それは戻してください」
   前は GAS の oosYukaStockRestoreByKey_ が【オイルだけ】戻して、ラベルは減ったままでした（7件・7枚）。
   本物の GAS の関数を、身代わりのスプレッドシートで動かします。GASが手元に無いときは飛ばします。 */
(function(){
  const p = require('path'), os = require('os');
  const gp = p.join(os.homedir(), 'OneDrive', 'ドキュメント', 'olive-stories-gas', 'コード.js');
  if(!fs.existsSync(gp)){ console.log('（GASのファイルが手元に無いので ⑦ は飛ばしました）'); return; }
  const G = fs.readFileSync(gp, 'utf8');
  function cutG(name){ const i = G.indexOf('function ' + name + '('); if(i < 0) throw new Error(name); let d = 0, j = G.indexOf('{', i); for(; j < G.length; j++){ if(G[j] === '{') d++; else if(G[j] === '}'){ d--; if(!d) break; } } return G.slice(i, j + 1); }
  function mkSheet(rows){
    return { rows,
      getLastRow(){ return rows.length; }, getLastColumn(){ return rows[0].length; },
      getDataRange(){ const r = rows; return { getValues(){ return r.map(x => x.slice()); } }; },
      getRange(r, c, nr, nc){ const R = rows; return {
        getValues(){ const out = []; for(let i = 0; i < (nr||1); i++) out.push(R[r-1+i].slice(c-1, c-1+(nc||1))); return out; },
        setValue(v){ R[r-1][c-1] = v; } }; } };
  }
  const extra = { yukaKey:'K1', stockDeducted:true, stockLog:[
    { kind:'lot', id:'L1', qty:1 },
    { kind:'label', pid:2, i:0, qty:1 } ] };
  const juchu = mkSheet([ ['h'].concat(Array(19).fill('')), ['o1'].concat(Array(18).fill('')).concat([JSON.stringify(extra)]) ]);
  const zaiko = mkSheet([ ['id','pid','name','','','stock','',''], ['L1', 2, 'オルガニック 250ml', '', '', 10, '', 'new'] ]);
  const shohin = mkSheet([ ['id','sku','name','ラベル１枚数','ラベル２枚数'],
                           [2, 'ORG250', 'オルガニック 250ml', '48', '既貼'] ]);
  const box = { SHEET_ID_MAIN:'x', PRODUCTS_SHEET_NAME:'商品マスタ', JSON, String, Number, isNaN, Date,
    SpreadsheetApp:{ openById(){ return { getSheetByName(n){ return n === '受注データ' ? juchu : n === '在庫データ' ? zaiko : n === '商品マスタ' ? shohin : null; } }; } },
    oosMeiboWasureru_(){}, loadProducts(){ return { products:[] }; } };
  vm.createContext(box);
  let _lab = '';
  try{ _lab = cutG('oosLabelModosu_'); }catch(e){ fail++; fails.push('⑦ 裏ラベルを戻す係（oosLabelModosu_）がGASにありません'); }
  vm.runInContext(_lab + '\n' + cutG('oosYukaStockRestoreByKey_'), box);
  const r = box.oosYukaStockRestoreByKey_('K1');
  eq('⑦ 発注書の❌キャンセル：オイルが戻る（10→11）', zaiko.rows[1][5], 11);
  eq('⑦ 発注書の❌キャンセル：裏ラベルも戻る（48→49）', shohin.rows[1][3], '49');
  eq('⑦ 「既貼」の欄にはさわらない', shohin.rows[1][4], '既貼');
  const ex2 = JSON.parse(juchu.rows[1][19]);
  eq('⑦ 戻したラベルの記録は消す（二重に戻さない）', ex2.stockLog.filter(e => e.kind === 'label').length, 0);
  eq('⑦ 戻したことが記録に出る', /裏ラベル（オルガニック 250ml）×1/.test(ex2.stockLog[ex2.stockLog.length-1].txt), true);
  const r2 = box.oosYukaStockRestoreByKey_('K1');
  eq('⑦ もう一度押しても二重に戻さない', shohin.rows[1][3], '49');
})();

console.log('===== キャンセルで在庫が戻るか =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f=>console.log('  '+f)); }
process.exit(fail?1:0);
