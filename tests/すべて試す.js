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
  ['test_kubun_honyaku.js','区分の翻訳（RT・卸が定価で計算される事故の見張り）'],
  ['test_gamen_zenmetsu.js','画面の連鎖全滅（ロット番号が数字で価格リストが消えた事故の見張り）'],
  ['test_set_kanri.js','セットの商品管理番号 SET-下4桁-下4桁（2026-09-09決定）'],
  ['test_lot_nijuu.js','ロットが二重にできる事故（打った値が出ない／2026-09-09）'],
  ['test_kubun_hinban.js','区分の並び順と品番の頭のきまり（2026-09-09決定）'],
  ['test_lot_ipponka.js','ロット・賞味期限の入力口を統合マスタＮに一本化（2026-09-09）'],
  ['test_narabi_soroe.js','統合マスタＮと原価データの商品の並びをそろえる（2026-09-09）'],
  ['test_kokyaku_memo.js','お客様からのメモ（備考欄U列）と受付後・発送後の行ロック（2026-09-09）'],
  ['test_souko_ipponka.js','倉庫への連絡を一本化（🔵にしたときだけ・2026-09-10）'],
  ['test_basara_nagare_kakutei.js','🔒 バサラ発注の流れ 確定（一切変えない・2026-09-10）'],
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
  ['test_rt_gekkiji.js',   'RT月次まとめ「この月の分を集計する」（2026-09-10）'],
  ['test_yoyaku_sheet_haiki.js','古い「取り置き・予約シート」はもう使わない（2026-09-10）'],
  ['test_yoyaku_list_okuru.js','🗂 発注前予約リスト：A列で「送る」を選んだときの動き（2026-09-10）'],
  ['test_nouhin_oya.js',   '📄 納品書の親と、請求書との金額一致（2026-09-10）'],
  ['test_shorui_kanarazu.js','📄 書類に【必ず載るもの】が本当に載っているか（2026-09-11）'],
  ['test_yunyu_free.js',   '輸入のフリー（予定−予約）'],
  ['test_ura_label.js',    '裏ラベル（シール）の在庫'],
  ['test_kienai.js',      '通しの動きと「消えない」の見張り'],
  ['test_shorui.js',      '倉庫Ｄの書類（A4縦・社内の言葉なし）'],
  ['test_zeiritsu.js',    '消費税の税率（8%は食品だけ・紙袋は10%）'],
  ['test_zei_2kaime.js',  '消費税・第2回点検（手数料の税・送料の行・※印・価格表）'],
  ['test_shoruiG_yoku_hiraku.js','書類Ｇ よく開くところ（承認モックとの対照）'],
  ['test_yunyu_note_2026-08-24.js','輸入Ｅ 輸入ノート（合計金額・仮保存・重さの補正）'],
  ['test_price_master_clear.js','価格マスタ：1マスだけ消す機能（2026-08-25バグ再発防止）'],
  ['test_basara_sender.js','倉庫D：送り主がバサラではない注文の見分け（2026-08-25バグ再発防止）'],
  ['test_rinji_nyuuko.js','臨時入庫：毎日の自動反映（GAS）'],
  ['test_rinji_nyuuko_client.js','臨時入庫：統合マスタN画面側'],
  ['test_hozon_anzen.js','統合マスタN：保存できずに消える事故の見張り（2026-08-25）'],
  ['test_rt_note_1en.js','RT納品書：①と納品書の合計1円ずれの見張り（2026-08-25）'],
  ['test_renraku_kiroku_nomi.js','受注Ａ：ゆかさんの3件の指摘の見張り（2026-08-25）'],
  ['test_bag_wholesale.js','紙袋は「RT限定（卸なし）」ではない（2026-08-25）'],
  ['test_mihari_soten.js', '見張りの見張り（版の一致・親の読み込み・自己点検の存在／2026-08-25）'],
  ['test_ordernum_code.js', '注文番号の暗号（受注A・見積М・お客様注文で一致するか／2026-08-25）'],
  ['test_soukofile.js',    '倉庫ファイル＋ゆかスプシ運用コピー（スプシ一本化・第1・2弾／2026-09-03）'],
  ['test_rt_zandaka.js',   '🏛 RT予約の残高一覧（第4弾・台帳の増減と✂️の決めごと／2026-09-04）'],
  ['test_konpou.js',       '📦 梱包の指示（ギフト・箱・同梱書類／2026-09-05）'],
  ['test_ikisaki.js',      '🧭 項目のゆくえ（①発注書32列 ②書類 ③倉庫Ｄ／2026-09-12）']
];

/* ══════════════════════════════════════════════════════════════════════
   🔒 見張りの本数の【下限】　★2026-09-12 追加（ひろみさん指示）
   ──────────────────────────────────────────────────────────────────────
   それまでは、テストを1本まるごと消しても・中身を削っても、
   「✅ 全部そろっています」と出てしまいました（本数を見ていなかったため）。

   ひろみさん：「ルールを決めても、ルールを書いてあるアプリを作っても、それでも間違えて、
   　　　　　　あなたがどんどん直して私の求めていない方向に変えていくので、
   　　　　　　どうすればそれがなくなるのか、ちゃんと探してください」
   答えのひとつがこれです。本数が減ったら、理由を言わないと通りません。

   ★この数字を【下げる向きに】書き換えないでください。
   　・見張りを足したら、そのぶん上げてください（上げるのは自由です）。
   　・減らすときは、ひろみさんに「なぜ減るのか」を先に説明してください。
   ══════════════════════════════════════════════════════════════════════ */
const KOUMOKU_KAGEN = 3000;   /* 2026-09-12 実測 3,077項目（GASが手元に無いと少し減ります） */

let total = 0, ngFiles = [], skipped = 0;
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
    skipped++;
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
/* 🔒 本数が減っていないか（見張りが消されていないか）★この判定を外さないでください */
const tobashita = (skipped > 0);
if(total < KOUMOKU_KAGEN && !tobashita){
  console.log('  ★ 見張りの本数が減っています：' + total + ' 項目（下限 ' + KOUMOKU_KAGEN + ' 項目）');
  console.log('  → テストが消された・削られた可能性があります。');
  console.log('     見張りを足して増えたのなら、tests/すべて試す.js の KOUMOKU_KAGEN を上げてください。');
  console.log('     減らしたのなら、ひろみさんに「なぜ減るのか」を先に説明してください。');
  ngFiles.push('見張りの本数が下限を割っています');
} else if(tobashita){
  console.log('  －  GASのファイルが手元にないテストを ' + skipped + ' 本飛ばしたので、本数の下限は見ていません');
}
if(ngFiles.length){
  console.log('  ★ こわれています：' + ngFiles.join(' / '));
  console.log('  → 決めたことのどれかが消えています。直すまで納品しないでください。');
  process.exit(1);
}
console.log('  ✅ 全部そろっています。決めたことは消えていません。');
console.log('──────────────────────────────────────────────');
