/* ══════════════════════════════════════════════════════════════════════
   🛠 GAS（コード.js）の直し ── 2026-10-16
   ──────────────────────────────────────────────────────────────────────
   ひろみさん（2026-10-16）：
   「原さんがバサラ専用のやつでA列のチェックをちゃんと入れてくれて、受付が済んでるわけだから、
   　あとやることは、ゆかちゃんにその情報が1個と、ちゃんと受注したよって1個と、
   　ゆかちゃんが赤いボタンを青いボタンに変えて、倉庫に情報を流すこと。それだけ。
   　本部のLINEには『バサラから発注がありました。倉庫＆OOS発送連絡スプシを見て、内容チェックして、
   　OKだったら正式発注してください』みたいな簡単なLINEが飛ばないとダメだよね」

   いままで：2026-09-13 に本部LINEを止めたとき（OOS_HONBU_LINE_OFF）、この知らせも【とめる】に
   　　　　　入っていたので、原さんの☑のあと本部には何も届かず、「倉庫連絡ストップ記録」に残るだけだった。
   これから：原さんの☑の知らせ【だけ】を、止め木を通らない道（oosLineToHonbuAlways_）に移す。
   　　　　　ほかの止めた知らせ（在庫なし・入荷・臨時入庫・キャンセル）はそのまま止めたまま。

   使い方（ひろみさんのPC・PowerShell）：
     cd C:\Users\cucin\OneDrive\ドキュメント\olive-stories
     git pull
     cd ..\olive-stories-gas
     npx @google/clasp pull
     node ..\olive-stories\scripts\gas_naoshi_2026-10-16.js コード.js
     npx @google/clasp push --force
   ★push だけで効きます（原さんの☑は onEdit トリガー＝保存した最新コードで動く）。デプロイは不要です。

   やること（全部「文字どおりの置き換え」。見つかる回数が1回でなければ何もせずに止まります）
     ① oosBasaraOrderAccept_：☑の知らせを oosLineToHonbu_ → oosLineToHonbuAlways_ に（1語）
     ② 止め木の説明：「とめる」の表から「のこす」の表へ、この知らせを移す（コメントだけ）
     ③ oosLineToHonbuAlways_ のそばの説明：使う場所が2つになったと書く（コメントだけ）
   直す前に コード_before_basara_shirase_2026-10-16.js.bak を同じフォルダに残します。
   ══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const file = process.argv[2] || path.join(__dirname, 'コード.js');
if(!fs.existsSync(file)){ console.error('見つかりません：' + file); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');
const moto = src;

if(src.indexOf("oosLineToHonbuAlways_('📦 バサラスターから発注がありました（") >= 0){
  console.log('もう直してあります（☑の知らせは oosLineToHonbuAlways_ です）。何もしませんでした。');
  process.exit(0);
}

const kaeta = [];
function kae(namae, a, b){
  const n = src.split(a).length - 1;
  if(n !== 1) throw new Error(namae + '：目印が ' + n + ' 回見つかりました（1回のはず）。何も変えていません。\n目印：' + a.slice(0, 80));
  src = src.split(a).join(b);
  kaeta.push(namae);
}

try{
/* ① ☑の知らせを、止め木を通らない道へ（1語） */
kae('① ☑の知らせを oosLineToHonbuAlways_ に（止め木を通らない）',
`  /* ★2026-09-09 ひろみさん指示：メモは単独のLINEにせず、発注のお知らせに一言そえる */
  try{ oosLineToHonbu_('📦 バサラスターから発注がありました（'+num+'・'+d[OOS_BC.name-1]+' 様）'`,
`  /* ★2026-09-09 ひろみさん指示：メモは単独のLINEにせず、発注のお知らせに一言そえる */
  /* ★2026-10-16 ひろみさん決定：原さんの☑のあと、本部（ゆか＆ひろみ）に必ず届くようにする。
     2026-09-13 に本部LINEを止めたとき（OOS_HONBU_LINE_OFF）この知らせも止まっていて、
     ゆかちゃんが発注に気づけなかった（10/16 14:34 の受付がそれ）。
     この1通【だけ】止め木を通らない道（oosLineToHonbuAlways_）で送る。ほかの止めた知らせはそのまま。
     ★oosLineToHonbu_ に戻さないでください（戻すと、また止まります） */
  try{ oosLineToHonbuAlways_('📦 バサラスターから発注がありました（'+num+'・'+d[OOS_BC.name-1]+' 様）'`);

/* ② 止め木の説明（コメントだけ） */
kae('② 止め木の説明：とめる → のこす へ移す',
`   ★止まるもの（ひろみさん「とめる」）
     ・📦 バサラスターから発注がありました（バサラ取込・自動）
     ・📤 「在庫がありません」の連絡を送りました（受注Ａのボタン）`,
`   ★止まるもの（ひろみさん「とめる」）
     ・📤 「在庫がありません」の連絡を送りました（受注Ａのボタン）`);
kae('② 止め木の説明：のこすものに足す',
`   ★★のこすもの（ひろみさん「のこし」）★★
     ・🧾 バサラの請求書ができました（月末・自動）
     　　これだけは oosLineToHonbuAlways_ で送っています（この止め木を通りません）。`,
`   ★★のこすもの（ひろみさん「のこし」）★★
     ・🧾 バサラの請求書ができました（月末・自動）
     ・📦 バサラスターから発注がありました（原さんが発注シートのA列に☑したとき）
     　　★2026-10-16 ひろみさん決定で「のこす」に移しました（ゆかちゃんが発注に気づけなかったため）
     この2つだけ oosLineToHonbuAlways_ で送っています（この止め木を通りません）。`);

/* ③ のこす道のそばの説明（コメントだけ） */
kae('③ のこす道の説明：使う場所は2つ',
`/* ★止め木を通さずに本部へ送る道。★いまは【バサラの請求書ができました】だけが使います
   （2026-09-13 ひろみさん「請求書はのこし」）。ほかのお知らせをここに足さないでください。 */`,
`/* ★止め木を通さずに本部へ送る道。使うのは2つだけ：
   【バサラの請求書ができました】（2026-09-13 ひろみさん「請求書はのこし」）
   【バサラスターから発注がありました】（2026-10-16 ひろみさん決定・原さんの☑のとき）
   ほかのお知らせをここに足さないでください（見張りが2か所だけかを数えています）。 */`);
}catch(e){ console.error(String(e.message || e)); process.exit(1); }

/* 控えを残してから書く */
const bak = path.join(path.dirname(file), 'コード_before_basara_shirase_2026-10-16.js.bak');
if(!fs.existsSync(bak)) fs.writeFileSync(bak, moto);
fs.writeFileSync(file, src);

/* 文法の確かめ */
try{ execFileSync(process.execPath, ['--check', file], { stdio:'pipe' }); }
catch(e){
  fs.writeFileSync(file, moto);
  console.error('文法エラーになったので元に戻しました：\n' + String(e.stderr || e));
  process.exit(1);
}
console.log('直しました：' + file);
kaeta.forEach(l => console.log('　' + l));
console.log('控え：' + bak);
console.log('次：npx @google/clasp push --force（原さんの☑は onEdit なので、これだけで効きます。デプロイは不要）');
