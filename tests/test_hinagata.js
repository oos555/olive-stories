/* ══════════════════════════════════════════════════════════════════════
   📄 お客様に渡す「お届け先リスト」のひな形（2026-09-25 ひろみさん承認）
   「お客様に渡すスプシは、一度開いてブランクであることを確認しないと、使えないようにしたい。
   　一瞬でも別の人が書いたものが見えたら情報漏洩になる」
   モック：mocks/mock_受注A_お届け先リストひな形リンク_2026-09-25.html（第2版・Q1 OK・Q2 OK）
   受注Ａの本物の関数（hinagataLinkCopy）を、サーバーの答えを差し替えて動かします。
   ① 原本が空 → リンクをコピーし、✅の文言
   ② 原本に記入 → コピーしない・⛔の文言（何行目の何か／リンクはコピーしていません／公開も止めました）
   ③ サーバーに届かない → コピーしない
   ④ 画面にボタン2つと注意書きがある（モックの文言どおり）
   ══════════════════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0; const fails = [];
function eq(name, a, b){ if(a === b){ pass++; } else { fail++; fails.push(name + '  期待:' + b + '  実際:' + a); } }

async function tamesu(kotae, nageru){
  const els = { 'hinagata-copy-btn': { textContent:'📋 お客様に渡すリンクをコピー', disabled:false }, 'hinagata-kekka': { innerHTML:'' } };
  const copied = [];
  const box = { console, JSON, String, Promise, Date, encodeURIComponent,
    GAS_URL: 'https://gas.example/exec',
    document: { getElementById: (id) => els[id] },
    navigator: { clipboard: { writeText: async (t) => { copied.push(t); } } },
    oosGetJson: async () => { if(nageru) throw new Error('通信'); return kotae; } };
  vm.createContext(box);
  vm.runInContext(H.cut(idx, 'esc') + '\n' + H.cutVar(idx, 'OOS_HINAGATA_ID') + ';\n' + H.cut(idx, 'hinagataLinkCopy'), box);
  await box.hinagataLinkCopy();
  return { copied, html: els['hinagata-kekka'].innerHTML, btn: els['hinagata-copy-btn'] };
}

(async function(){
  const LINK = 'https://docs.google.com/spreadsheets/d/XXX/copy';
  try{
    const a = await tamesu({ status:'ok', kara:true, at:'9/25 14:32', copyUrl: LINK });
    eq('① 原本が空なら、お客様に渡すリンクをコピーする', a.copied.join(), LINK);
    eq('① 文言「✅ 原本は空でした（…に確かめました）。お客様に渡すリンクをコピーしました。」', /✅ 原本は空でした（9\/25 14:32 に確かめました）。お客様に渡すリンクをコピーしました。そのままメールやLINEに貼りつけてください。/.test(a.html), true);
    eq('① 押したあとボタンは元にもどる', a.btn.disabled === false && a.btn.textContent === '📋 お客様に渡すリンクをコピー', true);

    const b = await tamesu({ status:'ok', kara:false, at:'9/25 14:32', nokori:[{ gyou:8, basho:['お届け先 お名前','商品①'] }] });
    eq('② 原本に記入があれば、リンクはコピーしない', b.copied.length, 0);
    eq('② 文言：何行目の何が残っているか', /⛔ 原本に記入が残っています（8行目：お届け先 お名前・商品①）。/.test(b.html), true);
    eq('② 文言：リンクはコピーしていません・公開も止めました', /リンクはコピーしていません/.test(b.html) && /原本の公開も<b>止めました<\/b>（誰にも見えません）/.test(b.html), true);
    eq('② 文言：消してもう一度押す案内', /「✏️ ひな形（原本）を開く」から消して、もう一度「📋」を押してください。/.test(b.html), true);

    const c = await tamesu({ status:'ok', kara:false, nokori:[1,2,3,4,5].map(n => ({ gyou: 7+n, basho:['ご住所'] })) });
    eq('② 残りが多いときは「ほか◯行」', /ほか2行/.test(c.html) && c.copied.length === 0, true);

    const d = await tamesu({ status:'error', message:'ひな形がまだありません' });
    eq('③ サーバーがエラーなら、コピーしない', d.copied.length, 0);
    const e = await tamesu(null, true);
    eq('③ 通信できなければ、コピーしない', e.copied.length === 0 && /リンクはコピーしていません/.test(e.html), true);
    const f = await tamesu({ status:'ok', copyUrl: LINK });
    eq('③ 「空」とはっきり返ってこなければ、コピーしない', f.copied.length, 0);
  }catch(err){ fail++; fails.push('動かせませんでした：' + err.message); }

  /* ④ 画面の中身（モック第2版の文言どおり・置き場所は PDFを入れる枠の上） */
  const i0 = idx.indexOf('<div class="sec">お客様からいただいた発送先リスト（PDF）を取り込む</div>');
  const i1 = idx.indexOf('📋 お客様に渡すリンクをコピー', i0);
  const i2 = idx.indexOf('✏️ ひな形（原本）を開く', i0);
  const i3 = idx.indexOf('PDFファイルをここにドロップ', i0);
  eq('④ 置き場所：PDFの見出しの下・PDFを入れる枠の上にボタン2つ', i0 >= 0 && i0 < i1 && i1 < i2 && i2 < i3, true);
  eq('④ 注意書き「原本には、お届け先を書かないでください。」', idx.indexOf('<b>原本には、お届け先を書かないでください。</b>', i0) > 0 && idx.indexOf('<b>原本には、お届け先を書かないでください。</b>', i0) < i3, true);

  console.log('===== お届け先リストのひな形 =====');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  if(fails.length){ console.log('--- FAIL の中身 ---'); fails.forEach(x => console.log('  ' + x)); }
  process.exit(fail ? 1 : 0);
})();
