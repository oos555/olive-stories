/* ══════════════════════════════════════════════════════════════════════
   承認済みモックと実装の突き合わせ道具（node版）

   使い方:
     node tests/対照表を作る.js 承認済みモック.html 実装.html

   これは mock-gate-rules 同梱の compare_mock.py（python版）と
   【同じやり方】を node に写したものです。このパソコンに python が
   入っていないため、node で走る形を用意しました。

   やること:
     両方のHTMLから「画面に見える文字」を機械的に抜き出して左右で突き合わせます。
       ・見出し（h1〜h6）
       ・表の列名（th）
       ・ボタンの文言（button／input type=button,submit,reset）
       ・タブ・ラベル・選択肢（label, option, summary, legend）
     抜き出しはコードから機械的に行います。記憶・要約・自己申告は入りません。

   判定:
     全カテゴリ一致 → 「✅ 全行一致」・終了コード 0
     1つでも不一致 → 「❌ 不一致あり」・終了コード 1（この状態での納品は禁止）

   限界（正直に）:
     この道具は「HTMLに直接書かれた文字」だけを見ます。
     JavaScript が後から作る列・ボタン・文言は見えません。
     両方0件のカテゴリは「この道具では確認できていない」印です。
     その部分は、行番号つきの引用による手動確認で必ず補ってください。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');

const HEADINGS = ['h1','h2','h3','h4','h5','h6'];
const CAPTURE  = ['th','button','label','option','summary','legend'].concat(HEADINGS);
const CATEGORIES = [['見出し','headings'], ['表の列名(th)','th'], ['ボタンの文言','buttons'], ['ラベル・選択肢・タブ','labels']];

function unescapeHtml(s){
  return String(s)
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
}
function norm(s){ return unescapeHtml(s).split(/\s+/).filter(Boolean).join(' '); }

/* HTMLをなめて、見える文字を集める（script/style の中は無視する） */
function extract(path){
  const html = fs.readFileSync(path, 'utf8');
  const out = { headings:[], th:[], buttons:[], labels:[] };
  const stack = [];            // {tag, buf}
  let skip = 0;                // script/style の深さ
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)\/?>/g;
  let last = 0, m;
  while((m = re.exec(html)) !== null){
    const text = html.slice(last, m.index);
    if(text && skip === 0 && stack.length) stack[stack.length-1].buf.push(text);
    last = re.lastIndex;
    if(m[0].startsWith('<!--')) continue;
    const tag = String(m[1]).toLowerCase();
    const closing = m[0][1] === '/';
    const attrs = m[2] || '';
    if(tag === 'script' || tag === 'style'){ skip += closing ? -1 : 1; if(skip < 0) skip = 0; continue; }
    if(!closing){
      if(tag === 'input'){
        const t = (attrs.match(/type\s*=\s*"([^"]*)"|type\s*=\s*'([^']*)'/i)||[]);
        const type = (t[1]||t[2]||'').toLowerCase();
        if(['button','submit','reset'].indexOf(type) >= 0){
          const v = (attrs.match(/value\s*=\s*"([^"]*)"|value\s*=\s*'([^']*)'/i)||[]);
          const val = norm(v[1]||v[2]||'');
          if(val) out.buttons.push(val);
        }
      }
      if(CAPTURE.indexOf(tag) >= 0 && !/\/>$/.test(m[0])) stack.push({tag:tag, buf:[]});
    } else {
      if(stack.length && stack[stack.length-1].tag === tag){
        const it = stack.pop();
        const t = norm(it.buf.join('').replace(/<[^>]*>/g,''));
        if(!t) continue;
        if(HEADINGS.indexOf(it.tag) >= 0) out.headings.push(t);
        else if(it.tag === 'th') out.th.push(t);
        else if(it.tag === 'button') out.buttons.push(t);
        else out.labels.push(t);
      }
    }
  }
  return out;
}

/* 並び順も含めて比べる（いちばん長い共通の並びを残し、外れたものを差分にする） */
function compareLists(a, b){
  const n = a.length, m = b.length;
  const dp = Array.from({length:n+1}, () => new Array(m+1).fill(0));
  for(let i=n-1; i>=0; i--) for(let j=m-1; j>=0; j--)
    dp[i][j] = (a[i] === b[j]) ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  const diffs = [];
  let i = 0, j = 0;
  while(i < n && j < m){
    if(a[i] === b[j]){ i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]) diffs.push(['モックにあるが実装にない（または順序が違う）', a[i++]]);
    else diffs.push(['実装にあるがモックにない（または順序が違う）', b[j++]]);
  }
  while(i < n) diffs.push(['モックにあるが実装にない（または順序が違う）', a[i++]]);
  while(j < m) diffs.push(['実装にあるがモックにない（または順序が違う）', b[j++]]);
  return diffs;
}

const [mockPath, implPath] = process.argv.slice(2);
if(!mockPath || !implPath){
  console.log('使い方: node tests/対照表を作る.js 承認済みモック.html 実装.html');
  process.exit(2);
}
const mock = extract(mockPath), impl = extract(implPath);
const line = '='.repeat(60);
console.log(line);
console.log('承認済みモック ↔ 実装 対照結果');
console.log('  モック: ' + mockPath);
console.log('  実装  : ' + implPath);
console.log(line);

let anyDiff = false; const unchecked = [];
CATEGORIES.forEach(function(c){
  const jp = c[0], key = c[1];
  const a = mock[key], b = impl[key];
  console.log('\n■ ' + jp + '  (モック ' + a.length + ' 件 / 実装 ' + b.length + ' 件)');
  if(a.length === 0 && b.length === 0){
    console.log('  (両方0件 — この道具では確認できていない。JSが画面を作る部分は手動確認へ)');
    unchecked.push(jp);
    return;
  }
  const diffs = compareLists(a, b);
  if(!diffs.length){ console.log('  ✅ 一致（順序も含めて）'); return; }
  anyDiff = true;
  console.log('  ❌ 不一致:');
  diffs.forEach(function(d){ console.log('    - ' + d[0] + ': 「' + d[1] + '」'); });
});

console.log('\n' + line);
if(anyDiff){
  console.log('❌ 不一致あり — この状態での納品は禁止。実装をモックに合わせて直し、再実行すること。');
  console.log(line);
  process.exit(1);
}
console.log('✅ この道具で見える範囲は全行一致。');
if(unchecked.length){
  console.log('⚠ ただし ' + unchecked.join('、') + ' は0件で未確認。JSが作る部分の手動確認（行番号つき引用）を必ず添えること。');
}
console.log(line);
process.exit(0);
