# Pomotomo 🍅

> 커플용 **픽셀 뽀모도로 타이머** (macOS 메뉴바 앱)
> 집중할수록 픽셀 토마토가 초록 → 주황 → 빨강으로 **익어갑니다.**

[Claude Design](https://claude.ai/design) 시안 `Pomotomo.dc.html` 을 **Tauri (Rust + 웹UI)** 로 구현한 데스크톱 앱입니다. 두 사람의 사진을 등록해 함께 집중 시간을 키워요.

---

## ✨ 주요 기능

| 화면 | 설명 |
|---|---|
| **메인 타이머** | 집중/휴식 탭, 익어가는 픽셀 토마토, 두 사람 프로필, 오늘의 세션 토마토 카운트 |
| **메뉴바(트레이)** | 토마토 아이콘 + 남은 시간을 **상시 표시**. 진행도·표정이 실시간 반영되고, 클릭하면 시작/멈춤·시간설정·사진교체 드롭다운 |
| **사진 고르기** | 내 사진·연인 사진·커플 사진을 **클릭 또는 드래그&드롭**으로 지정 (IndexedDB 저장) |
| **휴식 화면** | 자는 토마토 + 우리 사진 |
| **설정** | 집중/휴식 시간, 이름, 알림음, 휴식 자동시작, 테마 |

- 🍅 시간에 따라 익는 **픽셀 토마토**(표정 포함) — 앱·메뉴바 어디서나 동일
- 👫 **이름·사진**은 모든 창에서 공유되는 자원 (설정에서 바꾸면 전체 반영)
- 🪟 **반응형 UI** — 창 크기를 바꿔도 좌상단 고정, 비율 유지
- 🔕 백엔드/계정/네트워크 없음 — 모든 데이터는 로컬에만 저장

---

## 🛠 기술 스택

- **Tauri 2** (Rust 백엔드 + 시스템 WebView) — Electron과 달리 브라우저를 번들하지 않아 가볍습니다
- **프런트엔드**: 의존성 없는 바닐라 HTML/CSS/JS (창마다 HTML 1개)
- **타이머 상태**: Rust 가 단일 진실 공급원, 1초 틱을 모든 창에 이벤트로 브로드캐스트
- **사진 저장**: IndexedDB (창 간 공유)

---

## 📁 프로젝트 구조

```
src/                        웹 프런트엔드
  index.html  / main.js       메인 타이머 창 (휴식 화면 포함)
  tray.html   / tray.js       메뉴바 드롭다운
  settings.html / settings.js 설정
  photos.html / photos.js     사진 고르기
  tomato.core.js              픽셀 토마토 격자 계산 (브라우저+Node 공용)
  tomato.js                   토마토 canvas 렌더러
  bridge.js                   Tauri invoke/event 래퍼, 사진·이름 저장소, UI 헬퍼
src-tauri/                   Rust 백엔드
  src/lib.rs                  타이머 상태, 1초 틱, 트레이(라이브 토마토), 창 관리, 커맨드
tools/gen-icon.js            픽셀 토마토 → 앱 아이콘 PNG 생성기
```

---

## 🚀 시작하기

### 요구 사항
- macOS + [Xcode Command Line Tools](https://developer.apple.com/xcode/) (`xcode-select --install`)
- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 18+

### 설치 & 실행
```bash
git clone https://github.com/SungilBang12/Pomotomo.git
cd Pomotomo
npm install        # @tauri-apps/cli, @tauri-apps/api
npm run dev        # 개발 실행 (tauri dev)
```

### 빌드 (.app / .dmg)
```bash
npm run build
```

### 아이콘 재생성 (토마토 모양을 바꿨을 때만)
```bash
npm run icon       # tools/gen-icon.js 로 토마토 아이콘 생성 → src-tauri/icons/
```

> 첫 `npm run dev` 는 Rust 의존성을 컴파일하느라 몇 분 걸릴 수 있습니다.

---

## ⚙️ 동작 방식

- **타이머**는 Rust(`src-tauri/src/lib.rs`)가 소유합니다. 1초마다 틱을 돌려
  `timer://state` 이벤트로 모든 창을 동기화하므로, 메뉴바·메인·설정이 항상 같은 시간을 보여줍니다.
- **메뉴바 토마토**는 매 틱 Rust에서 진행도·표정에 맞춰 RGBA 이미지로 그려 트레이 아이콘으로 갱신합니다.
- **사진**은 IndexedDB(`pomotomo` DB)에 저장하고 `photos://changed` 이벤트로 창끼리 공유합니다.
  원본은 캔버스로 최대 2048px 까지 축소 후 저장합니다.
- **이름**은 `localStorage` + `names://changed` 이벤트로 공유합니다.

---

## 🔐 환경 변수

이 앱은 **외부 API·시크릿이 없어** 필수 환경 변수가 없습니다.
설정 가능한 항목은 [`.env.example`](./.env.example) 참고 (실제 `.env` 는 커밋되지 않습니다).

---

## 📄 라이선스

원하는 라이선스를 추가하세요 (예: MIT). 미지정 시 기본적으로 모든 권리는 저작자에게 있습니다.
