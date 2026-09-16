/* ══════════════════════════════════════════════════════════════════════
   🖨️ RT取り込み：ボタンの順番と、ボタンが消えない見張り
   2026-09-16　ひろみさん指示・そして事故の再発防止

   ★ひろみさんの指示
     「取り出すを先にして、そのあと 伝票の内容と納品書が合っていることを確認しました
     　のチェックがあって、その下に この内容で受注登録画面へ進む。順番が逆かな」

   ★起きた事故（同じ日）
     ひろみさん「**納品書をPDFで～のボタンが消えた！！！**」
     「🖨️ 納品書をPDFで取り出す」のかたまり（#rt-actions）を、確認の枠より上へ
     【移して】いました。移した先は画面（#rt-preview）の中です。
     そのあと画面を作り直すと（el.innerHTML = …）、**移したボタンごと消えて**、
     二度と戻りませんでした。

   ★直し方
     作り直す【前】に画面の外へ出して預かり（rtActionsHoldOut）、
     作り直した【あと】に置き直す（rtActionsPutBack）。

   ★この見張りは、本物の画面をブラウザなしで動かして
     「作り直しを何回くり返してもボタンが残っているか」を確かめます。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(LIVE, 'index.html'), 'utf8');

const title = '🖨️ RT取り込み：ボタンの順番と、消えない見張り（2026-09-16）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function eq(name, got, want){
  ok(name, JSON.stringify(got) === JSON.stringify(want),
     '（出た答え：' + JSON.stringify(got) + '／ほしい答え：' + JSON.stringify(want) + '）');
}

/* ══════════════════════════════════════════════════════════════
   ① 作りの見張り（預かる／置き直すが、正しい順で入っているか）
   ══════════════════════════════════════════════════════════════ */
const ren = H.cut(INDEX, 'renderRtPreview');
const renNoComment = ren.replace(/\/\*[\s\S]*?\*\//g, '');
const iHold = renNoComment.indexOf('rtActionsHoldOut()');
const iHtml = renNoComment.indexOf('el.innerHTML =');
const iBack = renNoComment.lastIndexOf('rtActionsPutBack()');
ok('①作り直す前に、ボタンを預かっている', iHold >= 0 && iHtml >= 0 && iHold < iHtml,
   '（rtActionsHoldOut が el.innerHTML より前にありません）');
ok('①作り直したあとに、ボタンを置き直している', iBack > iHtml,
   '（rtActionsPutBack が el.innerHTML より後にありません）');
ok('①中身が空のときも置き直している',
   /if\(!p\)\{[^}]*rtActionsPutBack\(\)/.test(renNoComment),
   '（取り込み前・キャンセル後にボタンが消えます）');
ok('①置き場所（rt-actions-slot）が、確認の枠より前にある',
   ren.indexOf('rt-actions-slot') >= 0
   && ren.indexOf('rt-actions-slot') < ren.indexOf('⚠️ 伝票と納品書を確認しましたか？'),
   '（ひろみさん指示：取り出す → 確認☑ → 受注登録へ進む の順）');
ok('①ボタンの文字に「確認」が入っている',
   INDEX.indexOf('納品書をPDFで取り出す（確認・印刷・保存）') >= 0);

/* ══════════════════════════════════════════════════════════════
   ② 本物を動かす：作り直しを10回くり返しても、ボタンが残っているか
   ══════════════════════════════════════════════════════════════ */
{
  /* ごく小さな「画面」を作って、本物の3つの関数をそのまま動かします */
  const vm = require('vm');
  function El(id){
    this.id = id; this.children = []; this.parentNode = null;
    this.style = {}; this._html = '';
  }
  El.prototype.appendChild = function(c){
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this; this.children.push(c); return c;
  };
  El.prototype.insertBefore = function(c, ref){
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = this.children.indexOf(ref);
    c.parentNode = this;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  };
  El.prototype.removeChild = function(c){
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null; return c;
  };
  Object.defineProperty(El.prototype, 'nextSibling', { get: function(){
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return this.parentNode.children[i + 1] || null;
  }});
  Object.defineProperty(El.prototype, 'innerHTML', {
    get: function(){ return this._html; },
    set: function(v){ this._html = v; this.children.forEach(c => { c.parentNode = null; }); this.children = []; }
  });

  const body = new El('body');
  const preview = new El('rt-preview');
  const actions = new El('rt-actions');
  const modal = new El('rt-send-modal');
  body.appendChild(preview); body.appendChild(actions); body.appendChild(modal);

  /* 画面を作り直すたびに、置き場所（slot）が新しく作られる、という本物の動きをまねます */
  let slot = null;
  const doc = {
    getElementById: function(id){
      if (id === 'rt-preview') return preview;
      if (id === 'rt-actions') return actions;
      if (id === 'rt-actions-slot') return slot;
      return null;
    }
  };
  const ctx = vm.createContext({ document: doc, console: console });
  vm.runInContext(H.cut(INDEX, 'rtActionsHoldOut') + '\n' + H.cut(INDEX, 'rtActionsPutBack')
    + '\nvar rtActionsEl = null, rtActionsHome = null;', ctx);
  /* 変数は関数より先に用意する（本物と同じ順） */
  vm.runInContext('rtActionsEl = null; rtActionsHome = null;', ctx);

  ctx.__slotSet = function(s){ slot = s; };
  vm.runInContext('function ichido(slotAri){ rtActionsHoldOut(); __kesu(); if(slotAri) __tsukuru(); rtActionsPutBack(); }', ctx);
  ctx.__kesu = function(){ preview.innerHTML = '…'; slot = null; };
  ctx.__tsukuru = function(){ slot = new El('rt-actions-slot'); preview.appendChild(slot); };

  function botanAru(){
    /* 画面のどこかに #rt-actions がぶら下がっているか */
    let n = actions, guard = 0;
    while (n && guard++ < 50) { if (n === body) return true; n = n.parentNode; }
    return false;
  }

  vm.runInContext('ichido(true)', ctx);
  ok('②1回目の作り直しのあとも、ボタンがある', botanAru());
  ok('②1回目は確認の枠の上（slotの中）にある', actions.parentNode && actions.parentNode.id === 'rt-actions-slot');

  let kieta = 0;
  for (let i = 0; i < 10; i++) {
    vm.runInContext('ichido(true)', ctx);
    if (!botanAru()) kieta++;
  }
  eq('②作り直しを10回くり返しても、ボタンは消えない', kieta, 0);

  /* 取り込み前・キャンセル後（置き場所が無い）でも消えないこと */
  vm.runInContext('ichido(false)', ctx);
  ok('②置き場所が無いときも、ボタンは消えない（もとの場所へ戻る）', botanAru());
  eq('②そのとき、もとの場所（body直下）に戻っている', actions.parentNode ? actions.parentNode.id : '', 'body');

  /* そこからもう一度取り込んでも、また上に並ぶこと */
  vm.runInContext('ichido(true)', ctx);
  ok('②もう一度取り込むと、また確認の枠の上に戻る',
     actions.parentNode && actions.parentNode.id === 'rt-actions-slot');
}

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
