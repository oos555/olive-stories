/* ══════════════════════════════════════════════════════════════════════
   🗒️ ひろみメモI の並び：やること削除・フリースペースが上・大切なメモがその下
   2026-11-18　ひろみさん指示（承認済みモック mocks/mock_ひろみメモ_2026-11-18.html「これで作って」）

   ★ひろみさんの言葉
     「やることリストを全部消して削除して、フリースペースを一番上に持ってきて、
     　その下に大切なメモを来るようにしてくれる？」

   ★この見張りが守ること
     ① 「✅ やること」の箱が画面に無い（入力欄・今日/明日/今週/来週・終了した業務）
     ② 並びは 伝言板 → 🖊 フリースペース → ⭐ 大切なメモ
     ③ 説明パネルからも「✅ やること」が消え、フリースペースが先に書いてある
     ④ フリースペースの説明文から「やること・」が消えている
     ⑤ やること用の関数（renderTodos / renderDoneArchive）は、箱が無くてもエラーで止まらない
        （画面を開いたとき hmApplyAll が renderTodos を呼ぶので、ここで止まると全部が出なくなる）
     ⑥ スプシのタブ「付箋メモIやること」は消していない（データは残す約束）
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const H = require('./harness');

const LIVE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(LIVE, 'hiromi.html'), 'utf8');
const MOCK_PATH = path.join(LIVE, 'mocks', 'mock_ひろみメモ_2026-11-18.html');

const title = '🗒️ ひろみメモIの並び：やること削除・フリースペースが上（承認済みモック・2026-11-18）';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail){
  if (cond) { pass++; return; }
  fail++; fails.push('        ' + name + (detail ? '  ' + detail : ''));
}
function at(s){ return SRC.indexOf(s); }

/* 画面の本体だけ（<body> から）を見る。<script> の中の文字と混ざらないように */
const BODY_START = SRC.indexOf('<div id="unlocked-view"');
const SCRIPT_START = SRC.indexOf('<script>', BODY_START);
const BODY = SRC.slice(BODY_START, SCRIPT_START > 0 ? SCRIPT_START : undefined);

/* ① やることの箱が無い */
ok('①やることの入力欄（todo-input）が無い', BODY.indexOf('id="todo-input"') < 0);
ok('①やることの置き場（todo-flat）が無い', BODY.indexOf('id="todo-flat"') < 0);
ok('①「終了した業務」の置き場（done-list）が無い', BODY.indexOf('id="done-list"') < 0);
ok('①「✅ やること」の見出しが無い', BODY.indexOf('>✅ やること<') < 0);
ok('①「いつやる？」の選択が無い', BODY.indexOf('いつやる？') < 0);

/* ② 並び：伝言板 → フリースペース → 大切なメモ */
const iBoard = BODY.indexOf('id="bd-head"');
const iFree  = BODY.indexOf('id="free-space-text"');
const iImp   = BODY.indexOf('id="imp-input"');
ok('②伝言板・フリースペース・大切なメモが全部ある', iBoard >= 0 && iFree >= 0 && iImp >= 0,
   '（bd-head:' + iBoard + ' free:' + iFree + ' imp:' + iImp + '）');
ok('②フリースペースは伝言板の下', iBoard < iFree);
ok('②大切なメモはフリースペースの下', iFree < iImp, '（free:' + iFree + ' imp:' + iImp + '）');
ok('②フリースペースの箱は1つだけ', BODY.split('id="free-space-text"').length - 1 === 1);
ok('②大切なメモの箱は1つだけ', BODY.split('id="imp-input"').length - 1 === 1);

/* ③ 説明パネル */
ok('③説明の見出しは「メモ・ゆかさんとの伝言板」', BODY.indexOf('メモ・ゆかさんとの伝言板') >= 0);
ok('③説明から「メモ・やること・」が消えている', BODY.indexOf('メモ・やること・') < 0);
ok('③説明の「書く」の行に「✅ やること」が無い', BODY.indexOf('✅ やること<small>') < 0);
const iZzFree = BODY.indexOf('<span class="zz-b">🖊 フリースペース</span>');
const iZzImp  = BODY.indexOf('<span class="zz-b">⭐ 大切なメモ');
ok('③説明の「書く」の行は フリースペース → 大切なメモ の順', iZzFree >= 0 && iZzImp >= 0 && iZzFree < iZzImp,
   '（free:' + iZzFree + ' imp:' + iZzImp + '）');

/* ④ フリースペースの説明文 */
ok('④説明文は「大切なメモに当てはまらない、なんでも自由に書ける場所です」', BODY.indexOf('大切なメモに当てはまらない、なんでも自由に書ける場所です') >= 0);
ok('④説明文に「やること・大切なメモに当てはまらない」は残っていない', BODY.indexOf('やること・大切なメモに当てはまらない') < 0);

/* ⑤ 本物の関数を、箱が無い画面で動かす（エラーで止まらないこと） */
(function(){
  const ctx = vm.createContext({
    console: console, String: String, Date: Date, Object: Object, Array: Array, JSON: JSON,
    document: { getElementById: function(){ return null; } },
    todos: [], openTodoPanel: null,
    daysAgo: function(){ throw new Error('daysAgo が呼ばれました（置き場が無いのに先へ進んでいます）'); },
    esc: function(s){ return String(s); }
  });
  ctx.window = ctx; ctx.globalThis = ctx;
  let kowareta = null;
  try {
    vm.runInContext(H.cut(SRC, 'renderDoneArchive'), ctx);
    vm.runInContext(H.cut(SRC, 'renderTodos'), ctx);
  } catch (e) { kowareta = '関数を取り出せません：' + e.message; }
  ok('⑤renderTodos / renderDoneArchive を取り出せる', !kowareta, kowareta || '');
  if (!kowareta) {
    let err = null;
    try { vm.runInContext('renderDoneArchive(); renderTodos();', ctx); } catch (e) { err = e.message; }
    ok('⑤置き場が無くても renderTodos / renderDoneArchive はエラーで止まらない', !err, err ? '（' + err + '）' : '');
    let err2 = null;
    try { vm.runInContext('todos=[{id:"a",text:"x",color:"doneArc",reminderDate:"2026-11-01"}]; renderTodos();', ctx); } catch (e) { err2 = e.message; }
    ok('⑤古いやることデータが残っていても止まらない', !err2, err2 ? '（' + err2 + '）' : '');
  }
})();

/* ⑥ データは消していない（読む先のシート名はそのまま。消す処理を足していない） */
ok('⑥SHEET_TODO（付箋メモIやること）の定義は残っている', at("const SHEET_TODO = '付箋メモIやること'") >= 0);
ok('⑥シートを消す処理（deleteSheet）を足していない', at('deleteSheet') < 0);

/* ⑦ 承認済みモックが正本として置いてある */
ok('⑦mocks/mock_ひろみメモ_2026-11-18.html がある', fs.existsSync(MOCK_PATH));
if (fs.existsSync(MOCK_PATH)) {
  const M = fs.readFileSync(MOCK_PATH, 'utf8');
  ok('⑦モックと同じ説明文（フリースペース）', M.indexOf('大切なメモに当てはまらない、なんでも自由に書ける場所です') >= 0);
  ok('⑦モックと同じ説明の見出し', M.indexOf('メモ・ゆかさんとの伝言板') >= 0);
  const mFree = M.indexOf('🖊 フリースペース</span>'), mImp = M.indexOf('⭐ 大切なメモ（');
  ok('⑦モックでも フリースペース → 大切なメモ の順', mFree >= 0 && mImp >= 0 && mFree < mImp);
}

/* ⑧ 版（oos-version）を上げてある */
ok('⑧oos-version が 2026-11-18-01', at('<meta name="oos-version" content="2026-11-18-01">') >= 0);

if (fail) {
  console.log('  ★ ' + title + ' PASS ' + pass + ' / FAIL ' + fail);
  fails.forEach(x => console.log(x));
  process.exitCode = 1;
} else {
  console.log('  ✅ ' + title + ' PASS ' + pass + ' / FAIL 0');
}
