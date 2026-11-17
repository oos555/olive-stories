/* 🤝 チームの頼みごと（tanomi/index.html・単独のページ）の見張り
   正本：mocks/mock_チーム頼みごと_2026-11-17.html（2026-11-17 ひろみさん「これで作って」）
   本物の <script> を丸ごと砂場に入れて、書き方ではなく【動き】を確かめる。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

let pass = 0, fail = 0; const fails = [];
function eq(label, got, want){ if(got === want) pass++; else { fail++; fails.push(label + '  期待:' + want + '  実際:' + got); } }

const html = fs.readFileSync(path.join(H.LIVE, 'tanomi', 'index.html'), 'utf8');
const mock = fs.readFileSync(path.join(H.LIVE, 'mocks', 'mock_チーム頼みごと_2026-11-17.html'), 'utf8');

/* ── 砂場 ── */
const bako = { console, JSON, String, Date, Math, Array, Object, Error, RegExp, Number, setTimeout:function(){}, clearTimeout:function(){},
  navigator:{}, window:{ prompt:function(){ return bako.__promptAnswer; } }, alert:function(m){ bako.__alerts.push(m); }, __alerts:[], __promptAnswer:'',
  __confirm:true, confirm:function(){ return bako.__confirm; },
  localStorage:{ _m:{}, setItem:function(k,v){ this._m[k]=String(v); }, getItem:function(k){ return (k in this._m)?this._m[k]:null; }, removeItem:function(k){ delete this._m[k]; } },
  __posted:[], fetch:function(){ return Promise.reject(new Error('砂場では通信しない')); } };
bako.document = H.ANY;
const ctx = vm.createContext(bako);
vm.runInContext(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')), ctx);
/* 画面の身代わり：id ごとに箱を用意（innerHTML/value/textContent を読める） */
bako.__els = {};
bako.document = { getElementById:function(id){ if(!bako.__els[id]) bako.__els[id] = { innerHTML:'', value:'', textContent:'', style:{}, onclick:null, onkeydown:null, disabled:false, classList:{ add:function(){}, remove:function(){} } }; return bako.__els[id]; } };
vm.runInContext('gasPost=function(body,cb){ __posted.push(body); if(cb) cb(null,{status:"ok"}); }; password="x"; TASKS=[];', ctx);

/* ① 入れ物：toTask → fromTask で元どおり。kind:teamtask。付箋メモJのメモは頼みごとと見なさない */
const r1 = vm.runInContext('(function(){ var t={id:"a1",kind:"teamtask",what:"100ml裏ラベルの改良版（賞味期限2つ）",to:["おだも"],by:"ひろみ",due:"2026-11-25",how:"PDFをDropboxへ",states:{"おだも":{s:"question",at:"2026-11-11T10:33:00.000Z",note:"この2種類でいいですか？"}},createdAt:"2026-11-11T07:25:00.000Z"}; var m=toTask(t); var b=fromTask(m); return { isTask:isTaskMemo(m), notTask:isTaskMemo({text:"ただのメモ"}), same:JSON.stringify(b)===JSON.stringify(t), sheet:SHEET_NAME, group:KEY_GROUP, unlock:UNLOCK_KEY, reminder:m.reminderDate, done:m.done }; })()', ctx);
eq('① toTask→fromTask で元どおり（what/to/by/due/how/states/createdAt）', r1.same, true);
eq('① kind:teamtask だけを頼みごとと見なす（ただの文字のメモは除外）', r1.isTask && !r1.notTask, true);
eq('① 保存先は「チーム頼みごと」シート（付箋メモJには混ぜない）・鍵はゆかメモと同じ group j・同じ置き場 oos_unlock_j', r1.sheet==='チーム頼みごと' && r1.group==='j' && r1.unlock==='oos_unlock_j', true);
eq('① 〆切は reminderDate にも入れる・全員できたでないうちは done=false', r1.reminder==='2026-11-25' && r1.done===false, true);

/* ② 誰に：みんな＝4人。もう一度押すと全部外れる。自分も選べる。れいこさんは「みんな」に含めない */
const r2 = vm.runInContext('(function(){ TO=[]; toggleTo("みんな"); var a=TO.slice(); toggleTo("みんな"); var b=TO.slice(); toggleTo("ゆか"); toggleTo("おだも"); var c=TO.slice(); toggleTo("ひろみ"); var d=TO.slice(); TO=["れいこさん"]; toggleTo("みんな"); var e=TO.slice(); return { a:a.join(","), b:b.length, c:c.join(","), d:d.join(","), e:e.join(","), everyone:isEveryone(a), label:toLabel(a), label2:toLabel(c) }; })()', ctx);
eq('② 「みんな」を押すと4人（ひろみ・ゆか・おだも・あやちん）', r2.a, 'ひろみ,ゆか,おだも,あやちん');
eq('② もう一度「みんな」で全部外れる', r2.b, 0);
eq('② ゆかとおだもだけ、も選べる', r2.c, 'ゆか,おだも');
eq('② 自分（ひろみ）も選べる', r2.d, 'ゆか,おだも,ひろみ');
eq('② れいこさんを選んだまま「みんな」を押すと 4人＋れいこさん', r2.e, 'れいこさん,ひろみ,ゆか,おだも,あやちん'.split(',').sort().join(',') === r2.e.split(',').sort().join(',') ? r2.e : 'ちがう');
eq('② 4人そろうと表示は「みんな（…）」、2人なら名前を・でつなぐ', r2.everyone && r2.label==='みんな（ひろみ・ゆか・おだも・あやちん）' && r2.label2==='ゆか・おだも', true);

/* ③ 記録：わたしは→誰に→何を→いつまで（日付）→完成の形。足りないと止まる。記録したら saveStickyMemo を同じシートで呼び、LINEに貼る文ができる */
const r3 = vm.runInContext('(function(){ __alerts.length=0; __posted.length=0; TASKS=[]; ME=""; TO=["おだも"]; document.getElementById("f-what").value="100ml裏ラベルの改良版"; document.getElementById("f-due").value="2026-11-25"; document.getElementById("f-how").value=""; tCreate(); var noMe=__alerts.length; setMe("ひろみ"); TO=[]; tCreate(); var noTo=__alerts.length; TO=["おだも"]; document.getElementById("f-due").value=""; tCreate(); var noDue=__alerts.length; document.getElementById("f-due").value="2026-11-25"; var copied=""; navigator.clipboard={ writeText:function(t){ copied=t; return { then:function(ok){ ok(); } }; } }; tCreate(); var p=__posted[__posted.length-1]; return { noMe:noMe, noTo:noTo, noDue:noDue, n:TASKS.length, by:TASKS[0]&&TASKS[0].by, action:p&&p.action, sheet:p&&p.sheetName, kind:p&&JSON.parse(p.memo.text).kind, copied:copied, formCleared:(TO.length===0 && document.getElementById("f-what").value==="") }; })()', ctx);
eq('③ わたしは・誰に・いつまで が無いと記録しない（それぞれ止まる）', r3.noMe===1 && r3.noTo===2 && r3.noDue===3 && r3.n===1, true);
eq('③ 頼んだ人は「わたしは」で選んだ人が自動で入る', r3.by, 'ひろみ');
eq('③ 記録したら saveStickyMemo を「チーム頼みごと」シートに kind:teamtask で送る', r3.action==='saveStickyMemo' && r3.sheet==='チーム頼みごと' && r3.kind==='teamtask', true);
eq('③ 記録と同時に LINEに貼る文（頼みごと／何を／いつまで／完成の形／押してください）ができる・入力欄は空に戻る', /^【頼みごと】ひろみ → おだも\n何を：100ml裏ラベルの改良版\nいつまで：11\/25（水）\n受けたら「受けた」、聞きたいことがあれば「質問あり」を押してください（チームの頼みごと）$/.test(r3.copied) && r3.formCleared, true);

/* ④ 状態：受けた／質問あり／無理→いつなら／できた。押した人の分だけ。何人かに頼んだら一人ずつ。全員できたで「できたもの」へ */
const r4 = vm.runInContext('(function(){ TASKS=[{id:"m1",kind:"teamtask",what:"パンフの案",to:["ひろみ","ゆか","おだも","あやちん"],by:"ひろみ",due:"2026-11-21",how:"",states:{},createdAt:"2026-11-17T00:00:00.000Z"}]; setMe("ゆか"); tState("m1","received"); var s1=TASKS[0].states; var r={}; r.yukaOnly = (s1["ゆか"]&&s1["ゆか"].s==="received") && !s1["おだも"] && !s1["ひろみ"]; setMe("おだも"); __promptAnswer="3行でいい？"; tState("m1","question"); r.q = TASKS[0].states["おだも"].s==="question" && TASKS[0].states["おだも"].note==="3行でいい？" && hasQuestion(TASKS[0]); renderList(); var h=document.getElementById("list").innerHTML; r.markAll = h.indexOf("ゆか 受けた")>=0 && h.indexOf("おだも 質問あり")>=0 && h.indexOf("あやちん まだ")>=0 && h.indexOf("ひろみ まだ")>=0; r.orange = /class="card q/.test(h); setMe("ゆか"); tState("m1","received"); r.toggleOff = !TASKS[0].states["ゆか"]; __promptAnswer=""; setMe("あやちん"); tState("m1","cannot"); r.cannotNeedsDate = !TASKS[0].states["あやちん"]; __promptAnswer="11/28"; tState("m1","cannot"); r.cannot = TASKS[0].states["あやちん"].s==="cannot" && TASKS[0].states["あやちん"].note==="11/28"; ["ひろみ","ゆか","おだも","あやちん"].forEach(function(n){ setMe(n); TASKS[0].states[n]={s:"done",at:"2026-11-18T00:00:00.000Z",note:""}; }); renderList(); r.allDone = isAllDone(TASKS[0]) && document.getElementById("list").innerHTML.indexOf("パンフの案")<0 && document.getElementById("count").textContent.indexOf("（0件）")>=0; doneOpen=true; renderList(); r.inDone = document.getElementById("done-list").innerHTML.indexOf("パンフの案")>=0 && document.getElementById("done-toggle").textContent.indexOf("できたもの（1）")>=0; doneOpen=false; return r; })()', ctx);
eq('④ 「受けた」は押した人（わたしは）の分だけ変わる', r4.yukaOnly, true);
eq('④ 「質問あり」は聞きたいことを1行で残し、カードが🟠になる', r4.q && r4.orange, true);
eq('④ 何人かに頼んだとき、右下に全員分「ゆか 受けた／おだも 質問あり／あやちん まだ…」が並ぶ', r4.markAll, true);
eq('④ 同じボタンをもう一度押すと取り消し。「無理→いつなら」は日付を入れないと記録しない', r4.toggleOff && r4.cannotNeedsDate && r4.cannot, true);
eq('④ 全員が「できた」を押したら一覧から消え、「できたもの（1）」に入る', r4.allDone && r4.inDone, true);

/* ⑤ 並び：質問ありがいちばん上、あとは〆切が近い順。〆切3日以内は赤、過ぎたら「◯日すぎ」。返事がないと「まだ返事なし（24時間…）」 */
const r5 = vm.runInContext('(function(){ TASKS=[ {id:"x1",kind:"teamtask",what:"遠い",to:["ゆか"],by:"ひろみ",due:"2026-12-20",how:"",states:{},createdAt:"2026-11-10T00:00:00.000Z"}, {id:"x2",kind:"teamtask",what:"近い",to:["ゆか"],by:"ひろみ",due:"2026-11-19",how:"",states:{},createdAt:"2026-11-11T00:00:00.000Z"}, {id:"x3",kind:"teamtask",what:"質問つき",to:["おだも"],by:"ひろみ",due:"2026-12-01",how:"",states:{"おだも":{s:"question",at:"2026-11-11T10:33:00.000Z",note:""}},createdAt:"2026-11-12T00:00:00.000Z"}, {id:"x4",kind:"teamtask",what:"過ぎた",to:["あやちん"],by:"ひろみ",due:"2026-11-16",how:"",states:{},createdAt:"2026-11-11T00:00:00.000Z"} ]; var order=sortOpen(TASKS).map(function(t){ return t.what; }).join(","); var h=card(TASKS[1],"2026-11-17")+card(TASKS[3],"2026-11-17")+card(TASKS[0],"2026-11-17"); return { order:order, near:card(TASKS[1],"2026-11-17").indexOf("due near\\">〆切<b>11/19（木）</b>あと2日")>=0, late:card(TASKS[3],"2026-11-17").indexOf("due late\\">〆切<b>11/16（月）</b>1日すぎ")>=0 && card(TASKS[3],"2026-11-17").indexOf("class=\\"card late\\"")>=0, noreply: card(TASKS[0],"2026-11-17").indexOf("まだ返事なし（24時間たったら頼んだ人がもう一度聞く）")>=0, list: openListText(TASKS, "2026-11-17") }; })()', ctx);
eq('⑤ 並びは 質問あり → 〆切が近い順', r5.order, '質問つき,過ぎた,近い,遠い');
eq('⑤ 〆切3日以内は赤で「あと◯日」、過ぎたら「◯日すぎ」で赤枠', r5.near && r5.late, true);
eq('⑤ 誰も押していなければ「まだ返事なし（24時間たったら頼んだ人がもう一度聞く）」', r5.noreply, true);
eq('⑤ 月曜に貼る「開いている一覧」は 件数＋1行ずつ（〆切／誰に／何を／質問あり・まだ返事なし）', r5.list, '【開いている頼みごと】11/17現在 4件\n・12/1（火）まで ／ おだも：質問つき（質問あり・ひろみの返事待ち）\n・11/16（月）まで ／ あやちん：過ぎた（まだ返事なし）\n・11/19（木）まで ／ ゆか：近い（まだ返事なし）\n・12/20（日）まで ／ ゆか：遠い（まだ返事なし）');

/* ⑥ 安全マージ：サーバーが空で返しても、この端末の記録は消えず、再送される */
const r6 = vm.runInContext('(function(){ TASKS=[{id:"local1",kind:"teamtask",what:"端末だけ",to:["ゆか"],by:"ひろみ",due:"2026-11-30",how:"",states:{},createdAt:"2026-11-17T00:00:00.000Z"}]; __posted.length=0; var saved=[]; gasPost=function(body,cb){ __posted.push(body); if(body.action==="loadStickyMemos"){ cb(null,{status:"ok",data:{memos:[]}}); } else { saved.push(body.memo.id); cb(null,{status:"ok"}); } }; syncLoad(); return { kept:TASKS.length===1 && TASKS[0].id==="local1", resent:saved.join(",") }; })()', ctx);
eq('⑥ サーバーが空で返しても、この端末の記録は消えない', r6.kept, true);
eq('⑥ 未同期の記録はサーバーへ送り直す', r6.resent, 'local1');

/* ⑦ 文言：モックと同じ（見出し・説明・ボタン・入力の見出し・決まり） */
const kotoba = ['🤝 チームの頼みごと','単独のページ（玄関からはつながない）／ 鍵は1つ（チームの合鍵）',
  'わたしは <small>（この端末で1回選べば次から覚えます）</small>','誰に <small>（何人でも押せます。もう一度押すと外れます。自分も選べます）</small>',
  '「みんな」を押すと4人全部が入り、もう一度押すと全部外れます。例：ゆかとおだもだけ → その2つだけ押す。',
  '何を <small>（1行で）</small>','いつまで <small>（日付を選ぶ。「明日」「3日後」のような押しボタンは置かない）</small>','完成の形 <small>（どんな形で・どこに出せば完成か。なくてもOK）</small>',
  '記録して、LINEに貼る文をコピー','📋 開いている一覧をコピー（月曜にLINEへ貼る用）','📋 LINEに貼る文をコピー','✏️ 直す',
  '例）100ml裏ラベルの改良版（賞味期限2つ）','例）PDFをDropboxの部分ラベルフォルダへ。印刷して12/5までに福岡へ'];
kotoba.forEach(function(s){ eq('⑦ 文言がモックと同じ：「'+s.slice(0,28)+'」', html.indexOf(s) >= 0 && mock.indexOf(s) >= 0, true); });
eq('⑦ 状態のボタンは 受けた／質問あり／無理→いつなら／できた の4つ（STATES）', vm.runInContext('Object.keys(STATES).map(function(k){ return STATES[k]; }).join("／")', ctx), '受けた／質問あり／無理→いつなら／できた');
eq('⑦ 〆切の押しボタン（明日・3日後・1週間後）は置いていない・日付入力は type=date', !/>明日<|>3日後<|>1週間後</.test(html) && /id="f-due" type="date"/.test(html), true);
eq('⑦ 玄関・工房からはつないでいない（genkan.html / home.html に tanomi/ のリンクが無い）', !/tanomi\//.test(fs.readFileSync(path.join(H.LIVE,'genkan.html'),'utf8')) && !/tanomi\//.test(fs.readFileSync(path.join(H.LIVE,'home.html'),'utf8')), true);

/* ⑧ GAS：チーム頼みごと シートは group j の鍵で開く（手元に GAS があるときだけ） */
(function(){
  const gp = H.gasPath && H.gasPath();
  if(!gp || !fs.existsSync(gp)){ console.log('（GASのファイルが手元にないので ⑧ は飛ばしました）'); return; }
  const g = fs.readFileSync(gp, 'utf8');
  /* 本物の関数（末尾に置いた上書き版＝あとに書いたほうが使われる）を砂場で動かす */
  const at = g.lastIndexOf('function stickyMemoPasswordOk');
  const fn = H.cut(g.slice(at), 'stickyMemoPasswordOk');
  const gctx = vm.createContext({ GROUP_PASSWORDS:{ j:'KAGI-J', secret:'KAGI-S' } });
  vm.runInContext(fn, gctx);
  const okJ = vm.runInContext('stickyMemoPasswordOk("チーム頼みごと","KAGI-J")', gctx);
  const ngS = vm.runInContext('stickyMemoPasswordOk("チーム頼みごと","KAGI-S")', gctx);
  const stillJ = vm.runInContext('stickyMemoPasswordOk("付箋メモJ","KAGI-J") && stickyMemoPasswordOk("付箋メモI","KAGI-S") && !stickyMemoPasswordOk("付箋メモI","KAGI-J")', gctx);
  eq('⑧ GAS：「チーム頼みごと」はゆかメモの鍵（group j）で開き、社長の鍵では開かない', okJ === true && ngS === false, true);
  eq('⑧ GAS：上書き版でも、付箋メモI／Jなど今までのシートの鍵は変わらない', stillJ, true);
})();

console.log('🤝 チームの頼みごと（単独のページ・承認済みモック 2026-11-17）  PASS ' + pass + ' / FAIL ' + fail);
if(fail){ fails.forEach(function(f){ console.log('  ★ ' + f); }); process.exit(1); }
