// 설정 창 (디자인 섹션 05).
(function () {
  var B = window.Bridge,
    E = B.el;
  var root = document.getElementById("app");
  var state = null;

  function spin(label, valueText, valueColor, dec, inc) {
    return E("div", "display:flex;align-items:center;gap:10px;", {
      kids: [
        E("span", "flex:1;font-family:'VT323';font-size:19px;color:#f3ead6;", {
          text: label,
        }),
        E(
          "button",
          "font-family:'Press Start 2P';font-size:10px;color:#f3ead6;background:#2a2440;border:2px solid #0a0810;padding:7px 11px;cursor:pointer;",
          { cls: "pixbtn", text: "−", on: { click: dec } }
        ),
        E(
          "div",
          "width:64px;text-align:center;font-family:'VT323';font-size:20px;color:" +
            valueColor +
            ";background:#15111f;border:2px solid #2a2440;padding:5px;",
          { text: valueText }
        ),
        E(
          "button",
          "font-family:'Press Start 2P';font-size:10px;color:#f3ead6;background:#2a2440;border:2px solid #0a0810;padding:7px 11px;cursor:pointer;",
          { cls: "pixbtn", text: "+", on: { click: inc } }
        ),
      ],
    });
  }

  function toggleRow(label, on, fn) {
    return E("div", "display:flex;align-items:center;gap:10px;", {
      kids: [
        E("span", "flex:1;font-family:'VT323';font-size:19px;color:#f3ead6;", {
          text: label,
        }),
        E("div", "", {
          cls: "toggle " + (on ? "on" : "off"),
          kids: [E("div", "")],
          on: { click: fn },
        }),
      ],
    });
  }

  function divider() {
    return E("div", "height:2px;background:#2a2440;");
  }

  function nameField(id) {
    var inp = E(
      "input",
      "width:92px;font-family:'VT323';font-size:18px;color:#f3ead6;background:#15111f;border:2px solid #2a2440;padding:5px 8px;-webkit-user-select:text;user-select:text;",
      { attr: { type: "text", maxlength: "8", value: B.Names.get(id) } }
    );
    inp.addEventListener("change", function () {
      B.Names.set(id, inp.value.trim());
    });
    return inp;
  }

  function nameRow() {
    return E("div", "display:flex;align-items:center;gap:10px;", {
      kids: [
        E("span", "flex:1;font-family:'VT323';font-size:19px;color:#f3ead6;", {
          text: "이름 (나 · 연인)",
        }),
        nameField("me"),
        nameField("partner"),
      ],
    });
  }

  function render() {
    if (!state) return;
    root.innerHTML = "";
    // 윈도우를 채우는 뷰포트 + 고정폭 카드 → 창 크기에 맞춰 비율 유지 스케일
    root.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:flex-start;overflow:hidden;background:#1b1626;";
    var card = E(
      "div",
      "width:400px;background:#1b1626;padding:18px;display:flex;flex-direction:column;gap:14px;"
    );

    card.appendChild(
      spin(
        "집중 시간",
        state.focusMin + "분",
        "#6cc257",
        function () {
          B.cmd.adjFocus(-5);
        },
        function () {
          B.cmd.adjFocus(5);
        }
      )
    );
    card.appendChild(
      spin(
        "휴식 시간",
        state.breakMin + "분",
        "#5ac8e8",
        function () {
          B.cmd.adjBreak(-1);
        },
        function () {
          B.cmd.adjBreak(1);
        }
      )
    );
    card.appendChild(divider());
    card.appendChild(nameRow());
    card.appendChild(divider());
    card.appendChild(
      toggleRow("알림음 (띵!)", state.soundOn, function () {
        B.cmd.setSound(!state.soundOn);
      })
    );
    card.appendChild(
      toggleRow("휴식 자동 시작", state.autoStartBreak, function () {
        B.cmd.setAutoStartBreak(!state.autoStartBreak);
      })
    );
    card.appendChild(divider());

    // 테마 (시각 표시용)
    var sel = localStorage.getItem("theme") || "#1b1626";
    function sw(c) {
      return E(
        "span",
        "width:24px;height:24px;background:" +
          c +
          ";border:" +
          (sel === c ? "3px solid #f4c14e" : "2px solid #0a0810") +
          ";cursor:pointer;",
        {
          on: {
            click: function () {
              localStorage.setItem("theme", c);
              render();
            },
          },
        }
      );
    }
    card.appendChild(
      E("div", "display:flex;align-items:center;gap:10px;", {
        kids: [
          E("span", "flex:1;font-family:'VT323';font-size:19px;color:#f3ead6;", {
            text: "테마",
          }),
          sw("#1b1626"),
          sw("#141b26"),
          sw("#241622"),
        ],
      })
    );

    // 사진 관리
    card.appendChild(
      E("div", "display:flex;align-items:center;gap:10px;padding-top:2px;", {
        kids: [
          E("span", "flex:1;font-family:'VT323';font-size:19px;color:#f3ead6;", {
            text: "우리 사진 관리",
          }),
          E(
            "button",
            "font-family:'VT323';font-size:16px;color:#14111d;background:#6cc257;border:2px solid #0a0810;padding:6px 12px;cursor:pointer;",
            {
              cls: "pixbtn",
              text: "열기 →",
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

    root.appendChild(card);
    B.fit(card, 400);
  }

  window.addEventListener("resize", function () {
    if (state) render();
  });

  // 설정 창에는 초 단위 시계가 없으므로, 표시값이 실제로 바뀔 때만 다시 그린다
  // (매 틱 재렌더하면 이름 입력 중 포커스를 잃는다).
  var lastSig = null;
  B.onState(function (s) {
    state = s;
    var sig = [s.focusMin, s.breakMin, s.soundOn, s.autoStartBreak].join("|");
    if (sig === lastSig) return;
    lastSig = sig;
    render();
  });
  B.Names.onChange(render);
})();
