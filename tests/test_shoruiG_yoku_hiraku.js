/* 書類Ｇ「よく開くところ」の見張り（2026-08-24 新設）

   承認済みモック：mocks/mock_書類G_よく開くところ_2026-08-24.html

   ★決めごと（2026-08-24 ひろみさん承認・変更禁止）
     ・農園ごとの枠（novavera／mozzicato／le tre colonne）は画面から出さない
       理由：書類は【年度別記録】の中にまとめて入れていて、その中で農家さんごとに
             分かれている。農園ごとのフォルダにあちこち仕舞うと、取り出すときに
             一つずつフォルダを開けなければならず面倒だから。
     ・出すのは3つだけ。左から
         ① 📥 01_輸入／00_共通
         ② 🤝 02_販売・取引先
         ③ 🗄 その他（検討中・過去）  ← 灰色（.sub）
     ・見出しは「⭐ よく開くところ」、説明文は「よく開くフォルダを、ここからひと押しで開けます。」
     ・🚨 naccs のボタンは見出しの横に残す
     ・FARMS / FARM_SUB は【検索のためだけ】に残す（画面には出さない）

   ここでは、本物の documents.html から renderFavs と FAVS を切り出して実際に動かし、
   出てきたHTMLを承認済みモックの中身と1対1で突き合わせます。
   （compare_mock.js では見えない「JSが作る部分」の対照表がこれです） */
const fs = require('fs');
const vm = require('vm');
const R = require('path').join(__dirname, '..') + '/';
const H = require('./harness');

let ok = 0, ng = 0; const bad = [];
function t(name, got, want){ if(String(got) === String(want)) ok++; else { ng++; bad.push(name + '　期待:' + want + '　実際:' + got); } }

const MOCK = R + 'mocks/mock_書類G_よく開くところ_2026-08-24.html';
const IMPL = R + 'documents.html';
const mockSrc = fs.readFileSync(MOCK, 'utf8');
const implSrc = fs.readFileSync(IMPL, 'utf8');

/* ── 本物の renderFavs を動かして、画面に出るHTMLを作る ── */
let produced = '';
{
  const box = H.makeSandbox({}).box;
  box.$ = function(){ return { set innerHTML(v){ produced = v; }, get innerHTML(){ return produced; } }; };
  const ctx = vm.createContext(box);
  vm.runInContext('var BASE="/OOS書類";', ctx);
  vm.runInContext(H.cutVar(implSrc, 'FAVS'), ctx);
  vm.runInContext(H.cut(implSrc, 'renderFavs'), ctx);
  box.renderFavs();
}
t('◎ 本物の renderFavs が動く', produced.length > 0, true);

/* ── 出てきたHTMLから、枠ごとの中身を取り出す ── */
function tiles(html){
  const out = [];
  /* モックはリンクを止めてあるので openDbx が入っていません。
     どちらのファイルからも同じように枠を取り出せる形にします。 */
  const re = /<a class="fav([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while((m = re.exec(html))){
    const inner = m[3];
    const op = /openDbx\('([^']+)'\)/.exec(m[2]);
    const b = /<b>([\s\S]*?)<\/b>/.exec(inner);
    const spans = [...inner.matchAll(/<span(?: class="path")?>([\s\S]*?)<\/span>/g)].map(x => x[1].trim());
    out.push({
      sub: m[1].indexOf('sub') >= 0,
      path: op ? op[1] : '',
      title: b ? b[1].trim() : '',
      desc: spans[0] || '',
      pathText: spans[1] || ''
    });
  }
  return out;
}
const impl = tiles(produced);
/* モック側は「新しい画面」の <main> だけを見る（古い画面と説明文は範囲外） */
const mockNew = mockSrc.slice(mockSrc.indexOf('<main>'), mockSrc.indexOf('</main>', mockSrc.indexOf('<main>')));
const mock = tiles(mockNew);

console.log('\n■ 承認済みモック ↔ 実装（JSが作る部分）の対照表');
console.log('  枠の数　モック ' + mock.length + ' 件 / 実装 ' + impl.length + ' 件');
t('枠の数が同じ', impl.length, mock.length);
t('枠は3つ', impl.length, 3);

const COLS = [['タイトル','title'], ['説明','desc'], ['パスの表示','pathText'], ['灰色か','sub']];
for(let i = 0; i < Math.max(mock.length, impl.length); i++){
  const m = mock[i] || {}, p = impl[i] || {};
  console.log('  ── ' + (i+1) + '枠目 ──');
  COLS.forEach(function(c){
    const mv = String(m[c[1]]), pv = String(p[c[1]]);
    console.log('    ' + (mv === pv ? '✅' : '❌') + ' ' + c[0].padEnd(6) + ' モック「' + mv + '」／実装「' + pv + '」');
    t((i+1) + '枠目の' + c[0], pv, mv);
  });
}

/* ── 実際に開くDropboxの場所（モックはリンクを止めてあるので、実装側だけ中身を確かめる）── */
console.log('\n■ 押したときに開く場所（実装）');
const WANT_PATHS = ['/OOS書類/01_輸入/00_共通', '/OOS書類/02_販売・取引先', '/OOS書類/01_輸入/その他'];
impl.forEach(function(p, i){
  console.log('    ' + (p.path === WANT_PATHS[i] ? '✅' : '❌') + ' ' + (i+1) + '枠目 → ' + p.path);
  t((i+1) + '枠目が開く場所', p.path, WANT_PATHS[i]);
});
t('パスの表示と、実際に開く場所が食い違っていない',
  impl.every(function(p){ return '/' + p.pathText === p.path; }), true);

/* ── 画面の外側（HTMLに直接書いてある部分）── */
console.log('\n■ 見出し・説明文・naccs');
t('見出しが「⭐ よく開くところ」', implSrc.indexOf('      ⭐ よく開くところ') >= 0, true);
t('説明文がモックのまま', implSrc.indexOf('<p class="note">よく開くフォルダを、ここからひと押しで開けます。</p>') >= 0, true);
t('🚨 naccs のボタンが残っている', implSrc.indexOf('>🚨 naccs</a>') >= 0, true);
t('naccs が開く場所は変えていない', implSrc.indexOf("openDbx('/OOS書類/01_輸入/00_naccs【輸入時最重要】')") >= 0, true);

/* ── 農園の枠が画面に戻っていないか（先祖返りの見張り）── */
console.log('\n■ 農園の枠が戻っていないか');
t('農園の枠を描く場所（farmGrid）が無い', implSrc.indexOf('farmGrid') >= 0, false);
t('農園の枠を描く関数（renderFarms）が無い', /function\s+renderFarms/.test(implSrc), false);
t('農園の枠のCSS（.farm-box{）が無い', implSrc.indexOf('.farm-box{') >= 0, false);
t('起動時に renderFavs を呼んでいる', implSrc.indexOf('renderFavs(); renderCats(); renderDocs();') >= 0, true);
t('「農園ボックス」の見出しが残っていない', implSrc.indexOf('🌳 農園ボックス') >= 0, false);

/* ── 消していないもの（機能を黙って削らない）── */
console.log('\n■ 消していないもの');
t('FARMS は検索用に残っている', /const FARMS=\[/.test(implSrc), true);
t('FARM_SUB は検索用に残っている', /const FARM_SUB=\[/.test(implSrc), true);
t('検索が FARMS を見ている', implSrc.indexOf('FARMS.forEach(f=>{') >= 0, true);
t('検索用だと分かる印がある', implSrc.indexOf('★検索専用。画面には出しません') >= 0, true);
t('「🗂 カテゴリで開く」は残っている', implSrc.indexOf('🗂 カテゴリで開く') >= 0, true);
t('カテゴリの 01_輸入/00_共通 は残っている', implSrc.indexOf('"01_輸入/00_共通",desc:') >= 0, true);
t('カテゴリの 02_販売・取引先 は残っている', implSrc.indexOf('"02_販売・取引先",desc:') >= 0, true);
t('💬 打ち合わせ は残っている', implSrc.indexOf('💬 打ち合わせ') >= 0, true);
t('📺 メディア出演 は残っている', implSrc.indexOf('📺 メディア出演') >= 0, true);
t('書類台帳の分類（novavera等）は残っている', implSrc.indexOf('<option>01_輸入/novavera_トルコ</option>') >= 0, true);

/* ── 検索が今までどおり農園を見つけられるか（本物の doSearch の中の判定を使う）── */
console.log('\n■ 検索で農園が今までどおり見つかるか');
{
  const box = H.makeSandbox({}).box;
  const ctx = vm.createContext(box);
  vm.runInContext('var BASE="/OOS書類";', ctx);
  vm.runInContext(H.cutVar(implSrc, 'FARM_SUB'), ctx);
  vm.runInContext(H.cutVar(implSrc, 'FARMS'), ctx);
  const FARMS = box.FARMS, FARM_SUB = box.FARM_SUB;
  ['novavera', 'mozzicato', 'le tre colonne'].forEach(function(q){
    const hit = FARMS.some(function(f){
      return f.label.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
    });
    t('「' + q + '」で見つかる', hit, true);
  });
  t('農園の中のフォルダ（通関・検疫）も残っている', FARM_SUB.indexOf('03_通関・検疫') >= 0, true);
}

/* ── 版 ── */
console.log('\n■ 版');
{
  const v = JSON.parse(fs.readFileSync(R + 'version.json', 'utf8')).pages['documents.html'];
  const meta = (/name="oos-version" content="([^"]+)"/.exec(implSrc) || [])[1];
  t('version.json と documents.html の版が一致', meta, v);
}

console.log('\n===== 書類Ｇ よく開くところ =====');
console.log('PASS ' + ok + ' / FAIL ' + ng);
if(ng){ console.log('--- FAIL の中身 ---'); bad.forEach(function(b){ console.log('  ' + b); }); process.exit(1); }
