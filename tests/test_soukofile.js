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
  // ★2026-09-04修正：並べ替えはしない。商品マスタの登録順のまま（統合アプリと同じ）
  eq('①並び順は商品マスタの登録順のまま（並べ替えない）', rows.map(r=>r[0].split(' ')[0]).join(','), 'ORG250,ORG500,MEM250');

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
/* ★2026-09-04 二重よけは「倉庫のオーダー表に本当にあるか」で見る形に変更（ひろみさん承認・バサラ行の誤ブロック直し） */
has('⑤二重転記よけ（倉庫にすでにあれば流さない）', reqSrc, 'すでに倉庫へ流れています（二重には流れません）');
has('⑤昔の発送済み行は流さない', reqSrc, 'すでに発送済みです（昔の注文）');
has('⑤③のマスは✅依頼済＋日時に変わる', reqSrc, "'✅ 依頼済 ' + stamp");
const shipSrc = H.cut(gasSrc, 'oosSoukoShippedEdit_');
has('⑤送り状NO.が空なら発送済にできない', shipSrc, '先に送り状NO.を書いてください');
/* ★2026-09-04 ひろみさん指示：「倉庫スプシに送り状番号を書いたら発送完了とみなす。☑は外す」
   → 戻す処理は oosSoukoTrackBack_ へ。S列（19列目）の記入で発動することを見張る */
has('⑤送り状NO.（S列）を書いたら発送完了が動く', shipSrc, 'col === 19');
has('⑤番号を書くと戻し処理が呼ばれる', shipSrc, 'oosSoukoTrackBack_(sh, row, track19)');
const backSrc = H.cut(gasSrc, 'oosSoukoTrackBack_');
has('⑤送り状NO.は運用コピーへ自動で戻る', backSrc, 'ysh.getRange(yrow, 19).setValue(track)');
has('⑤運用コピー側は発送済（行グレー）になる', backSrc, 'ysh.getRange(yrow, 20).setValue(true)');
has('⑤発送済☑の列は表に出さない（隠す）', H.cut(gasSrc, 'oosSoukoTrackDone'), 'hideColumns(20)');
has('⑤送り状NO.の見出しに説明が付く', H.cut(gasSrc, 'oosSoukoTrackDone'), '（書いたら発送完了になります）');
const fixSrc = H.cut(gasSrc, 'oosYukaFixEdit_');
has('⑤発送済みの行は修正できない', fixSrc, 'すでに発送済みのため修正できません');
has('⑤✏️修正あり の目印', fixSrc, '修正あり');
// オーダー表の列は実物どおり（電話・同梱他を含む20列）
has('⑤オーダー表に電話の列', setupSrc, '【お届け先】\\n電話');
has('⑤オーダー表に同梱書類他の列', setupSrc, '同梱書類\\n他あれば');
has('⑤行グレーは発送済（20列目=T）', setupSrc, '=$T2=TRUE');
has('⑤オレンジは備考欄（16列目=P）の入荷待ち', setupSrc, '=REGEXMATCH($P2,"入荷待ち")');

/* ── ⑥ 第2弾の残り＋第3弾：📱梱包ビュー（konpo.html）と📥取り込み ───────── */
const konpoSrc = fs.readFileSync(path.join(__dirname, '..', 'konpo.html'), 'utf8');
has('⑥konpo：見出し', konpoSrc, '📦 きょうの梱包');
has('⑥konpo：梱包終了ボタンの文言', konpoSrc, '✅ 梱包終了（この1件をスマホから消す）');
has('⑥konpo：入荷待ちはまだ梱包しない', konpoSrc, 'まだ梱包しません');
has('⑥konpo：足元の説明（スプシには全部残る）', konpoSrc, 'スマホから消えるだけで、スプシには全部残ります');
has('⑥konpo：読む窓口はkonpoOrders', konpoSrc, "action:'konpoOrders'");
has('⑥konpo：☑の記録はkonpoPackSave', konpoSrc, "action:'konpoPackSave'");
has('⑥konpo：開いたとき一度だけ読む＋🔄', konpoSrc, '🔄 新しくする');
has('⑥konpo：ボタンは青（家ルール）', konpoSrc, '.pack-done-btn { display: block; width: 100%; background: #0c447c');
eq('⑥konpo：在庫を触るコードが無い', /applyStockDeduct|saveAllData|saveOrders/.test(konpoSrc), false);

const konpoGas = H.cut(gasSrc, 'oosKonpoOrders');
has('⑥GAS：発送済みはスマホに出さない', konpoGas, 'vals[i][19] === true) continue');
has('⑥GAS：✏️修正ありは備考のメモから', konpoGas, 'getNotes()');
const packGas = H.cut(gasSrc, 'oosKonpoPackSave');
has('⑥GAS：☑は隠し列にだけ書く', packGas, 'oosPackColByHeader_');
const impGas = H.cut(gasSrc, 'oosYukaImportOrder');
has('⑥GAS：二重よけの目印は【出どころ 注文番号】', impGas, "'【' + String(order.src||'受注A') + ' ' + String(order.num||'') + '】'");
has('⑥GAS：すでにあればdupで止まる', impGas, "{status:'dup', row:i+2}");
has('⑥GAS：5商品以上は備考へ逃がす', impGas, 'ほかの商品：');
/* ★2026-09-04午後 ひろみさんの新しい流れ：A列は☑でなく赤ボタンで始まる */
has('⑥GAS：入った行のA列は赤ボタンで始まる', impGas, 'aCell.setValue(OOS_YUKA_BTN_STOP)');
const routeGas = H.cut(gasSrc, 'oosSpreadRoute_');
has('⑥GAS：窓口3つ（konpoOrders）', routeGas, "'konpoOrders'");
has('⑥GAS：窓口3つ（konpoPackSave）', routeGas, "'konpoPackSave'");
has('⑥GAS：窓口3つ（yukaImportOrder）', routeGas, "'yukaImportOrder'");

const idxSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
has('⑥受注Ａ：📥ボタンの文言', idxSrc, '📥 ゆかスプシに取り込む');
has('⑥受注Ａ：取込済バッジ', idxSrc, '📗 ゆかスプシへ取込済');
has('⑥受注Ａ：在庫は動かない説明', idxSrc, '在庫はここでは動きません。登録のときにもう引いてあります');
eq('⑥受注Ａ：①と②の両方の枠に📥が出る', (idxSrc.match(/whHint\+yk/g)||[]).length, 2);
const impIdx = H.cut(idxSrc, 'yukaImportOne');
eq('⑥受注Ａ：📥は在庫をいっさい触らない', /applyStockDeductOnSend|restoreStockForOrder/.test(impIdx), false);
has('⑥受注Ａ：最新読み直しの二重よけ', impIdx, 'fetchOrderFresh');
has('⑥受注Ａ：GASのdupにも印を付けて二重を防ぐ', impIdx, "d.status==='dup'");
has('⑥受注Ａ：もう一度押しても二重にならない案内', impIdx, 'もう一度押しても、ゆかスプシに2行目はできません');

/* ── ⑦ 追記の行位置：☑を敷いた空行は数えない（2026-09-04のバグ修正の見張り）
   実際に起きた事故：チェックボックスをA2:A1000に敷いたため getLastRow() が1000になり、
   📥の転記が1001行目に入ってしまった。 */
{
  const ctx7 = vm.createContext({ String, Number, Math });
  vm.runInContext(H.cut(gasSrc, 'oosLastDataRow_'), ctx7);
  // 92行目までデータ・その下は空（☑だけの行を想定）という身代わりシート
  const fake = {
    getLastRow(){ return 1000; },
    getRange(r, c, nr, nc){
      return { getDisplayValues(){
        const out = [];
        for(let i=0; i<nr; i++){
          const row = [];
          for(let j=0; j<nc; j++) row.push((r+i) <= 92 ? 'x' : '');
          out.push(row);
        }
        return out;
      } };
    }
  };
  eq('⑦最終データ行は92（☑だけの行993行分を数えない）', ctx7.oosLastDataRow_(fake, 2, 19), 92);
  const empty = { getLastRow(){ return 1; }, getRange(){ return { getDisplayValues(){ return []; } }; } };
  eq('⑦データが無ければ1（見出し行）', ctx7.oosLastDataRow_(empty, 2, 19), 1);
  has('⑦📥の転記は oosLastDataRow_ を使う', H.cut(gasSrc, 'oosYukaImportOrder'), 'oosLastDataRow_(sh, 2, 19) + 1');
  has('⑦③の転記も oosLastDataRow_ を使う', H.cut(gasSrc, 'oosYukaRequestEdit_'), 'oosLastDataRow_(osh, 1, 19) + 1');
}

/* ── ⑧ ゆかちゃん指摘の2バグ修正の見張り（2026-09-04） ─────────
   A:「記録のみ」(whSkip)が保存で捨てられ「未送信」に復活していた（2026-08-25報告）。
     原因＝GASの拡張データJSONの載せ忘れ（2026-08-24の送料と同じ穴）。書く側と読む側の両方を見張る。
   B: 取り置き登録で「送る目安」が必須になっていて先に進めなかった。確認1回に変更。 */
const saveMainSrc = H.cut(gasSrc, 'saveOrdersMain');
has('⑧whSkipを保存する', saveMainSrc, 'whSkip: o.whSkip||null');
has('⑧yukaImportを保存する', saveMainSrc, 'yukaImport: o.yukaImport||null');
const loadAllSrc = H.cut(gasSrc, 'loadAll');
has('⑧whSkipを読み戻す', loadAllSrc, 'whSkip: extra.whSkip||null');
has('⑧yukaImportを読み戻す', loadAllSrc, 'yukaImport: extra.yukaImport||null');
has('⑧取り置きの送る目安は必須にしない（確認1回）', idxSrc, '「送る目安（いつ頃出す？）」が空です');
eq('⑧空のままでは登録できない旧ブロックは消えている', idxSrc.indexOf('取り置きは「いつまでの取り置きか」を必ず入れてください') < 0, true);

/* ── ⑨ 本部の処理は☑で（2026-09-04 ひろみさん指示）─────────
   マスタＮに反映し終わったら☑→「✅ マスタＮに反映済み＋日時」に置き換わり行がグレーに。
   倉庫さんはこの列に触れない（保護のまま）。在庫はここでは動かない。 */
const honbuSrc = H.cut(gasSrc, 'oosSoukoHonbuDone_');
has('⑨☑で✅反映済み＋日時に変わる', honbuSrc, "'✅ マスタＮに反映済み '");
has('⑨空の行の☑は戻す', honbuSrc, 'この行にはまだ報告が入っていません');
has('⑨☑の用意（✅済みのマスは触らない）', H.cut(gasSrc, 'oosSoukoHonbuCheckboxes'), "indexOf('✅') === 0");
has('⑨onEditから本部の処理列で呼ばれる', H.cut(gasSrc, 'oosSoukoOnEdit'), 'oosSoukoHonbuDone_(e, sh, row, isDef)');
has('⑨セットアップでも☑を用意する', H.cut(gasSrc, 'oosSetupSoukoFile'), 'oosSoukoHonbuCheckboxes()');

/* ── ⑩ 在庫表の🔄大ボタン（2026-09-04 ひろみさん指示）───────── */
const refBtnSrc = H.cut(gasSrc, 'oosSoukoRefreshButton');
has('⑩文言はひろみさんの言葉どおり（2026-09-04指定）', refBtnSrc, '🔄 最新の在庫数に合わせるボタンです\\n随時押してください');
has('⑩水色', refBtnSrc, '#b3e5fc');
has('⑩倉庫さんも押せる（☑のマスだけ保護から外す）', refBtnSrc, 'setUnprotectedRanges');
has('⑩☑で映し直して☑を外す', H.cut(gasSrc, 'oosSoukoOnEdit'), 'oosSoukoStockSync();');
has('⑩セットアップでもボタンを用意する', H.cut(gasSrc, 'oosSetupSoukoFile'), 'oosSoukoRefreshButton()');

/* ── ⑪ ❌キャンセルの印（提案A・2026-09-04 ひろみさん承認）───────── */
const cancelGas = H.cut(gasSrc, 'oosYukaCancelOrder');
has('⑪運用コピーと倉庫ファイルの両方に印', cancelGas, "getSheetByName('オーダー表')");
const cancelMark = H.cut(gasSrc, 'oosCancelMarkRows_');
has('⑪印の文言', cancelMark, '❌ キャンセルされました');
has('⑪二重よけ（すでに❌の行は触らない）', cancelMark, "indexOf('❌ キャンセル') >= 0) continue");
has('⑪❌の行は赤＋取り消し線', H.cut(gasSrc, 'oosCancelRuleAdd_'), 'setStrikethrough(true)');
has('⑪キャンセルはスマホに出さない', H.cut(gasSrc, 'oosKonpoOrders'), '❌ キャンセル');
has('⑪キャンセル行は③で流せない', H.cut(gasSrc, 'oosYukaRequestEdit_'), 'この注文はキャンセルされています');
const cancelIdx = H.cut(idxSrc, 'yukaCancelMark');
eq('⑪印付けは在庫を触らない', /applyStockDeduct|undoStockForOrder/.test(cancelIdx), false);
has('⑪キャンセル処理から呼ばれる', H.cut(idxSrc, 'cancelOrder'), 'yukaCancelMark(o)');
has('⑪差し戻しからも呼ばれる', H.cut(idxSrc, 'reopenOrderForEdit'), 'yukaCancelMark(o)');
has('⑪失敗したら正直に知らせる', cancelIdx, 'キャンセルの印が付いていません');

/* ── ⑫ 単位（2026-09-04・ゆかさん指摘②：ギフト用空箱の単位が「●本」）───────
   商品マスタの「単位」列。空欄＝本のまま／ギフト箱＝「箱」。名簿でいつでも直せる。 */
{
  const ctxU = vm.createContext({ String });
  vm.runInContext(H.cut(idxSrc, 'unitOfProduct'), ctxU);
  eq('⑫単位列が空なら「本」', ctxU.unitOfProduct({extras:{}}), '本');
  eq('⑫単位列に箱とあれば「箱」', ctxU.unitOfProduct({extras:{'単位':'箱'}}), '箱');
  eq('⑫商品が無くても落ちない', ctxU.unitOfProduct(null), '本');
}
has('⑫カードの明細は単位つき', idxSrc, "lineTotal(l)+lineUnit(l)).join('　')");
has('⑫倉庫へのLINEも単位つき', idxSrc, "lineTotal(l)+lineUnit(l); }).join('\\n　')");
has('⑫出荷依頼書は箱ものに単位を書く', idxSrc, "l.bottles+(_u!=='本'?_u:'')");
has('⑫ゆかスプシへの転記も単位つき', H.cut(idxSrc,'yukaImportOne'), "(_u!=='本'?_u:'')");
has('⑫残高一覧の単位も名簿を先に見る', H.cut(idxSrc,'rtbUnit'), 'unitOfProduct(p)');
has('⑫GAS：すでに入っている単位は触らない', H.cut(gasSrc,'oosProdUnitColumn'), 'すでに入っている値は触らない');
has('⑫GAS：「箱」は箱そのものだけ（名前で判定・セットは除外）', H.cut(gasSrc,'oosProdUnitColumn'), "/ギフト箱|ギフトボックス|空箱/.test(nm) && !/セット/.test(nm)");

/* ── ⑬ RT予約まわりの印の保存（2026-09-04・第4弾のバグ修正の見張り）─────────
   whSkipと同じ「載せ忘れの穴」：custId・rtm系・✂️帰属(rtCut)が保存されず、開き直すと残高一覧が空になった。 */
has('⑬custIdを保存する', saveMainSrc, 'custId: (o.custId==null');
has('⑬rtm系とrtCutを保存する', saveMainSrc, 'rtCut: o.rtCut||null');
has('⑬custIdを読み戻す', loadAllSrc, "custId: extra.custId||''");
has('⑬rtCutを読み戻す', loadAllSrc, 'rtCut: extra.rtCut||null');
has('⑬昔の注文はお客様名から取引先を特定（救済）', H.cut(idxSrc,'rtbCidOf'), 'x.name===o.client');

/* ── ⑭ バサラスター発注シート（本番・2026-09-04）───────── */
const baAccept = H.cut(gasSrc, 'oosBasaraOrderAccept_');
has('⑭お届け先3点必須', baAccept, '氏名・住所・電話の3つが入るまで発注できません');
has('⑭熨斗あり備考必須', baAccept, '熨斗「あり」のときは、備考欄に用途を書いてください');
has('⑭二重よけ', baAccept, 'すでに発注済みです（二重には流れません）');
has('⑭ゆかスプシへは既存の転記を呼ぶだけ', baAccept, 'oosYukaImportOrder(');
eq('⑭在庫は一切減らさない', /applyStockDeduct|basaraComputeStock_\(\)\.deduct|persistStockDeduct/.test(baAccept), false);
const baInv = H.cut(gasSrc, 'oosBasaraInvoiceBuild');
has('⑭請求書は毎月増える（上書き禁止）', baInv, 'すでにあります（上書き禁止）');
has('⑭税はいつもの決まり（食品8%・送料10%・切り捨て）', baInv, 'Math.floor(goodsSum*0.08)');
has('⑭振込先は卸ルール（三菱UFJ）', gasSrc, '三菱UFJ銀行 新座志木支店（支店番号296）');
has('⑭会社表記は見積Мと同じ（登録番号）', gasSrc, 'T9012801020687');
const baConf = H.cut(gasSrc, 'oosBasaraInvoiceConfirm_');
has('⑭本部確認でバサラスターへメール1通', baConf, '請求書のご用意ができました');
has('⑭メールの宛先は正規のバサラ担当', baConf, 'BASARA_FROM');

/* ── ⑮ スプシ発注の受注Ａ連携（2026-09-04 ひろみさん承認の3点セット）───────
   ①③の二重よけは「倉庫に本当にあるか」で見る（バサラ行が誤って弾かれない）
   ②在庫減算は③に一本化（バサラ分はoosYukaStockDeductByKey_で減る・足りないと③が止まる）
   ③送り状NO.はゆかスプシ・バサラ発注シート・受注Ａ台帳の3か所へ戻る　★消さないでください */
const req2 = H.cut(gasSrc, 'oosYukaRequestEdit_');
has('⑮③の二重よけは倉庫の実物で見る', req2, 'すでに倉庫へ流れています');
has('⑮③で在庫減算が呼ばれる', req2, 'oosYukaStockDeductByKey_(existKey)');
has('⑮足りないと③が止まる', req2, '在庫が足りないため、倉庫へ流せません');
has('⑮③で倉庫LINEにシンプル案内', req2, '出荷のご依頼が1件入りました');
has('⑮LINEに注文番号を書かない（暗号を外に出さない）', req2.indexOf("disp[10]")>=0 && req2.indexOf('+num+')<0 ? 'ok':'ng', 'ok');
const acc2 = H.cut(gasSrc, 'oosBasaraOrderAccept_');
has('⑮バサラ☑で受注Ａ台帳に自動記録', acc2, 'basaraAppendOrderRow_');
has('⑮バサラの送料は常に800円', acc2, "d[10]+' 様', goods, 800");
has('⑮受付時は在庫を減らさない（減るのは③）', acc2, '在庫はここでは減らさない');
/* ★2026-09-04午後 配りは共通部品 oosTrackFanout_ に集約（ゆか直記入と旧オーダー表の両方から呼ぶ） */
const tb2 = H.cut(gasSrc, 'oosTrackFanout_');
has('⑮送り状はバサラ発注シート（24列目）にも戻る', tb2, 'bsh.getRange(brow, 24).setValue(track)');
has('⑮送り状で受注Ａの注文が発送済みになる', tb2, "setValue('shipped')");
has('⑮旧オーダー表の道も同じ部品を呼ぶ', H.cut(gasSrc,'oosSoukoTrackBack_'), 'oosTrackFanout_(key, track)');

/* ── ⑯ 倉庫スプシ廃止・赤/青ボタンの流れ（2026-09-04午後 ひろみさん決定）──────
   「転記転記は事故になる。ゆかスプシを倉庫と共有する」★消さないでください */
has('⑯赤ボタンの文言（ひろみさん指定そのまま）', gasSrc, "OOS_YUKA_BTN_STOP = 'OOS未チェック 発送しないでください（登録済）'");
has('⑯青ボタンの文言', gasSrc, "OOS_YUKA_BTN_GO   = '発送してください'");
const goSrc = H.cut(gasSrc, 'oosYukaShipGo_');
has('⑯青にした瞬間 倉庫LINEへ1通', goSrc, '出荷のご依頼が1件入りました');
has('⑯在庫が足りなければ赤に戻して止める', goSrc, 'まだ発送できません');
has('⑯LINEの二重送り防止（📨の印）', goSrc, "indexOf('📨')");
has('⑯倉庫スプシへの転記コードが無い', goSrc.indexOf('オーダー表')<0 ? 'ok':'ng', 'ok');
const trkSrc = H.cut(gasSrc, 'oosYukaTrackEdit_');
has('⑯ゆかスプシに送り状を書いたら発送済＋自動配り', trkSrc, 'oosTrackFanout_(key, track)');
has('⑯送り状で発送済（行グレー）', trkSrc, 'getRange(row,20).setValue(true)');
const konSrc = H.cut(gasSrc, 'oosKonpoOrders');
has('⑯倉庫Ｄ・梱包ビューはゆかスプシを読む', konSrc, 'oosYukaFile_()');
has('⑯出すのは青「発送してください」の行だけ', konSrc, 'OOS_YUKA_BTN_GO) continue');
has('⑯送り状NO.が入った行は出さない', konSrc, "d[18]||'').trim()) continue");
const acc16 = H.cut(gasSrc, 'oosBasaraOrderAccept_');
has('⑯在庫は受付と同時に減る（ひろみさん決定）', acc16, 'ゆかスプシ転記と同時）に確保して減らす');
/* ★2026-09-04夕方 ひろみさん追加：「セルAで状態が全部わかる」＝3つ目の状態「発送済」（グレー） */
has('⑯3つ目の状態「発送済」', gasSrc, "OOS_YUKA_BTN_DONE = '発送済'");
has('⑯送り状NO.を書くとセルAが自動で「発送済」に', trkSrc, 'setValue(OOS_YUKA_BTN_DONE)');
const doneSrc = H.cut(gasSrc, 'oosYukaShipDone_');
has('⑯番号なしで「発送済」は選べない（青に戻す）', doneSrc, '先に「送り状NO.」');
has('⑯手で発送済にしても配りは同じ部品', doneSrc, 'oosTrackFanout_(key, track)');
has('⑯見出しは「状態を選択してください」', H.cut(gasSrc,'oosYukaShipBtnSetup'), '状態を選択してください');
has('⑮ふだ（yukaKey）は保存で消えない（whitelist）', H.cut(gasSrc,'saveOrdersMain'), 'yukaKey: o.yukaKey');

/* 数字テスト：oosYukaStockDeductByKey_ を本物のまま砂場で動かす */
{
  const P15=[{id:1,sku:'ORG250',name:'オルガニック250ml',boxQty:12},
             {id:9,sku:'SET-B',name:'ギフトB',isSet:true,components:[{sku:'ORG250',qty:2}]}];
  function makeSheet15(rows){
    return { rows:rows, writes:[],
      getLastRow(){ return this.rows.length+1; },
      getRange(r,c,nr,nc){ const s=this;
        return { getValues(){ const out=[]; for(let i=0;i<(nr||1);i++){ const rw=s.rows[r-2+i]||[]; out.push(rw.slice(c-1,c-1+(nc||1))); } return out; },
                 setValue(v){ s.writes.push([r,c,v]); if(s.rows[r-2]) s.rows[r-2][c-1]=v; } }; } };
  }
  function box15(orderExtra, zaikoRows, avail){
    const ord = makeSheet15([['o1','バサラスター','BA-1','卸バサラスター','','','','','','','','pending','','','','','','','',JSON.stringify(orderExtra)]]);
    const zaiko = makeSheet15(zaikoRows);
    const b={ console, JSON, Object, Array, String, Number, Math, Date,
      SHEET_ID_MAIN:'X',
      SpreadsheetApp:{ openById(){ return { getSheetByName(n){ return n==='受注データ'?ord : n==='在庫データ'?zaiko : null; } }; } },
      loadProducts(){ return {products:P15}; },
      basaraComputeStock_(){ return { available(sku){ return avail[sku]; } }; } };
    const ctx=vm.createContext(b);
    vm.runInContext(H.cut(gasSrc,'oosYukaStockDeductByKey_'),ctx);
    return {ctx, ord, zaiko, run(k){ return vm.runInContext('oosYukaStockDeductByKey_('+JSON.stringify(k)+')', ctx); }};
  }
  // A) 20本引く：newの棚15+10から順に（15→0、10→5）。oldは触らない
  let s=box15({yukaKey:'KT', stockDeducted:false, stockLog:[], lines:[{productId:1,bottles:20,boxes:0,boxQty:12}]},
    [['z1',1,'','','',15,'','new'],['z2',1,'','','',10,'','new'],['z3',1,'','','',99,'','old']], {ORG250:30});
  let r15=s.run('KT');
  eq('⑮20本の減算が通る', r15 && r15.status, 'ok');
  eq('⑮1つ目の棚 15→0', s.zaiko.rows[0][5], 0);
  eq('⑮2つ目の棚 10→5', s.zaiko.rows[1][5], 5);
  eq('⑮旧ロットは触らない', s.zaiko.rows[2][5], 99);
  {
    const ex=JSON.parse(s.ord.rows[0][19]);
    eq('⑮引いた印が付く', ex.stockDeducted, true);
    eq('⑮倉庫へ送った印が付く', ex.notified, true);
    eq('⑮記録が残る', ex.stockLog.length>0, true);
  }
  // B) 販売可能が足りない → 止まる・1本も引かない
  s=box15({yukaKey:'KT', stockDeducted:false, stockLog:[], lines:[{productId:1,bottles:20,boxes:0,boxQty:12}]},
    [['z1',1,'','','',15,'','new']], {ORG250:10});
  r15=s.run('KT');
  eq('⑮足りないと止まる', r15 && r15.status, 'short');
  eq('⑮そのとき1本も引かない', s.zaiko.writes.length, 0);
  // C) もう引いてある → 二重には引かない
  s=box15({yukaKey:'KT', stockDeducted:true, stockLog:[], lines:[{productId:1,bottles:20,boxes:0,boxQty:12}]},
    [['z1',1,'','','',15,'','new']], {ORG250:30});
  r15=s.run('KT');
  eq('⑮二重には引かない', r15 && r15.status, 'done');
  eq('⑮二重のとき棚は動かない', s.zaiko.writes.length, 0);
  // D) セットは中身にほどいて引く（3セット→中身6本）
  s=box15({yukaKey:'KT', stockDeducted:false, stockLog:[], lines:[{productId:9,bottles:3,boxes:0,boxQty:1}]},
    [['z1',1,'','','',15,'','new']], {ORG250:30});
  r15=s.run('KT');
  eq('⑮セットは中身で引く（15→9）', s.zaiko.rows[0][5], 9);
  // E) ふだが合わない → 何もしない（ふつうの📥の行）
  s=box15({yukaKey:'KX', stockDeducted:false, stockLog:[], lines:[{productId:1,bottles:5,boxes:0,boxQty:1}]},
    [['z1',1,'','','',15,'','new']], {ORG250:30});
  eq('⑮ひも付く注文が無ければ何もしない', s.run('KT'), null);
}

console.log('===== 倉庫ファイル（スプシ一本化・第1弾）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
