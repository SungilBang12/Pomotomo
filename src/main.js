// 메인 타이머 창 (디자인 섹션 01 + 휴식 상태는 섹션 04 를 합침).
(function () {
  var B = window.Bridge,
    E = B.el;
  var appWin = window.__TAURI__.window.getCurrentWindow();
  var app = document.getElementById("app");
  var state = null;

  function frame(slotEl) {
    return E("div", "padding:3px;background:#2a2440;border:2px solid #0a0810;", {
      kids: [slotEl],
    });
  }

  function profile(id, name) {
    return E(
      "div",
      "display:flex;flex-direction:column;align-items:center;gap:5px;",
      {
        kids: [
          frame(B.photoSlot(id, 42, 42, id === "me" ? "내 사진" : "연인 사진")),
          E("div", "font-family:'VT323';font-size:16px;color:#cdbff0;", {
            text: name,
          }),
        ],
      }
    );
  }

  function light(color, title, fn) {
    return E(
      "span",
      "width:11px;height:11px;background:" + color + ";cursor:pointer;",
      { attr: { title: title }, on: { click: fn } }
    );
  }

  function render() {
    if (!state) return;
    var d = B.derive(state);
    var br = d.isBreak;
    var panelBg = br ? "#141b26" : "#1b1626";
    var barBg = br ? "#0b1018" : "#0f0b18";
    var barBorder = br ? "#243a48" : "#2a2440";
    var innerSh = br ? "#1d3140" : "#251f37";
    var titleCol = br ? "#6fa3b8" : "#7c728f";

    app.innerHTML = "";
    // #app 은 윈도우 전체를 채우는 투명 뷰포트, card 는 고정 비율 디자인(400x588)을
    // 윈도우 크기에 맞춰 스케일한다 → 창을 키워도 모든 요소 비율이 그대로 유지된다.
    app.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:flex-start;overflow:hidden;background:transparent;";
    var card = E(
      "div",
      "position:relative;width:400px;height:588px;background:" +
        panelBg +
        ";display:flex;flex-direction:column;border:3px solid #0a0810;border-radius:16px;overflow:hidden;"
    );

    // --- 타이틀바 (드래그 영역 + 트래픽 라이트) ---
    var bar = E(
      "div",
      "display:flex;align-items:center;height:32px;padding:0 11px;background:" +
        barBg +
        ";border-bottom:3px solid " +
        barBorder +
        ";flex:none;",
      {
        attr: { "data-tauri-drag-region": "" },
        kids: [
          E("div", "display:flex;gap:7px;", {
            kids: [
              light("#ff5f57", "닫기", function () {
                appWin.hide();
              }),
              light("#febc2e", "최소화", function () {
                appWin.minimize();
              }),
              light("#28c840", "설정", function () {
                B.cmd.openSettings();
              }),
            ],
          }),
          E(
            "div",
            "flex:1;text-align:center;font-family:'VT323';font-size:17px;color:" +
              titleCol +
              ";letter-spacing:2px;pointer-events:none;",
            { text: br ? "BREAK" : "POMOTOMO" }
          ),
          E("div", "width:46px;"),
        ],
      }
    );

    var body = E(
      "div",
      "flex:1;display:flex;flex-direction:column;align-items:center;padding:18px 22px 20px;box-shadow:inset 0 0 0 2px " +
        innerSh +
        ";overflow:hidden;"
    );

    // 프로필 (이름은 공유 저장소에서)
    body.appendChild(
      E("div", "display:flex;justify-content:space-between;width:100%;", {
        kids: [
          profile("me", B.Names.get("me")),
          profile("partner", B.Names.get("partner")),
        ],
      })
    );

    // 집중/휴식 탭
    body.appendChild(
      E("div", "display:flex;border:2px solid #0a0810;margin:10px 0 6px;", {
        kids: [
          E(
            "button",
            "font-family:'VT323';font-size:18px;letter-spacing:1px;padding:5px 18px;cursor:pointer;border:0;border-right:2px solid #0a0810;color:" +
              (br ? "#6f658a" : "#14111d") +
              ";background:" +
              (br ? "#15111f" : "#6cc257") +
              ";",
            {
              cls: "pixbtn",
              text: "집중",
              on: {
                click: function () {
                  B.cmd.toFocus();
                },
              },
            }
          ),
          E(
            "button",
            "font-family:'VT323';font-size:18px;letter-spacing:1px;padding:5px 18px;cursor:pointer;border:0;color:" +
              (br ? "#14111d" : "#6f658a") +
              ";background:" +
              (br ? "#5ac8e8" : "#15111f") +
              ";",
            {
              cls: "pixbtn",
              text: "휴식",
              on: {
                click: function () {
                  B.cmd.toBreak();
                },
              },
            }
          ),
        ],
      })
    );

    if (br) {
      body.appendChild(
        E(
          "div",
          "font-family:'VT323';font-size:18px;color:#6fa3b8;letter-spacing:3px;margin:2px 0;",
          { text: "잠깐 쉬어가요" }
        )
      );
    }

    // 토마토
    body.appendChild(
      E("div", "margin:4px 0 8px;", {
        kids: [window.renderTomato(d.p, { size: 128, mode: "fill", face: d.face })],
      })
    );

    // 시간
    body.appendChild(
      E(
        "div",
        "font-family:'Press Start 2P';font-size:30px;color:" +
          (br ? "#dff0f5" : "#f3ead6") +
          ";letter-spacing:1px;text-shadow:0 3px 0 #0a0810;",
        { text: d.timeStr }
      )
    );

    if (br) {
      // 휴식 화면: 우리 사진
      body.appendChild(
        E(
          "div",
          "padding:4px;background:#1d3140;border:3px solid #0a0810;margin:14px 0 4px;",
          { kids: [B.photoSlot("couple", 220, 80, "둘이 찍은 사진 한 장")] }
        )
      );
    } else {
      // 집중 화면: 세션 토마토 카운트
      var counts = E(
        "div",
        "display:flex;gap:7px;flex-wrap:wrap;justify-content:center;max-width:250px;"
      );
      if (state.sessions === 0) {
        counts.appendChild(
          E("div", "font-family:'VT323';font-size:16px;color:#6f658a;", {
            text: "첫 토마토를 키워보세요",
          })
        );
      } else {
        for (var i = 0; i < state.sessions; i++) {
          counts.appendChild(window.renderTomato(1, { size: 19, mode: "fill" }));
        }
      }
      body.appendChild(
        E(
          "div",
          "display:flex;flex-direction:column;align-items:center;gap:6px;margin:11px 0 8px;",
          {
            kids: [
              counts,
              E("div", "font-family:'VT323';font-size:17px;color:#9a8fb8;", {
                html:
                  '오늘 <span style="color:#e8453c;">' +
                  state.sessions +
                  "</span>번 집중",
              }),
            ],
          }
        )
      );
    }

    // 컨트롤
    var ctrls;
    if (br) {
      ctrls = E("div", "display:flex;gap:11px;margin-top:auto;", {
        kids: [
          E(
            "button",
            "font-family:'Press Start 2P';font-size:10px;color:#14111d;background:#5ac8e8;border:3px solid #0a0810;box-shadow:3px 3px 0 #0a0810;padding:12px 16px;cursor:pointer;letter-spacing:1px;",
            {
              cls: "pixbtn",
              text: "집중으로",
              on: {
                click: function () {
                  B.cmd.skip();
                },
              },
            }
          ),
          E(
            "button",
            "font-family:'Press Start 2P';font-size:10px;color:#dff0f5;background:#243a48;border:3px solid #0a0810;box-shadow:3px 3px 0 #0a0810;padding:12px 16px;cursor:pointer;letter-spacing:1px;",
            {
              cls: "pixbtn",
              text: d.startLabel,
              on: {
                click: function () {
                  B.cmd.toggle();
                },
              },
            }
          ),
        ],
      });
    } else {
      ctrls = E("div", "display:flex;gap:11px;margin-top:auto;", {
        kids: [
          E(
            "button",
            "font-family:'Press Start 2P';font-size:10px;color:#14111d;background:" +
              d.startBtnColor +
              ";border:3px solid #0a0810;box-shadow:3px 3px 0 #0a0810;padding:12px 18px;cursor:pointer;letter-spacing:1px;",
            {
              cls: "pixbtn",
              text: d.startLabel,
              on: {
                click: function () {
                  B.cmd.toggle();
                },
              },
            }
          ),
          E(
            "button",
            "font-family:'Press Start 2P';font-size:10px;color:#f3ead6;background:#2a2440;border:3px solid #0a0810;box-shadow:3px 3px 0 #0a0810;padding:12px 16px;cursor:pointer;letter-spacing:1px;",
            {
              cls: "pixbtn",
              text: "RESET",
              on: {
                click: function () {
                  B.cmd.reset();
                },
              },
            }
          ),
        ],
      });
    }
    body.appendChild(ctrls);

    // 빠른 이동
    body.appendChild(
      E("div", "display:flex;gap:16px;margin-top:13px;", {
        kids: [
          E(
            "button",
            "font-family:'VT323';font-size:16px;color:#9a8fb8;background:none;border:0;cursor:pointer;",
            {
              text: "⚙ 설정",
              on: {
                click: function () {
                  B.cmd.openSettings();
                },
              },
            }
          ),
          E(
            "button",
            "font-family:'VT323';font-size:16px;color:#9a8fb8;background:none;border:0;cursor:pointer;",
            {
              text: "🖼 우리 사진",
              on: {
                click: function () {
                  B.cmd.openPhotos();
                },
              },
            }
          ),
        ],
      })
    );

    card.appendChild(bar);
    card.appendChild(body);

    // 우하단 크기조절 그립 (borderless 창은 OS 리사이즈 영역이 얇아 직접 제공)
    var grip = E(
      "div",
      "position:absolute;right:3px;bottom:3px;width:20px;height:20px;cursor:nwse-resize;z-index:9;" +
        "background:repeating-linear-gradient(135deg,transparent,transparent 3px,#6f658a 3px,#6f658a 4px);",
      {
        attr: { title: "크기 조절" },
        on: {
          mousedown: function (e) {
            e.preventDefault();
            appWin.startResizeDragging("SouthEast");
          },
        },
      }
    );
    card.appendChild(grip);

    app.appendChild(card);
    B.fit(card, 400, 588);
  }

  B.onState(function (s) {
    state = s;
    render();
  });
  window.addEventListener("resize", render);
  B.onChime(function () {
    if (state && state.soundOn) B.chime();
  });
  B.Photos.onChange(render);
  B.Names.onChange(render);
})();
