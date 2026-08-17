/* ══════════════════════════════════════════════════════════════════════════
   オリーブオイル・ストーリーズ　版の見張り　oos-version.js
   2026-08-18 作成（ひろみさん指示）

   ★なぜ作ったか
     ひろみさんの言葉：「毎日決めたルールが壊れていく、変わっていく、戻っていく」
     2026-08-17〜18に原因を実測して分かったこと：
       ・直したファイルは正しく上がっていた（中身を検索して確認済み）
       ・それでも古い表示が出ていた。理由は【古いコピーが手元に残っていたから】
         － ブラウザが前に開いた画面を持ち続けている（max-age で10分ほど残る）
         － GitHub Pages の配信も、上げた直後は前の版を返すことがある
           （実測：X-Cache HIT ／ Age 546秒。8分以上、前の版が出続けた）
     つまり「戻っていた」のではなく「新しい版が届いていなかった」。

   ★この仕組みがすること（2つだけ）
     ① 画面の右下に「版」を小さく出す　→ 見ればすぐ新しい版かどうか分かる
     ② 古い版を開いていたら、1回だけ自動で読み直す　→ 気づかないうちに直る
     さらに、右下の版をタップすれば、いつでも手で最新に取り直せる。

   ★使い方（アプリ側は2行だけ）
     <meta name="oos-version" content="2026-08-18-01">
     <script src="oos-version.js"></script>
     そして version.json にも同じ版を書く。ファイルを直したら【両方】を上げる。

   ★このファイルと version.json を消さないでください。消すと、また
     「直したのに古いまま」「戻ったように見える」が起きます。
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function pageName(){
    var p = location.pathname.split('/').pop();
    return p ? p : 'index.html';
  }
  function myVersion(){
    var m = document.querySelector('meta[name="oos-version"]');
    return m ? String(m.getAttribute('content') || '').trim() : '';
  }
  function reloadFresh(v){
    // 版を URL に付けて開き直す。URLが変わるので、ブラウザが持っている古いコピーは使われない。
    var base = location.pathname;
    var q = location.search.replace(/[?&]__v=[^&]*/g, '').replace(/^&/, '?');
    if(q && q[0] !== '?') q = '?' + q;
    var sep = q ? '&' : '?';
    location.replace(base + q + sep + '__v=' + encodeURIComponent(v));
  }

  var MY = myVersion();

  // ── ① 右下に版を出す ──────────────────────────────────────────
  function badge(text, stale){
    var el = document.getElementById('oos-ver-badge');
    if(!el){
      el = document.createElement('div');
      el.id = 'oos-ver-badge';
      el.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99998;'
        + 'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;'
        + 'font-size:11px;font-weight:700;padding:4px 9px;border-radius:99px;cursor:pointer;'
        + 'border:1px solid rgba(0,0,0,.12);box-shadow:0 1px 4px rgba(0,0,0,.10);opacity:.78';
      el.title = 'タップすると最新に取り直します';
      el.onclick = function(){
        // 手で最新に取り直す（時刻を付けるので、必ず取り直しになる）
        var base = location.pathname;
        var q = location.search.replace(/[?&]__v=[^&]*/g, '').replace(/^&/, '?');
        if(q && q[0] !== '?') q = '?' + q;
        location.replace(base + q + (q ? '&' : '?') + '__v=' + Date.now());
      };
      document.body.appendChild(el);
    }
    el.textContent = text;
    if(stale){ el.style.background = '#b91c1c'; el.style.color = '#fff'; el.style.opacity = '1'; }
    else      { el.style.background = '#f3f0ea'; el.style.color = '#6b6459'; }
  }

  function start(){
    if(!MY){ return; }                     // meta が無いページでは何もしない
    badge('版 ' + MY, false);

    // ── ② 最新の版を聞いて、古ければ1回だけ読み直す ──────────────
    var url = 'version.json?cb=' + Date.now();
    fetch(url, { cache:'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        if(!j || !j.pages) return;
        var want = j.pages[pageName()];
        if(!want || want === MY) return;    // 最新を見ている

        // すでに同じ版で読み直したあとなら、もう読み直さない（ぐるぐる回るのを防ぐ）
        var already = (location.search.indexOf('__v=' + want) >= 0);
        if(already){
          badge('版 ' + MY + '（配信待ち）', true);
          return;
        }
        badge('新しい版に取り直しています…', true);
        setTimeout(function(){ reloadFresh(want); }, 250);
      })
      .catch(function(){ /* 聞けなくても、いまの画面はそのまま使えるようにする */ });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
