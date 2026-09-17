/* ══════════════════════════════════════════════════════════════════════
   🏨 RTは、送料と倉庫ピッキング手数料を【もう一度えらばない】
   2026-09-17　ひろみさん指示（ゆかちゃんの報告を受けて）

   ★ゆかちゃんの報告（2026-09-16）
     「RTデータ取込でアイポーターの伝票を取込、納品書を作成しました！
     　ここまでは順調です！
     　それから、受注登録の画面に進み、**再度送料を入力**し、内容を確認すると
     　（⚠ えらぶまで受注登録できません）になります。
     　RTの受注伝票がない、となり、そのままの内容でOKで進めると、
     　登録はできますが、**伝票の貼り付けができない**、となります」

   ★ひろみさんの言葉
     「RTは伝票を取り込んで納品書も全部作っていて、その段階で
     　**倉庫のピッキング手数料とか送料は、もう全部そこに出来上がってる**ので、
     　あとはそのまま倉庫と連動しているスプレッドシートに流していくだけでいい。
     　**その流れに変えてほしい、RTは**」

   ★見つけた原因は2つ
     ① 受注登録へ渡すとき、送料とピッキング手数料を【渡していなかった】
     ② 受注登録へ進むときに cancelRtImport() を呼んでいて、
        読み取った中身（rtParsed）が空になっていた。
        あとで［この内容で発注書に貼る］を押しても
        rtAttachDocsToOrder が「RTの伝票が読み込まれていない」で止まっていた
        ＝ゆかちゃんの「伝票の貼り付けができない」

   ★2026-09-12の決めごと「毎回えらぶ・えらぶまで登録できません」は
     RT以外は今までどおりです。RTだけ、前の画面で人が選んだものを写します。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '🏨 RTは送料・ピッキング手数料をえらび直さない（2026-09-17）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function eq(name, got, want){
  ok(name, got === want, '（出た答え：' + JSON.stringify(got) + '／ほしい答え：' + JSON.stringify(want) + '）');
}

/* ══════════════════════════════════════════════════════════════
   ごく小さな「カード」を作る（本物の pkgBlockHtml と同じ形の要点だけ）
   ══════════════════════════════════════════════════════════════ */
function tsukuruCard(ctx){
  function El(tag){
    this.tag = tag; this.children = []; this.attrs = {}; this.style = {};
    this.classList = { list: [],
      add: (c) => { if (this.classList.list.indexOf(c) < 0) this.classList.list.push(c); },
      remove: (c) => { const i = this.classList.list.indexOf(c); if (i >= 0) this.classList.list.splice(i, 1); },
      contains: (c) => this.classList.list.indexOf(c) >= 0 };
    this.value = '';
  }
  El.prototype.setAttribute = function(k, v){ this.attrs[k] = String(v); };
  El.prototype.getAttribute = function(k){ return (k in this.attrs) ? this.attrs[k] : null; };
  El.prototype.appendChild = function(c){ c.parentNode = this; this.children.push(c); return c; };
  El.prototype.insertBefore = function(c, ref){ c.parentNode = this;
    const i = this.children.indexOf(ref); if(i<0) this.children.push(c); else this.children.splice(i,0,c); return c; };
  El.prototype.removeChild = function(c){ const i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1); return c; };
  Object.defineProperty(El.prototype, 'firstChild', { get(){ return this.children[0] || null; } });
  El.prototype.zenbu = function(out){ out = out || []; this.children.forEach(c => { out.push(c); c.zenbu(out); }); return out; };
  /* ごく簡単なセレクタ：[data-role="x"] / [data-soryo="n"] / [data-pickup="n"] / .pkg-doc.on の組み合わせ */
  El.prototype.querySelector = function(sel){ return this.querySelectorAll(sel)[0] || null; };
  El.prototype.closest = function(sel){
    let n = this, guard = 0;
    while (n && guard++ < 50) { if (auKa(n, sel)) return n; n = n.parentNode; }
    return null;
  };
  function auKa(n, part){
    let hit = true;
    part.replace(/\[([a-zA-Z-]+)="?([^\]"]*)"?\]/g, function(_, k, v){ if (n.getAttribute(k) !== v) hit = false; return ''; });
    const cls = part.replace(/\[[^\]]*\]/g, '').split('.').filter(Boolean);
    cls.forEach(function(c){ if (!n.classList.contains(c)) hit = false; });
    return hit;
  }
  El.prototype.querySelectorAll = function(sel){
    const parts = String(sel).trim().split(/\s+/);
    let moto = [this];
    parts.forEach(function(part, idx){
      const next = [];
      moto.forEach(function(oya){
        (idx === 0 && oya === undefined ? [] : oya.zenbu()).forEach(function(n){
          if (auKa(n, part) && next.indexOf(n) < 0) next.push(n);
        });
      });
      moto = next;
    });
    return moto;
  };

  const card = new El('div');
  const box = new El('div'); box.setAttribute('data-role', 'pkgbox'); card.appendChild(box);
  const pb = new El('div'); pb.setAttribute('data-role', 'pickupBtns'); box.appendChild(pb);
  ctx.PKG_PICKUP.forEach(function(x, i){
    const e = new El('span'); e.classList.add('pkg-doc'); e.setAttribute('data-pickup', i); pb.appendChild(e);
  });
  const pm = new El('div'); pm.setAttribute('data-role', 'pickupMada'); pm.style.display = 'block'; box.appendChild(pm);
  const sb = new El('div'); sb.setAttribute('data-role', 'soryoBtns'); box.appendChild(sb);
  ctx.PKG_SORYO.forEach(function(x, i){
    const e = new El('span'); e.classList.add('pkg-doc'); e.setAttribute('data-soryo', i); sb.appendChild(e);
  });
  const sw = new El('div'); sw.setAttribute('data-role', 'soryoOtherWrap'); sw.style.display = 'none'; box.appendChild(sw);
  const so = new El('input'); so.setAttribute('data-role', 'soryoOther'); sw.appendChild(so);
  const sm = new El('div'); sm.setAttribute('data-role', 'soryoMada'); sm.style.display = 'block'; box.appendChild(sm);
  card.El = El;
  return card;
}

function sunaba(){
  const ctx = vm.createContext({ console: console, Math: Math, Number: Number, String: String,
    Object: Object, Array: Array, parseInt: parseInt, isNaN: isNaN,
    document: { createElement: function(){ return null; } } });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(SRC.match(/var PKG_PICKUP = \[[\s\S]*?\];/)[0], ctx);
  vm.runInContext(SRC.match(/var PKG_SORYO = \[[\s\S]*?\n\];/)[0], ctx);
  ['pickupTog','soryoTog','pickupYenIn','soryoYenIn','rtHikitsuguRyokin'].forEach(function(n){
    vm.runInContext(H.cut(SRC, n), ctx);
  });
  return ctx;
}

/* ══════════════════════════════════════════════════════════════
   ① RT取込で選んだものが、そのままカードに入る
   ══════════════════════════════════════════════════════════════ */
function tameshi(p){
  const ctx = sunaba();
  const card = tsukuruCard(ctx);
  ctx.__card = card; ctx.__p = p;
  const mieru = vm.runInContext('rtHikitsuguRyokin(__card, __p)', ctx);
  return { ctx: ctx, card: card, mieru: mieru,
    pickup: vm.runInContext('pickupYenIn(__card)', ctx),
    soryo:  vm.runInContext('soryoYenIn(__card)', ctx) };
}
{
  const r = tameshi({ shipFee: 800, pickFee: 700 });
  eq('①送料800円が、そのまま入る', r.soryo, 800);
  eq('①ピッキング700円が、そのまま入る', r.pickup, 700);
  ok('①「えらぶまで受注登録できません」が消える',
     r.card.querySelector('[data-role="soryoMada"]').style.display === 'none'
     && r.card.querySelector('[data-role="pickupMada"]').style.display === 'none');
}
{
  const r = tameshi({ shipFee: 1250, pickFee: 0 });
  eq('②ボタンに無い金額（1250円）も、そのまま入る', r.soryo, 1250);
  eq('②「無料サービス」も、そのまま入る', r.pickup, 0);
  ok('②1250円は「その他」の欄に書かれている',
     r.card.querySelector('[data-role="soryoOther"]').value === 1250,
     '（出た答え：' + r.card.querySelector('[data-role="soryoOther"]').value + '）');
}
{
  const r = tameshi({ shipFee: 0, pickFee: 'nashi' });
  eq('③送料0円（無料サービス）', r.soryo, 0);
  eq('③ピッキング「なし」は、0円ではなく【なし】のまま', r.pickup, 'nashi');
  ok('③「なし」でも受注登録できる（未選択あつかいにしない）', r.pickup !== null);
  ok('③「なし」の印がカードに付く', r.card.getAttribute('data-rt-pickup') === 'nashi');
}
{
  const r = tameshi({ shipFee: '', pickFee: 700 });
  eq('④送料が空のときは、えらばれていないまま（うそをつかない）', r.soryo, null);
  eq('④ピッキングは入る', r.pickup, 700);
}
/* ★「なし」を0円（無料サービス）に置きかえてしまわないこと。
   　書類では「なし」は ― 、0円は「無料サービス」と出ます。意味がちがいます。 */
{
  const r = tameshi({ shipFee: 800, pickFee: 'nashi' });
  ok('⑤「なし」を0円に置きかえていない', r.pickup !== 0, '（0円にすると書類に「無料サービス」と出てしまいます）');
}

/* ══════════════════════════════════════════════════════════════
   ⑥ 受注登録へ進んでも、読み取った中身を消さない（伝票が貼れるように）
   ══════════════════════════════════════════════════════════════ */
{
  const apply = H.cut(SRC, 'applyRtToOrderForm');
  const applyNoC = apply.replace(/\/\*[\s\S]*?\*\//g, '');   /* 説明文は見ない */
  ok('⑥受注登録へ進むときに cancelRtImport() を呼んでいない',
     applyNoC.indexOf('cancelRtImport()') < 0,
     '（呼ぶと rtParsed が空になり、あとで伝票と納品書を貼れません）');
  ok('⑥画面だけ閉じる関数を呼んでいる', apply.indexOf('rtImportGamenTojiru_()') >= 0);
  const tojiru = H.cut(SRC, 'rtImportGamenTojiru_');
  ok('⑥画面だけ閉じる関数は、読み取った中身を消していない',
     tojiru.indexOf('rtParsed') < 0,
     '（ここで rtParsed = null に戻さないでください）');
  const cancel = H.cut(SRC, 'cancelRtImport');
  ok('⑥✕「取り込みをやめる」のほうは、今までどおり中身も消す',
     cancel.indexOf('rtParsed = null') >= 0);
  ok('⑥送料・手数料を持っていく処理が入っている',
     apply.indexOf('rtHikitsuguRyokin(card, p)') >= 0);
  ok('⑥何を持ってきたか、画面に出している',
     apply.indexOf('rtRyokinShirase(') >= 0);
}

/* ══════════════════════════════════════════════════════════════
   ⑦ ちがう伝票の書類を貼らない
   ══════════════════════════════════════════════════════════════ */
/* ★2026-09-17（同じ日の夕方）に、守り方を【もっと強いもの】に変えました。
   　はじめは「伝票番号が合わなければ、貼らずに知らせる」にしていました。
   　でもそれだと、伝票を閉じたあとは【何も貼れないまま】になります。
   　いまは「伝票番号が合わないときは、その注文から納品書を作る」ので、
   　ちがう伝票の納品書を貼ることは無く、しかも必ず1枚は貼れます。
   　（ひろみさん「この2つが間違いなく倉庫に届くように」）
   　くわしい見張りは tests/test_rt_shorui_2tsu.js にあります。 */
{
  const at = H.cut(SRC, 'rtAttachDocsToOrder');
  const atc = at.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('⑦いま開いている伝票が、この注文のものかを見ている',
     atc.indexOf('_denpyouKara') >= 0,
     '（見ないと、ちがう伝票の納品書を貼ってしまいます）');
  ok('⑦ちがう伝票のときは、その注文から納品書を作る',
     atc.indexOf("nouhinBuildPdfB64(o, '納品書')") >= 0);
  ok('⑦貼ったあと、2つそろったか自分で確かめる',
     atc.indexOf('RTは【納品書と発注伝票の2つ】が要ります') >= 0);
}

/* ══════════════════════════════════════════════════════════════
   ⑧ RT以外は、今までどおり「毎回えらぶ」
   ══════════════════════════════════════════════════════════════ */
{
  const ctx = sunaba();
  const card = tsukuruCard(ctx);
  ctx.__card = card;
  eq('⑧何も選んでいないカードは、ピッキングが未選択のまま', vm.runInContext('pickupYenIn(__card)', ctx), null);
  eq('⑧何も選んでいないカードは、送料が未選択のまま', vm.runInContext('soryoYenIn(__card)', ctx), null);
  ok('⑧「えらぶまで受注登録できません」が出たまま',
     card.querySelector('[data-role="pickupMada"]').style.display !== 'none');
  ok('⑧はじめから選ばれている印が付いていない',
     !card.querySelector('[data-role="pickupBtns"] .pkg-doc.on'));
}

/* ══════════════════════════════════════════════════════════════
   ⑨ 届け先が2つ以上でも、押したカードの⚠だけが消える
      ★2026-09-17 見つけた別のバグ：
      　pickupTog / soryoTog は 'pkgBox' と '.deliv-card' を探していましたが、
      　その名前はこのファイルのどこにもありませんでした（いつも document）。
      　そのため、2枚目を押しても【1枚目の】⚠が消えていました。
   ══════════════════════════════════════════════════════════════ */
{
  const ctx = sunaba();
  const card1 = tsukuruCard(ctx);
  const card2 = tsukuruCard(ctx);
  ctx.__c1 = card1; ctx.__c2 = card2;
  /* 2枚目のカードで「700円」を押す */
  ctx.__btn = card2.querySelector('[data-role="pickupBtns"] [data-pickup="2"]');
  vm.runInContext('pickupTog(__btn)', ctx);
  ok('⑨押したカード（2枚目）の⚠は消える',
     card2.querySelector('[data-role="pickupMada"]').style.display === 'none');
  ok('⑨押していないカード（1枚目）の⚠は、消えずに残る',
     card1.querySelector('[data-role="pickupMada"]').style.display !== 'none',
     '（1枚目の⚠が消えると、まだえらんでいないのに済んだように見えます）');
  eq('⑨1枚目は、まだ未選択のまま', vm.runInContext('pickupYenIn(__c1)', ctx), null);
  eq('⑨2枚目だけ700円', vm.runInContext('pickupYenIn(__c2)', ctx), 700);
  /* 探している名前が、本当にこのファイルにあること */
  ok('⑨探している名前が、実際にファイルの中にある',
     SRC.indexOf('data-role="pkgbox"') >= 0 && SRC.indexOf('recipient-card') >= 0);
  ok('⑨どこにも無い名前（pkgBox・deliv-card）を探していない',
     SRC.indexOf("closest('[data-role=\"pkgBox\"]')") < 0 && SRC.indexOf("closest('.deliv-card')") < 0);
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
