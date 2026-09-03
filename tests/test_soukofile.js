/* 倉庫ファイル（スプシ一本化・第1弾）の決めごとが消えていないかを試す。2026-09-03 追加。
   承認済みモック：おためし版_ゆかスプシと倉庫ファイル_2026-09-03.html（mocks/）
   GASのファイルは【公開リポジトリに置きません】。手元の作業フォルダにあれば読み、無ければ飛ばします。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

function readGasSource(){
  const os = require('os');
  const cands = [
    path.join(__dirname, 'gas', 'コード.js'),
    path.join(os.homedir(), 'OneDrive', 'ドキュメント', 'olive-stories-gas', 'コード.js')
  ];
  for(const c of cands){ if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); }
  console.log('（GASのファイルが手元にないので、このテストは飛ばしました）');
  process.exit(0);
}
const gasSrc = readGasSource();

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(got === want) pass++; else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}
function has(label, hay, needle){
  if(String(hay).indexOf(needle) >= 0) pass++; else { fail++; fails.push(`${label}  「${needle}」が見つかりません`); }
}

/* ── ① 在庫表の行の計算（本物の oosSoukoStockRows_ をそのまま動かす） ─────────
   決めごと：🛒＝親のavailable／🔒＝（棚の良品−販売可能）＋手入力取置（hold・hold_old）／
   🏠＝🛒＋🔒（必ずこの足し算。二重計上よけ） */
const ctx = vm.createContext({ Math, String, Number, Object });
vm.runInContext(H.cut(gasSrc, 'oosSoukoStockRows_'), ctx);
const rowsFn = ctx.oosSoukoStockRows_;

{
  const products = [
    { id:1, sku:'ORG250', name:'オルガニック 250ml', sortOrder:2 },
    { id:2, sku:'ORG500', name:'オルガニック 500ml', sortOrder:1 },
    { id:3, sku:'SET01',  name:'セット', isSet:true, sortOrder:0 },
    { id:4, sku:'OLD01',  name:'終売品', active:false, sortOrder:0 },
    { id:5, sku:'MEM250', name:'メネジック 250ml', sortOrder:3 }
  ];
  const lots = [
    { pid:1, stock:5, status:'hold' },       // 手入力の取置（現）
    { pid:1, stock:2, status:'hold_old' },   // 手入力の取置（旧）も🔒に入れる
    { pid:1, stock:60, status:'new' },       // 棚の良品はここでは数えない（親calcの仕事）
    { pid:2, stock:3, status:'discard' }     // 廃棄は🔒に入れない
  ];
  // 親（basaraComputeStock_相当）の身代わり：ORG250 棚60/販売可能45（＝受注取置15）
  const calc = {
    regularGood(sku){ return {ORG250:60, ORG500:50, MEM250:0}[sku] ?? null; },
    available(sku){  return {ORG250:45, ORG500:50, MEM250:0}[sku] ?? null; }
  };
  const rows = rowsFn(products, lots, calc);

  eq('①行数（セット・終売は出ない）', rows.length, 3);
  eq('①並び順はsortOrder（500→250→メネ）', rows.map(r=>r[0].split(' ')[0]).join(','), 'ORG500,ORG250,MEM250');

  const org250 = rows.find(r => r[0].startsWith('ORG250'));
  eq('①ORG250 🛒販売できる数＝親のavailable', org250[2], 45);
  eq('①ORG250 🔒＝受注取置15＋手入力7', org250[3], 22);
  eq('①ORG250 🏠＝🛒＋🔒（別の式で出さない）', org250[1], 45 + 22);

  const org500 = rows.find(r => r[0].startsWith('ORG500'));
  eq('①ORG500 廃棄は🔒に入らない', org500[3], 0);
  eq('①ORG500 🏠＝🛒＋🔒', org500[1], org500[2] + org500[3]);

  const mem = rows.find(r => r[0].startsWith('MEM250'));
  eq('①MEM250 ぜんぶ0でも行は出る（0も見せる）', mem.join(','), 'MEM250 メネジック 250ml,0,0,0');

  // 全行で 🏠＝🛒＋🔒 の検算（モックの「85=60+25」「93=0+93」と同じ関係）
  eq('①検算：全行で🏠＝🛒＋🔒', rows.every(r => r[1] === r[2] + r[3]), true);
}

{ // 親がnullを返す商品（マスタ不整合）でも落ちず0で出す
  const rows = rowsFn([{ id:9, sku:'XX', name:'謎', sortOrder:1 }], [], { regularGood(){ return null; }, available(){ return null; } });
  eq('②親がnullでも0で出る', rows[0].join(','), 'XX 謎,0,0,0');
}

/* ── ③ ▼の選択肢・見出しがモックの文言のままか（一字一句） ───────── */
function readVar(name){ const c = vm.createContext({}); vm.runInContext(H.cutVar(gasSrc, name), c); return c[name]; }
const states = readVar('OOS_SOUKO_STATES');
eq('③状態▼は5つ', states.length, 5);
eq('③状態▼青', states[0], '🔵 青：ラベルを貼り替えれば使える');
eq('③状態▼黒', states[4], '⚫ 黒：廃棄（もう使えない）');
const tos = readVar('OOS_SOUKO_TO');
eq('③あとの状態▼の先頭は「使える」', tos[0], '⚪ 使える（良品にもどす）');
const froms = readVar('OOS_SOUKO_FROM');
eq('③まえの状態▼に「わからない」', froms[4], '❓ わからない');
const lotsOpt = readVar('OOS_SOUKO_LOTS');
eq('③ロット▼', lotsOpt.join('/'), '現ロット/旧ロット/わからない');

const setupSrc = H.cut(gasSrc, 'oosSetupSoukoFile');
// 見出しはGASの中に「\n」（改行の印）つきで書かれているので、印のまま探す
has('③在庫表の🏠見出し', setupSrc, '🏠 倉庫にある数\\n（実在庫）');
has('③在庫表の🛒見出し', setupSrc, '🛒 販売できる数\\n（ここまで動かしてOK）');
has('③在庫表の🔒見出し', setupSrc, '🔒 予約・取り置き済み\\n（触らない）');
has('③オーダー表の送り状見出し', setupSrc, '送り状NO.\\nご記入お願いします。');
has('③オーダー表の依頼日時見出し', setupSrc, '依頼日時\\n（自動で入る）');
has('③黒メモの見出し', setupSrc, 'メモ（自由）\\n黒のときは瓶の様子をひとこと');

/* ── ④ 守りが入っているか（保護・トリガー・見張り） ───────── */
has('④在庫表は見るだけの保護', setupSrc, '在庫表は見るだけです');
has('④オーダー表で書けるのは送り状と発送済だけ', setupSrc, '倉庫さんが書くのは「送り状NO.」と「発送済☑」だけ');
has('④毎時の在庫表うつしトリガー', setupSrc, "newTrigger('oosSoukoStockSync')");
has('④編集の見張りトリガー', setupSrc, "newTrigger('oosSoukoOnEdit')");
has('④トリガーは一度消してから作る（増殖よけ）', setupSrc, 'deleteTrigger');
has('④共有は自動でしない（人が招待）', setupSrc, '「共有」で倉庫さんを「編集者」として招待');

const onEditSrc = H.cut(gasSrc, 'oosSoukoOnEdit');
has('④黒でメモが空なら例文を出す', onEditSrc, '瓶の様子をひとこと書いてください');
has('④まえ＝あとの注意', onEditSrc, 'まえとあとが同じ色です');

const syncSrc = H.cut(gasSrc, 'oosSoukoStockSync');
has('④数字の親はbasaraComputeStock_を呼ぶだけ', syncSrc, 'basaraComputeStock_()');
has('④🕐最終更新を必ず出す', syncSrc, '🕐 最終更新');
eq('④syncは在庫データに書かない（読むだけ）', /在庫データ[^\n]*setValue/.test(syncSrc), false);

/* ── ⑤ 第2弾：ゆかスプシの運用コピーと③倉庫へ依頼する ───────── */
// 純粋な変換（本物の oosYukaRowToOrder_ をそのまま動かす）：コピーの2〜18列がオーダー表の2〜18列にそのまま写るか
vm.runInContext(H.cut(gasSrc, 'oosYukaRowToOrder_'), ctx);
{
  const disp = ['TRUE','2027/01/31','コード7043* CUP3個入り','20','','','','','','',
                'サンクチュアリコート高山','岐阜県高山市…','0577-40-0116','2026/05/16','午前中',
                '同梱伝票２枚あります。','納品書.pdf','伝票番号368131.pdf','（送り状）','（発送済）'];
  const out = ctx.oosYukaRowToOrder_(disp, '9/3 14:05');
  eq('⑤先頭は依頼日時', out[0], '9/3 14:05');
  eq('⑤賞味期限が2列目に', out[1], '2027/01/31');
  eq('⑤商品①名', out[2], 'コード7043* CUP3個入り');
  eq('⑤商品①数', out[3], '20');
  eq('⑤氏名（11列目）', out[10], 'サンクチュアリコート高山');
  eq('⑤電話（13列目・実物で確認した列）', out[12], '0577-40-0116');
  eq('⑤備考欄（16列目）', out[15], '同梱伝票２枚あります。');
  eq('⑤同梱他（18列目）', out[17], '伝票番号368131.pdf');
  eq('⑤送り状は空で始まる', out[18], '');
  eq('⑤発送済はfalseで始まる', out[19], false);
  eq('⑤全部で20列', out.length, 20);
  eq('⑤コピーの送り状・発送済（19・20列目）は写さない', out.indexOf('（送り状）') < 0 && out.indexOf('（発送済）') < 0, true);
}
// オリジナルのゆかスプシは絶対に開かない（コピーするだけ）＝ひろみさんの指示（2026-09-03）
eq('⑤オリジナルをopenByIdで開くコードが無い', /openById\(\s*OOS_YUKA_ORIG_ID/.test(gasSrc), false);
has('⑤コピーはDriveAppのmakeCopyで作る', H.cut(gasSrc, 'oosSetupYukaCopy'), 'makeCopy');
has('⑤オリジナル無変更の説明がログに出る', H.cut(gasSrc, 'oosSetupYukaCopy'), 'オリジナルのゆかスプシは1文字も変えていません');
// 守りの文言
const reqSrc = H.cut(gasSrc, 'oosYukaRequestEdit_');
has('⑤商品①が空なら流さない', reqSrc, '商品①が空です');
has('⑤氏名が空なら流さない', reqSrc, '氏名が空です');
has('⑤二重転記よけ（キーがあれば流さない）', reqSrc, 'すでに依頼済みです（二重には流れません）');
has('⑤昔の発送済み行は流さない', reqSrc, 'すでに発送済みです（昔の注文）');
has('⑤③のマスは✅依頼済＋日時に変わる', reqSrc, "'✅ 依頼済 ' + stamp");
const shipSrc = H.cut(gasSrc, 'oosSoukoShippedEdit_');
has('⑤送り状NO.が空なら発送済にできない', shipSrc, '先に送り状NO.を書いてください');
has('⑤送り状NO.は運用コピーへ自動で戻る', shipSrc, 'ysh.getRange(yrow, 19).setValue(track)');
const fixSrc = H.cut(gasSrc, 'oosYukaFixEdit_');
has('⑤発送済みの行は修正できない', fixSrc, 'すでに発送済みのため修正できません');
has('⑤✏️修正あり の目印', fixSrc, '修正あり');
// オーダー表の列は実物どおり（電話・同梱他を含む20列）
has('⑤オーダー表に電話の列', setupSrc, '【お届け先】\\n電話');
has('⑤オーダー表に同梱書類他の列', setupSrc, '同梱書類\\n他あれば');
has('⑤行グレーは発送済（20列目=T）', setupSrc, '=$T2=TRUE');
has('⑤オレンジは備考欄（16列目=P）の入荷待ち', setupSrc, '=REGEXMATCH($P2,"入荷待ち")');

console.log('===== 倉庫ファイル（スプシ一本化・第1弾）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
