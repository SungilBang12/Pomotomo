// 사진 고르기 창 (디자인 섹션 03). 슬롯 클릭/드롭으로 사진 지정.
(function () {
  var B = window.Bridge,
    E = B.el;
  var root = document.getElementById("app");

  function dest(id, label, ph) {
    return E(
      "div",
      "display:flex;flex-direction:column;align-items:center;gap:7px;",
      {
        kids: [
          E("div", "padding:4px;background:#2a2440;border:3px solid #0a0810;", {
            kids: [B.photoSlot(id, 96, 96, ph)],
          }),
          E("div", "font-family:'VT323';font-size:18px;color:#cdbff0;", {
            text: label,
          }),
        ],
      }
    );
  }

  function albumTile(heart) {
    return E(
      "div",
      "aspect-ratio:1;background:repeating-linear-gradient(45deg,#241e34,#241e34 5px,#2c2542 5px,#2c2542 10px);border:2px solid #0a0810;position:relative;",
      {
        kids: [
          heart
            ? E(
                "span",
                "position:absolute;top:3px;right:3px;font-family:'VT323';font-size:14px;color:#e8453c;",
                { text: "♥" }
              )
            : null,
        ],
      }
    );
  }

  function render() {
    root.innerHTML = "";
    // 뷰포트 + 고정폭 카드 → 창 크기에 맞춰 비율 유지 스케일
    root.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:flex-start;overflow:hidden;background:#1b1626;";
    var card = E(
      "div",
      "width:560px;background:#1b1626;padding:20px;box-shadow:inset 0 0 0 2px #251f37;"
    );

    // 목적지 슬롯
    card.appendChild(
      E(
        "div",
        "display:flex;gap:16px;justify-content:center;align-items:center;margin-bottom:18px;",
        {
          kids: [
            dest("me", B.Names.get("me") + " (나)", "내 사진"),
            E(
              "div",
              "font-family:'Press Start 2P';font-size:16px;color:#e8453c;",
              { text: "♥" }
            ),
            dest("partner", B.Names.get("partner") + " (연인)", "연인 사진"),
          ],
        }
      )
    );

    // 커플 사진
    card.appendChild(
      E(
        "div",
        "display:flex;flex-direction:column;align-items:center;gap:7px;margin-bottom:18px;",
        {
          kids: [
            E("div", "padding:4px;background:#1d3140;border:3px solid #0a0810;", {
              kids: [B.photoSlot("couple", 230, 96, "둘이 찍은 사진 한 장")],
            }),
            E("div", "font-family:'VT323';font-size:16px;color:#6fa3b8;", {
              text: "휴식 화면에 보이는 우리 사진",
            }),
          ],
        }
      )
    );

    // 사진첩 레이블
    card.appendChild(
      E(
        "div",
        "font-family:'VT323';font-size:16px;color:#6f658a;letter-spacing:1px;margin-bottom:9px;display:flex;justify-content:space-between;",
        {
          kids: [
            E("span", "", { text: "사진첩" }),
            E("span", "color:#9a8fb8;", { text: "최근 항목 ▾" }),
          ],
        }
      )
    );

    var grid = E(
      "div",
      "display:grid;grid-template-columns:repeat(5,1fr);gap:8px;"
    );
    for (var i = 0; i < 10; i++) grid.appendChild(albumTile(i === 0 || i === 2));
    card.appendChild(grid);

    card.appendChild(
      E(
        "div",
        "font-family:'VT323';font-size:16px;color:#6f658a;margin-top:12px;text-align:center;",
        { text: "슬롯을 클릭하거나 사진을 끌어다 놓으면 모든 화면에 적용돼요" }
      )
    );

    root.appendChild(card);
    B.fit(card, 560);
  }

  render();
  B.Photos.onChange(render);
  B.Names.onChange(render);
  window.addEventListener("resize", render);
})();
