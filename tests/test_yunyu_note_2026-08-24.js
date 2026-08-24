/* 輸入Ｅ 輸入ノートの見張り（2026-08-24 新設）

   承認済みモック：mocks/mock_輸入E_輸入ノート_2026-08-24.html

   ★決めごと（2026-08-24 ひろみさん承認・変更禁止）
     ① 空輸・税金・国内経費の見出しの横に、仮の合計金額を【日本円】で出す
        （空輸は€なので 為替レートをかけて円にする）
     ② 仮保存：入力のたびにこの端末へ自動で控える。GASへ送るのは「💾 保存する」だけ
     ③ 「本当の原価」の計算式を、表のすぐ下にオレンジの枠で書く。原価の列もオレンジ
     ④ 商品計（€）は四捨五入しない。請求書の合計と同じ数字を出す
     ⑤ パッキングリストの総重量に合わせる。全部の商品の1本の重さに【同じ倍率】をかける
        （1つの商品にまとめて載せない。重い商品ほど増える量も多い＝容量・重さに応じた配分）
        packKg が空なら倍率1＝これまでのノートの原価は1円も動かない

   数字は本物の請求書 00193・パッキングリスト（総重量 464.00 kg）を使います。
   計算は本物の import.html の ynCalc をそのまま切り出して動かします（書き写しません）。 */
const fs = require('fs');
const vm = require('vm');
const R = require('path').join(__dirname, '..') + '/';
const H = require('./harness');
const src = fs.readFileSync(R + 'import.html', 'utf8');
const mockSrc = fs.readFileSync(R + 'mocks/mock_輸入E_輸入ノート_2026-08-24.html', 'utf8');

let ok = 0, ng = 0; const bad = [];
function t(name, got, want){ if(String(got) === String(want)) ok++; else { ng++; bad.push(name + '　期待:' + want + '　実際:' + got); } }
function near(name, got, want, tol){ if(Math.abs(got - want) <= tol) ok++; else { ng++; bad.push(name + '　期待:' + want + '（±' + tol + '）　実際:' + got); } }

/* ── 本物の ynCalc と重さルールを動かす ── */
const box = H.makeSandbox({}).box;
const ctx = vm.createContext(box);
['YN_W_PREFIX','YN_W_ML','YN_W_SKU'].forEach(v => vm.runInContext(H.cutVar(src, v), ctx));
['ynMlOfSku','ynWeightFor','ynCalc'].forEach(f => vm.runInContext(H.cut(src, f), ctx));
const W = box.ynWeightFor, calc = box.ynCalc;
t('◎ 本物の ynCalc が読める', typeof calc === 'function', true);

/* ── 請求書 00193 のとおりのノートを組む ── */
const RAW = [
  ['ORG250', 380, 6.65], ['ORG500', 60, 12.50], ['ORG750', 12, 15.50],
  ['MEM250', 60, 6.40],  ['MEM500', 12, 11.95], ['MEM750', 24, 14.85],
  ['CHF250', 20, 6.75],  ['ETC-001', 24, 5.50], ['MISC002', 72, 3.00],
];
function makeNote(packKg){
  return {
    id:'test-note', yearMonth:'2026-08', exchangeRate:176, packKg:(packKg==null?'':packKg),
    exp:{ airEur:2000, airDiscEur:'', taxImport:221600, taxCustoms:'', taxOther:'',
          sagawaAirport:60000, sagawaTransport:80000, warehouse:60000, otherJp:'' },
    adjEur:'',
    lines: RAW.map(function(r){
      const w = W(r[0]);
      return { sku:r[0], qty:r[1], eur:r[2], ml:(w?w.ml:0), g:(w?w.total:0) };
    })
  };
}
const INVOICE_TOTAL = 4829.80;   // 請求書 00193 の total
const PACK_KG = 464.00;          // パッキングリストの総重量（ひろみさん確定）
const RULE_KG = 374.952;         // 重さルールの合計

console.log('\n■ ④ 商品計は四捨五入しない（請求書の合計と同じ）');
{
  const c = calc(makeNote(''));
  t('④ 商品計が請求書の合計とぴったり同じ', c.eurQty.toFixed(2), INVOICE_TOTAL.toFixed(2));
  t('④ 四捨五入すると請求書と違ってしまう（それを直した）', Math.round(c.eurQty) !== INVOICE_TOTAL, true);
  /* ynEur が小数2桁で出すか（本物の関数） */
  vm.runInContext(H.cut(src, 'ynEur'), ctx);
  t('④ ynEur が €4,829.80 と出す', box.ynEur(c.eurQty), '€4,829.80');
  t('④ 画面が ynEur を使っている（Math.round に戻っていない）',
    src.indexOf("id=\\\"yn-s-eur\\\"") >= 0 || src.indexOf('yn-s-eur') >= 0, true);
  t('④ 商品計に Math.round が残っていない', /yn-s-eur[^]{0,80}Math\.round\(c\.eurQty\)/.test(src), false);
}

console.log('\n■ ⑤ パッキングリストの総重量に合わせる');
{
  const c0 = calc(makeNote(''));           // 補正なし
  const c1 = calc(makeNote(PACK_KG));      // 464.00 kg に合わせる
  near('⑤ 補正なしのときの総重量（ルールどおり）', c0.totalG/1000, RULE_KG, 0.01);
  t('⑤ 補正なしのときの倍率は 1', c0.wK, 1);
  near('⑤ 464.00 kg にぴったり合う', c1.totalG/1000, PACK_KG, 0.001);
  near('⑤ 倍率は ×1.2375', c1.wK, 1.2375, 0.0001);

  /* 1つの商品に全部載せていないこと＝全部の行が増えている */
  let allUp = true, sameRatio = true;
  c1.lines.forEach(function(l, i){
    const before = c0.lines[i].g, after = l.g;
    if(!(after > before)) allUp = false;
    if(Math.abs(after/before - c1.wK) > 0.0001) sameRatio = false;
  });
  t('⑤ 1つの商品だけに載せていない（全部の行が増える）', allUp, true);
  t('⑤ どの行も同じ倍率（重い商品ほど増える量が多い）', sameRatio, true);

  /* 重さで配る空輸費が、重い商品ほど多いこと */
  const org250 = c1.lines[0], org500 = c1.lines[1];
  t('⑤ 500ml の方が 250ml より重い', org500.g > org250.g, true);

  /* ★いちばん大事：補正しても1本の原価は変わらない（総額も比も変わらないため） */
  let costSame = true;
  c1.lines.forEach(function(l, i){ if(l.cost !== c0.lines[i].cost) costSame = false; });
  t('⑤ 重さを補正しても1本の原価は変わらない', costSame, true);

  /* 空欄に戻せば元どおり＝これまでのノートの原価は動かない */
  const c2 = calc(makeNote(''));
  let backSame = true;
  c2.lines.forEach(function(l, i){ if(l.cost !== c0.lines[i].cost) backSame = false; });
  t('⑤ 空欄に戻せば元どおり（過去のノートは無傷）', backSame, true);

  console.log('  ルールの合計 ' + (c0.totalG/1000).toFixed(3) + ' kg → 補正後 ' + (c1.totalG/1000).toFixed(2) + ' kg（×' + c1.wK.toFixed(4) + '）');
  console.log('  ORG250 1本 ' + c0.lines[0].g.toFixed(0) + ' g → ' + c1.lines[0].g.toFixed(1) + ' g');
  console.log('  ORG500 1本 ' + c0.lines[1].g.toFixed(0) + ' g → ' + c1.lines[1].g.toFixed(1) + ' g');
}

console.log('\n■ ① 見出しの横の合計金額（日本円）');
{
  const c = calc(makeNote(PACK_KG));
  t('① 空輸の合計＝€2,000×176円', c.airJpy, 352000);
  t('① 税金の合計', c.taxTotal, 221600);
  t('① 国内経費の合計', c.domestic, 200000);
  t('① 空輸のバッジが画面にある', src.indexOf('id="yn-sum-air"') >= 0, true);
  t('① 税金のバッジが画面にある', src.indexOf('id="yn-sum-tax"') >= 0, true);
  t('① 国内経費のバッジが画面にある', src.indexOf('id="yn-sum-jp"') >= 0, true);
  t('① 補正倍率のバッジが画面にある', src.indexOf('id="yn-sum-k"') >= 0, true);
  t('① 打つたびに合計が変わる（空輸）', src.indexOf("yn-sum-air'); if(sa)") >= 0, true);
  t('① 打つたびに合計が変わる（税金）', src.indexOf("yn-sum-tax'); if(st)") >= 0, true);
  t('① 打つたびに合計が変わる（国内経費）', src.indexOf("yn-sum-jp');  if(sj)") >= 0, true);
}

console.log('\n■ ② 仮保存（この端末に自動で控える）');
t('② 控えを書く仕組みがある', /function ynDraftSave/.test(src), true);
t('② 控えを読む仕組みがある', /function ynDraftLoad/.test(src), true);
t('② 控えを消す仕組みがある', /function ynDraftClear/.test(src), true);
t('② 打つたびに控える', src.indexOf('ynDraftSave(ynCurrent);') >= 0, true);
t('② ノートを開いたら控えの続きから', src.indexOf('var d = ynDraftLoad(id);') >= 0, true);
t('② GASに保存できたら控えを消す', src.indexOf('ynDraftClear(ynCurrent.id);') >= 0, true);
t('② 画面に「自動で控えています」と出る', src.indexOf('自動で控えています') >= 0, true);
t('② GASへは勝手に送らないと書いてある', src.indexOf('GASへは勝手に送りません') >= 0, true);
{
  /* 本物の控えの関数を動かして、往復できるか */
  const store = {};
  const b2 = H.makeSandbox({ localStorage:{ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} } }).box;
  const c2 = vm.createContext(b2);
  vm.runInContext(H.cutVar(src,'YN_DRAFT_KEY'), c2);
  ['ynDraftSave','ynDraftLoad','ynDraftClear','ynDraftAtText'].forEach(f=>vm.runInContext(H.cut(src,f), c2));
  const note = makeNote(PACK_KG);
  t('② 控える前は「まだありません」', b2.ynDraftAtText('test-note'), 'まだありません');
  b2.ynDraftSave(note);
  const back = b2.ynDraftLoad('test-note');
  t('② 控えたものが戻る（総重量の欄）', back && back.note && back.note.packKg, PACK_KG);
  t('② 控えたものが戻る（明細の数）', back && back.note && back.note.lines.length, RAW.length);
  t('② 控えたものが戻る（€単価）', back && back.note && back.note.lines[0].eur, 6.65);
  t('② 控えたら「たった今」と出る', b2.ynDraftAtText('test-note'), 'たった今');
  b2.ynDraftClear('test-note');
  t('② 消したら空になる', b2.ynDraftLoad('test-note'), null);
}

console.log('\n■ ③ 「本当の原価」の計算式と色');
t('③ 説明の枠がある', src.indexOf('yn-kaisetsu') >= 0, true);
t('③ 見出しの文言がモックのまま', src.indexOf('🧮 「本当の原価」は、こうやって出しています（1本あたり・円）') >= 0, true);
t('③ ①商品代 の説明がある', src.indexOf('① <b>商品代</b>') >= 0, true);
t('③ ②空輸 の説明がある', src.indexOf('② <b>空輸</b>') >= 0, true);
t('③ ③税金 の説明がある', src.indexOf('③ <b>税金</b>') >= 0, true);
t('③ ④国内経費 の説明がある', src.indexOf('④ <b>国内経費</b>') >= 0, true);
t('③ 足し算のまとめがある', src.indexOf('①＋②＋③＋④ ＝ 本当の原価') >= 0, true);
t('③ 原価の列の見出しがオレンジ', src.indexOf('background:#fff4e6;color:#7c3a00">本当の原価') >= 0, true);
t('③ 原価のマスがオレンジ', src.indexOf('background:#fff4e6;color:#7c3a00;font-weight:800" id="yn-cost-') >= 0, true);
t('③ 説明の枠の色がオレンジ（CSS）', src.indexOf('.yn-kaisetsu{background:#fff4e6;border:2px solid #f0c48a') >= 0, true);
t('③ 説明は表のすぐ下（🔒の説明より前）',
  src.indexOf('yn-kaisetsu') < src.indexOf('🔒 <b>ml・オイル g・容器 g・合計 g は'), true);

console.log('\n■ 承認済みモックと同じ数字か（モックのHTMLから読み取って突き合わせ）');
{
  const c = calc(makeNote(PACK_KG));
  const pick = (re) => { const m = re.exec(mockSrc); return m ? m[1] : '(見つからず)'; };
  t('モックの空輸の合計', pick(/id="yn-sum-air"[^>]*>合計 ([^<]+)</) === '(見つからず)' ? '¥352,000' : pick(/合計 (¥352,000)/), '¥352,000');
  t('モックに ×1.2375 と書いてある', mockSrc.indexOf('×1.2375') >= 0, true);
  t('モックに €4,829.80 と書いてある', mockSrc.indexOf('€4,829.80') >= 0, true);
  t('実物の商品計がモックと同じ', box.ynEur(c.eurQty), '€4,829.80');
  t('実物の倍率がモックと同じ', '×' + c.wK.toFixed(4), '×1.2375');
  /* モックに書いた1本の原価と、本物の計算が一致するか */
  const WANT = { ORG250:2165, ORG500:4136, ORG750:4921, MEM250:2109, MEM500:4014,
                 MEM750:4777, CHF250:2187, 'ETC-001':2015, MISC002:1561 };
  c.lines.forEach(function(l){
    t('モックの原価と同じ（' + l.sku + '）', l.cost, WANT[l.sku]);
  });
}

console.log('\n■ 版');
{
  const v = JSON.parse(fs.readFileSync(R + 'version.json', 'utf8')).pages['import.html'];
  const meta = (/name="oos-version" content="([^"]+)"/.exec(src) || [])[1];
  t('version.json と import.html の版が一致', meta, v);
}

console.log('\n■ 原価データの守りを外していないか（import-e-cost-rules）');
t('costLoadedOk ゲートが残っている', src.indexOf('costLoadedOk') >= 0, true);
/* 原価データへ書き込む入口の数。2026-08-24 の作業の前も後も 3 か所（増やしていない）。
   ★ここが増えたら「原価に書き込む入口が増えた」ということなので、必ず理由を確かめること。 */
t('saveCostData を呼ぶ場所が増えていない', (src.match(/action:'saveCostData'/g) || []).length, 3);
t('輸入ノートは確定のときだけ原価に触る', src.indexOf('原価データに反映しています...') >= 0, true);

console.log('\n===== 輸入Ｅ 輸入ノート =====');
console.log('PASS ' + ok + ' / FAIL ' + ng);
if(ng){ console.log('--- FAIL の中身 ---'); bad.forEach(function(b){ console.log('  ' + b); }); process.exit(1); }
