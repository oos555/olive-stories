/* ══════════════════════════════════════════════════════════════════════════
   オリーブオイル・ストーリーズ　在庫の数え方【親】　oos-zaiko.js
   2026-08-13 作成

   ★このファイルが、在庫の数え方の「唯一の親」です。
   ★統合マスタN・受注A・倉庫D・請求C は、自分では計算せず、ここを見に行きます。
   ★在庫の数え方を直すときは、このファイルだけを直してください。
     アプリ側のHTMLに同じ計算を書き写してはいけません（＝独自のコピーを持たない）。

   ── 数の約束（2026-08-13 確定・ひろみさん承認済みモック）────────────────
     販売可能 ＝ 棚の良品 − 受注Aの取り置き　　（0本より下にはならない）
     実在庫   ＝ 棚の良品 ＋ 不良 ＋ 手で入れた取置
       ・受注Aの取り置きは実在庫に足さない（棚の良品の中にすでにある本数だから）
       ・廃棄は実在庫に足さない（もう倉庫にないから）
     現ロットと旧ロットは絶対に混ぜない。

   ── ロットの置き場所（status）──────────────────────────────────────
     現ロットの良品      'new'（ほか、下記以外すべて）
     旧ロットの良品      'old'
     手で入れた取置      'hold'（現）／'hold_old'（旧）
     廃棄                'discard'（現）／'discard_old'（旧）
     輸入予定            'incoming'（実在庫とは別枠）
     不良は defects の lotKind（'old' なら旧ロット、無ければ現ロット）

   ── GASについて（正直な注意）────────────────────────────────────────
     GAS（basaraComputeStock_）だけは、サーバーの中で動くためこのファイルを読めません。
     GASには同じ計算のコピーが1つだけ残ります。
     直したときは必ず「このファイルとGASが同じ数字を出すか」を突き合わせてください。
   ══════════════════════════════════════════════════════════════════════════ */
(function(global){
  'use strict';

  var VERSION = '2026-08-13';

  // 不良が「生きている（数に入れるべき）」か
  function isActiveDefect(d){
    if(!d) return false;
    if(d.status==='resolved' || d.status==='rejected') return false;
    if(d.source==='warehouse' && !d.reviewed) return false;   // 本部が反映するまでは数に入れない
    if(d.level==='relabel' || d.level==='discard') return false;
    return true;
  }

  function num(v){ var n = parseInt(v); return isNaN(n) ? 0 : n; }

  /* 1商品ぶんの数を、現ロット・旧ロットに分けて数える。
     data = { lots:[], defects:[], holds:[] }
       lots   … {pid, status, stock}
       defects… {pid, level, qty, shippedQty, status, source, reviewed, lotKind}
       holds  … {pid, qty}（受注Aの取り置き）  */
  function numbers(pid, data){
    data = data || {};
    var lots = data.lots || [], defects = data.defects || [], holds = data.holds || [];
    function blank(){
      return { avail:0, defLight:0, defMid:0, defHeavy:0, defectQty:0,
               autoHold:0, manualHold:0, holdQty:0, discardQty:0, stock:0, sellable:0 };
    }
    var cur = blank(), old = blank(), incoming = 0;

    lots.forEach(function(l){
      if(!l || l.pid != pid) return;
      var st = l.status, q = num(l.stock != null ? l.stock : l.qty);
      if(st==='old')              old.avail += q;
      else if(st==='incoming')    incoming += q;
      else if(st==='hold')        cur.manualHold += q;
      else if(st==='hold_old')    old.manualHold += q;
      else if(st==='discard')     cur.discardQty += q;
      else if(st==='discard_old') old.discardQty += q;
      else                        cur.avail += q;          // 'new' ほか＝現ロット
    });

    defects.forEach(function(d){
      if(!d || d.pid != pid || !isActiveDefect(d)) return;
      var dq = Math.max(0, num(d.qty) - num(d.shippedQty));
      var t = (d.lotKind==='old') ? old : cur;
      if(d.level==='lv1')      t.defLight += dq;
      else if(d.level==='lv3') t.defHeavy += dq;
      else                     t.defMid   += dq;
    });

    holds.forEach(function(h){ if(h && h.pid == pid) cur.autoHold += num(h.qty); });  // 受注Aの取り置きは現ロットから

    [cur, old].forEach(function(t){
      t.defectQty = t.defLight + t.defMid + t.defHeavy;
      t.holdQty   = t.autoHold + t.manualHold;
      t.stock     = t.avail + t.defectQty + t.manualHold;   // 実在庫
      t.sellable  = Math.max(0, t.avail - t.autoHold);      // 販売可能
    });

    var hasOld = (old.avail + old.defectQty + old.holdQty + old.discardQty) > 0;

    return {
      cur: cur, old: old, hasOld: hasOld, incoming: incoming,
      stock:       cur.stock + old.stock,
      avail:       cur.avail,                       // 現ロットの棚の良品（編集欄に出す数）
      sellable:    cur.sellable,                    // 現ロットの販売可能
      sellableAll: cur.sellable + old.sellable,     // 現＋旧の販売可能
      oldStock:    old.avail,
      defectQty:   cur.defectQty + old.defectQty,
      defLight:    cur.defLight + old.defLight,
      defMid:      cur.defMid   + old.defMid,
      defHeavy:    cur.defHeavy + old.defHeavy,
      holdQty:     cur.holdQty  + old.holdQty,
      autoHold:    cur.autoHold,
      manualHold:  cur.manualHold + old.manualHold,
      discardQty:  cur.discardQty + old.discardQty
    };
  }

  /* SKUで販売可能数を出す（セット商品は中身の最小値）。
     products … 商品マスタの配列（{id, sku, isSet, components:[{sku,qty}]}）  */
  function availableForSku(sku, data, products){
    products = products || [];
    var seen = {};
    function calc(s){
      if(seen[s] !== undefined) return seen[s];
      seen[s] = 0;
      var p = null;
      for(var i=0;i<products.length;i++){ if(products[i] && products[i].sku===s){ p = products[i]; break; } }
      if(!p) return seen[s] = null;
      if(p.isSet){
        if(!p.components || !p.components.length) return seen[s] = null;
        var vals = p.components.map(function(c){
          var x = calc(c.sku);
          return (x===null) ? 0 : Math.floor(x / (num(c.qty) || 1));
        });
        return seen[s] = Math.min.apply(null, vals);
      }
      return seen[s] = numbers(p.id, data).sellable;
    }
    return calc(sku);
  }

  global.OOS_ZAIKO = {
    VERSION: VERSION,
    isActiveDefect: isActiveDefect,
    numbers: numbers,
    availableForSku: availableForSku
  };
})(window);
