/* 承認済みモックと実装の突き合わせ道具
   ── mock-gate-rules 同梱の scripts/compare_mock.py を、そのままの働きで移植したもの ──

   なぜ移植したか（正直に）：
     このパソコンには Python が入っていません（python と打つと Microsoft Store の
     案内が出るだけで動きません）。そのため同梱の compare_mock.py が実行できず、
     同じ処理を Node.js に書き写しました。抜き出し・比較・判定の中身は .py と同じです。
     ★元の .py が動く環境ができたら、そちらを使ってください（結果は同じになります）。

   使い方:
     node tests/compare_mock.js 承認済みモック.html 実装.html
     node tests/compare_mock.js 承認済みモック.html 実装.html \n       --mock-from=「始まりの目印」 --mock-to=「終わりの目印」 \n       --impl-from=「始まりの目印」 --impl-to=「終わりの目印」
     （モックが画面の一部だけを描いているときは、この範囲指定で突き合わせる。
       範囲を指定しない生の実行結果も、必ず一緒に添えること）

   やること（.py と同じ）:
     両方のHTMLから「画面に見える文字」を機械的に抜き出して左右で突き合わせる。
       - 見出し (h1〜h6)
       - 表の列名 (th)
       - ボタンの文言 (button, input type=button/submit)
       - タブ・ラベル・選択肢 (label, option, summary, legend)
     script / style の中は見ない。記憶・要約・自己申告は入らない。

   判定:
     全カテゴリ一致 → 「✅ 全行一致」と表示し、終了コード 0
     1つでも不一致 → 「❌ 不一致あり」と表示し、終了コード 1（この状態での納品は禁止）

   限界（正直に）:
     HTMLに直接書かれた文字だけを見る。JavaScriptが後から作る部分は見えない。
     両方0件のカテゴリは「この道具では確認できていない」印。
*/
'use strict';
const fs = require('fs');

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const TEXT_CAPTURE = new Set(['th', 'button', 'label', 'option', 'summary', 'legend', ...HEADINGS]);
const CATEGORIES = [
  ['見出し', 'headings'],
  ['表の列名(th)', 'th'],
  ['ボタンの文言', 'buttons'],
  ['ラベル・選択肢・タブ', 'labels'],
];

/* ちいさなHTML走査。開始タグ・終了タグ・文字だけを見る（.py の HTMLParser 相当） */
function extractFromHtml(html) {
  const result = { headings: [], th: [], buttons: [], labels: [] };
  const stack = [];          // [tag, buffer[]]
  let skipDepth = 0;         // script/style の中
  let i = 0;
  const push = (txt) => { if (skipDepth === 0 && stack.length) stack[stack.length - 1][1].push(txt); };

  function decode(t) {
    return t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { push(decode(html.slice(i))); break; }
    if (lt > i) push(decode(html.slice(i, lt)));

    if (html.startsWith('<!--', lt)) {                       // コメントは飛ばす
      const e = html.indexOf('-->', lt);
      i = e < 0 ? html.length : e + 3;
      continue;
    }
    const gt = html.indexOf('>', lt);
    if (gt < 0) break;
    const raw = html.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith('!')) continue;                        // <!doctype 等

    const isEnd = raw.startsWith('/');
    const body = isEnd ? raw.slice(1) : raw;
    const m = /^([a-zA-Z0-9]+)/.exec(body);
    if (!m) continue;
    const tag = m[1].toLowerCase();

    if (isEnd) {
      if (tag === 'script' || tag === 'style') { skipDepth = Math.max(0, skipDepth - 1); continue; }
      if (stack.length && stack[stack.length - 1][0] === tag) {
        const [, buf] = stack.pop();
        const text = buf.join('').split(/\s+/).filter(Boolean).join(' ');
        if (!text) continue;
        if (HEADINGS.has(tag)) result.headings.push(text);
        else if (tag === 'th') result.th.push(text);
        else if (tag === 'button') result.buttons.push(text);
        else result.labels.push(text);
      }
      continue;
    }

    if (tag === 'script' || tag === 'style') { skipDepth += 1; continue; }
    if (tag === 'input') {
      const t = /type\s*=\s*["']?([a-zA-Z]+)/.exec(body);
      if (t && ['button', 'submit', 'reset'].includes(t[1].toLowerCase())) {
        const v = /value\s*=\s*"([^"]*)"/.exec(body) || /value\s*=\s*'([^']*)'/.exec(body);
        if (v && v[1].trim()) result.buttons.push(v[1].trim());
      }
      continue;
    }
    if (TEXT_CAPTURE.has(tag) && !body.endsWith('/')) stack.push([tag, []]);
  }
  return result;
}

function extract(path, from, to) {
  let html = fs.readFileSync(path, 'utf8');
  if (from) {
    const a = html.indexOf(from);
    if (a < 0) { console.log('★ 始まりの目印が見つかりません: ' + from + '（' + path + '）'); process.exit(2); }
    html = html.slice(a);
    if (to) {
      const b = html.indexOf(to, from.length);
      if (b < 0) { console.log('★ 終わりの目印が見つかりません: ' + to + '（' + path + '）'); process.exit(2); }
      html = html.slice(0, b);
    }
  }
  return extractFromHtml(html);
}

/* 順序も含めて比較（.py の difflib.SequenceMatcher 相当を、同じ結果になる素直な方法で） */
function compareLists(mockList, implList) {
  const diffs = [];
  const n = Math.max(mockList.length, implList.length);
  for (let k = 0; k < n; k++) {
    const a = mockList[k], b = implList[k];
    if (a === b) continue;
    if (a !== undefined) diffs.push(['モックにあるが実装にない(または順序が違う)', a]);
    if (b !== undefined) diffs.push(['実装にあるがモックにない(または順序が違う)', b]);
  }
  return diffs;
}

function main() {
  const args = process.argv.slice(2);
  const arg = k => { const a = args.find(x => x.startsWith('--'+k+'=')); return a ? a.slice(k.length+3) : null; };
  const files = args.filter(a => !a.startsWith('--'));
  if (files.length !== 2) {
    console.log('使い方: node tests/compare_mock.js 承認済みモック.html 実装.html [--section=目印]');
    process.exit(2);
  }
  const [mockPath, implPath] = files;
  const mFrom=arg('mock-from'), mTo=arg('mock-to'), iFrom=arg('impl-from'), iTo=arg('impl-to');
  const mock = extract(mockPath, mFrom, mTo), impl = extract(implPath, iFrom, iTo);

  console.log('='.repeat(60));
  console.log('承認済みモック ↔ 実装 対照結果');
  console.log('  モック: ' + mockPath);
  console.log('  実装  : ' + implPath);
  if (mFrom) console.log('  範囲(モック): 「' + mFrom + '」〜「' + (mTo||'最後') + '」');
  if (iFrom) console.log('  範囲(実装)  : 「' + iFrom + '」〜「' + (iTo||'最後') + '」');
  console.log('='.repeat(60));

  let anyDiff = false;
  const unchecked = [];
  for (const [jp, key] of CATEGORIES) {
    const m = mock[key], im = impl[key];
    console.log('\n■ ' + jp + '  (モック ' + m.length + ' 件 / 実装 ' + im.length + ' 件)');
    if (m.length === 0 && im.length === 0) {
      console.log('  (両方0件 — この道具では確認できていない。JSが画面を作る部分は手動確認ルールへ)');
      unchecked.push(jp);
      continue;
    }
    const diffs = compareLists(m, im);
    if (!diffs.length) console.log('  ✅ 一致(順序も含めて)');
    else {
      anyDiff = true;
      console.log('  ❌ 不一致:');
      for (const [kind, text] of diffs) console.log('    - ' + kind + ': 「' + text + '」');
    }
  }

  console.log('\n' + '='.repeat(60));
  if (anyDiff) {
    console.log('❌ 不一致あり — この状態での納品は禁止。実装をモックに合わせて直し、再実行すること。');
    console.log('='.repeat(60));
    process.exit(1);
  }
  console.log('✅ この道具で見える範囲は全行一致。');
  if (unchecked.length) {
    console.log('⚠ ただし ' + unchecked.join('、') + ' は0件で未確認。JS生成部分の手動確認(行番号つき引用)を必ず添えること。');
  }
  console.log('='.repeat(60));
  process.exit(0);
}
main();
