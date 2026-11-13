/* ══════════════════════════════════════════════════════════════════════
   🛑 在庫の数で発送を止めない（OOS_ZAIKO_DE_TOMENAI）── 2026-11-13 ひろみさん決定

   ゆかちゃん（11/13）：「オルガニック500mlが入荷待ち商品の扱いになっているためか、
   　『発送してください』を押しても、5秒ぐらい経つと自動的に『発送しないでください』に戻ります」
   ひろみさん：「アプリでカウントしてた在庫の数は全くもうめちゃめちゃに狂ってるので、勝手に止めちゃってる
   　状態が続いています。なので、在庫切れがあったら止めるとかそういうのも全部切ってもらって、
   　バサラからオーダーが来たらするりと発注できるようにしてください」

   切ったもの（3つ）：
   　① 発注書のA列を🔵にしたときの「在庫の安全網（足りなければ赤に戻す）」→ 印だけ残して進む
   　② バサラ▼の「（入荷待ち）」の印（→ 受付の ✈️入荷待ち の印も付かなくなる）
   　③ 30分おきの欠品メールの見張り → 自動スイッチ（欠品メール：⛔止まっている・2026-11-13 09:26）
   残したもの：在庫を引く処理そのもの（足りるときは今までどおり引く）

   ★このテストは「切ったものが戻っていないか」の見張りです。戻すのはひろみさんの指示があるときだけ。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const H = require('./harness');
const GAS = H.readGas();

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function cutFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  return '';
}

/* ── ① スイッチ ─────────────────────────────────────────── */
ok('①スイッチ OOS_ZAIKO_DE_TOMENAI が true', /var OOS_ZAIKO_DE_TOMENAI = true;/.test(GAS));
ok('①スイッチは1つだけ（別の場所で false にしていない）', (GAS.match(/OOS_ZAIKO_DE_TOMENAI\s*=/g) || []).length === 1);

/* ── ② 🔵にしたとき、足りなくても赤に戻さない ─────────── */
const go = cutFn(GAS, 'oosYukaShipGo_');
ok('②🔵の係 oosYukaShipGo_ がある', go.length > 0);
const iShort = go.indexOf("'short'"), iSw = go.indexOf('if(!OOS_ZAIKO_DE_TOMENAI){', iShort), iBack = go.indexOf("back('🔵 在庫が足りないため、まだ発送できません。", iSw), iRet = go.indexOf('return;', iBack);
ok('②足りないときの「赤に戻す」は、スイッチが切れているときだけ（short → スイッチ → 赤に戻す → return の順）',
   iShort > 0 && iSw > iShort && iBack > iSw && iRet > iBack && (iRet - iBack) < 400);
ok('②スイッチが入っているときは、印だけ残して発送に進む',
   go.indexOf("cell.setNote('⚠️ アプリの在庫の数では足りない計算ですが、発送は止めません（2026-11-13 ひろみさん決定）") >= 0);
ok('②在庫を引く処理（oosYukaStockDeductByKey_）は残っている', go.indexOf('oosYukaStockDeductByKey_(key)') >= 0);
/* 本物を砂場で動かす：在庫が足りない（short）でも、赤に戻らず、〆・LINEの段に進むか */
(function(){
  const log = [];
  const cellNotes = {};
  function cellOf(r, c){ return {
    setValue(v){ log.push('A' + r + '=' + String(v).slice(0, 12)); return this; },
    setNote(v){ cellNotes[r] = String(v); log.push('note'); return this; },
    getNote(){ return cellNotes[r] || ''; }, getValue(){ return 'K1'; },
    setFontColor(){ return this; }, setFontWeight(){ return this; }
  }; }
  const sh = { getRange(r, c, nr, nc){ const o = cellOf(r, c); o.getDisplayValues = function(){ const d = new Array(30).fill(''); d[2] = 'ORG500 オルガニック 500ml（入荷待ち）'; d[3] = '1'; d[10] = '筒井様'; return [d]; }; return o; } };
  const box = {
    OOS_ZAIKO_DE_TOMENAI: true, OOS_YC: { track:24, note:21, shipped:25, doc1:22, doc2:23 }, OOS_YUKA_BTN_STOP: '赤', OOS_YUKA_BTN_GO: '青',
    OOS_SOUKO_MATOME_ON: true, OOS_YUKA_MATOME_MIN: 3, OOS_YUKA_LINE_COL: 33, OOS_YUKA_LINE_MADA: 'まだ', OOS_SOUKO_RENRAKU_OFF: true,
    oosKeyColByHeader_(){ return 28; },
    oosYukaStockDeductByKey_(k){ log.push('deduct'); return { status:'short', msg:'　・オルガニック 500ml　必要 1本／販売可能 0本' }; },
    oosYukaKigenKakuKurikaeshi_(){ log.push('kigen'); },
    oosSoukoMatomeYoyaku_(){ log.push('matome'); },
    oosYukaLineMidashi_(){}, oosLineToWarehouse_(){ log.push('line'); }, oosKigenAtoYoyaku_(){},
    Utilities: { formatDate(){ return '11/13 09:30'; } }, Logger: { log(){} }, String: String, Number: Number, Date: Date, console: console
  };
  vm.createContext(box);
  vm.runInContext(go, box);
  box.oosYukaShipGo_(sh, 48);
  ok('②（砂場）足りない計算でも赤に戻さない（A列を赤にしていない）', log.indexOf('A48=赤') < 0, '（いま ' + log.join('>') + '）');
  ok('②（砂場）足りない計算でも〆（依頼／〆）を書き、倉庫へのまとめ送りの予約まで進む', log.indexOf('kigen') >= 0 && log.indexOf('matome') >= 0, '（いま ' + log.join('>') + '）');
  ok('②（砂場）A列のメモに「発送は止めません」と残る', /発送は止めません（2026-11-13 ひろみさん決定）/.test(cellNotes[48] || ''));
  /* スイッチを切ると、今までどおり赤に戻る（戻せることの確認＝コードは消していない） */
  const log2 = []; const box2 = Object.assign({}, box, { OOS_ZAIKO_DE_TOMENAI: false });
  const sh2 = { getRange(r, c){ const o = { setValue(v){ log2.push('A' + r + '=' + String(v)); return this; }, setNote(){ return this; }, getNote(){ return ''; }, getValue(){ return 'K1'; }, getDisplayValues(){ const d = new Array(30).fill(''); d[2] = 'x'; d[3] = '1'; d[10] = 'y'; return [d]; } }; return o; } };
  vm.createContext(box2); vm.runInContext(go, box2);
  box2.oosYukaShipGo_(sh2, 5);
  ok('②（砂場）スイッチを false に戻せば、今までどおり赤に戻る（コードは消していない）', log2.indexOf('A5=赤') >= 0, '（いま ' + log2.join('>') + '）');
})();

/* ── ③ バサラ▼に「（入荷待ち）」を付けない ────────────── */
const list = cutFn(GAS, 'oosBasaraItemList_');
ok('③▼の「（入荷待ち）」は、スイッチが切れているときだけ', list.indexOf("!OOS_ZAIKO_DE_TOMENAI)?'（入荷待ち）':''") >= 0);
(function(){
  const box = {
    OOS_ZAIKO_DE_TOMENAI: true,
    basaraComputeStock_(){ return { available(){ return 0; } }; },
    oosBasaraPrices_(){ return { ORG500: { ba: 6228 }, MISC001: { ba: 1105 }, ORG100: { ba: 0 } }; },
    loadProducts(){ return { products: [ { sku:'ORG500', name:'オルガニック 500ml' }, { sku:'MISC001', name:'初版ピッツァ本 サイン入り' }, { sku:'ORG100', name:'オルガニック 100ml' }, { sku:'YS100', name:'セット', isSet:true } ] }; },
    String: String, Number: Number
  };
  vm.createContext(box); vm.runInContext(list, box);
  const out = box.oosBasaraItemList_();
  ok('③（砂場）在庫0でも▼に「（入荷待ち）」が付かない', out.length === 2 && out.every(function(x){ return x.label.indexOf('入荷待ち') < 0; }), '（いま ' + out.map(function(x){ return x.label; }).join(' / ') + '）');
  ok('③（砂場）バサラ価格が無い商品・セットは今までどおり▼に出ない', out.map(function(x){ return x.sku; }).join(',') === 'ORG500,MISC001');
  const box2 = Object.assign({}, box, { OOS_ZAIKO_DE_TOMENAI: false }); vm.createContext(box2); vm.runInContext(list, box2);
  ok('③（砂場）スイッチを false に戻せば「（入荷待ち）」が付く', box2.oosBasaraItemList_().every(function(x){ return x.label.indexOf('（入荷待ち）') >= 0; }));
})();
ok('③受付の ✈️ の印は、▼の「（入荷待ち）」から決めている（＝▼に付かなければ付かない）',
   cutFn(GAS, 'oosBasaraOrderAccept_').indexOf("if(lb.indexOf('（入荷待ち）')>=0) wait=true;") >= 0);

/* ── ④ 欠品メールは自動スイッチで止める（コードでは止めない＝履歴に残る） ── */
ok('④自動スイッチに「欠品メール」のスイッチ（stock）がある', GAS.indexOf("'stock'){ st.stock = on; }") >= 0);
ok('④欠品メールの見張り（basaraWatchV2）は自動スイッチを通る', cutFn(GAS, 'basaraWatchV2').indexOf('oosAutoState_') >= 0);

/* ── 結果 ───────────────────────────────────────────────── */
const title = '🛑 在庫の数で発送を止めない（🔵の安全網・バサラ▼の入荷待ち・欠品メール／2026-11-13 ひろみさん決定）';
if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
