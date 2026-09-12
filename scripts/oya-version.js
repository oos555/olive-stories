/* ══════════════════════════════════════════════════════════════════════
   🔑 親ファイルの合言葉（?v=）を、中身から計算して全部そろえる道具
   ──────────────────────────────────────────────────────────────────────
   ★2026-09-12 ひろみさん：「PDFは、さっきからおねがいしてるけど一切直ってない」

   起きていたこと：
   　oos-doc.js の中身を直したのに、読み込む側の  ?v=20260912h  を上げ忘れた。
   　ブラウザは古いファイルを使い続けるので、直したものが画面に届かない。
   　さらに oos-shorui-kimari.js は、アプリによって ?v= が違っていて、
   　【アプリごとに決めごとが違う】状態になっていた。

   直し方：合言葉を【親ファイルの中身から計算】する。
   　中身が1文字でも変われば合言葉が変わるので、上げ忘れが起きない。
   　見張り（tests/test_mihari_soten.js ①）が、合言葉のずれを見つけて落とします。

   使い方：  node scripts/oya-version.js          … いまのずれを見るだけ
   　　　　  node scripts/oya-version.js --naosu  … 全部のHTMLをそろえる
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

/* 親ファイル（HTMLから ?v= 付きで読み込まれるもの） */
function oyaFiles(){
  return fs.readdirSync(ROOT)
    .filter(function(f){ return /^oos-.*\.js$/.test(f); })
    .sort();
}

/* 合言葉＝親ファイルぜんぶの中身から計算（改行の形はそろえて数える） */
function aikotoba(){
  const h = crypto.createHash('md5');
  oyaFiles().forEach(function(f){
    h.update(f);
    h.update(fs.readFileSync(path.join(ROOT, f), 'utf8').split('\r\n').join('\n'));
  });
  return 'p' + h.digest('hex').slice(0, 10);
}

/* HTMLの中の oos-◯◯.js?v=… を探す */
const TAG = /(oos-[a-z0-9-]+\.js\?v=)([A-Za-z0-9._-]+)/g;

function htmlFiles(){
  return fs.readdirSync(ROOT).filter(function(f){ return /\.html$/.test(f); });
}

function shirabe(){
  const ima = aikotoba();
  const zure = [];
  htmlFiles().forEach(function(f){
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    let m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(s)) !== null){
      if (m[2] !== ima) zure.push({ file: f, tag: m[1] + m[2] });
    }
  });
  return { ima: ima, zure: zure };
}

function naosu(){
  const ima = aikotoba();
  let kazu = 0;
  htmlFiles().forEach(function(f){
    const p = path.join(ROOT, f);
    const raw = fs.readFileSync(p, 'utf8');
    const CRLF = raw.indexOf('\r\n') >= 0;
    let s = raw.split('\r\n').join('\n');
    const mae = s;
    s = s.replace(TAG, function(_all, atama){ return atama + ima; });
    if (s !== mae){
      kazu++;
      if (CRLF) s = s.split('\n').join('\r\n');
      fs.writeFileSync(p, s);
      console.log('  そろえました： ' + f);
    }
  });
  console.log('合言葉： ' + ima + '　／　直したHTML： ' + kazu + ' 個');
}

if (require.main === module){
  if (process.argv.indexOf('--naosu') >= 0){ naosu(); }
  else {
    const r = shirabe();
    console.log('いまの合言葉： ' + r.ima);
    if (!r.zure.length) console.log('✅ ぜんぶそろっています');
    else {
      console.log('★ ずれているところ： ' + r.zure.length + ' か所');
      r.zure.forEach(function(x){ console.log('   ' + x.file + ' … ' + x.tag); });
      console.log('　→ node scripts/oya-version.js --naosu でそろえてください');
    }
  }
}

module.exports = { aikotoba, shirabe, oyaFiles };
