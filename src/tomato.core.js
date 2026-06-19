// 픽셀 토마토의 셀 계산 — 디자인(Pomotomo.dc.html)의 buildTomato 에서
// DOM 생성을 뺀 순수 격자 로직을 이식한 것. 브라우저(window.TomatoCore)와
// Node(require, 아이콘 생성용) 양쪽에서 동일하게 쓴다.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.TomatoCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // p: 진행도 0~1 (익힘 정도)
  // opts: { mode:'fill'|'hue', face:'happy'|'focused'|'rest'|null, cheeks:bool }
  function tomatoCells(p, opts) {
    opts = opts || {};
    var mode = opts.mode || "fill";
    var face = opts.face || null;
    var cheeks = opts.cheeks !== false;
    var W = 14,
      H = 14;
    var cx = 6.5,
      cy = 8.2,
      rx = 6.4,
      ry = 5.7,
      bodyMin = 6,
      bodyMax = 13;

    function hex(h) {
      h = h.replace("#", "");
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
    function css(a) {
      return "rgb(" + (a[0] | 0) + "," + (a[1] | 0) + "," + (a[2] | 0) + ")";
    }
    function lerp(a, b, t) {
      return a.map(function (v, i) {
        return v + (b[i] - v) * t;
      });
    }
    function adj(c, amt) {
      var m = c.match(/\d+/g).map(Number);
      var t = amt > 0 ? [255, 255, 255] : [0, 0, 0];
      return css(lerp(m, t, Math.abs(amt)));
    }

    var GREEN = hex("#6cc257"),
      RED = hex("#e8453c"),
      ORANGE = hex("#f0903a");

    // 얼굴 픽셀(눈/볼/입)을 좌표키로 미리 채운다.
    var fset = {};
    if (face) {
      var dk = "#2a1424",
        eyeY = 9;
      if (face === "rest") {
        [[4, eyeY], [5, eyeY], [9, eyeY], [10, eyeY]].forEach(function (c) {
          fset[c] = dk;
        });
      } else {
        [[5, eyeY], [9, eyeY]].forEach(function (c) {
          fset[c] = dk;
        });
      }
      if (cheeks && face !== "rest") {
        [[4, 10], [10, 10]].forEach(function (c) {
          fset[c] = "#f2849a";
        });
      }
      if (face === "happy") {
        [[6, 11], [7, 12], [8, 11]].forEach(function (c) {
          fset[c] = dk;
        });
      } else if (face === "focused") {
        [[6, 11], [7, 11], [8, 11]].forEach(function (c) {
          fset[c] = dk;
        });
      } else if (face === "rest") {
        [[7, 11], [8, 11]].forEach(function (c) {
          fset[c] = dk;
        });
      }
    }

    var cells = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var d = Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2);
        var color = null;
        var stem =
          (x === 6 && (y === 2 || y === 3)) || (x === 7 && (y === 1 || y === 2));
        if (stem) color = "#6f4a2f";
        else if (d <= 1) {
          if (y <= 5) color = "#3fa14b";
          else {
            var c;
            if (mode === "hue") c = lerp(GREEN, RED, p);
            else {
              var thr = bodyMax - p * (bodyMax - bodyMin);
              c =
                y > thr + 0.5
                  ? RED.slice()
                  : y > thr - 0.5
                  ? ORANGE.slice()
                  : GREEN.slice();
            }
            color = css(c);
            if (x <= cx - 1 && y <= 8) color = adj(color, 0.13);
            if (x >= cx + 2 && y >= 11) color = adj(color, -0.12);
          }
        }
        var k = [x, y].toString();
        if (fset[k] && (color || d <= 1)) color = fset[k];
        if (color) cells.push({ x: x, y: y, color: color });
      }
    }
    return { cells: cells, W: W, H: H };
  }

  return { cells: tomatoCells };
});
