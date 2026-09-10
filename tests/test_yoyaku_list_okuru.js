/* ══════════════════════════════════════════════════════════════════════
   🗂 取り置き及び発注前予約リスト：A列で「送る」を選んだときの動き（2026-09-10）

   ★なぜニセGASで確かめるのか
     本物のスプレッドシートで押すと、倉庫のLINEに本当に出荷依頼が飛びます。
     倉庫さんを混乱させないため、本物の関数だけを取り出して砂場で動かします。

   ★確かめる4つ（ひろみさんと決めた形）
     ① 抜けあり・1回目 … 🗓 まだ出しません に戻り、足りないものをメモで知らせる
     　　　　　　　　　　（発注書へは行かない・倉庫LINEも飛ばない）
     ② 抜けあり・2回目 … 同じものをもう一度選べば、そのまま送る
     ③ 在庫不足　　　　 … 2回目でも送らない。発注書に作った行も消して元どおり
     ④ 二重送信　　　　 … 「✅ 送りました」の行をもう一度選んでも、何も起きない

   ★スプレッドシートの中では確認ダイアログを出せません（Googleの決まり）。
     だから【2回選ぶ】形にしています。ひろみさん了解ずみ（2026-09-10）。
     ★この形を勝手に変えないでください。

   本物の関数（oosYoyakuListGo_／oosYukaShipGo_／oosYukaStockDeductByKey_）を
   そのまま切り出して動かします。本番のファイルは一切書きません。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const H = require('./harness');
const GASPATH = 'C:/Users/cucin/OneDrive/ドキュメント/olive-stories-gas/コード.js';
const gasSrc = fs.readFileSync(GASPATH, 'utf8');

let pass = 0, fail = 0; const fails = [];
function eq(l, g, w){ if(String(g) === String(w)) pass++; else { fail++; fails.push(l + '  期待:' + w + '  実際:' + g); } }
function ok(l, g){ eq(l, !!g, true); }
function inc(l, text, needle, want){ eq(l, String(text || '').indexOf(needle) >= 0, want); }

/* ── ニセのシート（行の配列＋メモ＋書いた記録） ───────────────── */
function makeSheet(name, rows, width){
  return {
    name: name, rows: rows, notes: {}, writes: [], deleted: [], validationCleared: [],
    getName(){ return this.name; },
    getLastRow(){ return this.rows.length + 1; },   /* 1行目は見出しのつもり */
    getLastColumn(){ return width; },
    getRange(r, c, nr, nc){
      const s = this;
      return {
        getValues(){ const out = []; for(let i=0;i<(nr||1);i++){ const rw = s.rows[r-2+i] || []; out.push(rw.slice(c-1, c-1+(nc||1))); } return out; },
        getDisplayValues(){ const out = []; for(let i=0;i<(nr||1);i++){ const rw = s.rows[r-2+i] || []; const line = []; for(let j=0;j<(nc||1);j++){ const v = rw[c-1+j]; line.push(v==null?'':String(v)); } out.push(line); } return out; },
        getValue(){ const rw = s.rows[r-2] || []; return rw[c-1]; },
        getDisplayValue(){ const rw = s.rows[r-2] || []; const v = rw[c-1]; return v==null?'':String(v); },
        setValue(v){ s.writes.push([r, c, v]); if(!s.rows[r-2]) s.rows[r-2] = []; s.rows[r-2][c-1] = v; return this; },
        setValues(vv){ for(let i=0;i<vv.length;i++){ if(!s.rows[r-2+i]) s.rows[r-2+i] = []; for(let j=0;j<vv[i].length;j++) s.rows[r-2+i][c-1+j] = vv[i][j]; } return this; },
        setNote(t){ s.notes[r + ',' + c] = t; return this; },
        getNote(){ return s.notes[r + ',' + c] || ''; },
        setDataValidation(v){ if(v === null) s.validationCleared.push([r, c]); return this; },
        setBackground(){ return this; }, setFontColor(){ return this; }, setFontWeight(){ return this; },
        setWrap(){ return this; }, setHorizontalAlignment(){ return this; }, setVerticalAlignment(){ return this; },
        setNumberFormat(){ return this; }, merge(){ return this; }, breakApart(){ return this; }, clearContent(){ return this; }
      };
    },
    deleteRow(r){ this.deleted.push(r); this.rows.splice(r-2, 1); },
    setColumnWidth(){ }, setFrozenRows(){ }, setFrozenColumns(){ }, hideColumns(){ }
  };
}

/* ── 1行ぶんのリストのデータを作る（29列） ─────────────────── */
function ylRow(opt){
  opt = opt || {};
  const r = new Array(29).fill('');
  r[0]  = opt.state || '🗓 まだ出しません';
  r[1]  = opt.bunrui || 'ノヴェッロ2026予約';
  r[2]  = '🗓 予約（入荷まち）';
  r[3]  = '2026-11';
  r[4]  = '2026-09-10';
  r[5]  = (opt.exp === undefined) ? '2028-06' : opt.exp;     /* 賞味期限 */
  r[6]  = (opt.item === undefined) ? 'ORG250 オルガニック 250ml' : opt.item;
  r[7]  = (opt.qty  === undefined) ? '24' : opt.qty;
  r[14] = (opt.name === undefined) ? '宮西 杏奈' : opt.name;
  r[15] = (opt.zip  === undefined) ? '150-0001' : opt.zip;
  r[16] = (opt.addr === undefined) ? '東京都渋谷区1-1-1' : opt.addr;
  r[17] = (opt.tel  === undefined) ? '03-1111-2222' : opt.tel;
  r[20] = (opt.sName === undefined) ? '株式会社オリーブオイル・ストーリーズ' : opt.sName;
  r[24] = opt.note || '';
  r[25] = (opt.doc1 === undefined) ? '納品書' : opt.doc1;
  r[27] = 'その他';
  r[28] = opt.key || 'K-TEST-1';
  return r;
}

/* ── 砂場をひとつ作る ────────────────────────────────── */
function sandbox(opt){
  opt = opt || {};
  const yl   = makeSheet('🗂 取り置き及び発注前予約リスト（ホテル以外）', [ylRow(opt.row || {})], 29);
  const yuka = makeSheet('発注書', [], 32);
  const lineSent = [];       /* 倉庫LINEに飛んだ本文 */
  const statusSet = [];      /* 受注Ａの状態を変えた記録 */
  const imported = [];       /* 発注書へ写した中身 */

  const box = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp, Boolean, parseInt, parseFloat, isNaN,
    SHEET_ID_MAIN: 'X',
    Logger: { log(){} },
    Utilities: { formatDate(){ return '9/10 18:00'; } },
    SpreadsheetApp: {
      openById(){ return { getSheetByName(n){ return n === '発注書' ? yuka : null; } }; },
      newDataValidation(){ const o = { requireValueInList(){ return o; }, setAllowInvalid(){ return o; }, build(){ return {}; } }; return o; }
    },
    /* ── 身代わり（本物の中身は別の見張りで確かめています） ── */
    oosYukaFile_(){ return { getSheetByName(n){ return n === '発注書' ? yuka : null; } }; },
    oosKeyColByHeader_(){ return 29; },      /* 発注書の隠しふだ列 */
    oosLineToWarehouse_(txt){ lineSent.push(String(txt)); },
    oosSetOrderStatusByKey_(k, st){ statusSet.push([k, st]); return true; },
    oosYukaImportOrder(p){
      imported.push(p);
      if(opt.importNg) return { status:'error', message:'（わざと失敗させました）' };
      const r = new Array(32).fill('');
      r[0]  = 'OOS未チェック 発送しないでください（登録済）';
      r[2]  = (p.items && p.items[0]) ? p.items[0].name : '';
      r[3]  = (p.items && p.items[0]) ? p.items[0].qty  : '';
      r[10] = p.name || '';
      r[28] = p.key || '';
      yuka.rows.push(r);
      return { status:'ok', row: yuka.rows.length + 1, key: p.key || 'K-NEW' };
    },
    /* 在庫の引き算：足りるか足りないかだけ、こちらで決める */
    oosYukaStockDeductByKey_(){ return opt.stockShort ? { status:'short', msg:'　・オルガニック 250ml　必要 24本／販売可能 0本' } : { status:'ok' }; }
  };
  box.globalThis = box;
  const ctx = vm.createContext(box);

  /* ── 本物のコードを入れる ── */
  let code = '';
  ['OOS_YUKA_SHEET', 'OOS_YC', 'OOS_YUKA_BTN_STOP', 'OOS_YUKA_BTN_GO', 'OOS_YUKA_BTN_DONE',
   'OOS_YL_SHEET', 'OOS_YL_STAY', 'OOS_YL_GO', 'OOS_YL'].forEach(function(n){ code += H.cutVar(gasSrc, n) + '\n'; });
  ['oosLastDataRow_', 'oosYukaShipGo_', 'oosYoyakuListSummary_', 'oosYoyakuListGo_'].forEach(function(n){ code += H.cut(gasSrc, n) + '\n'; });
  /* 合計行の作り直しは、この見張りでは本題ではないので、シートを探しに行かせない */
  code += 'function oosYoyakuListSheet_(){ return null; }\n';
  vm.runInContext(code, ctx);

  return {
    box: box, ctx: ctx, yl: yl, yuka: yuka, lineSent: lineSent, statusSet: statusSet, imported: imported,
    go(){ vm.runInContext('oosYoyakuListGo_(__yl, 2)', Object.assign(ctx, {})); },
    push(){ box.__yl = yl; vm.runInContext('oosYoyakuListGo_(__yl, 2)', ctx); },
    stateA(){ return String(yl.rows[0][0] || ''); },
    noteA(){ return yl.notes['2,1'] || ''; }
  };
}

/* ══════════════════════════════════════════════════════════════════════
   ① 抜けあり・1回目 … 送らずに戻す
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = sandbox({ row: { zip:'', tel:'', exp:'' } });   /* 郵便番号・電話・賞味期限がない */
  s.push();
  eq('①A列は「🗓 まだ出しません」に戻る', s.stateA(), '🗓 まだ出しません');
  inc('①足りないと知らせる',            s.noteA(), '⚠️ 足りないところがあります', true);
  inc('①郵便番号が無いと言う',          s.noteA(), 'お届け先の郵便番号が入っていません', true);
  inc('①電話が無いと言う',              s.noteA(), 'お届け先の電話が入っていません', true);
  inc('①賞味期限が無いと言う',          s.noteA(), '賞味期限が入っていません', true);
  inc('①入っているものは言わない（住所）', s.noteA(), 'お届け先の住所が入っていません', false);
  inc('①もう一度選べば送れると書いてある', s.noteA(), '【もう一度】選ぶと、そのまま送ります', true);
  eq('①発注書へは1行も行かない',        s.yuka.rows.length, 0);
  eq('①倉庫LINEは飛ばない',             s.lineSent.length, 0);
  eq('①受注Ａの状態も変えない',         s.statusSet.length, 0);
}

/* ══════════════════════════════════════════════════════════════════════
   ② 抜けあり・2回目 … 同じものをもう一度選べば、そのまま送る
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = sandbox({ row: { zip:'', tel:'', exp:'' } });
  s.push();                                   /* 1回目：戻される */
  s.yl.rows[0][0] = '📦 発注書へ送って出荷を依頼する';   /* ひろみさんがもう一度選ぶ */
  s.push();                                   /* 2回目 */
  inc('②2回目は「✅ 送りました」になる', s.stateA(), '✅ 送りました', true);
  inc('②何行目に入ったかも書く',         s.stateA(), '（発注書 2行目）', true);
  eq('②発注書に1行入る',                 s.yuka.rows.length, 1);
  eq('②発注書のA列は青（発送してください）', s.yuka.rows[0][0], '発送してください');
  eq('②倉庫LINEはこのとき1回だけ飛ぶ',   s.lineSent.length, 1);
  inc('②LINEは出荷依頼の形',             s.lineSent[0], '📦 新しい出荷依頼です', true);
  inc('②LINEにお届け先のお名前が入る',   s.lineSent[0], '宮西 杏奈 様', true);
  eq('②受注Ａは「通常受注」に変わる',     JSON.stringify(s.statusSet), JSON.stringify([['K-TEST-1', 'pending']]));
  eq('②A列の選択肢は外す（もう選ばせない）', s.yl.validationCleared.length >= 1, true);
  eq('②メモは消す（古い警告を残さない）', s.noteA(), '');
}

/* ══════════════════════════════════════════════════════════════════════
   ②' ぜんぶ入っていれば、1回で送れる
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = sandbox({});
  s.push();
  inc("②'抜けが無ければ1回で送れる", s.stateA(), '✅ 送りました', true);
  eq("②'倉庫LINEは1回",             s.lineSent.length, 1);
  eq("②'発注書に1行",               s.yuka.rows.length, 1);
  eq("②'発注書へ渡した分類",         s.imported[0].bunrui, 'ノヴェッロ2026予約');
  eq("②'発注書へ渡したふだ",         s.imported[0].key, 'K-TEST-1');
  eq("②'商品は①だけ拾う",           s.imported[0].items.length, 1);
}

/* ══════════════════════════════════════════════════════════════════════
   ③ 在庫不足 … 2回目でも送らない。発注書に作った行も消す
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = sandbox({ stockShort: true });
  s.push();
  eq('③A列は「🗓 まだ出しません」に戻る', s.stateA(), '🗓 まだ出しません');
  inc('③在庫が足りないと言う',           s.noteA(), '在庫が足りないため、まだ送れません', true);
  inc('③何が何本足りないかも書く',       s.noteA(), '販売可能 0本', true);
  inc('③入荷したらまた押せると書く',     s.noteA(), '在庫が入ってから、もう一度お試しください', true);
  eq('③倉庫LINEは飛ばない',              s.lineSent.length, 0);
  eq('③発注書に作った行は消す',          s.yuka.rows.length, 0);
  eq('③消したのは作った行',              JSON.stringify(s.yuka.deleted), JSON.stringify([2]));
  eq('③受注Ａの状態は変えない',          s.statusSet.length, 0);
  /* もう一度押しても、やはり送らない */
  s.yl.rows[0][0] = '📦 発注書へ送って出荷を依頼する';
  s.push();
  eq('③もう一度押しても送らない',        s.stateA(), '🗓 まだ出しません');
  eq('③もう一度押しても倉庫LINEは飛ばない', s.lineSent.length, 0);
}

/* ══════════════════════════════════════════════════════════════════════
   ④ 二重送信 … 「✅ 送りました」の行をもう一度選んでも、何も起きない
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = sandbox({});
  s.push();                                   /* 1回目：ちゃんと送る */
  const line1 = s.lineSent.length, rows1 = s.yuka.rows.length;
  s.yl.rows[0][0] = '📦 発注書へ送って出荷を依頼する';   /* 無理やりもう一度選ぶ */
  s.yl.rows[0][0] = '✅ 送りました 9/10 18:00（発注書 2行目）';
  s.push();
  eq('④倉庫LINEは増えない',        s.lineSent.length, line1);
  eq('④発注書の行も増えない',      s.yuka.rows.length, rows1);
  eq('④受注Ａの状態も1回だけ',      s.statusSet.length, 1);
  inc('④もう送ってあると知らせる',  s.noteA(), 'この行はもう送ってあります', true);
  inc('④「送りました」の表示は消えない', s.stateA(), '✅ 送りました', true);
}

/* ══════════════════════════════════════════════════════════════════════
   ⑤ 発注書へ写せなかったとき … 戻して、理由をメモに出す
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = sandbox({ importNg: true });
  s.push();
  eq('⑤A列は「🗓 まだ出しません」に戻る', s.stateA(), '🗓 まだ出しません');
  inc('⑤送れなかったと書く',             s.noteA(), '発注書へ送れませんでした', true);
  inc('⑤理由も書く',                     s.noteA(), 'わざと失敗させました', true);
  eq('⑤倉庫LINEは飛ばない',              s.lineSent.length, 0);
  eq('⑤受注Ａの状態も変えない',          s.statusSet.length, 0);
}

/* ══════════════════════════════════════════════════════════════════════
   ⑥ 決めごとが消えていないか（読むだけの見張り）
   ══════════════════════════════════════════════════════════════════════ */
{
  const go = H.cut(gasSrc, 'oosYoyakuListGo_');
  inc('⑥「2回選ぶ」形が残っている',      go, "indexOf('⚠️ 足りないところがあります') >= 0", true);
  inc('⑥在庫不足なら発注書の行を消す',    go, 'ysh.deleteRow(imp.row)', true);
  inc('⑥受注Ａを通常受注に戻す',          go, "oosSetOrderStatusByKey_(String(d[OOS_YL.key-1]||''), 'pending')", true);
  inc('⑥倉庫へはA列🔵を通ってから',       go, 'oosYukaShipGo_(ysh, imp.row)', true);
  inc('⑥リストから直接LINEを送っていない', go, 'oosLineToWarehouse_', false);
  const ship = H.cut(gasSrc, 'oosYukaShipGo_');
  inc('⑥在庫が足りなければA列を赤へ戻す', ship, "back('🔵 在庫が足りないため、まだ発送できません。", true);
  inc('⑥LINEの二重送り防止（📨の印）',     ship, "indexOf('📨')", true);
}

console.log('===== 🗂 発注前予約リスト：A列で「送る」を選んだときの動き =====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(function(f){ console.log('  ' + f); }); }
process.exit(fail ? 1 : 0);
