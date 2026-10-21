/* ═══════════════════════════════════════════════════════════
   🎁 サンプル台帳（営業のお隣）と RTカードの窓口（2026-10-21 ひろみさん承認）
   承認モック：mocks/mock_営業K_サンプル台帳_2026-10-21.html（「この状態で作ってください」）
   ひろみさん：「誰に何をいつどんな風にサンプルをあげてどういう目的であげたのか」「RTの場合はRTのカードの中に」
   　　　　　　「牛肉がどこのものか」「次のアクションはいつか・結果はどうだったか」
   　　　　　　「サンプル発送先は営業の中に入れてもらおうかな」「東京ベイコートの料理長は麻生ではなくて浅野さん」

   見張ること
     ① GAS：スプシ「🎁 サンプル発送先」は 13列そのまま＋右に8列（14〜21列目）
     ② GAS：受注Ａから自動で入る行に 区分・施設・品目・どこのもの・渡し方 が入る（RT伝票ならRT）
     ③ GAS：保存は atoAri:true のときだけ 14〜21列目を書く（古い画面の保存で空にしない）
     ④ GAS：できごと記録の 🎁サンプル は台帳にも1行（2回保存しても1行・写真は台帳に入れない）
     ⑤ GAS：今までの行の形を直す窓口は、区分が空の行だけ・何度流しても同じ
     ⑥ 画面：営業のお隣に 🎁 サンプル の部屋／見積Ｍからは一覧が消えている／鍵の見方はお隣と同じ
     ⑦ RT台帳：施設カードに🎁枠（読むだけ・たたむ・追いかけ日すぎは赤で先に）／?q= で絞れる／浅野さん
     ⑧ 版：meta と version.json がそろっている
   本物の関数（GAS・rt_chef_daicho.html）をそのまま切り出して動かします。
   ═══════════════════════════════════════════════════════════ */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const LIVE = H.LIVE;
let pass = 0, fail = 0; const fails = [];
function eq(name, a, b){ if(a === b){ pass++; } else { fail++; fails.push(name + '  期待:' + JSON.stringify(b) + '  実際:' + JSON.stringify(a)); } }
function ok(name, c){ eq(name, !!c, true); }
function read(f){ return fs.readFileSync(path.join(LIVE, f), 'utf8'); }

/* ── 身代わりのスプシ（test_gas.js と同じ作り） ── */
function Sh(){ this.c = []; this.bg = {}; }
Sh.prototype = {
  getLastRow(){ for(let r = this.c.length; r > 0; r--){ if((this.c[r-1] || []).some(v => v !== '' && v != null)) return r; } return 0; },
  getRange(r, c, nr, nc){ const sh = this; nr = nr || 1; nc = nc || 1;
    const get = f => { const o = []; for(let i = 0; i < nr; i++){ const a = []; for(let j = 0; j < nc; j++){ const v = (sh.c[r-1+i] || [])[c-1+j]; a.push(f(v == null ? '' : v)); } o.push(a); } return o; };
    const rg = { getValues(){ return get(v => v); }, getValue(){ return get(v => v)[0][0]; },
      setValues(vs){ vs.forEach((row, i) => { sh.c[r-1+i] = sh.c[r-1+i] || []; row.forEach((v, j) => { sh.c[r-1+i][c-1+j] = v; }); }); return rg; },
      setValue(v){ return rg.setValues([[v]]); }, setBackground(b){ for(let i = 0; i < nr; i++) sh.bg[r+i] = b; return rg; },
      setFontColor(){ return rg; }, setFontWeight(){ return rg; }, setNumberFormat(){ return rg; }, setNote(){ return rg; } };
    return rg; },
  setFrozenRows(){}, setColumnWidth(){}, getSheetId(){ return 1; }, getParent(){ return { getUrl(){ return 'https://x'; } }; },
  appendRow(row){ this.c.push(row.slice()); }, getDataRange(){ const sh = this; return { getValues(){ return sh.c.map(r => r.slice()); } }; },
  setName(n){ this.name = n; return this; }
};

let gasSrc = null;
try{ gasSrc = H.readGas(); }catch(e){ console.log('  GASのファイルが手元にありません → GASの見張り①〜⑤は飛ばしました'); }

if(gasSrc){
  const kanriTabs = {}, shachoTabs = {}, mainTabs = {};
  const mk = tabs => ({ getSheetByName(n){ return tabs[n] || null; }, insertSheet(n){ return (tabs[n] = new Sh()); }, getSheets(){ return Object.keys(tabs).map(k => tabs[k]); }, getId(){ return 'S'; }, getEditors(){ return []; }, getName(){ return 'n'; } });
  const props = { OOS_SAMPLE_FILE_ID:'SHACHO', OOS_KANRI_FILE_ID:'K' };
  const ctx = vm.createContext({ console, Math, JSON, String, Number, Object, Array, RegExp, Error, parseInt, Date,
    SpreadsheetApp:{ openById(id){ return id === 'SHACHO' ? mk(shachoTabs) : (id === 'K' ? mk(kanriTabs) : mk(mainTabs)); }, create(){ return mk(shachoTabs); } },
    PropertiesService:{ getScriptProperties(){ return { getProperty(k){ return props[k] || null; }, setProperty(k, v){ props[k] = v; } }; } },
    LockService:{ getScriptLock(){ return { waitLock(){}, releaseLock(){} }; } },
    DriveApp:{}, Utilities:{ formatDate(d){ const p = n => ('0' + n).slice(-2); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); } },
    Logger:{ log(){} }, ContentService:{}, HtmlService:{}, ScriptApp:{ getProjectTriggers(){ return []; }, newTrigger(){ return { timeBased(){ return { everyHours(){ return { create(){} }; } }; } }; } }, CacheService:{}, UrlFetchApp:{}, Session:{}, MailApp:{}, GmailApp:{} });
  let yometa = true;
  try{ vm.runInContext(gasSrc, ctx); }catch(e){ yometa = false; console.log('  GASを読み込めない', e.message); }
  if(yometa){
    /* 商品マスタ（生産地）の身代わり */
    const pm = mk(mainTabs).insertSheet('商品マスタ');
    pm.c.push(['id','sku','name','group','origin']);
    pm.c.push([1, 'TRL250', 'トゥリリエ 250ml', 'オイル', 'スペイン']);
    pm.c.push([2, 'AIB500', 'アイバリック 500ml', 'オイル', 'イタリア']);

    /* ① 見出し */
    const A = ctx.OOS_SAMPLE_ATAMA;
    eq('① 見出しは21列', A.length, 21);
    eq('① 今までの13列は順番ごとそのまま', A.slice(0, 13).join('|'), '送った日|相手|何を|有償・無償|伝票番号|目的|渡した見積|次の追いかけ日|追いかけの内容|状況|自由メモ|注文ID（さわらない）|終了した日');
    eq('① 右に足した8列（承認モックの列）', A.slice(13).join('|'), '相手の区分|施設・会社|担当者|品目の種類|どこのもの|渡し方|結果・感想|だれが渡した');
    const sh = ctx.oosSampleSheet_();
    eq('① 新しく作るシートの1行目に21列の見出しが入る', (sh.c[0] || []).length, 21);
    /* 13列のままの古い見出しは、開いたときに21列に書き直される（行の中身はさわらない） */
    sh.c[0] = A.slice(0, 13); sh.c[1] = ['2026-09-20', 'A社', 'トゥリリエ 250ml ×1', '無償', 'TK-1', '', '', '', '', '送った', '', 'ord_1', ''];
    ctx.oosSampleSheet_();
    eq('① 13列だけの見出しは21列に書き直す', (sh.c[0] || []).length, 21);
    eq('① そのとき行の中身はさわらない', sh.c[1][1] + '/' + sh.c[1][11], 'A社/ord_1');

    /* ② 受注Ａから自動で入る行 */
    const od = mk(mainTabs).insertSheet('受注データ'); od.c.push(['ID']);
    const J = function(id, client, bangou, kubun, ex){ const r = []; r[0] = id; r[1] = client; r[2] = bangou; r[3] = kubun; r[11] = 'shipped'; r[12] = '2026-10-15'; r[13] = '2026-10-16'; r[19] = JSON.stringify(ex); return r; };
    od.c.push(J('ord_rt', 'サンクチュアリコート高山 ｲﾀﾘｱﾝﾚｽﾄﾗﾝ', 'RT-20261015-1111', 'RT（ホテル）', { recipientName:'サンクチュアリコート高山 ｲﾀﾘｱﾝﾚｽﾄﾗﾝ', lines:[{ sku:'TRL250', productName:'トゥリリエ 250ml', bottles:2, giftType:'sample_free' }] }));
    od.c.push(J('ord_tk', '○○トラットリア', 'TK-20261018-2222', '定価', { recipientName:'○○トラットリア', lines:[{ sku:'TRL250', productName:'トゥリリエ 250ml', bottles:1, giftType:'sample_free' }, { sku:'AIB500', productName:'アイバリック 500ml', bottles:1, giftType:'sample_paid' }, { sku:'ORG250', productName:'オルガニック 250ml', bottles:6, giftType:'normal' }] }));
    od.c.push(J('ord_no', 'ふつうの注文', 'TK-20261018-3333', '定価', { lines:[{ sku:'ORG250', productName:'オルガニック 250ml', bottles:1, giftType:'normal' }] }));
    const n = ctx.oosSampleJidou_(sh);
    eq('② サンプルの注文だけ足す（ふつうの注文は足さない）', n, 2);
    const rt = sh.c.find(r => r[11] === 'ord_rt'), tk = sh.c.find(r => r[11] === 'ord_tk');
    eq('② RT伝票の行：区分RT・施設＝発注元（部署つき）・品目オリーブオイル・どこのもの＝生産地・渡し方＝発送', [rt[13], rt[14], rt[15], rt[16], rt[17], rt[18]].join('|'), 'RT|サンクチュアリコート高山 ｲﾀﾘｱﾝﾚｽﾄﾗﾝ||オリーブオイル|スペイン|発送');
    eq('② それ以外の行：区分お取引先・施設＝相手', [tk[13], tk[14], tk[16], tk[18]].join('|'), 'お取引先|○○トラットリア|オリーブオイル|発送');
    eq('② どこのものは、サンプルの行の生産地だけ（ふつうの行の商品は入れない・重なりは1つ）', tk[17], 'スペイン、イタリア');
    eq('② 何を・有償無償は今までどおり', tk[2] + '|' + tk[3], 'トゥリリエ 250ml ×1、アイバリック 500ml ×1|有償・無償');
    eq('② 2回動かしても二重に足さない', ctx.oosSampleJidou_(sh), 0);

    /* ③ 保存 */
    ctx.oosSampleSave({ id:'ord_rt', mokuteki:'冬コース', jokyo:'反応待ち' });
    eq('③ atoAri の無い保存（古い画面）は 14〜21列目をさわらない', rt[13] + '|' + rt[17], 'RT|スペイン');
    eq('③ 目的・状況は今までどおり入る', rt[5] + '|' + rt[9], '冬コース|反応待ち');
    ctx.oosSampleSave({ id:'ord_rt', mokuteki:'冬コース', jokyo:'反応待ち', atoAri:true, kubun:'RT', shisetsu:'サンクチュアリコート高山', tantou:'○○総料理長', hinmoku:'牛肉', doko:'○○牧場（△△県）', watashikata:'発送', kekka:'脂の甘みを気に入ってくださった', dare:'ひろみ' });
    eq('③ atoAri:true の保存（新しい画面）は 14〜21列目を書く', sh.c.find(r => r[11] === 'ord_rt').slice(13).join('|'), 'RT|サンクチュアリコート高山|○○総料理長|牛肉|○○牧場（△△県）|発送|脂の甘みを気に入ってくださった|ひろみ');
    const te = ctx.oosSampleSave({ atoAri:true, okuttaBi:'2026-10-15', aite:'△△シェフ（芦屋ベイコート倶楽部）', nani:'黒毛和牛 サーロイン 約500g', yushou:'無償', mokuteki:'冬コース', kubun:'RT', shisetsu:'芦屋ベイコート倶楽部', tantou:'△△シェフ', hinmoku:'牛肉', doko:'○○牧場', watashikata:'発送', dare:'ひろみ' });
    const teRow = sh.c.find(r => r[11] === te.id);
    eq('③ ＋1行たす：idはM＋時刻・21列ぜんぶ入る', String(te.id).charAt(0) === 'M' && teRow.length === 21 && teRow[16] === '牛肉' && teRow[14] === '芦屋ベイコート倶楽部', true);
    const L = ctx.oosSampleList();
    const lr = L.rows.find(r => r.id === 'ord_rt');
    eq('③ 一覧は 14〜21列目も返す', [lr.kubun, lr.shisetsu, lr.tantou, lr.hinmoku, lr.doko, lr.watashikata, lr.kekka, lr.dare].join('|'), 'RT|サンクチュアリコート高山|○○総料理長|牛肉|○○牧場（△△県）|発送|脂の甘みを気に入ってくださった|ひろみ');

    /* ④ できごと記録の 🎁サンプル */
    const mae = sh.getLastRow();
    /* 社長の合言葉はGASの const から取る（テストに書かない・表示しない） */
    let pw = ''; try{ pw = vm.runInContext('(typeof GROUP_PASSWORDS!=="undefined" && GROUP_PASSWORDS.secret) || ""', ctx); }catch(e){}
    const rec = { id:'k1', date:'2026-10-20', who:'○○総料理長', fac:'芦屋ベイコート倶楽部', type:'sample', content:'トゥリリエ 250ml を2本', img1:'data:image/jpeg;base64,xxxx' };
    const s1 = ctx.saveRtActivity(pw, rec);
    eq('④ できごと記録は今までどおり ok', s1.status, 'ok');
    eq('④ 台帳にも1行入る（返事に sample:ok）', s1.sample && s1.sample.status, 'ok');
    const kr = sh.c.find(r => r[11] === 'Kk1');
    eq('④ 入る中身：日付・相手（担当者（施設））・何を・無償・RT・施設・担当者・品目・どこのもの・訪問時・ひろみ',
       [kr[0], kr[1], kr[2], kr[3], kr[13], kr[14], kr[15], kr[16], kr[17], kr[18], kr[20]].join('|'),
       '2026-10-20|○○総料理長（芦屋ベイコート倶楽部）|トゥリリエ 250ml を2本|無償|RT|芦屋ベイコート倶楽部|○○総料理長|オリーブオイル|スペイン|訪問時|ひろみ');
    ok('④ 写真は台帳に入れない', !kr.some(v => /^data:image/.test(String(v))));
    ctx.saveRtActivity(pw, Object.assign({}, rec, { content:'トゥリリエ 250ml を3本' }));
    eq('④ 同じできごとを2回保存しても1行のまま（何をだけ直る）', sh.getLastRow() - mae, 1);
    eq('④ 何をが直る', sh.c.find(r => r[11] === 'Kk1')[2], 'トゥリリエ 250ml を3本');
    const s2 = ctx.saveRtActivity(pw, { id:'k2', date:'2026-10-20', who:'芦屋ベイコート倶楽部', type:'sample', content:'黒毛和牛 サーロイン' });
    const k2 = sh.c.find(r => r[11] === 'Kk2');
    eq('④ 相手が施設そのものなら 施設＝相手・担当者なし／牛肉は品目「牛肉」', k2[14] + '|' + k2[15] + '|' + k2[16], '芦屋ベイコート倶楽部||牛肉');
    const s3 = ctx.saveRtActivity(pw, { id:'k3', date:'2026-10-20', who:'芦屋ベイコート倶楽部', type:'talk', content:'お話' });
    eq('④ 🎁サンプル以外のできごとは台帳に入れない（sample は null）', s3.status === 'ok' && s3.sample === null, true);
    ok('④ 🎁サンプル以外のできごとで行が増えない', !sh.c.some(r => r[11] === 'Kk3'));

    /* ⑤ 形を直す窓口 */
    sh.c.push(['2026-09-24', 'エクシブ蓼科　洋食厨房料理長　小川良彦　', '唐辛子オイル 100ml ×1', '無償', 'RT-20260924-9381', 'レストランでの採用検討用', '③ RT専用価格リスト', '2026-10-09', '', '送った', '9/28発送', 'ord_old1', '']);
    sh.c.push(['2026-09-14', '中村先生', 'トゥリリエ 250ml ×1', '有償', 'TK-20260912-5577', '', '', '', '', '送った', '', 'ord_old2', '']);
    sh.c.push(['2026-08-28', '株式会社オリーブオイル・ストーリーズ', 'アイバリック 500ml ×5', '無償', 'TK-20260825-1312', 'RT、CG大阪用', '', '', '', '送った', '', 'ord_old3', '']);
    /* 区分が空の行＝①で足した ord_1 と、ここで足した3行の 4行。自動で入った行（ord_rt・ord_tk）や Kk1・Kk2 は区分が入っているので数えない */
    const d1 = ctx.oosSampleKatachiNaoshi(true);
    eq('⑤ &dry=1 は読むだけ（行は変わらない）', d1.naoshita === 4 && sh.c.find(r => r[11] === 'ord_old1').length === 13, true);
    const n1 = ctx.oosSampleKatachiNaoshi();
    eq('⑤ 区分が空の行だけ直す（もう入っている行は数えない）', n1.naoshita, 4);
    eq('⑤ 13列だけだった ord_1 も お取引先 になる', sh.c.find(r => r[11] === 'ord_1')[13], 'お取引先');
    const o1 = sh.c.find(r => r[11] === 'ord_old1'), o2 = sh.c.find(r => r[11] === 'ord_old2'), o3 = sh.c.find(r => r[11] === 'ord_old3');
    eq('⑤ RT伝票：区分RT・施設＝最初の語・担当者＝残り', [o1[13], o1[14], o1[15], o1[16], o1[18]].join('|'), 'RT|エクシブ蓼科|洋食厨房料理長 小川良彦|オリーブオイル|発送');
    eq('⑤ それ以外：お取引先・施設＝相手・どこのもの＝何をの商品の生産地', [o2[13], o2[14], o2[15], o2[17]].join('|'), 'お取引先|中村先生||スペイン');
    eq('⑤ 自社（オリーブオイル・ストーリーズ）は その他', o3[13], 'その他');
    eq('⑤ 目的・渡した見積・次の追いかけ日・メモはそのまま', [o1[5], o1[6], o1[7], o1[10]].join('|'), 'レストランでの採用検討用|③ RT専用価格リスト|2026-10-09|9/28発送');
    eq('⑤ 2回流しても何も変わらない', ctx.oosSampleKatachiNaoshi().naoshita, 0);
    /* doGet の窓口 */
    ok('⑤ 窓口 ?action=oosSampleKatachiNaoshi が doGet にある（&dry=1 つき）', H.cut(gasSrc, 'doGet').indexOf("'oosSampleKatachiNaoshi'") >= 0 && H.cut(gasSrc, 'doGet').indexOf('e.parameter.dry') >= 0);
  }
}

/* ⑥ 画面 */
{
  const sp = read('eigyo/sample.html'), ix = read('eigyo/index.html'), mt = read('mitsumori.html');
  ok('⑥ 営業のお隣に 🎁 サンプル の部屋（sample.html）がある', /href="sample\.html"/.test(ix) && /<span class="na">サンプル<\/span>/.test(ix));
  ok('⑥ サンプル台帳の見出し', /<h1>🎁 サンプル台帳<\/h1>/.test(sp));
  ok('⑥ ボタンは3つ（＋ 1行たす／この1行をたす／やめる）', /＋ 1行たす/.test(sp) && /この1行をたす/.test(sp) && />やめる</.test(sp));
  ok('⑥ だれにの区分は RT／お取引先／これからの方／その他', /<option value="rt">RT<\/option><option value="tori">お取引先<\/option><option value="mikomi" selected>これからの方<\/option><option value="sono">その他<\/option>/.test(sp));
  ok('⑥ 渡し方は 発送／手渡し／訪問時／注文に同梱', /<option>発送<\/option><option>手渡し<\/option><option>訪問時<\/option><option>注文に同梱<\/option>/.test(sp));
  ok('⑥ 状況の5つは今までと同じ（送った・反応待ち・商談中・成約・見送り）', /var JOKYO = \['送った','反応待ち','商談中','成約','見送り'\]/.test(sp));
  ok('⑥ 鍵の見方は営業のお隣と同じ（oos_atelier_ok か oos_unlock_secret）', /oos_atelier_ok/.test(sp) && /oos_unlock_secret/.test(sp));
  ok('⑥ 保存は atoAri:true を付ける（14〜21列目を書く印）', /atoAri:true/.test(sp) && /body\.atoAri = true/.test(sp));
  ok('⑥ ［終了］はスプシに残す（oosSampleOwari）', /oosSampleOwari/.test(sp));
  ok('⑥ 読み込み中は「ありません」と言わない', /⏳ サンプル台帳を読み込み中です…/.test(sp));
  ok('⑥ RTの施設▼は台帳と同じ16施設', /<option>サンクチュアリコート日光<\/option>/.test(sp) && /<option>メイプルポイントゴルフクラブ レストラン<\/option>/.test(sp));
  /* ★2026-10-22 ひろみさん「RTの施設の選択肢に 名古屋本社購買部 も入れておいて」 */
  ok('⑥ RTの施設▼に 名古屋本社購買部 がある（2026-10-22 ひろみさん）', /<option>名古屋本社購買部<\/option>/.test(sp));
  ok('⑥ 見積Ｍから一覧の関数が消えている（sampleYomu／sampleCard／teTasuHiraku）', !/function sampleYomu|function sampleCard|function teTasuHiraku/.test(mt));
  ok('⑥ 見積Ｍには引っ越し先のリンクが残る', /eigyo\/sample\.html/.test(mt));
  ok('⑥ 受注Ａの「サンプルの注文→すぐ足す」はそのまま', /oosSampleSync/.test(read('index.html')));
  /* 本物の関数を動かす：並び（追いかけ日すぎが先）としぼりこみ */
  const els = { list:{ innerHTML:'' }, count:{ textContent:'' } };
  const box = { console, JSON, String, Date, Math, Object, Array, encodeURIComponent, document:{ getElementById: id => els[id] || { options:[], value:'' } } };
  vm.createContext(box);
  /* esc は正規表現の中に " があり harness.cut が切れないので、同じ中身をここで定義（test_mkt_neta.js と同じやり方） */
  box.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  vm.runInContext(['KUBUN','KUBUN_GYAKU','HIN','HIN_JI','HIN_GYAKU','ST_CLS','JOKYO','WATASHI','DARE','ROWS','F','OPEN','today'].map(n => H.cutVar(sp, n)).join('\n')
    + '\n' + ['ymd','md','shirushi','te','isOsoi','owatta','whoJi','render','opt','r2Html','facOptionsHtml'].map(n => H.cut(sp, n)).join('\n'), box);
  box.today = new Date(2026, 9, 21);
  vm.runInContext('ROWS = [' +
    '{id:"ord_1",okuttaBi:"2026-10-18",aite:"○○トラットリア",nani:"トゥリリエ",yushou:"無償",oikakeBi:"2026-10-28",jokyo:"送った",kubun:"これからの方",shisetsu:"○○トラットリア",hinmoku:"オリーブオイル"},' +
    '{id:"M1",okuttaBi:"2026-10-15",aite:"芦屋",nani:"黒毛和牛",yushou:"無償",oikakeBi:"2026-10-19",jokyo:"反応待ち",kubun:"RT",shisetsu:"芦屋ベイコート倶楽部",hinmoku:"牛肉"},' +
    '{id:"ord_2",okuttaBi:"2026-09-30",aite:"有馬",nani:"アイバリック",yushou:"無償",oikakeBi:"",jokyo:"成約",kubun:"RT",shisetsu:"エクシブ有馬離宮",hinmoku:"オリーブオイル"},' +
    '{id:"ord_3",okuttaBi:"2026-09-01",aite:"終わった",nani:"x",yushou:"無償",oikakeBi:"",jokyo:"終了",kubun:"お取引先",shisetsu:"x",hinmoku:"オリーブオイル"}' +
    '].map(shirushi); render();', box);
  const html = els.list.innerHTML;
  eq('⑥ ふだんは追いかけ中だけ（成約・終了は出ない）＝2件', els.count.textContent, '2件（追いかけ中）');
  ok('⑥ 追いかけ日をすぎた行が赤で一番上', html.indexOf('row rt osoi') >= 0 && html.indexOf('id="row-1"') < html.indexOf('id="row-0"'));
  ok('⑥ すぎた行は「すぎた 10/19」', /<small>すぎた<\/small>10\/19/.test(html));
  vm.runInContext('F.s="owari"; render();', box);
  eq('⑥ 「成約・見送りも」で成約が出る（終了は出ない）', els.count.textContent, '3件');
  vm.runInContext('F.s="ima"; F.h="beef"; render();', box);
  eq('⑥ 🥩 でしぼると牛肉だけ', els.count.textContent, '1件（追いかけ中）');
  vm.runInContext('F.h=""; OPEN=1; render();', box);
  ok('⑥ ひらいた行に 結果・感想／次は／状況／RTカードで見る がある', /結果・感想/.test(els.list.innerHTML) && /rt_chef_daicho\.html\?q=/.test(els.list.innerHTML) && /💾 保存/.test(els.list.innerHTML) && /✅ 終了/.test(els.list.innerHTML));
}

/* ⑦ RT台帳の窓口 */
{
  const rt = read('rt_chef_daicho.html');
  ok('⑦ 施設カードに🎁枠（sampleWakuHtml）を出す', /sampleWakuHtml\(f\)/.test(rt) && /oilsHtml\(f\)\+barsHtml\(nowOils\(f\)\)\+monthHtml\(f\)\+/.test(rt));
  ok('⑦ 追いかけ日すぎがあるときだけ「次の一手」をサンプル優先に', /sampleOsoiAru\(f\)\) \? '<div class="tip tip-sam">次の一手：'\+sampleTip\(f\)/.test(rt));
  ok('⑦ 開いたときに台帳を読む（読むだけ・oosSampleList）', H.cut(rt, 'openMain').indexOf('sampleYomu()') >= 0 && H.cut(rt, 'sampleYomu').indexOf('action=oosSampleList') >= 0);
  ok('⑦ この画面に書く機能を付けない（oosSampleSave を呼ばない）', !/oosSampleSave/.test(rt));
  ok('⑦ ?q=施設名 で絞って開ける', /new URLSearchParams\(location\.search\)\.get\('q'\)/.test(rt));
  ok('⑦ できごと記録の 🎁サンプル は施設（fac）を添えて送る', H.cut(rt, 'saveKatsudo').indexOf('katFacOf(who)') >= 0);
  ok('⑦ 東京ベイコートの料理長の例は浅野さん（麻生ではない）', /料理長は浅野さん/.test(rt) && !/麻生/.test(rt));
  /* 本物の関数を動かす */
  const box = { console, JSON, String, Date, Math, Object, Array, curMode:'fac', renderDaicho(){}, GAS_URL:'x',
    FAC:{ '芦屋ベイコート倶楽部':{}, '東京ベイコート倶楽部':{} }, PEOPLE:[{ name:'○○総料理長', fac:'芦屋ベイコート倶楽部' }],
    nextTip(){ return 'いつもの文'; } };
  vm.createContext(box);
  box.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  vm.runInContext(['SAMPLES','SAMPLE_OPEN','SAMPLE_ST'].map(n => H.cutVar(rt, n)).join('\n') + '\n' + ['today','sampleMd','sampleOsoi','sampleRowsFor','sampleOsoiAru','sampleHin','sampleWakuHtml','sampleTip','katFacOf'].map(n => H.cut(rt, n)).join('\n'), box);
  box.today = () => '2026-10-21';
  vm.runInContext('SAMPLES=[' +
    '{okuttaBi:"2026-10-15",nani:"黒毛和牛 サーロイン 約500g",doko:"○○牧場",yushou:"無償",watashikata:"発送",tantou:"○○総料理長",mokuteki:"冬コース",jokyo:"反応待ち",oikakeBi:"2026-10-19",oikake:"電話で味の感想を聞く",shisetsu:"芦屋ベイコート倶楽部",hinmoku:"牛肉"},' +
    '{okuttaBi:"2026-06-02",nani:"トゥリリエ 250ml ×2",yushou:"無償",watashikata:"訪問時",jokyo:"成約",kekka:"7月から定期",shisetsu:"芦屋ベイコート倶楽部",hinmoku:"オリーブオイル"},' +
    '{okuttaBi:"2026-10-01",nani:"x",yushou:"無償",jokyo:"終了",shisetsu:"芦屋ベイコート倶楽部",hinmoku:"オリーブオイル"},' +
    '{okuttaBi:"2026-10-02",nani:"y",yushou:"無償",jokyo:"送った",oikakeBi:"2026-11-01",shisetsu:"サンクチュアリコート高山 ｲﾀﾘｱﾝﾚｽﾄﾗﾝ",hinmoku:"オリーブオイル"}];', box);
  const w = vm.runInContext('sampleWakuHtml("芦屋ベイコート倶楽部")', box);
  ok('⑦ 芦屋のカードに🎁枠が出る（終了は数えない＝2件）', /🎁 サンプル <span class="n">2件<\/span>/.test(w));
  ok('⑦ 追いかけ日すぎがあるので、たたまずに開いて赤', /class="rts open"/.test(w) && /⚠ 追いかけ日すぎ 1件/.test(w) && /がすぎています/.test(w));
  ok('⑦ 中身：🥩 牛肉・どこのもの・担当者・目的・結果', /🥩 <b>黒毛和牛 サーロイン 約500g<\/b>（○○牧場）/.test(w) && /→ ○○総料理長/.test(w) && /冬コース/.test(w) && /7月から定期/.test(w));
  ok('⑦ 書くのは営業のお隣（ここでは書けない）', /書くのは営業のお隣 🎁/.test(w));
  eq('⑦ サンプルが無い施設には枠を出さない', vm.runInContext('sampleWakuHtml("東京ベイコート倶楽部")', box), '');
  ok('⑦ 部署つきの施設名（施設名で始まる）もその施設のカードに入る', /1件/.test(vm.runInContext('sampleWakuHtml("サンクチュアリコート高山")', box)));
  ok('⑦ 追いかけ日すぎが無い施設は、たたんで出す', /class="rts"/.test(vm.runInContext('sampleWakuHtml("サンクチュアリコート高山")', box)));
  ok('⑦ 次の一手はサンプル優先の文', /🎁 サンプルの追いかけが先。<\/b>電話で味の感想を聞く（10\/19）がまだ/.test(vm.runInContext('sampleTip("芦屋ベイコート倶楽部")', box)));
  eq('⑦ 追いかけ日すぎが無い施設は いつもの文', vm.runInContext('sampleOsoiAru("サンクチュアリコート高山")', box), false);
  eq('⑦ 相手が人（名刺）なら、その人の施設を添える', vm.runInContext('katFacOf("○○総料理長")', box), '芦屋ベイコート倶楽部');
  eq('⑦ 相手が施設なら、施設そのもの', vm.runInContext('katFacOf("芦屋ベイコート倶楽部")', box), '芦屋ベイコート倶楽部');
}

/* ⑧ 版 */
{
  const vj = JSON.parse(read('version.json')).pages;
  [['eigyo/sample.html'], ['eigyo/index.html'], ['mitsumori.html'], ['rt_chef_daicho.html']].forEach(function(p){
    const m = read(p[0]).match(/name="oos-version" content="([^"]+)"/);
    eq('⑧ ' + p[0] + ' の版が version.json とそろっている', m && m[1], vj[p[0]]);
  });
  const mock = path.join(LIVE, 'mocks', 'mock_営業K_サンプル台帳_2026-10-21.html');
  ok('⑧ 承認モックが mocks/ にある', fs.existsSync(mock));
  ok('⑧ 承認モックの東京ベイコートの料理長は浅野さん', fs.existsSync(mock) && /浅野料理長/.test(fs.readFileSync(mock, 'utf8')) && !/麻生/.test(fs.readFileSync(mock, 'utf8')));
}

console.log('🎁 サンプル台帳（営業のお隣）とRTカードの窓口（2026-10-21）  PASS ' + pass + ' / FAIL ' + fail);
fails.forEach(f => console.log('  ✗ ' + f));
process.exit(fail ? 1 : 0);
