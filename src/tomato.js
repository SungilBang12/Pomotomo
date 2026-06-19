// 픽셀 토마토를 단일 canvas 로 그린다.
// 예전엔 셀마다 div 를 깔았는데, 셀 사이 미세한 이음선이 생기고 창 확대(transform
// scale) 시 그 선이 확대돼 "격자"처럼 보였다. canvas 하나에 fillRect 로 정수 좌표에
// 칠하면 이음선이 없고, image-rendering:pixelated 로 확대해도 또렷하게 유지된다.
(function () {
  function renderTomato(p, opts) {
    opts = opts || {};
    var size = opts.size || 128;
    var r = window.TomatoCore.cells(p, opts);
    var W = r.W,
      H = r.H;
    var ss = 8; // 셀당 내부 해상도 (블록을 또렷하게)
    var cv = document.createElement("canvas");
    cv.width = W * ss;
    cv.height = H * ss;
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    r.cells.forEach(function (c) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x * ss, c.y * ss, ss, ss);
    });
    var u = size / W;
    cv.style.cssText =
      "display:block;width:" +
      size +
      "px;height:" +
      (size * H) / W +
      "px;image-rendering:pixelated;image-rendering:crisp-edges;filter:drop-shadow(0 " +
      u +
      "px 0 rgba(0,0,0,0.28));";
    return cv;
  }
  window.renderTomato = renderTomato;
})();
