import fs from 'fs';
const p='index.html';
let L=fs.readFileSync(p,'utf8').split('\n');
/* 入れてしまった18行（5270..5287）を取りのぞく */
const start=5270-1;
if(!L[start].includes('★2026-09-17 ちがう伝票の書類を貼らないための確かめ') && !L[start+1].includes('★2026-09-17 ちがう伝票')) throw new Error('位置ちがい: '+L[start]);
const s0 = L.findIndex(l=>l.includes('/* ══════════════════════════════════════════════════════════════') && false);
let a = L.findIndex((l,idx)=> idx>=5265 && l.includes('★2026-09-17 ちがう伝票の書類を貼らないための確かめ'));
if(a<0) throw new Error('見つからない');
a = a-1;                       /* コメント開始の行 */
let b = L.findIndex((l,idx)=> idx>a && l.trim()==='}');
/* 取りのぞくのは 18行ちょうど */
const kesu = L.slice(a, a+18);
if(kesu[kesu.length-1].trim() !== '}') throw new Error('終わりがちがう: '+JSON.stringify(kesu[kesu.length-1]));
L.splice(a, 18);
fs.writeFileSync(p, L.join('\n'));
console.log('取りのぞきました');
