import fs from 'fs';
const p='index.html'; let s=fs.readFileSync(p,'utf8');
const a = "  if(typeof pkgSetDocs==='function') pkgSetDocs(card, ['RT発注伝票＋納品書'], false);\n\n  cancelRtImport();";
if(s.split(a).length-1!==1) throw new Error('目印ちがい');
const b = "  if(typeof pkgSetDocs==='function') pkgSetDocs(card, ['RT発注伝票＋納品書'], false);\n\n"
+ "  /* ★2026-09-17 ひろみさん指示：RTは、送料と倉庫ピッキング手数料を【もう一度えらばない】。\n"
+ "     　前の画面（RT伝票取込）で人がもう選んでいて、納品書にもその金額で出ています。\n"
+ "     ★ここを消すと、ゆかちゃんがまた入れ直すことになります（2026-09-16の報告）。 */\n"
+ "  try{ rtRyokinShirase(card, rtHikitsuguRyokin(card, p)); }catch(_rr){}\n\n"
+ "  /* ★2026-09-17 ここで cancelRtImport() を呼ぶと rtParsed が空になり、\n"
+ "     　あとで［この内容で発注書に貼る］を押したときに rtAttachDocsToOrder が\n"
+ "     　「RTの伝票が読み込まれていない」で止まります。\n"
+ "     　＝ゆかちゃんの報告【伝票の貼り付けができない】の原因でした。\n"
+ "     ★画面だけ閉じて、読み取った中身は【貼り終わるまで残します】。\n"
+ "     　cancelRtImport() に戻さないでください。 */\n"
+ "  rtImportGamenTojiru_();";
s = s.replace(a, () => b);
/* cancelRtImport を2つに分ける */
const c = "function cancelRtImport(){\n  rtParsed = null;\n  if(typeof rtResetExtraDoc==='function') rtResetExtraDoc();\n  const el = document.getElementById('rt-preview');\n  el.style.display='none'; el.innerHTML='';\n  document.getElementById('rt-file').value='';\n  if(typeof rtSetActionsEnabled==='function') rtSetActionsEnabled(false);\n}";
if(s.split(c).length-1!==1) throw new Error('cancelRtImportの目印ちがい');
const d = "/* 取り込みの【画面だけ】を閉じる。読み取った中身（rtParsed）は残します。\n"
+ "   ★2026-09-17 受注登録へ進むときに使います。ここで rtParsed を消すと、\n"
+ "   　あとで発注書に伝票と納品書を貼れなくなります（ゆかちゃんの報告）。 */\n"
+ "function rtImportGamenTojiru_(){\n"
+ "  const el = document.getElementById('rt-preview');\n"
+ "  if(el){ el.style.display='none'; el.innerHTML=''; }\n"
+ "  const f = document.getElementById('rt-file'); if(f) f.value='';\n"
+ "  if(typeof rtSetActionsEnabled==='function') rtSetActionsEnabled(false);\n"
+ "}\n"
+ "/* ✕ 取り込みをやめる … こちらは中身も消します（今までどおり） */\n"
+ c;
s = s.replace(c, () => d);
fs.writeFileSync(p, s); console.log('ok');
