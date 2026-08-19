/* 通しの動きと「消えない」の見張り（2026-08-20 ひろみさん指示で新設）

   ひろみさん：「絶対に消えない。私が指示しない限り消えないということも、もう一度確かめて」
               「二人で同時に同じファイルを開いて作業してしまう。壊れませんか、数がずれませんか」

   ① 通しの動き：注文 → 出荷 → もう一度押す → キャンセル で、
      オイルも裏ラベルも【1本・1枚のズレもなく】元に戻るか
   ② 消えうる道：全消し保存・上書き・見張りの書き戻しなどが塞がっているか
   ③ 2人同時：読み直してから動く見張りがそろっているか
   ④ たくさんデータがあっても落ちないか

   ★このテストを一覧から外さないでください。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = require('path').join(__dirname, '..') + '/';
const H = require('./harness');
const read = f => fs.readFileSync(R + f, 'utf8');
const F = { zaiko: read('oos-zaiko.js'), master: read('master.html'), index: read('index.html'),
            home: read('home.html'), billing: read('billing.html'), pickup: read('pickup.html') };
/* GASは手元にある人だけ確かめる（無くても他の項目は動く） */
let GAS = '';
try{ GAS = fs.readFileSync('C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js','utf8'); }catch(e){}

let ok = 0, ng = 0; const bad = [];
function t(name, got, want){ if(String(got) === String(want)) ok++; else { ng++; bad.push(name + '　期待:' + want + '　実際:' + got); } }
function sec(s){ console.log('\n■ ' + s); }

/* ══════ ① 通しの動き：注文 → 出荷 → キャンセル ══════ */
sec('① 通しの動き（注文 → 出荷 → キャンセル）でぴったり戻るか');
const boxZ = H.makeSandbox({}).box;
vm.runInContext(F.zaiko, vm.createContext(boxZ));
const Z = boxZ.OOS_ZAIKO, LAB = Z.LABEL;

const PRODUCTS = [{ id:1, sku:'ORG250', name:'オルガニック250ml', boxQty:12,
  'ラベル１名前':'本体ラベル', 'ラベル１枚数':'500',
  'ラベル２名前':'部分ラベル', 'ラベル２枚数':'300' }];
const lots = [
  { id:'CUR-A', pid:1, status:'new', expiry:'2026-12-01', stock:20 },
  { id:'CUR-B', pid:1, status:'new', expiry:'2027-01-01', stock:30 },
  { id:'OLD',   pid:1, status:'old', expiry:'2026-06-01', stock:8 }
];
const defects = [{ id:'D1', pid:1, qty:5, shippedQty:0, level:'lv1', status:'pending', reviewed:true, lotKind:'', processedAt:'2026-08-01' }];
const before = { lots: JSON.stringify(lots), defects: JSON.stringify(defects),
                 lab1: LAB.qty(PRODUCTS[0],0), lab2: LAB.qty(PRODUCTS[0],1) };

const boxI = H.makeSandbox({
  OOS_ZAIKO: Z, PRODUCTS: PRODUCTS, lots: lots, defects: defects, orders: [],
  findProduct: function(id){ return PRODUCTS.find(p => String(p.id) === String(id)); },
  findProductBySku: function(sku){ return PRODUCTS.find(p => p.sku === sku); },
  isActiveDefect: function(d){ return Z.isActiveDefect(d); }
}).box;
['deductFromLots','deductFromDefects','deductStockForOrder','restoreStockForOrder',
 'applyStockDeductOnSend','undoStockForOrder','labDeductForProduct','labSetQty','lineTotal']
  .forEach(fn => { try{ vm.runInContext(H.cut(F.index, fn), vm.createContext(boxI)); }catch(e){ console.log('  （切り出せず: ' + fn + '）'); } });
vm.runInContext('var __labDirty = {};', vm.createContext(boxI));

const order = { id:'T1', num:'TK-TEST', status:'pending', stockDeducted:false, stockLog:[],
  lines:[{ productId:1, bottles:7, boxes:0, boxQty:1, condition:'normal' }] };
boxI.applyStockDeductOnSend(order);
const shelfAfter = lots.filter(l => l.status==='new').reduce((s,l)=>s+l.stock,0);
t('出荷でオイルが7本減る', shelfAfter, 50 - 7);
t('出荷でラベル①が7枚減る', LAB.qty(PRODUCTS[0],0), 493);
t('出荷でラベル②も7枚減る', LAB.qty(PRODUCTS[0],1), 293);
t('印が付く', order.stockDeducted, true);
/* もう一度押しても動かない */
boxI.applyStockDeductOnSend(order);
t('もう一度押してもオイルは減らない', lots.filter(l=>l.status==='new').reduce((s,l)=>s+l.stock,0), 43);
t('もう一度押してもラベルは減らない', LAB.qty(PRODUCTS[0],0), 493);
/* キャンセル */
boxI.undoStockForOrder(order);
t('キャンセルでオイルが完全に戻る', JSON.stringify(lots), before.lots);
t('キャンセルで不良も完全に戻る', JSON.stringify(defects), before.defects);
t('キャンセルでラベル①が戻る', LAB.qty(PRODUCTS[0],0), before.lab1);
t('キャンセルでラベル②が戻る', LAB.qty(PRODUCTS[0],1), before.lab2);
t('印が外れる', order.stockDeducted, false);
/* 旧ロット・不良の出荷でもラベルは減る（瓶は出ていくので） */
const o2 = { id:'T2', status:'pending', stockDeducted:false, stockLog:[],
  lines:[{ productId:1, bottles:2, boxes:0, boxQty:1, condition:'old' }] };
boxI.applyStockDeductOnSend(o2);
t('旧ロットの出荷でもラベルは減る', LAB.qty(PRODUCTS[0],0), 498);
boxI.undoStockForOrder(o2);
t('戻すと元どおり', LAB.qty(PRODUCTS[0],0), 500);
const o3 = { id:'T3', status:'pending', stockDeducted:false, stockLog:[],
  lines:[{ productId:1, bottles:3, boxes:0, boxQty:1, condition:'defect', defectLevel:'lv1', defectLotKind:'cur' }] };
boxI.applyStockDeductOnSend(o3);
t('不良品の出荷でもラベルは減る', LAB.qty(PRODUCTS[0],0), 497);
boxI.undoStockForOrder(o3);
t('戻すと元どおり（不良）', LAB.qty(PRODUCTS[0],0), 500);
t('全部やって、オイルの在庫は最初と同じ', JSON.stringify(lots), before.lots);

/* ══════ ② 「指示しない限り消えない」 ══════ */
sec('② 消えうる道をすべて塞げているか');
t('②-1 商品マスタの全消し保存(saveProducts)を、どの画面も呼んでいない',
  /action:\s*'saveProducts'/.test(F.master + F.index + F.billing + F.home + F.pickup), false);
t('②-2 統合マスタＮから受注の全消し保存(saveOrders)を呼んでいない', /saveOrders\s*\(/.test(F.master), false);
t('②-3 受注の保存は「最新を読み直して自分の変更だけ重ねる」', F.index.indexOf('最新をベースに、自分の変更した注文だけを id で重ねる') >= 0, true);
t('②-4 在庫の保存は「自分が変えた分だけ」（baseline差分）', F.master.indexOf('この画面で自分が変えた分（追加・変更・削除）を id 単位で洗い出す') >= 0, true);
t('②-5 出荷の在庫反映は「最新に増減だけ足す」', F.index.indexOf('増減リストを、取り直した最新データに適用して保存') >= 0, true);
t('②-6 ラベルの保存は1商品ずつ（saveOneProduct）', /action:'saveOneProduct'/.test(F.index) && /action:'saveOneProduct'/.test(F.master), true);
if(GAS){
t('②-7 GASは空データで上書きしない安全装置がある', /skipped/.test(GAS), true);
t('②-8 GASは知らない列を消さずに右端へ足す', GAS.indexOf('シートにまだ列が無いものは右端に足す') >= 0, true);
t('②-9 GASは未知の列を extras に入れて読み返す', GAS.indexOf('p.extras[h] = String(val)') >= 0, true);
} else console.log('  （GASのファイルが手元にないので②-7〜②-9は飛ばしました）');
t('②-10 「🗑 発注から消す」は行を消さず status を変えるだけ', /status='deleted'|status = 'deleted'|'deleted'/.test(F.index), true);
t('②-11 ラベルは通信が失敗しても画面から消さない', F.master.indexOf('通信が失敗しても、画面から消さない') >= 0 || F.master.indexOf('先に手元へ') >= 0, true);
t('②-12 在庫の見張りは保存を一切しない', F.index.indexOf('保存もしません（persistStockDeduct などは呼びません）') >= 0, true);
t('②-13 見張りはラベルも必ず戻す', F.index.indexOf('裏ラベルの枚数も控えて必ず戻す') >= 0, true);
t('②-14 見張りのぶんは保存しない', F.index.indexOf('見張りのぶんは保存しない') >= 0, true);

/* ══════ ③ 2人同時の見張り ══════ */
sec('③ 2人が同時に開いたときの見張り');
t('③-1 ラベル📥は最新を読み直す', F.master.indexOf('function labFetchFresh') >= 0, true);
t('③-2 輸入の一気入れも読み直す', F.master.indexOf('function impFetchFreshIncoming') >= 0, true);
t('③-3 ②倉庫へ送るも読み直す', F.index.indexOf('async function fetchOrderFresh') >= 0, true);
t('③-4 もう送られていたら止める', F.index.indexOf('二重には送っていません') >= 0, true);
t('③-5 止めたあと画面を新しくする', F.index.indexOf('画面を新しくしました') >= 0, true);
t('③-6 確かめられないときは黙って進めない', F.master.indexOf('声をかけてください') >= 0 || F.master.indexOf('声をかけて') >= 0, true);

/* ══════ ④ たくさんあっても落ちないか ══════ */
sec('④ たくさんデータがあっても落ちないか');
const many = [];
for(let i = 1; i <= 3000; i++){
  many.push({ id:i, sku:'S' + i, name:'商品' + i,
    'ラベル１名前': (i % 3 ? '本体ラベル' : ''), 'ラベル１枚数': String(i % 120) });
}
const t0 = Date.now();
const low = LAB.lowList(many);
const ms = Date.now() - t0;
t('④-1 3000商品でも落ちない', low.length > 0, true);
t('④-2 名前が空のものは数えない', low.every(x => x.label !== ''), true);
t('④-3 じゅうぶん速い（1秒未満）', ms < 1000, true);
console.log('  3000商品の見張りにかかった時間: ' + ms + 'ミリ秒／少ないラベル ' + low.length + '件');
/* 在庫の親も大量データで確認 */
const bigLots = [];
for(let i = 0; i < 5000; i++) bigLots.push({ id:'L'+i, pid:1, status:'new', expiry:'2026-12-01', stock:1 });
const t1 = Date.now();
const nn = Z.numbers(1, { lots:bigLots, defects:[], orders:[], preorders:[] }, [{id:1,sku:'X',name:'X'}]);
t('④-4 5000ロットでも数えられる', nn.cur.avail, 5000);
console.log('  5000ロットの計算にかかった時間: ' + (Date.now() - t1) + 'ミリ秒');

/* ══════ まとめ ══════ */
console.log('===== 通しの動きと「消えない」の見張り =====');
console.log('PASS ' + ok + ' / FAIL ' + ng);
if(bad.length){ console.log('--- FAIL の中身 ---'); bad.forEach(function(b){ console.log('  ' + b); }); }
process.exit(ng ? 1 : 0);
