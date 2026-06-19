// Tauri 백엔드와의 다리. 모든 창이 공유한다.
// - 명령(invoke): 타이머 조작은 전부 Rust 로 보낸다 (단일 진실 공급원).
// - 이벤트(listen): `timer://state` 로 상태를 받아 다시 그린다.
// - 사진: data URL 을 localStorage 에 저장(같은 origin 이라 창끼리 공유) + 변경 브로드캐스트.
(function () {
  var T = window.__TAURI__;
  var core = T.core;
  var ev = T.event;

  function invoke(name, args) {
    return core.invoke(name, args || {});
  }

  // 타이머 명령 모음
  var cmd = {
    toggle: function () {
      return invoke("toggle");
    },
    reset: function () {
      return invoke("reset");
    },
    skip: function () {
      return invoke("skip");
    },
    toFocus: function () {
      return invoke("to_focus");
    },
    toBreak: function () {
      return invoke("to_break");
    },
    adjFocus: function (delta) {
      return invoke("adj_focus", { delta: delta });
    },
    adjBreak: function (delta) {
      return invoke("adj_break", { delta: delta });
    },
    preset: function (min) {
      return invoke("preset", { min: min });
    },
    setAutoStartBreak: function (v) {
      return invoke("set_auto_start_break", { v: v });
    },
    setSound: function (v) {
      return invoke("set_sound", { v: v });
    },
    openSettings: function () {
      return invoke("open_settings");
    },
    openPhotos: function () {
      return invoke("open_photos");
    },
    hideTray: function () {
      return invoke("hide_tray");
    },
    getState: function () {
      return invoke("get_state");
    },
  };

  // 상태 변경 구독 + 최초 1회 즉시 동기화
  function onState(cb) {
    ev.listen("timer://state", function (e) {
      cb(e.payload);
    });
    cmd.getState().then(cb);
  }

  function onChime(cb) {
    ev.listen("timer://chime", cb);
  }

  // 상태 → 화면 파생값
  function derive(s) {
    var isBreak = s.mode === "break";
    return {
      p: s.progress,
      isBreak: isBreak,
      face: isBreak ? "rest" : s.running ? "focused" : "happy",
      timeStr: s.timeStr,
      startLabel: s.running ? "PAUSE" : "START",
      startBtnColor: s.running ? "#f4c14e" : "#6cc257",
      modeLabel: isBreak ? "휴식" : "집중",
    };
  }

  // ---- 사진 저장소 (IndexedDB 기반, 창 공유) ----
  // localStorage 는 엔진이 ~5MB 로 고정해 사진엔 부족하다. IndexedDB 는 수십~수백 MB
  // 를 다루므로 큰 사진도 안전하다. 동기 렌더를 위해 메모리 캐시를 두고, 변경 시
  // photos://changed 이벤트로 모든 창의 캐시를 갱신·재렌더한다.
  function openDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("pomotomo", 1);
      r.onupgradeneeded = function () {
        r.result.createObjectStore("photos");
      };
      r.onsuccess = function () {
        res(r.result);
      };
      r.onerror = function () {
        rej(r.error);
      };
    });
  }
  function dbPut(id, val) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("photos", "readwrite");
        tx.objectStore("photos").put(val, id);
        tx.oncomplete = function () {
          res();
        };
        tx.onerror = function () {
          rej(tx.error);
        };
      });
    });
  }
  function dbGet(id) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("photos", "readonly");
        var rq = tx.objectStore("photos").get(id);
        rq.onsuccess = function () {
          res(rq.result);
        };
        rq.onerror = function () {
          rej(rq.error);
        };
      });
    });
  }
  function dbAll() {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var out = {};
        var cur = db.transaction("photos", "readonly").objectStore("photos").openCursor();
        cur.onsuccess = function (e) {
          var c = e.target.result;
          if (c) {
            out[c.key] = c.value;
            c.continue();
          } else res(out);
        };
        cur.onerror = function () {
          rej(cur.error);
        };
      });
    });
  }

  var Photos = {
    _cache: {},
    _cbs: [],
    get: function (id) {
      return this._cache[id] || "";
    },
    set: function (id, dataUrl) {
      var self = this;
      dbPut(id, dataUrl)
        .then(function () {
          self._cache[id] = dataUrl;
          ev.emit("photos://changed", { id: id });
        })
        .catch(function () {
          alert("사진을 저장하지 못했어요.");
        });
    },
    onChange: function (cb) {
      this._cbs.push(cb);
      ev.listen("photos://changed", function (e) {
        var id = e.payload && e.payload.id;
        if (!id) {
          cb();
          return;
        }
        dbGet(id).then(function (v) {
          Photos._cache[id] = v || "";
          cb();
        });
      });
    },
  };
  // 시작 시 캐시 하이드레이트 → 등록된 콜백으로 사진 반영 재렌더
  dbAll()
    .then(function (map) {
      Photos._cache = map;
      Photos._cbs.forEach(function (cb) {
        cb();
      });
    })
    .catch(function () {});

  // ---- 이름 저장소 (창 공유) ----
  var DEFAULT_NAMES = { me: "가연", partner: "성일" };
  var Names = {
    get: function (id) {
      var v = localStorage.getItem("name:" + id);
      return v != null && v !== "" ? v : DEFAULT_NAMES[id] || "이름";
    },
    set: function (id, v) {
      localStorage.setItem("name:" + id, v);
      ev.emit("names://changed", { id: id });
    },
    onChange: function (cb) {
      ev.listen("names://changed", function () {
        cb();
      });
      window.addEventListener("storage", function () {
        cb();
      });
    },
  };

  // IndexedDB 는 용량이 넉넉하므로 최대 2048px 까지만 줄여 화질을 보존한다.
  function storeScaled(id, src) {
    var img = new Image();
    img.onload = function () {
      var max = 2048;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var cw = Math.max(1, Math.round(img.width * scale));
      var ch = Math.max(1, Math.round(img.height * scale));
      var cv = document.createElement("canvas");
      cv.width = cw;
      cv.height = ch;
      cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
      Photos.set(id, cv.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = function () {
      alert("이미지를 읽지 못했어요.");
    };
    img.src = src;
  }

  // 파일(이미지)을 읽어 축소 후 슬롯에 저장
  function readFileToSlot(id, file) {
    if (!file || !/^image\//.test(file.type)) return;
    var fr = new FileReader();
    fr.onload = function () {
      storeScaled(id, fr.result);
    };
    fr.readAsDataURL(file);
  }

  // 파일 선택창을 열어 슬롯 지정.
  // WKWebView 는 DOM 에 붙지 않은 file input 의 click() 으로 대화상자가 안 열릴 수
  // 있어, 화면 밖에 잠깐 붙였다가 제거한다.
  function pickPhoto(id) {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(inp);
    inp.addEventListener("change", function () {
      if (inp.files && inp.files[0]) readFileToSlot(id, inp.files[0]);
      if (inp.parentNode) inp.parentNode.removeChild(inp);
    });
    inp.click();
  }

  // 반응형: 카드를 윈도우에 맞춰 비율 유지하며 스케일.
  // dh 를 주면 고정 높이, 안 주면 카드의 자연 높이를 측정해 사용한다.
  function fit(card, dw, dh) {
    card.style.width = dw + "px";
    if (dh) card.style.height = dh + "px";
    var h = dh || card.offsetHeight || dw;
    var s = Math.min(window.innerWidth / dw, window.innerHeight / h);
    // 좌상단을 고정한 채 스케일 → 창을 키워도 콘텐츠가 움직이지 않는다.
    card.style.transformOrigin = "top left";
    card.style.transform = "scale(" + s + ")";
  }

  // 작은 엘리먼트 빌더 — 디자인의 인라인 스타일을 그대로 옮기기 위함
  function el(tag, css, opts) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    opts = opts || {};
    if (opts.text != null) e.textContent = opts.text;
    if (opts.html != null) e.innerHTML = opts.html;
    if (opts.cls) e.className = opts.cls;
    if (opts.attr)
      for (var a in opts.attr) e.setAttribute(a, opts.attr[a]);
    if (opts.on) for (var k in opts.on) e.addEventListener(k, opts.on[k]);
    if (opts.kids)
      opts.kids.forEach(function (c) {
        if (c) e.appendChild(c);
      });
    return e;
  }

  // 사진 슬롯(저장된 이미지 or placeholder). 클릭=파일선택, 드롭=지정
  function photoSlot(id, w, h, placeholder) {
    var url = Photos.get(id);
    var inner = url
      ? el("div", "width:100%;height:100%;background-image:url('" + url +
          "');background-size:cover;background-position:center;image-rendering:auto;")
      : el(
          "div",
          "width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;background:#15111f;color:#6f658a;font-family:'VT323',monospace;font-size:14px;line-height:1.05;padding:4px;",
          { text: placeholder || "사진" }
        );
    var slot = el(
      "div",
      "width:" + w + "px;height:" + h + "px;overflow:hidden;cursor:pointer;",
      {
        kids: [inner],
        attr: { title: "클릭/드롭해서 사진 지정" },
        on: {
          click: function () {
            pickPhoto(id);
          },
          dragover: function (e) {
            e.preventDefault();
            slot.style.outline = "2px solid #6cc257";
          },
          dragleave: function () {
            slot.style.outline = "";
          },
          drop: function (e) {
            e.preventDefault();
            slot.style.outline = "";
            if (e.dataTransfer && e.dataTransfer.files[0])
              readFileToSlot(id, e.dataTransfer.files[0]);
          },
        },
      }
    );
    return slot;
  }

  // 띵! 소리 (WebAudio, 에셋 불필요)
  function chime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.start();
      o.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  }

  window.Bridge = {
    cmd: cmd,
    onState: onState,
    onChime: onChime,
    derive: derive,
    Photos: Photos,
    Names: Names,
    pickPhoto: pickPhoto,
    photoSlot: photoSlot,
    el: el,
    fit: fit,
    chime: chime,
  };
})();
