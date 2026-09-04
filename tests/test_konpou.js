/* 📦 梱包の指示（2026-09-05）の見張り
   承認済みモック：mocks/mock_受注A_梱包の指示_2026-09-05.html
   （デスクトップ版：おためし版_梱包の指示_受注A入力画面_2026-09-05.html）

   ひろみさんの言葉：「倉庫のれい子さんとのやり取りをしないで、倉庫を分かりやすくしたい」
   ・お届け先ごとに「ふつうの発送／ギフト」を選ぶ
   ・同梱書類は「入れるものを押す札」。注文ごと→お届け先ごとへ引っ越した（指示A）
   ・倉庫には「入れないもの」も薄く出す（空欄は聞き返しの元になるため）
   ・送り状の貼り方は選ばせない（倉庫さんにおまかせの1択）
   ★この見張りを外さないでください。外すと聞き返しが元に戻ります。 */
const vm = require('vm');
const H = require('./harness');
const idx = H.read('index.html');
const pick = H.read('pickup.html');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){
  if(JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; fails.push(`${label}  期待:${JSON.stringify(want)}  実際:${JSON.stringify(got)}`); }
}
function has(label, hay, needle){
  if(String(hay).indexOf(needle) >= 0) pass++; else { fail++; fails.push(`${label}  「${needle}」が見つかりません`); }
}
function no(label, hay, needle){
  if(String(hay).indexOf(needle) < 0) pass++; else { fail++; fails.push(`${label}  「${needle}」が残っています`); }
}

/* ── ① 選ぶ項目と文言（モックの一字一句） ── */
has('①ふつうの発送の札', idx, '📦 ふつうの発送');
has('①ギフトの札', idx, '🎁 ギフト');
has('①ふつうの箱は3つ', H.cut(idx,'pkgBlockHtml'), "PKG_BOX");
has('①箱の3つ（卸レベルでOK）', idx, "'卸レベルでOK'");
has('①箱の3つ（きれいなものならリサイクル箱OK）', idx, "'きれいなものならリサイクル箱OK'");
has('①箱の3つ（新しい箱で）', idx, "'新しい箱で'");
has('①ふつうの箱の初めの値は「きれいなものならリサイクル箱OK」（ひろみさん指示）',
    H.cut(idx,'pkgBlockHtml'), "pkgOpts('box', PKG_BOX, 'きれいなものならリサイクル箱OK', false)");
has('①ギフトの箱は2つ（化粧箱に入れる／クラフト箱でOK）', idx, "var PKG_GBOX = ['化粧箱に入れる','クラフト箱でOK'];");
has('①包装紙は包む／包まない（1種類なので紙の種類は選ばせない）', H.cut(idx,'pkgBlockHtml'), "['包む','包まない']");
has('①リボンはかける／かけない', H.cut(idx,'pkgBlockHtml'), "['かける','かけない']");
has('①熨斗はなし／内のし／外のし', H.cut(idx,'pkgBlockHtml'), "['なし','内のし','外のし']");
has('①送り状の貼り方は選ばせない（1択）', H.cut(idx,'pkgBlockHtml'), '倉庫さんにおまかせ');
has('①1つも押さなければ書類なし、の案内', H.cut(idx,'pkgBlockHtml'), '1つも押さなければ「同梱書類なし」');

/* 書類の札は、いままでの受注Ａと同じ名前・同じ並び（新しい名前を作らない） */
eq('①書類の札の名前と並び（いままで通り）',
   (idx.match(/var PKG_DOCS = \[([^\]]+)\]/)||[])[1],
   "'納品書','請求書','領収書','納品書兼請求書','納品書兼領収書','RT発注伝票＋納品書'");
has('①その他（自分で書く）は残っている', H.cut(idx,'pkgBlockHtml'), 'その他（自分で書く）');
has('①パンフレットも札になった', H.cut(idx,'pkgBlockHtml'), '__pamph');

/* ── ② 置きかえたもの（二重にしない） ── */
no('②注文ごとの「📄 同梱書類」ブロックは消えている', idx, '📄 同梱書類（お荷物に入れる紙）');
no('②「リサイクル箱使用可」のチェックは消えている', idx, 'リサイクル箱使用可</label>');
has('②お届け先カードの中に梱包の指示が入っている', H.cut(idx,'addRecipient'), 'pkgBlockHtml(id)');
has('②カードを作ったら既定を入れる', idx, "if(typeof pkgApplyCtype==='function') pkgApplyCtype(card);");

/* ── ③ いままでの決めごとは変えていない ── */
has('③既定は納品書兼請求書', H.cut(idx,'pkgApplyCtype'), "if(!rtset && d==='納品書兼請求書') x.classList.add('on');");
has('③RT・RTGCはRT発注伝票＋納品書', H.cut(idx,'pkgApplyCtype'), "if(rtset && d==='RT発注伝票＋納品書') x.classList.add('on');");
has('③パンフレットの既定（RT・卸①②・バサラはオフ）', H.cut(idx,'pkgApplyCtype'),
    "(v==='rt'||v==='rtgc'||v==='wholesale1'||v==='wholesale2'||v==='basara')");
has('③ギフトを含む届け先は「新しい箱で」に固定', H.cut(idx,'updateRecycleLock'), "'新しい箱で'");
has('③鍵のかかった札は押しても動かない', H.cut(idx,'pkgPick'), "if(el.classList.contains('lock')) return;");
has('③RT伝票取込はRT発注伝票＋納品書', idx, "pkgSetDocs(card, ['RT発注伝票＋納品書'], false);");
has('③バサラ取込は書類なし＋パンフレット', idx, 'pkgSetDocs(card, [], true);');
has('③空のときの既定は納品書兼請求書', H.cut(idx,'pkgFillCard'), "var _enc0 = o.enclosedDoc || '納品書兼請求書';");

/* ── ④ 倉庫に出る形（入れないものも必ず出す） ── */
has('④受注Ａの出荷依頼書に梱包の指示', idx, "html += '<div class=\"slip-section-title\">📦 梱包の指示</div>' + pkgTableHtml(o);");
has('④倉庫Ｄにも梱包の指示', pick, "pkgTableHtmlPD(o)");
has('④倉庫Ｄは入れないものも出す', H.cut(pick,'pkgTableHtmlPD'), '入れないもの：');
has('④受注Ａも入れないものを出す', H.cut(idx,'pkgTableHtml'), '入れないもの：');
has('④ふつうの発送にも必ず出す（ギフトではありません）', H.cut(idx,'pkgTableHtml'), 'ふつうの発送（ギフトではありません）');
has('④倉庫Ｄも同じ文言', H.cut(pick,'pkgTableHtmlPD'), 'ふつうの発送（ギフトではありません）');

/* ── ⑤ 数字と中身（本物の関数を動かす） ── */
function box(){
  const b = { JSON, String, Number, Array, Object, esc:function(s){ return String(s==null?'':s); } };
  const ctx = vm.createContext(b);
  ['pkgDocsIn','pkgDocsOut','pkgOf','pkgOneLine','pkgTableHtml'].forEach(function(n){ vm.runInContext(H.cut(idx, n), ctx); });
  vm.runInContext("var PKG_ALLDOCS = ['納品書','請求書','領収書','納品書兼請求書','納品書兼領収書','RT発注伝票＋納品書','パンフレット'];", ctx);
  return b;
}
{
  const G = box();
  /* ふつうの発送：納品書とパンフレットを入れる */
  const o1 = { pkg:{kind:'normal', box:'卸レベルでOK'}, enclosedDoc:'納品書', includePamphlet:true };
  eq('⑤入れる書類（納品書＋パンフレット）', G.pkgDocsIn(o1), ['納品書','パンフレット']);
  eq('⑤入れないものは残り5つ', G.pkgDocsOut(o1).length, 5);
  eq('⑤スプシの1行（ふつう）', G.pkgOneLine(o1), '📦 ふつう／箱:卸レベルでOK');

  /* ギフト：書類なし・パンフレットだけ */
  const o2 = { pkg:{kind:'gift', giftBox:'化粧箱に入れる', wrap:'包む', ribbon:'かける', noshiSide:'なし'},
               enclosedDoc:'なし', includePamphlet:true };
  eq('⑤ギフトで書類なしのとき', G.pkgDocsIn(o2), ['パンフレット']);
  eq('⑤スプシの1行（ギフト）', G.pkgOneLine(o2), '🎁 ギフト／化粧箱に入れる／包む／リボンあり／熨斗:なし');

  /* 熨斗つき */
  const o3 = { pkg:{kind:'gift', giftBox:'クラフト箱でOK', wrap:'包む', ribbon:'かけない', noshiSide:'内のし'},
               noshi:{title:'御祝', name:'佐藤'}, enclosedDoc:'なし', includePamphlet:false };
  eq('⑤スプシの1行（熨斗つき）', G.pkgOneLine(o3), '🎁 ギフト／クラフト箱でOK／包む／リボンなし／熨斗:内のし(御祝 佐藤)');
  eq('⑤パンフレットを外したら書類なし', G.pkgDocsIn(o3), []);

  /* 2026-09-05より前の注文（pkgが無い）＝落ちない・ふつう扱い */
  const old1 = { useRecycle:true, enclosedDoc:'納品書兼請求書', includePamphlet:true };
  eq('⑤古い注文はふつう扱い', G.pkgOf(old1).kind, 'normal');
  eq('⑤古い注文の箱（♻ありはリサイクルOK）', G.pkgOf(old1).box, 'きれいなものならリサイクル箱OK');
  eq('⑤古い注文の箱（♻なしは新しい箱で）', G.pkgOf({}).box, '新しい箱で');
  eq('⑤古い注文でも1行が作れる', G.pkgOneLine(old1), '📦 ふつう／箱:きれいなものならリサイクル箱OK');

  /* 表がこわれない（ギフト・ふつう・古い注文の3つとも） */
  [o1, o2, o3, old1, {}].forEach(function(o, i){
    const t = G.pkgTableHtml(o);
    eq('⑤表が作れる('+i+')', t.indexOf('送り状の貼り方') >= 0, true);
    eq('⑤表に「倉庫さんにおまかせ」('+i+')', t.indexOf('倉庫さんにおまかせ') >= 0, true);
  });
}

/* ── ⑥ ゆかスプシ（発注書）：列は増やさず、備考の先頭と同梱書類の2列へ ── */
{
  const gasPath = require('path').join(__dirname, '..', '..', 'olive-stories-gas', 'コード.js');
  const gas = require('fs').readFileSync(gasPath, 'utf8');
  has('⑥受注Ａが梱包の1行を送る', H.cut(idx,'yukaImportOne'), "pkg: (typeof pkgOneLine==='function' ? pkgOneLine(o) : '')");
  has('⑥受注Ａが同梱書類を2つに分けて送る', H.cut(idx,'yukaImportOne'), 'docNouhin:');
  has('⑥納品書系とそれ以外で分ける', H.cut(idx,'yukaImportOne'), "d.indexOf('納品書')>=0");
  has('⑥入れないものは「入れない」と書く（空欄にしない）', H.cut(idx,'yukaImportOne'), "|| '入れない'");
  has('⑥GASが備考の先頭に梱包の1行', H.cut(gas,'oosYukaImportOrder'), "String(order.pkg||'').trim()");
  has('⑥GASが17・18列に同梱書類', H.cut(gas,'oosYukaImportOrder'), "String(order.docNouhin||''), String(order.docHoka||''), ''");
  has('⑥列は増やしていない（発送済は20列目のまま）', H.cut(gas,'oosYukaImportOrder'), 'sh.getRange(newRow, 20).insertCheckboxes();');
}
console.log('===== 📦 梱包の指示（2026-09-05）=====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(f => console.log('  ' + f)); }
process.exit(fail ? 1 : 0);
