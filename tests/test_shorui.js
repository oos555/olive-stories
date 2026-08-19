/* 倉庫Ｄの書類の見張り（2026-08-20 新設）

   ひろみさんのご質問：「A4縦サイズはOK？」「RTという名前が納品書に書かれないこともOK？」

   ★決めごと（2026-08-19 確定・変更禁止）
   ・書類は【A4縦】。品数が多いときは印刷のときだけ3段階で詰めて1枚に収める
   ・書類に【社内の暗号（TK/BA/RT/RTG/OS1/OS2/IT/FT）】と【区分（定価・卸・バサラ等）】を出さない
   ・伝票番号がある注文（RT取込）は【納品日＋伝票番号】、無い注文は【発行日＋注文番号（暗号なし）】

   ここでは、本物の関数で【5種類の書類 × 8種類の暗号＝40通り】を実際に組み立てて、
   出てきた文字を総当たりで調べます。 */
const fs = require('fs');
const vm = require('vm');
const R = require('path').join(__dirname, '..') + '/';
const H = require('./harness');
const pickup = fs.readFileSync(R + 'pickup.html', 'utf8');
const doc = fs.readFileSync(R + 'oos-doc.js', 'utf8');

let ok = 0, ng = 0; const bad = [];
function t(name, got, want){ if(String(got) === String(want)) ok++; else { ng++; bad.push(name + '　期待:' + want + '　実際:' + got); } }

/* ── 本物の oos-doc.js を読み込む ── */
const box = H.makeSandbox({}).box;
box.document = { createElement: () => ({ style:{}, textContent:'', appendChild(){}, getBoundingClientRect(){ return {}; } }),
                 head: { appendChild(){} }, getElementById: () => null, querySelectorAll: () => [] };
vm.runInContext(doc, vm.createContext(box));
const D = box.OOS_DOC;
t('◎ 共通の書類ファイルが読める', !!(D && typeof D.buildDoc === 'function'), true);

/* ── 倉庫Ｄの本物の関数 ── */
['docTitleOf','docNumberOf','docSlipNoOf','docDeliveryDateOf','invoiceNeedsAmount','buildInvoiceHtml']
  .forEach(fn => { try{ vm.runInContext(H.cut(pickup, fn), vm.createContext(box)); }catch(e){ console.log('（切り出せず: ' + fn + '）'); } });
['OOS_DOC_NAMES','CTYPE_BADGE','COMPANY_WEBSITE','COMPANY_EMAIL'].forEach(function(v){
  try{ vm.runInContext(H.cutVar(pickup, v), vm.createContext(box)); }catch(e){ console.log('（変数が切り出せず: '+v+'）'); }
});
box.PRODUCTS = [{ id:1, sku:'ORG250', name:'オルガニック エキストラバージンオリーブオイル 250ml', boxQty:12 }];
box.findProduct = id => box.PRODUCTS.find(p => String(p.id) === String(id));
box.findProductBySku = sku => box.PRODUCTS.find(p => p.sku === sku);
box.esc = s => String(s == null ? '' : s);
box.lineTotal = l => (l.bottles||0) + (l.boxes||0)*(l.boxQty||1);
/* 値段まわりは倉庫Ｄの本物を使う（無いものだけ身代わり） */
['priceForSku','lineTierType','taxRateForSku','effectiveCustomerType','defaultTaxRateForGroup','findProductBySku','recipientAddressBlock','shipFeeOf','orderTotalOf','giftLabel'].forEach(function(fn){
  try{ vm.runInContext(H.cut(pickup, fn), vm.createContext(box)); }catch(e){}
});
['DEFAULT_PRICES'].forEach(function(v){ try{ vm.runInContext(H.cutVar(pickup, v), vm.createContext(box)); }catch(e){} });
if(typeof box.priceForSku !== 'function') box.priceForSku = function(){ return 4750; };
if(typeof box.lineTierType !== 'function') box.lineTierType = function(){ return 'general'; };
if(typeof box.taxRateForSku !== 'function') box.taxRateForSku = function(){ return 0.08; };
box.priceMaster = []; box.PRICE_MASTER = [{sku:'ORG250', priceGeneral:4750, priceRT:3800, priceWholesale1:3800, priceWholesale2:2850, taxRate:0.08}];

/* ── ① 暗号を外す（総当たり） ── */
console.log('\n■ ① 注文番号から社内の暗号が外れるか（総当たり）');
const CODES = ['TK','BA','RT','RTG','OS1','OS2','IT','FT'];
CODES.forEach(function(c){
  const num = c + '-20260819-3528';
  const outNum = box.docNumberOf(num);
  t('① ' + c + '- が外れる（' + num + ' → ' + outNum + '）', /^[A-Za-z]/.test(outNum), false);
  t('① ' + c + ' の日付と番号は残る', outNum, '20260819-3528');
});
t('① 暗号が無い番号はそのまま', box.docNumberOf('20260819-3528'), '20260819-3528');
t('① 空でも落ちない', box.docNumberOf(''), '');
t('① 全角のハイフンでも外れる', box.docNumberOf('RT－20260819-3528'), '20260819-3528');

/* ── ② 書類ぜんぶを組み立てて、隠語が1文字も無いか ── */
console.log('\n■ ② できあがった書類の中に、社内の言葉が出ていないか');
const NG_WORDS = ['TK-','BA-','RT-','RTG-','OS1-','OS2-','IT-','FT-',
                  '定価','卸①','卸②','バサラ','不良在庫特価','特別提供価格','RT','RTGC','wholesale','defectprice','general'];
const DOCS = ['納品書','納品書兼請求書','納品書兼請求書兼領収書','請求書','領収書'];
let built = 0;
DOCS.forEach(function(dn){
  CODES.forEach(function(c){
    const o = {
      id:'X', num: c + '-20260819-3528', client:'リゾートトラスト株式会社', recipientName:'東京ベイコート倶楽部',
      customerType: (c === 'RT' ? 'rt' : c === 'BA' ? 'basara' : 'general'),
      zip:'105-0000', addr:'東京都港区', tel:'03-0000-0000',
      enclosedDoc: dn, note:'RT伝票取込 ／ 伝票番号 904211 ／ 納品予定日 2026-08-25 ／ 納品先 EC営業課',
      lines:[{ productId:1, bottles:6, boxes:1, boxQty:12, giftType:'none' }],
      registeredAt:'2026-08-19T01:00:00Z', shippedAt:'', shipFee:1200
    };
    let html = '';
    try{ html = String(box.buildInvoiceHtml(o) || ''); }catch(e){ html = 'ERROR:' + e.message; }
    if(html.indexOf('ERROR:') === 0){ ng++; bad.push('② ' + dn + '／' + c + ' が組み立てられない: ' + html); return; }
    built++;
    const text = html.replace(/<[^>]*>/g, ' ');
    NG_WORDS.forEach(function(w){
      if(text.indexOf(w) >= 0){ ng++; bad.push('② ' + dn + '／' + c + ' に「' + w + '」が出ている'); }
    });
  });
});
ok += built;
console.log('  ' + built + '通り（書類' + DOCS.length + '種 × 暗号' + CODES.length + '種）を組み立てて調べました');

/* ── ③ 出るべきものは出ているか ── */
console.log('\n■ ③ 出るべきものは出ているか');
const o2 = { id:'Y', num:'RT-20260819-3528', client:'リゾートトラスト株式会社', recipientName:'東京ベイコート倶楽部',
  customerType:'rt', zip:'105-0000', addr:'東京都港区', tel:'03-0000-0000', enclosedDoc:'納品書',
  note:'RT伝票取込 ／ 伝票番号 904211 ／ 納品予定日 2026-08-25', shipFee:1200,
  lines:[{ productId:1, sku:'ORG250', productName:'オルガニック エキストラバージンオリーブオイル 250ml', bottles:6, boxes:1, boxQty:12, giftType:'none' }], registeredAt:'2026-08-19T01:00:00Z' };
const h2 = String(box.buildInvoiceHtml(o2) || '');
const txt2 = h2.replace(/<[^>]*>/g, ' ');
t('③ 表題が「納品書」', txt2.indexOf('納品書') >= 0, true);
t('③ 伝票番号 904211 が出る', txt2.indexOf('904211') >= 0, true);
t('③ 納品予定日が出る', txt2.indexOf('2026/08/25') >= 0 || txt2.indexOf('2026-08-25') >= 0, true);
/* ★仕様：伝票番号がある注文（RT取込）は、注文番号のかわりに【納品日＋伝票番号】を出す
   （ゆかさん指摘・アイポーターと同じ番号）。伝票番号が無い注文だけ【発行日＋注文番号】。 */
t('③ 伝票番号がある注文は、注文番号を出さない', txt2.indexOf('注文番号') >= 0, false);
t('③ かわりに伝票番号を出す', txt2.indexOf('伝票番号：904211') >= 0, true);
const o3 = Object.assign({}, o2, { note:'' });
const txt3 = String(box.buildInvoiceHtml(o3)||'').replace(/<[^>]*>/g,' ');
t('③ 伝票番号が無い注文は、注文番号を暗号なしで出す', txt3.indexOf('20260819-3528') >= 0, true);
t('③ そのとき暗号のRT-は出ない', txt3.indexOf('RT-') >= 0, false);
t('③ そのとき発行日を出す', txt3.indexOf('発行日') >= 0, true);
t('③ お届け先が出る', txt2.indexOf('東京ベイコート倶楽部') >= 0, true);
t('③ 商品名が出る', txt2.indexOf('オルガニック') >= 0, true);
t('③ 本数が出る（6＋12＝18本）', txt2.indexOf('18') >= 0, true);

/* ── ④ A4縦・1枚のきまり ── */
console.log('\n■ ④ A4縦のきまり');
t('④ PDFはA4の縦', /orientation:\s*'portrait'[\s\S]{0,40}format:\s*'a4'/.test(doc), true);
t('④ 印刷は紙いっぱい（幅の制限を外す）', doc.indexOf("max-width:none!important") >= 0, true);
t('④ 文字は11pt', doc.indexOf('.invoice-doc{font-size:11pt!important}') >= 0, true);
t('④ 品数で詰める3段階がある', doc.indexOf("items.length >= 11 ? ' doc-dense3'") >= 0, true);
t('④ 5品以上で詰めはじめる', doc.indexOf("items.length >= 5 ? ' doc-dense1'") >= 0, true);
t('④ 外枠を出さない', doc.indexOf('border:none!important') >= 0, true);
t('④ 詰めを消すなの注意書きが残っている', doc.indexOf('この3段階を消すと2枚になります') >= 0, true);
/* 品数ごとにどの詰めになるか */
function dense(n){ return n >= 11 ? 'dense3' : (n >= 8 ? 'dense2' : (n >= 5 ? 'dense1' : 'そのまま')); }
[[1,'そのまま'],[4,'そのまま'],[5,'dense1'],[7,'dense1'],[8,'dense2'],[10,'dense2'],[11,'dense3'],[20,'dense3']]
  .forEach(x => t('④ ' + x[0] + '品 → ' + x[1], dense(x[0]), x[1]));

console.log('===== 倉庫Ｄの書類（A4縦・社内の言葉を出さない） =====');
console.log(`PASS ${ok} / FAIL ${ng}`);
if(bad.length){ console.log('--- FAIL の中身 ---'); bad.slice(0,20).forEach(b => console.log('  ' + b)); if(bad.length>20) console.log('  …ほか' + (bad.length-20) + '件'); }
process.exit(ng ? 1 : 0);
