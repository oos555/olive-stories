/* ══════════════════════════════════════════════════════════════════════
   バサラの「送り状No.のページ」が、承認済みモックのとおりに動くかを確かめる
   承認済みモック：mocks/mock_basara_okurijou_2026-08-18.html（2026-08-18 ひろみさん承認）

   決めたこと（★このテストが番人です）
    ① 出す列は6つだけ：バサラ発注No./ご注文日/ご購入者/発送日/送り状No./状態
    ② 出すのは【ご購入者】だけ。お届け先・ご住所は出さない
    ③ パスワードは付けない（倉庫Ｄと同じ）
    ④ バサラの注文だけ。よその注文・お客様は1件も出ない
       （＝この画面から loadAll を呼ばない。GAS側で絞ってから受け取る）
    ⑤ 送り状No.を押すと佐川急便の追跡ページが開く
    ⑥ 玄関のアラートは【梱包完了の翌日】から出す（当日は出さない）
    ⑦ 送り状No.の入力欄は【バサラの注文だけ】に出す（倉庫Ｄ）

   本番のファイルから本物の関数をそのまま切り出して動かします。
   本番のデータには一切書き込みません。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const os = require('os');
const H = require('./harness');

const basara = H.read('basara.html');
const home   = H.read('home.html');
const pickup = H.read('pickup.html');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(String(got) === String(want)) pass++;
  else { fail++; fails.push(`${label}  期待:${want}  実際:${got}`); }
}

/* ══ ① 列の名前と並びが、モックと1字1句同じか ═══════════════════ */
const MOCK = path.join(H.LIVE, 'mocks', 'mock_basara_okurijou_2026-08-18.html');
const mockSrc = fs.existsSync(MOCK) ? fs.readFileSync(MOCK, 'utf8') : '';
const HEAD = '<thead><tr><th>バサラ発注No.</th><th>ご注文日</th><th>ご購入者</th><th>発送日</th><th>送り状No.</th><th>状態</th></tr></thead>';
eq('① 列の名前と並びが実装にある', basara.indexOf(HEAD) >= 0, true);
if(mockSrc){
  eq('① 同じ列の並びが承認済みモックにもある', mockSrc.indexOf(HEAD) >= 0, true);
} else {
  eq('① 承認済みモックが mocks/ にある', false, true);
}
eq('① 見出しがモックと同じ', basara.indexOf('📦 発送のご案内　バサラスター 御中') >= 0, true);
eq('① 但し書きがモックと同じ', basara.indexOf('送り状No.をクリックすると、佐川急便の追跡ページが開きます。') >= 0, true);
eq('① 「発送ずみ」の札がある', basara.indexOf('発送ずみ') >= 0, true);
eq('① 「準備中」の札がある', basara.indexOf('準備中') >= 0, true);
eq('① 「（まだ）」がある', basara.indexOf('（まだ）') >= 0, true);

/* ══ ② お届け先・ご住所を出していないか ═══════════════════════ */
eq('② 「ご住所」の列が無い', basara.indexOf('<th>ご住所</th>') < 0, true);
eq('② 「お届け先」の列が無い', basara.indexOf('<th>お届け先</th>') < 0, true);
eq('② 住所を読んでいない（addr を使わない）', /\baddr\b/.test(basara), false);
eq('② 電話を読んでいない（tel を使わない）', /\bo\.tel\b/.test(basara), false);

/* ══ ③ パスワードを付けていないか ═════════════════════════════ */
eq('③ パスワードを聞かない', /verifyPassword|password/.test(basara), false);

/* ══ ④ よその注文が混ざらない作りか ═══════════════════════════ */
eq('④ ぜんぶ読む窓口（loadAll）を呼んでいない', /action=loadAll/.test(basara), false);
eq('④ バサラ専用の窓口を呼んでいる', basara.indexOf('action=basaraOrders') >= 0, true);

/* ══ ⑤ 画面を作る本物の関数を動かす ═══════════════════════════ */
const { box, ctx } = H.makeSandbox({});
['esc', 'sagawaUrl', 'rowHtml'].forEach(n => vm.runInContext(H.cut(basara, n), ctx));

const rowShipped = box.rowHtml({ basaraNo:'20', orderDate:'2026-08-14', purchaser:'野々山 千尋',
                                 shipDate:'2026-08-16', trackingNo:'4712-3390-8845', shipped:true });
const rowYet     = box.rowHtml({ basaraNo:'23', orderDate:'2026-08-17', purchaser:'大野 亮',
                                 shipDate:'', trackingNo:'', shipped:false });

eq('⑤ 発注No.に # が付く', rowShipped.indexOf('#20') >= 0, true);
eq('⑤ ご購入者に「様」が付く', rowShipped.indexOf('野々山 千尋 様') >= 0, true);
eq('⑤ 発送ずみの札が出る', rowShipped.indexOf('発送ずみ') >= 0, true);
eq('⑤ 送り状No.が佐川急便へのリンクになる',
   rowShipped.indexOf('k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=471233908845') >= 0, true);
eq('⑤ リンクは別の窓で開く', rowShipped.indexOf('target="_blank"') >= 0, true);
eq('⑤ まだのときは「（まだ）」', rowYet.indexOf('（まだ）') >= 0, true);
eq('⑤ まだのときは「準備中」の札', rowYet.indexOf('準備中') >= 0, true);
eq('⑤ 発送日が無いときは —', rowYet.indexOf('<td>—</td>') >= 0, true);
eq('⑤ まだの行に色が付く', rowYet.indexOf('row-yet') >= 0, true);
const rowKigou = box.rowHtml({ purchaser:'<b>あ</b>', shipped:false });
eq('⑤ 名前の記号がそのまま出ない（<>を逃がす）', rowKigou.indexOf('<b>あ</b>') >= 0, false);
eq('⑤ 逃がした形で出る', rowKigou.indexOf('&lt;b&gt;あ&lt;/b&gt; 様') >= 0, true);

/* ══ ⑥ 玄関のアラート：梱包完了の【翌日】から ══════════════════ */
const hbox = H.makeSandbox({});
['oosTrackingIsBasara', 'oosTrackingDay', 'oosTrackingMissing'].forEach(n => vm.runInContext(H.cut(home, n), hbox.ctx));
const TODAY = new Date(2026, 7, 20);            // 2026-08-20
const M = hbox.box.oosTrackingMissing;

eq('⑥ 昨日 梱包完了・番号なし → 出す',
   M({ source:'basara', status:'shipped', shippedAt:'2026/8/19 18:00:00', trackingNo:'' }, TODAY), true);
eq('⑥ 今日 梱包完了・番号なし → 出さない（倉庫さんを急かさない）',
   M({ source:'basara', status:'shipped', shippedAt:'2026/8/20 9:00:00', trackingNo:'' }, TODAY), false);
eq('⑥ 番号が入っている → 出さない',
   M({ source:'basara', status:'shipped', shippedAt:'2026/8/19 18:00:00', trackingNo:'4712-3390-8845' }, TODAY), false);
eq('⑥ まだ梱包完了していない → 出さない',
   M({ source:'basara', status:'pending', shippedAt:'', trackingNo:'' }, TODAY), false);
eq('⑥ バサラ以外の注文は数えない',
   M({ source:'manual', status:'shipped', shippedAt:'2026/8/19 18:00:00', trackingNo:'' }, TODAY), false);
eq('⑥ お客様名が「バサラ」でも拾う',
   M({ client:'バサラ', status:'shipped', shippedAt:'2026/8/19 18:00:00', trackingNo:'' }, TODAY), true);
eq('⑥ キャンセルは数えない',
   M({ source:'basara', status:'cancelled', shippedAt:'2026/8/19 18:00:00', trackingNo:'' }, TODAY), false);
eq('⑥ 発注から消した注文は数えない',
   M({ source:'basara', status:'deleted', shippedAt:'2026/8/19 18:00:00', trackingNo:'' }, TODAY), false);
eq('⑥ ISO形式の日時でも読める',
   M({ source:'basara', status:'shipped', shippedAt:'2026-08-19T09:00:00.000Z', trackingNo:'' }, TODAY), true);
eq('⑥ 空白だけの番号は「入っていない」とみなす',
   M({ source:'basara', status:'shipped', shippedAt:'2026/8/19 18:00:00', trackingNo:'   ' }, TODAY), true);

/* 見張り一覧に名乗っているか（ここに無いものは「見張っている」と言えない） */
const mihari = H.cutVar(home, 'OOS_MIHARI');
eq('⑥ 見張り一覧に載っている', mihari.indexOf("key:'trackNone'") >= 0, true);
eq('⑥ 見張り一覧の文言がモックと同じ', mihari.indexOf('発送したのに送り状No.が入っていない') >= 0, true);
eq('⑥ お庭に混ぜている', home.indexOf('.concat(window.__oosTrackingNow||[])') >= 0, true);
eq('⑥ 数を数えている', home.indexOf('window.__oosMihariCount.trackNone = trackNone;') >= 0, true);
eq('⑥ 見本（?demo=1）にも載せた', home.indexOf("{href:'basara.html',  label:'📮 発送したのに送り状No.が入っていない'") >= 0, true);
eq('⑥ 自己点検が この見張りも試している', home.indexOf('送り状No.の見張り（発送したのに入っていない）が消えています') >= 0, true);

/* わざと壊して、自己点検が気づくか */
const sbox = H.makeSandbox({ document:{ getElementById(){ return null; }, createElement(){ return { style:{}, appendChild(){} }; }, body:{ appendChild(){}, style:{} } } });
H.runZaiko(sbox.ctx);
vm.runInContext(H.cutVar(home, 'OOS_MIHARI'), sbox.ctx);
['oosTrackingIsBasara', 'oosTrackingDay', 'oosGenkanSelfCheck'].forEach(n => vm.runInContext(H.cut(home, n), sbox.ctx));
vm.runInContext('function renderMihari(){} function renderAlerts(){} function oosGenkanAlarm(){}', sbox.ctx);
vm.runInContext('function oosTrackingMissing(){ return false; }', sbox.ctx);   // ★わざと壊す
const found = sbox.box.oosGenkanSelfCheck();
eq('⑥ わざと壊すと自己点検が気づく',
   found.some(x => x.indexOf('送り状No.') >= 0), true);

/* ══ ⑦ 倉庫Ｄ：送り状No.の欄はバサラの注文だけ ═════════════════ */
eq('⑦ 入力欄がある', pickup.indexOf('id="tracking-input"') >= 0, true);
eq('⑦ 入力欄はバサラの注文のときだけ出す',
   /if\(isBasaraOrder\(o\)\)\{\s*\n\s*html \+= '<div class="sec-title" style="margin-top:16px">🚚 送り状No./.test(pickup), true);
eq('⑦ 保存の仕組みが残っている（ほかの注文を消さないマージ保存）',
   pickup.indexOf('async function mergeSaveTracking(val)') >= 0, true);
eq('⑦ 梱包完了のときにも一緒に保存する', pickup.indexOf('await mergeSaveTracking(String(_tEl.value||\'\').trim())') >= 0, true);

/* ══ ⑧ GAS：バサラの分だけを返す窓口（手元にあるときだけ） ══════ */
function readGasSource(){
  const cands = [
    path.join(__dirname, 'gas', 'コード.js'),
    path.join(os.homedir(), 'OneDrive', 'ドキュメント', 'olive-stories-gas', 'コード.js')
  ];
  for(const c of cands){ if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); }
  return null;
}
const gasSrc = readGasSource();
if(!gasSrc){
  console.log('（GASのファイルが手元にないので、⑧だけ飛ばしました）');
} else {
  const HEADERS = ['ID','お客様名','注文番号','区分','郵便番号','住所','電話','発送区分','配送希望日','時間指定',
                   '特別指示','ステータス','受注日時','出荷日時','キャンセル日時','リサイクル箱','商品内容','合計本数',
                   '商品明細JSON','拡張データJSON'];
  function row(o){
    const r = new Array(20).fill('');
    r[0]=o.id; r[1]=o.client||''; r[2]=o.num||''; r[3]=o.ctype||''; r[5]=o.addr||''; r[6]=o.tel||'';
    r[10]=o.note||''; r[11]=o.status||''; r[12]=o.registeredAt||''; r[13]=o.shippedAt||'';
    r[19]=JSON.stringify(o.extra||{});
    return r;
  }
  const ROWS = [
    row({ id:'basara-1', client:'バサラ', ctype:'卸バサラスター', status:'shipped',
          note:'バサラ（楽天）自動取込 ／ 発注番号 20 ／ 発注日 2026/8/14 ／ #B20/2026/8/14',
          registeredAt:'2026-08-14T01:00:00.000Z', shippedAt:'2026/8/16 17:00:00',
          addr:'静岡県浜松市…', tel:'053-000-0000',
          extra:{ source:'basara', recipientName:'野々山 千尋', trackingNo:'4712-3390-8845' } }),
    row({ id:'basara-2', client:'バサラ', ctype:'卸バサラスター', status:'pending',
          note:'バサラ（楽天）自動取込 ／ 発注番号 23 ／ 発注日 2026/8/17 ／ #B23/2026/8/17',
          registeredAt:'2026-08-17T01:00:00.000Z',
          extra:{ source:'basara', recipientName:'大野 亮', trackingNo:'' } }),
    row({ id:'basara-3', client:'バサラ', ctype:'卸バサラスター', status:'cancelled',
          note:'#B99/2026/8/10', extra:{ source:'basara', recipientName:'取消 太郎' } }),
    row({ id:'ippan-1', client:'一般のお客様', ctype:'定価', status:'shipped',
          note:'', registeredAt:'2026-08-15T01:00:00.000Z', shippedAt:'2026/8/16 17:00:00',
          addr:'東京都世田谷区…', tel:'03-0000-0000',
          extra:{ source:'manual', recipientName:'川口 恵', trackingNo:'' } })
  ];
  const fakeSheet = {
    getLastRow(){ return ROWS.length + 1; },
    getRange(r, c, nr, nc){ return { getValues(){ return ROWS.slice(r-2, r-2+nr); } }; }
  };
  const g = H.makeSandbox({
    SHEET_ID_MAIN: 'x',
    SpreadsheetApp: { openById(){ return { getSheetByName(n){ return n === '受注データ' ? fakeSheet : null; } }; } },
    Utilities: { formatDate(d, tz, f){
      const p = n => ('0'+n).slice(-2);
      if(f === 'yyyy-MM-dd') return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
      return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 '+p(d.getHours())+':'+p(d.getMinutes());
    } }
  });
  ['basaraOrders', 'basaraNoFromNote_', 'basaraOrderDateFromNote_', 'basaraYmd_']
    .forEach(n => vm.runInContext(H.cut(gasSrc, n), g.ctx));
  const res = g.box.basaraOrders();

  eq('⑧ 窓口が答える', res.status, 'ok');
  eq('⑧ バサラの注文だけ返す（一般のお客様は返さない）', res.orders.length, 2);
  eq('⑧ キャンセルは返さない', res.orders.filter(o => o.purchaser === '取消 太郎').length, 0);
  eq('⑧ よそのお客様の名前が混ざっていない', JSON.stringify(res.orders).indexOf('川口 恵') < 0, true);
  eq('⑧ 住所を返していない', JSON.stringify(res.orders).indexOf('浜松市') < 0, true);
  eq('⑧ 電話を返していない', JSON.stringify(res.orders).indexOf('053-000-0000') < 0, true);
  eq('⑧ 返す中身は6つだけ', Object.keys(res.orders[0]).sort().join(','),
     'basaraNo,orderDate,purchaser,shipDate,shipped,trackingNo');
  eq('⑧ 発注No.をメモから取り出せる', res.orders[0].basaraNo, '20');
  eq('⑧ ご注文日はバサラの発注日', res.orders[0].orderDate, '2026-08-14');
  eq('⑧ ご購入者', res.orders[0].purchaser, '野々山 千尋');
  eq('⑧ 発送日', res.orders[0].shipDate, '2026-08-16');
  eq('⑧ 送り状No.', res.orders[0].trackingNo, '4712-3390-8845');
  eq('⑧ 発送ずみ', res.orders[0].shipped, true);
  eq('⑧ まだの注文は発送日が空', res.orders[1].shipDate, '');
  eq('⑧ まだの注文は準備中', res.orders[1].shipped, false);
  eq('⑧ 並びはご注文日の古い順（モックと同じ）',
     res.orders.map(o => o.basaraNo).join(','), '20,23');
  eq('⑧ 「いま何時現在」を返す', /\d+年\d+月\d+日/.test(String(res.at)), true);
  eq('⑧ 呼び口（action=basaraOrders）がGASにある', gasSrc.indexOf("action === 'basaraOrders'") >= 0, true);
  eq('⑧ 読むだけ（この窓口はスプレッドシートに書かない）',
     /function basaraOrders\(\)[\s\S]*?\n\}/.exec(gasSrc)[0].indexOf('setValue') < 0, true);
}

console.log('===== バサラの送り状No.のページ =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
