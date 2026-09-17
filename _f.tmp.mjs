import fs from 'fs';
const p='tests/test_zeiritsu.js';
let s=fs.readFileSync(p,'utf8');
const a = `t('⑧ 親の消費税は、いまは1行ごとの四捨五入（★2026-08-24の「切り捨て」と食い違い・返事待ち）',
  fs.readFileSync(R + 'oos-doc.js', 'utf8').indexOf("tax10 += Math.round((it.amount||0)*0.10)") >= 0, true);`;
if(s.split(a).length-1!==1) throw new Error('目印ちがい');
const b = `/* ★2026-09-17 ひろみさんの返事が出ました：**RTだけ切り捨て・他は四捨五入**。
   　「多くのところで計算方法が四捨五入になっているので、うちだけ切り捨てちゃうと
   　　よそと合わなくなってしまう可能性があるの」
   　決めごとの置き場所は oos-zei.js だけ。くわしくは tests/test_zei_hasuu.js（25項目）。
   　ここでは「書類の親が自分で丸めていないこと」だけを見ます。 */
t('⑧ 書類の親は、自分で税を丸めていない（親＝oos-zei.js に聞く）',
  /tax(8|10)\s*\+?=\s*Math\.(round|floor)\(/.test(
    fs.readFileSync(R + 'oos-doc.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')), false);`;
s = s.replace(a, () => b);
fs.writeFileSync(p, s); console.log('ok');
