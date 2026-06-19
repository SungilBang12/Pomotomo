// 메뉴바 드롭다운 창 (디자인 섹션 02).
(function () {
  var B = window.Bridge,
    E = B.el;
  var root = document.getElementById("app");
  var state = null;

  function pbtn(css, label, fn) {
    return E("button", css, {
      cls: "pixbtn",
      text: label,
      on: { click: fn },
    });
  }

  function render() {
    if (!state) return;
    var d = B.derive(state);
    root.innerHTML = "";
    root.style.cssText =
      "width:100vw;height:100vh;background:#1b1626;border:3px solid #0a0810;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;";

    // 헤더
    root.appendChild(
      E(
        "div",
        "display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:2px solid #2a2440;flex:none;",
        {
          kids: [
            window.renderTomato(d.p, { size: 17, mode: "fill" }),
            E("span", "font-family:'Press Start 2P';font-size:9px;color:#f3ead6;", {
              text: "POMOTOMO",
            }),
            E("span", "flex:1;"),
            E(
              "span",
              "font-family:'VT323';font-size:15px;color:#14111d;background:" +
                (d.isBreak ? "#5ac8e8" : "#f4c14e") +
                ";padding:1px 8px;cursor:pointer;",
              {
                cls: "pixbtn",
                attr: { title: "집중/휴식 전환" },
                text: d.modeLabel + " ⇄",
                on: {
                  click: function () {
                    if (state.mode === "focus") B.cmd.toBreak();
                    else B.cmd.toFocus();
                  },
                },
              }
            ),
          ],
        }
      )
    );

    // 시간 + 컨트롤
    root.appendChild(
      E("div", "padding:14px;text-align:center;flex:none;", {
        kids: [
          E(
            "div",
            "font-family:'Press Start 2P';font-size:24px;color:#f3ead6;letter-spacing:1px;margin-bottom:12px;text-shadow:0 3px 0 #0a0810;",
            { text: d.timeStr }
          ),
          E("div", "display:flex;gap:8px;justify-content:center;", {
            kids: [
              pbtn(
                "flex:1;font-family:'Press Start 2P';font-size:9px;color:#14111d;background:" +
                  d.startBtnColor +
                  ";border:3px solid #0a0810;box-shadow:3px 3px 0 #0a0810;padding:10px;cursor:pointer;",
                d.startLabel,
                function () {
                  B.cmd.toggle();
                }
              ),
              pbtn(
                "font-family:'Press Start 2P';font-size:9px;color:#f3ead6;background:#2a2440;border:3px solid #0a0810;box-shadow:3px 3px 0 #0a0810;padding:10px 12px;cursor:pointer;",
                "↺",
                function () {
                  B.cmd.reset();
                }
              ),
              pbtn(
                "font-family:'Press Start 2P';font-size:9px;color:#f3ead6;background:#2a2440;border:3px solid #0a0810;box-shadow:3px 3px 0 #0a0810;padding:10px 12px;cursor:pointer;",
                "»",
                function () {
                  B.cmd.skip();
                }
              ),
            ],
          }),
        ],
      })
    );

    // 시간 설정
    root.appendChild(
      E("div", "padding:0 14px 14px;flex:none;", {
        kids: [
          E(
            "div",
            "font-family:'VT323';font-size:16px;color:#6f658a;letter-spacing:1px;margin-bottom:7px;",
            { text: "시간 설정" }
          ),
          E("div", "display:flex;align-items:center;gap:8px;margin-bottom:9px;", {
            kids: [
              pbtn(
                "font-family:'Press Start 2P';font-size:11px;color:#f3ead6;background:#2a2440;border:2px solid #0a0810;padding:8px 12px;cursor:pointer;",
                "−",
                function () {
                  B.cmd.adjFocus(-5);
                }
              ),
              E(
                "div",
                "flex:1;text-align:center;font-family:'VT323';font-size:22px;color:#f3ead6;background:#15111f;border:2px solid #2a2440;padding:5px;",
                { text: state.focusMin + "분" }
              ),
              pbtn(
                "font-family:'Press Start 2P';font-size:11px;color:#f3ead6;background:#2a2440;border:2px solid #0a0810;padding:8px 12px;cursor:pointer;",
                "+",
                function () {
                  B.cmd.adjFocus(5);
                }
              ),
            ],
          }),
          E("div", "display:flex;gap:7px;", {
            kids: [15, 25, 45].map(function (n) {
              return pbtn(
                "flex:1;font-family:'VT323';font-size:16px;color:#cdbff0;background:#15111f;border:2px solid #2a2440;padding:6px;cursor:pointer;",
                String(n),
                function () {
                  B.cmd.preset(n);
                }
              );
            }),
          }),
        ],
      })
    );

    // 사진 행
    function mini(id, ph) {
      return E("div", "padding:2px;background:#2a2440;border:2px solid #0a0810;", {
        kids: [B.photoSlot(id, 30, 30, ph)],
      });
    }
    root.appendChild(
      E(
        "div",
        "padding:13px 14px;border-top:2px solid #2a2440;display:flex;align-items:center;gap:9px;margin-top:auto;",
        {
          kids: [
            mini("me", "ME"),
            mini("partner", "YOU"),
            E(
              "span",
              "flex:1;font-family:'VT323';font-size:16px;color:#9a8fb8;line-height:1.05;",
              {
                html:
                  '우리 사진<br><span style="color:#6f658a;font-size:14px;">드래그해서 교체</span>',
              }
            ),
            pbtn(
              "font-family:'VT323';font-size:15px;color:#14111d;background:#6cc257;border:2px solid #0a0810;padding:6px 10px;cursor:pointer;",
              "교체…",
              function () {
                B.cmd.openPhotos();
              }
            ),
          ],
        }
      )
    );
  }

  B.onState(function (s) {
    state = s;
    render();
  });
  B.Photos.onChange(render);
})();
