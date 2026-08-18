const fs=require('fs'), vm=require('vm');
const t=fs.readFileSync(process.argv[2],'utf8');
const re=/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
let m,i=0,bad=0,skip=0;
while((m=re.exec(t))){
  const attrs=m[1]||'';
  const ty=(attrs.match(/type\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
  if(ty && !/javascript|module|^$/i.test(ty)){ skip++; continue; }   // JSでないもの（JSONなど）は飛ばす
  i++;
  try{ new vm.Script(m[2]); }catch(e){ bad++; console.log('    文法エラー: '+e.message); }
}
console.log('  JSの<script> '+i+' 個 ／ 文法エラー '+bad+' ／ JS以外を飛ばした数 '+skip);
process.exit(bad?1:0);
