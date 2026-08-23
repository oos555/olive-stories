/* 本番ファイルから「本物の関数」をそのまま抜き出して動かす土台。
   テスト用に関数を書き直さない（別物を測ってしまう事故を防ぐため）。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const LIVE = path.join(__dirname, '..');   /* ★リポジトリ直下のファイルをそのまま読む */

function read(f){ return fs.readFileSync(path.join(LIVE, f), 'utf8'); }

/* 関数定義を名前で見つけて、波かっこの数を数えて丸ごと切り出す */
function cut(src, name){
  const re = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if(!m) throw new Error('関数が見つからない: ' + name);
  let i = src.indexOf('{', m.index + m[0].length - 1);
  let depth = 0, inStr = null, inLine = false, inBlock = false, inRe = false;
  let j = i;
  for(; j < src.length; j++){
    const c = src[j], p = src[j-1], n = src[j+1];
    if(inLine){ if(c === '\n') inLine = false; continue; }
    if(inBlock){ if(c === '*' && n === '/'){ inBlock = false; j++; } continue; }
    if(inStr){ if(c === '\\'){ j++; continue; } if(c === inStr) inStr = null; continue; }
    if(c === '/' && n === '/'){ inLine = true; j++; continue; }
    if(c === '/' && n === '*'){ inBlock = true; j++; continue; }
    if(c === '"' || c === "'" || c === '`'){ inStr = c; continue; }
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(depth === 0){ j++; break; } }
  }
  return src.slice(m.index, j);
}

function cutVar(src, name){
  const re = new RegExp('(?:^|\\n)\\s*(?:var|let|const)\\s+' + name + '\\s*=');
  const m = re.exec(src);
  if(!m) throw new Error('変数が見つからない: ' + name);
  // 行末（配列/オブジェクトなら閉じるまで）
  let i = src.indexOf('=', m.index) + 1;
  let depth = 0, j = i, inStr = null;
  for(; j < src.length; j++){
    const c = src[j];
    if(inStr){ if(c === '\\'){ j++; continue; } if(c === inStr) inStr = null; continue; }
    if(c === '"' || c === "'" || c === '`'){ inStr = c; continue; }
    if('([{'.includes(c)) depth++;
    else if(')]}'.includes(c)) depth--;
    else if(c === ';' && depth === 0){ break; }
    else if(c === '\n' && depth === 0){ break; }
  }
  return 'var ' + name + ' = ' + src.slice(i, j) + ';';
}

/* 何を触っても落ちない「なんでも」オブジェクト（画面まわりの身代わり） */
const ANY = new Proxy(function(){}, {
  get(t, k){
    if(k === Symbol.toPrimitive) return () => '';
    if(k === 'then') return undefined;
    if(k === 'value' || k === 'textContent' || k === 'innerHTML') return '';
    if(k === 'classList') return ANY;
    if(k === 'style') return ANY;
    return ANY;
  },
  set(){ return true; },
  apply(){ return ANY; },
  has(){ return true; }
});

function makeSandbox(extra){
  const box = Object.assign({
    console, Math, Date, JSON, parseInt, parseFloat, isNaN, String, Number,
    Object, Array, Boolean, RegExp, Error, Set, Map, Promise, encodeURIComponent, decodeURIComponent,
    document: ANY, window: {}, alert(){}, confirm(){ return true; }, prompt(){ return ''; },
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    fetch(){ return Promise.resolve({ json(){ return Promise.resolve({ status:'ok' }); } }); },
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    navigator: ANY, location: ANY
  }, extra || {});
  box.window = box;
  box.globalThis = box;
  const ctx = vm.createContext(box);
  /* ★2026-08-24 消費税の【親】oos-zei.js は、どのテストでも必ず入れておく。
     アプリ側は自分で税率を判定せず OOS_ZEI を呼ぶだけになっているため。★消さないでください */
  vm.runInContext(read('oos-zei.js'), ctx);
  return { box, ctx };
}

function runZaiko(ctx){
  const z = read('oos-zaiko.js');
  vm.runInContext(z, ctx);
}

/* 消費税の【親】。makeSandbox が自動で入れるが、自前で箱を作ったときはこれを呼ぶ */
function runZei(ctx){
  vm.runInContext(read('oos-zei.js'), ctx);
}

module.exports = { read, cut, cutVar, makeSandbox, runZaiko, runZei, ANY, LIVE };
