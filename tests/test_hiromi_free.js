/* ══════════════════════════════════════════════════════════════════════
   🖊 ひろみメモのフリースペース：手で保存する・勝手に上書きしない
   2026-09-17　ひろみさん指示

   ★ひろみさんの言葉
     「ひろみメモの自由に書けるフリースペース、**いつも消えてる気がする**。
     　**保存するボタンを作って手動で保存する**ようにして。
     　**今入っている者は消さないで**」

   ★なぜ消えていたか（2026-09-17に見つけた本当の原因）
     画面を開いたとき、【サーバーの内容で、書いてある文字を必ず上書き】していました。
     　ta.value = m.text;   ← 中身をくらべずに、いつも上書き
     自動保存（1.2秒後）が失敗していると、サーバーには古い文字が残ります。
     次に開くと、その古い文字で上書きされ、書いた分が消えて見えました。
     しかも保存に失敗しても「✅ 保存しました」と出ていました
     （post は status を見ずに返すので、GASがエラーでも catch に入らなかった）。

   ★この見張りが守ること
     ① 自動保存はしない（💾を押したときだけ送る）
     ② 手元とサーバーが違うとき、勝手に上書きしない（手元を残して知らせる）
     ③ 保存の成否は、GASの返事をちゃんと見て言う（うそをつかない）
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'hiromi.html'), 'utf8');

const title = '🖊 ひろみメモのフリースペース：手で保存する（2026-09-17）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function eq(name, got, want){
  ok(name, got === want, '（出た答え：' + JSON.stringify(got) + '／ほしい答え：' + JSON.stringify(want) + '）');
}

/* ── 本物の関数を動かす砂場 ── */
function sunaba(opt){
  opt = opt || {};
  const ta   = { id:'free-space-text', value: opt.gamen || '' };
  const st   = { id:'free-save-state', textContent:'', style:{} };
  const btn  = { id:'free-save-btn', textContent:'', disabled:false, style:{} };
  const obi  = { id:'free-chigai', style:{ display:'none' } };
  const mise = {};
  const ctx = vm.createContext({
    console: console, String: String, Date: Date, Object: Object, Array: Array, JSON: JSON,
    document: { getElementById: function(id){
      if(id==='free-space-text') return ta;
      if(id==='free-save-state') return st;
      if(id==='free-save-btn')   return btn;
      if(id==='free-chigai')     return obi;
      return null;
    }},
    localStorage: {
      _v: (opt.teMoto === undefined ? null : opt.teMoto),
      getItem: function(){ return this._v; },
      setItem: function(_k, v){ this._v = String(v); }
    },
    confirm: function(){ mise.kikareta = true; return opt.confirmOk !== false; },
    password: 'x', SHEET_FREE: 'free',
    post: async function(body){ mise.okutta = body; return opt.henji || { status:'ok' }; }
  });
  ctx.window = ctx; ctx.globalThis = ctx;
  ['freeShowChigai','freeApply_','freeUseServer','hmApplyFree','loadFreeSpace','onFreeSpaceInput','saveFreeSpaceNow']
    .forEach(function(n){ vm.runInContext(H.cut(SRC, n), ctx); });
  vm.runInContext("var FREE_NOTE_ID='free_note_1'; var FREE_CACHE_KEY='oos_hiromi_freespace_cache';"
                + " var freeSpaceCreatedAt=null; var freeSpaceServerText=null;", ctx);
  return { ctx: ctx, ta: ta, st: st, btn: btn, obi: obi, mise: mise,
           run: function(code){ return vm.runInContext(code, ctx); } };
}

/* ══════════════════════════════════════════════════════════════
   ① ★手元に書きかけがあるとき、サーバーの古い内容で【上書きしない】
      （これが「いつも消えてる」の正体でした）
   ══════════════════════════════════════════════════════════════ */
{
  const s = sunaba({ teMoto: 'きょう書いた新しいメモ' });
  s.ctx.__m = [{ id:'free_note_1', text:'ふるい内容', createdAt:'2026-09-01' }];
  s.run('hmApplyFree(__m)');
  eq('①手元の書きかけが残る（サーバーの古い内容で消されない）', s.ta.value, 'きょう書いた新しいメモ');
  ok('①食いちがいの帯が出る', s.obi.style.display === 'block');
}

/* ② 手元とサーバーが同じなら、帯は出さない */
{
  const s = sunaba({ teMoto: 'おなじ内容' });
  s.ctx.__m = [{ id:'free_note_1', text:'おなじ内容', createdAt:'2026-09-01' }];
  s.run('hmApplyFree(__m)');
  eq('②同じなら、そのまま', s.ta.value, 'おなじ内容');
  ok('②帯は出さない', s.obi.style.display === 'none');
}

/* ③ 手元に何も無ければ、サーバーの内容を入れる */
{
  const s = sunaba({ teMoto: undefined });
  s.ctx.__m = [{ id:'free_note_1', text:'サーバーのメモ', createdAt:'2026-09-01' }];
  s.run('hmApplyFree(__m)');
  eq('③手元が空なら、サーバーの内容を出す', s.ta.value, 'サーバーのメモ');
  ok('③帯は出さない', s.obi.style.display === 'none');
}

/* ④ サーバーに何も無ければ、手元を消さない */
{
  const s = sunaba({ teMoto: '手元にだけあるメモ' });
  s.ctx.__m = [];
  s.run('hmApplyFree(__m)');
  eq('④サーバーが空でも、手元を消さない', s.ta.value, '手元にだけあるメモ');
}

/* ══════════════════════════════════════════════════════════════
   ⑤ 書いている間は、サーバーへ送らない（自動保存をやめた）
   ══════════════════════════════════════════════════════════════ */
{
  const s = sunaba({ teMoto: '' });
  s.ta.value = 'いま書いている途中';
  s.run('onFreeSpaceInput()');
  ok('⑤サーバーへ送っていない', s.mise.okutta === undefined,
     '（自動保存に戻すと、書きかけが勝手に上書きされます）');
  ok('⑤手元には控えている', s.ctx.localStorage._v === 'いま書いている途中');
  ok('⑤「まだ保存していません」と出す', String(s.st.textContent).indexOf('まだ保存していません') >= 0);
  ok('⑤ボタンの色と文字が変わる', String(s.btn.textContent).indexOf('未保存あり') >= 0);
  const fn = H.cut(SRC, 'onFreeSpaceInput').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('⑤自動保存のタイマーが残っていない',
     fn.indexOf('setTimeout') < 0 && fn.indexOf('freeSpaceSaveTimer') < 0,
     '（1.2秒後に自動で送る形に戻さないでください）');
}

/* ══════════════════════════════════════════════════════════════
   ⑥ 💾を押したときだけ送る。返事をちゃんと見る（うそをつかない）
   ══════════════════════════════════════════════════════════════ */
(async function(){
  {
    const s = sunaba({ teMoto:'', henji:{ status:'ok' } });
    s.ta.value = '保存したい文';
    await s.run('saveFreeSpaceNow()');
    ok('⑥押したらサーバーへ送る', !!s.mise.okutta && s.mise.okutta.action === 'saveStickyMemo');
    ok('⑥送る中身に、書いた文が入っている', s.mise.okutta.memo.text === '保存したい文');
    ok('⑥うまくいったら「✅ 保存しました」', String(s.st.textContent).indexOf('✅ 保存しました') >= 0);
    ok('⑥ボタンが押せる状態に戻る', s.btn.disabled === false);
  }
  {
    const s = sunaba({ teMoto:'', henji:{ status:'error', message:'あいことばがちがいます' } });
    s.ta.value = '保存したい文';
    await s.run('saveFreeSpaceNow()');
    ok('⑦失敗したら「✅ 保存しました」と言わない',
       String(s.st.textContent).indexOf('✅') < 0,
       '（前は失敗しても ✅ と出ていました。これが消えたと思う原因の1つです）');
    ok('⑦できなかったことを、はっきり言う',
       String(s.st.textContent).indexOf('保存できませんでした') >= 0);
    ok('⑦理由も出す', String(s.st.textContent).indexOf('あいことばがちがいます') >= 0);
    ok('⑦「手元には残っています」と伝える',
       String(s.st.textContent).indexOf('手元には残っています') >= 0);
  }
  /* ⑧ サーバーの内容に戻すのは、押して、聞かれて、OKしたときだけ */
  {
    const s = sunaba({ teMoto:'いま書いた文' });
    s.ctx.__m = [{ id:'free_note_1', text:'サーバーの古い文', createdAt:'2026-09-01' }];
    s.run('hmApplyFree(__m)');
    s.run('freeUseServer()');
    ok('⑧押すと、まず確かめる', s.mise.kikareta === true);
    eq('⑧OKしたら、サーバーの内容になる', s.ta.value, 'サーバーの古い文');
  }
  {
    const s = sunaba({ teMoto:'いま書いた文', confirmOk:false });
    s.ctx.__m = [{ id:'free_note_1', text:'サーバーの古い文', createdAt:'2026-09-01' }];
    s.run('hmApplyFree(__m)');
    s.run('freeUseServer()');
    eq('⑧キャンセルしたら、いま書いた文のまま', s.ta.value, 'いま書いた文');
  }
  /* ⑨ 画面の作り */
  {
    ok('⑨💾 保存するボタンがある', SRC.indexOf('id="free-save-btn"') >= 0 && SRC.indexOf('onclick="saveFreeSpaceNow()"') >= 0);
    ok('⑨食いちがいの帯がある', SRC.indexOf('id="free-chigai"') >= 0);
    ok('⑨「自動で保存されます」と書いていない', SRC.indexOf('書いた内容は自動で保存されます') < 0,
       '（手で保存する形にしたので、説明も直します）');
    ok('⑨押すまで保存されないと書いてある', SRC.indexOf('押すまで保存されません') >= 0);
  }

  if (fail) {
    console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
    fails.forEach(x => console.log(x));
    process.exitCode = 1;
  } else {
    console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
  }
})();
