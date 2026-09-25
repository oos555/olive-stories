/* ══════════════════════════════════════════════════════════════════════
   📣 マーケ H：ネタは社長専用スプシ「📗 マーケ ネタ帳」に1行ずつ（2026-09-25 ひろみさん承認）
   モック：mocks/mock_マーケ_ネタはスプシに1行ずつ_2026-09-25.html
   「今ずらずらっと溜まっていってるけど、これ重たくなる」「アプリは最新のものを１種類ずつ載せるだけ」
   「ネタ帳のアーカイブが不要になるね。投稿プランはそのままとっておいて」
   本物の関数（loadNeta / renderNeta）を動かして確かめます。
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const H = require('./harness');
const F = path.join(__dirname, '..', 'eigyo', 'marketing.html');
const src = fs.readFileSync(F, 'utf8');
let pass = 0, fail = 0; const fails = [];
function eq(name, a, b){ if(a === b){ pass++; } else { fail++; fails.push(name + '  期待:' + b + '  実際:' + a); } }

async function ugokasu(kotae, opt){
  opt = opt || {};
  const els = { 'neta-list': { innerHTML:'' }, 'neta-when': { textContent:'' }, 'neta-sps': { href:'#', style:{ display:'none' } } };
  const sent = [];
  const box = { console, JSON, String, Promise, Date: opt.Date || Date, MAIN_GAS_URL: 'https://gas.example/exec',
    document: { getElementById: id => els[id] },
    oosSavedPw: () => (opt.pw === undefined ? 'KAGI' : opt.pw),
    fetch: async (u, o) => { sent.push(JSON.parse(o.body)); return { json: async () => kotae }; } };
  vm.createContext(box);
  box.esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  vm.runInContext(['loadNeta', 'netaKyou', 'netaIma', 'renderNeta'].map(n => H.cut(src, n)).join('\n'), box);
  await box.loadNeta();
  return { els, sent };
}

(async function(){
  try{
    const kotae = { status:'ok', saishinTouroku:'2026-09-26', url:'https://docs.google.com/spreadsheets/d/X/edit',
      bunrui:['①話題性','②歴史','③最新','④成分・効能','⑤気になる'],
      latest:[ { bunrui:'①話題性', touroku:'2026-09-26', bunsho:'スペインの新しい研究', link:'https://a.example', shutenBi:'2026-09-24', tsukaisaki:'note, instagram' },
               { bunrui:'②歴史', nai:true }, { bunrui:'③最新', bunsho:'c', shutenBi:'' }, { bunrui:'④成分・効能', bunsho:'d' }, { bunrui:'⑤気になる', bunsho:'e' } ] };
    const a = await ugokasu(kotae);
    eq('① 社長の鍵をつけて「分類ごとの最新1件」だけを聞く（全部は読まない）', JSON.stringify(a.sent[0]), JSON.stringify({ action:'mktNetaLatest', password:'KAGI' }));
    eq('① 分類ごとに1件ずつ（5件）出る', (a.els['neta-list'].innerHTML.match(/class="item"/g) || []).length, 5);
    const html = a.els['neta-list'].innerHTML;
    eq('① 出典の日付・使い先（複数）が出る', /出典の日付 2026-09-24　／　使い先：note, instagram/.test(html), true);
    eq('① 文章が出る', /スペインの新しい研究/.test(html), true);
    eq('① 出典のリンクが出る', /href="https:\/\/a.example"/.test(html), true);
    eq('① まだ無い分類は「まだありません」', /②歴史<\/span><\/div><div class="item-text" style="color:#8a8578">まだありません/.test(a.els['neta-list'].innerHTML), true);
    eq('① 出典の日付が空なら（不明）', /出典の日付 （不明）/.test(a.els['neta-list'].innerHTML), true);
    eq('① 全部のネタはスプシで見る（リンク）', a.els['neta-sps'].href === kotae.url && a.els['neta-sps'].style.display === 'inline-block', true);

    /* 13時を過ぎても今日の分が無ければ知らせる（日本時間 2026-09-27 14:00 のつもり） */
    const T = class extends Date { constructor(...x){ super(...(x.length ? x : [Date.UTC(2026, 8, 27, 5, 0, 0)])); } static now(){ return Date.UTC(2026, 8, 27, 5, 0, 0); } };
    const b = await ugokasu(kotae, { Date: T });
    eq('② 13時を過ぎて今日の分が無いと「⚠️ 今日はまだ入っていません」', /⚠️ 今日はまだ入っていません/.test(b.els['neta-when'].textContent), true);
    const T2 = class extends Date { constructor(...x){ super(...(x.length ? x : [Date.UTC(2026, 8, 26, 5, 0, 0)])); } static now(){ return Date.UTC(2026, 8, 26, 5, 0, 0); } };
    const c = await ugokasu(kotae, { Date: T2 });
    eq('② 今日の分が入っていれば知らせない', /今日はまだ/.test(c.els['neta-when'].textContent), false);

    const d = await ugokasu({ status:'error', message:'パスワードが違います' });
    eq('③ 読めなかったときは「読み込み中」のままにしない', /読み込めませんでした（パスワードが違います）/.test(d.els['neta-list'].innerHTML), true);
    const e = await ugokasu(null, { pw: null });
    eq('③ 鍵が無ければ聞きに行かない', e.sent.length, 0);
  }catch(err){ fail++; fails.push('動かせませんでした：' + err.message); }

  /* ④ タブ：今日のネタ・投稿プランだけ（今週の登録・ネタ帳アーカイブはやめた） */
  const tabs = [...src.matchAll(/<button class="tab[^"]*" onclick="showPanel\('(\w+)'/g)].map(m => m[1]);
  eq('④ タブは 今日のネタ → 投稿プラン の2つ', tabs.join(','), 'neta,plan');
  /* ⑤ 投稿プランは1文字も変えない（2026-09-25 時点の中身と同じ） */
  const cut = s => s.slice(s.indexOf('<div id="panel-plan" class="panel">'), s.indexOf('<div class="toast"')).replace(/\r/g, '');
  const plan = cut(src);
  eq('⑤ 投稿プランの中身がそのまま（曜日テーマ7行・投稿ペース）', plan.length === 1060 && /<tr><th>日<\/th><td>フリー\(日常・審査員活動・メディア・お客様の声\)<\/td><\/tr>/.test(plan) && /週1回\(木曜目安\)/.test(plan), true);

  console.log('===== マーケ ネタ帳（社長専用スプシ・今日のネタ） =====');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(x => console.log('  ' + x)); }
  process.exit(fail ? 1 : 0);
})();
