(function () {
  var out = [];
  var o = document.getElementById('outer');
  var f = document.getElementById('foot');
  out.push('scrollH=' + o.scrollHeight + ' clientH=' + o.clientHeight);
  [0, 100, 300, o.scrollHeight].forEach(function (st) {
    o.scrollTop = st;
    var or_ = o.getBoundingClientRect();
    var fr = f.getBoundingClientRect();
    var band = [];
    document.querySelectorAll('.row').forEach(function (r, i) {
      var rr = r.getBoundingClientRect();
      if (rr.bottom > or_.bottom - 20 && rr.top < or_.bottom) band.push('row' + i);
    });
    out.push('st=' + o.scrollTop + ' footerBottomRel=' + (fr.bottom - or_.bottom).toFixed(1) + ' rowsInBottomBand=[' + band.join(',') + ']');
  });
  return out.join('\n');
})()
