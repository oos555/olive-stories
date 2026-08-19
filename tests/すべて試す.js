/* ══════════════════════════════════════════════════════════════════════
   決めたことが消えていないかを、まとめて確かめる
   2026-08-18 作成（ひろみさん：「これ、また数時間で消えない？」）

   使い方（1行だけ）:
     node tests/すべて試す.js

   ここにあるテストは【本番のファイルから本物の関数をそのまま切り出して】動かします。
   テスト用に書き直した別物ではないので、「テストは通るのにアプリは壊れている」が起きません。

   ★1つでも FAIL が出たら、決めたことのどれかが壊れています。
   ★このフォルダごと消さないでください。ここが「決めたことの番人」です。
   ══════════════════════════════════════════════════════════════════════ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FILES = [
  ['test_bunpou.js',      '文法（画面が出なくなる事故を防ぐ）'],
  ['test_master.js',       'マスターＮ 在庫の決めごと'],
  ['test_apps.js',         '4アプリの突き合わせ／不良の出荷／注文番号'],
  ['test_gas.js',          'GASと親（oos-zaiko.js）が同じ数字か'],
  ['test_ketsuhin.js',     '欠品メールは1商品1回だけか'],
  ['test_genka.js',        '原価が消えない守り'],
  ['test_shukka.js',       '在庫の減り方／受注Ａの見張り'],
  ['test_reissue.js',      '注文番号の引き直し'],
  ['test_cancel.js',       'キャンセルで在庫が戻るか'],
  ['test_zaikomachi.js',   '在庫がない注文は倉庫へ送れないか'],
  ['test_yoyaku_count.js', '予約の数え方（親に一本化）'],
  ['test_genkan.js',       '玄関のアラートが本当に働くか'],
  ['test_bihin.js',        '備品も在庫として数えるか'],
  ['test_yomikomi.js',     '読み込み中に「ありません」と言わないか'],
  ['test_rt_1button.js',   'RTのボタン1つで取置と予約を登録'],
  ['test_yunyu_note.js',   '輸入準備計算から輸入ノートへ流れるか'],
  ['test_yoyaku_torioki.js','入荷したら予約が取り置きに変わるか'],
  ['test_basara_okurijou.js','バサラの送り状No.のページ'],
  ['test_uriage_list.js',  '売上一覧に載せるタイミング'],
  ['test_yunyu_free.js',   '輸入のフリー（予定−予約）'],
  ['test_ura_label.js',    '裏ラベル（シール）の在庫'],
  ['test_kienai.js',      '通しの動きと「消えない」の見張り']
];

let total = 0, ngFiles = [];
console.log('══════════════════════════════════════════════');
console.log('  決めたことが消えていないか、まとめて確かめます');
console.log('══════════════════════════════════════════════\n');

FILES.forEach(function(row){
  const f = row[0], name = row[1];
  const p = path.join(__dirname, f);
  if(!fs.existsSync(p)){
    console.log('  ★ ' + f + ' がありません（' + name + '）');
    ngFiles.push(f + '（ファイルごと消えています）');
    return;
  }
  let out = '';
  let ok = true;
  try{ out = execFileSync(process.execPath, [p], { encoding:'utf8' }); }
  catch(e){ out = String((e.stdout||'') + (e.stderr||'')); ok = false; }
  const m = out.match(/PASS (\d+) \/ FAIL (\d+)/);
  if(m){ total += parseInt(m[1],10); if(parseInt(m[2],10) > 0) ok = false; }
  if(out.indexOf('飛ばしました') >= 0){
    console.log('  －  ' + name.padEnd(34) + ' 飛ばしました（GASのファイルが手元にありません）');
    return;
  }
  console.log((ok ? '  ✅ ' : '  ★ ') + name.padEnd(34) + (m ? ('PASS ' + m[1] + ' / FAIL ' + m[2]) : '動きませんでした'));
  if(!ok){
    ngFiles.push(f);
    out.split('\n').filter(function(l){ return l.indexOf('  ') === 0; }).slice(0,8)
       .forEach(function(l){ console.log('        ' + l.trim()); });
  }
});

console.log('\n──────────────────────────────────────────────');
console.log('  合計 ' + total + ' 項目');
if(ngFiles.length){
  console.log('  ★ こわれています：' + ngFiles.join(' / '));
  console.log('  → 決めたことのどれかが消えています。直すまで納品しないでください。');
  process.exit(1);
}
console.log('  ✅ 全部そろっています。決めたことは消えていません。');
console.log('──────────────────────────────────────────────');
