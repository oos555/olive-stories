import fs from 'fs';
const p='oos-nouhin.js'; let s=fs.readFileSync(p,'utf8');
const a = `      /* ★消費税の計算にだけ入れる（表には出しません） */
      zeiOnly: zeiOnly,`;
if(s.split(a).length-1!==1) throw new Error('目印ちがい');
const b = a + `
      /* ★2026-09-17 ひろみさん確定：RTだけ消費税を【切り捨て】。ほかは四捨五入。
         　どちらかは親（OOS_ZEI.kirisuteKa）が決めます。ここでは聞くだけです。
         　理由：RTはアイポーターの発注伝票と1円もずらさない。
         　　　　ほかはよその会社と計算が合うように四捨五入のまま。
         ★ここで true/false を決め打ちしないでください。 */
      kirisute: (ZEI && ZEI.kirisuteKa) ? ZEI.kirisuteKa(o.customerType) : false,`;
s = s.replace(a, () => b);
fs.writeFileSync(p, s); console.log('ok');
