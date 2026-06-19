// Pomotomo — 커플용 픽셀 뽀모도로 타이머
//
// Rust 가 타이머의 단일 진실 공급원이다. 1초마다 틱을 돌면서 상태를 갱신하고
// 모든 창(main / tray / settings / photos)에 `timer://state` 이벤트로 브로드캐스트한다.
// 메뉴바 트레이는 토마토 아이콘 + 남은 시간을 항상 보여주고, 클릭하면 드롭다운 창을 띄운다.

use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};

const TRAY_ID: &str = "pomotomo-tray";

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Focus,
    Break,
}

impl Mode {
    fn as_str(self) -> &'static str {
        match self {
            Mode::Focus => "focus",
            Mode::Break => "break",
        }
    }
}

struct Timer {
    focus_min: u32,
    break_min: u32,
    left_sec: i64,
    running: bool,
    mode: Mode,
    sessions: u32,
    auto_start_break: bool,
    sound_on: bool,
}

impl Default for Timer {
    fn default() -> Self {
        // 초기 상태: 집중 25분 / 휴식 5분, 오늘 0번 집중(앱 시작 시 0부터)
        Timer {
            focus_min: 25,
            break_min: 5,
            left_sec: 25 * 60,
            running: false,
            mode: Mode::Focus,
            sessions: 0,
            auto_start_break: false,
            sound_on: true,
        }
    }
}

impl Timer {
    /// 현재 모드 기준 한 사이클의 총 길이(초).
    fn total_sec(&self) -> i64 {
        (if self.mode == Mode::Focus {
            self.focus_min
        } else {
            self.break_min
        }) as i64
            * 60
    }
}

struct AppState {
    inner: Mutex<Timer>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    focus_min: u32,
    break_min: u32,
    left_sec: i64,
    running: bool,
    mode: String,
    sessions: u32,
    auto_start_break: bool,
    sound_on: bool,
    /// 한 사이클 진행도 0.0 ~ 1.0 (토마토 익힘 정도)
    progress: f64,
    /// "mm:ss"
    time_str: String,
}

fn fmt(sec: i64) -> String {
    let sec = sec.max(0);
    format!("{:02}:{:02}", sec / 60, sec % 60)
}

fn snapshot(t: &Timer) -> Snapshot {
    let total = t.total_sec().max(1);
    let progress = ((total - t.left_sec) as f64 / total as f64).clamp(0.0, 1.0);
    Snapshot {
        focus_min: t.focus_min,
        break_min: t.break_min,
        left_sec: t.left_sec,
        running: t.running,
        mode: t.mode.as_str().to_string(),
        sessions: t.sessions,
        auto_start_break: t.auto_start_break,
        sound_on: t.sound_on,
        progress,
        time_str: fmt(t.left_sec),
    }
}

/// 픽셀 토마토를 RGBA 이미지로 그린다 (프런트 tomato.core.js 의 격자 로직을 Rust 로 이식).
/// 트레이 아이콘을 진행도/표정에 맞춰 매 틱 갱신하는 데 쓴다 — "우리 토마토"가 메뉴바에 그대로 산다.
fn tomato_image(p: f64, face: &str, size: u32) -> tauri::image::Image<'static> {
    use std::collections::HashMap;
    const W: i32 = 14;
    const H: i32 = 14;
    let (cx, cy, rx, ry) = (6.5f64, 8.2f64, 6.4f64, 5.7f64);
    let (body_min, body_max) = (6.0f64, 13.0f64);
    let green = [0x6c, 0xc2, 0x57];
    let red = [0xe8, 0x45, 0x3c];
    let orange = [0xf0, 0x90, 0x3a];

    fn lerp(a: [f64; 3], b: [f64; 3], t: f64) -> [f64; 3] {
        [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
        ]
    }
    fn adj(c: [u8; 3], amt: f64) -> [u8; 3] {
        let m = [c[0] as f64, c[1] as f64, c[2] as f64];
        let t = if amt > 0.0 {
            [255.0, 255.0, 255.0]
        } else {
            [0.0, 0.0, 0.0]
        };
        let r = lerp(m, t, amt.abs());
        [r[0] as u8, r[1] as u8, r[2] as u8]
    }

    // 표정 픽셀(눈/볼/입)
    let mut fset: HashMap<(i32, i32), [u8; 3]> = HashMap::new();
    let dk = [0x2a, 0x14, 0x24];
    let eye_y = 9;
    if face == "rest" {
        for c in [(4, eye_y), (5, eye_y), (9, eye_y), (10, eye_y)] {
            fset.insert(c, dk);
        }
    } else {
        for c in [(5, eye_y), (9, eye_y)] {
            fset.insert(c, dk);
        }
    }
    if face != "rest" {
        for c in [(4, 10), (10, 10)] {
            fset.insert(c, [0xf2, 0x84, 0x9a]);
        }
    }
    match face {
        "happy" => {
            for c in [(6, 11), (7, 12), (8, 11)] {
                fset.insert(c, dk);
            }
        }
        "focused" => {
            for c in [(6, 11), (7, 11), (8, 11)] {
                fset.insert(c, dk);
            }
        }
        "rest" => {
            for c in [(7, 11), (8, 11)] {
                fset.insert(c, dk);
            }
        }
        _ => {}
    }

    let mut cells = [[None::<[u8; 3]>; 14]; 14];
    for y in 0..H {
        for x in 0..W {
            let dx = (x as f64 - cx) / rx;
            let dy = (y as f64 - cy) / ry;
            let d = dx * dx + dy * dy;
            let stem = (x == 6 && (y == 2 || y == 3)) || (x == 7 && (y == 1 || y == 2));
            let mut color: Option<[u8; 3]> = None;
            if stem {
                color = Some([0x6f, 0x4a, 0x2f]);
            } else if d <= 1.0 {
                if y <= 5 {
                    color = Some([0x3f, 0xa1, 0x4b]); // 잎
                } else {
                    let thr = body_max - p * (body_max - body_min);
                    let mut cc = if (y as f64) > thr + 0.5 {
                        red
                    } else if (y as f64) > thr - 0.5 {
                        orange
                    } else {
                        green
                    };
                    if (x as f64) <= cx - 1.0 && y <= 8 {
                        cc = adj(cc, 0.13);
                    }
                    if (x as f64) >= cx + 2.0 && y >= 11 {
                        cc = adj(cc, -0.12);
                    }
                    color = Some(cc);
                }
            }
            if let Some(fc) = fset.get(&(x, y)) {
                if color.is_some() || d <= 1.0 {
                    color = Some(*fc);
                }
            }
            cells[y as usize][x as usize] = color;
        }
    }

    // 14x14 격자를 size x size RGBA(투명 배경)로 확대
    let mut buf = vec![0u8; (size * size * 4) as usize];
    let u = size as f64 / W as f64;
    for y in 0..H {
        for x in 0..W {
            if let Some(c) = cells[y as usize][x as usize] {
                let x0 = (x as f64 * u).round() as i32;
                let x1 = ((x as f64 + 1.0) * u).round() as i32;
                let y0 = (y as f64 * u).round() as i32;
                let y1 = ((y as f64 + 1.0) * u).round() as i32;
                for yy in y0..y1 {
                    for xx in x0..x1 {
                        if xx < 0 || yy < 0 || xx >= size as i32 || yy >= size as i32 {
                            continue;
                        }
                        let i = ((yy as u32 * size + xx as u32) * 4) as usize;
                        buf[i] = c[0];
                        buf[i + 1] = c[1];
                        buf[i + 2] = c[2];
                        buf[i + 3] = 255;
                    }
                }
            }
        }
    }
    tauri::image::Image::new_owned(buf, size, size)
}

/// 현재 상태를 모든 창에 보내고, 트레이 아이콘(라이브 토마토) + 타이틀(남은 시간)을 갱신한다.
fn broadcast(app: &AppHandle) {
    let snap = {
        let st = app.state::<AppState>();
        let t = st.inner.lock().unwrap();
        snapshot(&t)
    };
    let _ = app.emit("timer://state", snap.clone());
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_title(Some(snap.time_str.clone()));
        let face = if snap.mode == "break" {
            "rest"
        } else if snap.running {
            "focused"
        } else {
            "happy"
        };
        let _ = tray.set_icon(Some(tomato_image(snap.progress, face, 40)));
    }
}

// ------------------------- commands -------------------------

#[tauri::command]
fn get_state(state: State<AppState>) -> Snapshot {
    let t = state.inner.lock().unwrap();
    snapshot(&t)
}

#[tauri::command]
fn toggle(app: AppHandle, state: State<AppState>) {
    {
        let mut t = state.inner.lock().unwrap();
        t.running = !t.running;
    }
    broadcast(&app);
}

#[tauri::command]
fn reset(app: AppHandle, state: State<AppState>) {
    {
        let mut t = state.inner.lock().unwrap();
        t.running = false;
        t.left_sec = t.total_sec();
    }
    broadcast(&app);
}

#[tauri::command]
fn skip(app: AppHandle, state: State<AppState>) {
    {
        let mut t = state.inner.lock().unwrap();
        if t.mode == Mode::Focus {
            t.mode = Mode::Break;
            t.left_sec = t.break_min as i64 * 60;
            t.running = false;
            t.sessions += 1;
        } else {
            t.mode = Mode::Focus;
            t.left_sec = t.focus_min as i64 * 60;
            t.running = false;
        }
    }
    broadcast(&app);
}

#[tauri::command]
fn to_focus(app: AppHandle, state: State<AppState>) {
    {
        let mut t = state.inner.lock().unwrap();
        t.mode = Mode::Focus;
        t.left_sec = t.focus_min as i64 * 60;
        t.running = false;
    }
    broadcast(&app);
}

#[tauri::command]
fn to_break(app: AppHandle, state: State<AppState>) {
    {
        let mut t = state.inner.lock().unwrap();
        t.mode = Mode::Break;
        t.left_sec = t.break_min as i64 * 60;
        t.running = false;
    }
    broadcast(&app);
}

#[tauri::command]
fn adj_focus(app: AppHandle, state: State<AppState>, delta: i32) {
    {
        let mut t = state.inner.lock().unwrap();
        let f = (t.focus_min as i32 + delta).clamp(5, 90) as u32;
        t.focus_min = f;
        if t.mode == Mode::Focus && !t.running {
            t.left_sec = f as i64 * 60;
        }
    }
    broadcast(&app);
}

#[tauri::command]
fn adj_break(app: AppHandle, state: State<AppState>, delta: i32) {
    {
        let mut t = state.inner.lock().unwrap();
        let b = (t.break_min as i32 + delta).clamp(1, 30) as u32;
        t.break_min = b;
        if t.mode == Mode::Break && !t.running {
            t.left_sec = b as i64 * 60;
        }
    }
    broadcast(&app);
}

#[tauri::command]
fn preset(app: AppHandle, state: State<AppState>, min: u32) {
    {
        let mut t = state.inner.lock().unwrap();
        t.focus_min = min.clamp(5, 90);
        t.running = false;
        t.mode = Mode::Focus;
        t.left_sec = t.focus_min as i64 * 60;
    }
    broadcast(&app);
}

#[tauri::command]
fn set_auto_start_break(app: AppHandle, state: State<AppState>, v: bool) {
    {
        let mut t = state.inner.lock().unwrap();
        t.auto_start_break = v;
    }
    broadcast(&app);
}

#[tauri::command]
fn set_sound(app: AppHandle, state: State<AppState>, v: bool) {
    {
        let mut t = state.inner.lock().unwrap();
        t.sound_on = v;
    }
    broadcast(&app);
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    show_or_create(&app, "settings", "settings.html", "Pomotomo · 설정", 400.0, 520.0);
}

#[tauri::command]
fn open_photos(app: AppHandle) {
    show_or_create(&app, "photos", "photos.html", "Pomotomo · 우리 사진", 560.0, 600.0);
}

#[tauri::command]
fn hide_tray(app: AppHandle) {
    if let Some(w) = app.get_webview_window("tray") {
        let _ = w.hide();
    }
}

fn show_or_create(app: &AppHandle, label: &str, file: &str, title: &str, w: f64, h: f64) {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, label, WebviewUrl::App(file.into()))
        .title(title)
        .inner_size(w, h)
        .min_inner_size(w * 0.6, h * 0.6)
        .resizable(true)
        .disable_drag_drop_handler() // HTML5 드래그&드롭(사진 끌어놓기)을 웹뷰가 처리하도록
        .build();
}

// ------------------------- app entry -------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            inner: Mutex::new(Timer::default()),
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            toggle,
            reset,
            skip,
            to_focus,
            to_break,
            adj_focus,
            adj_break,
            preset,
            set_auto_start_break,
            set_sound,
            open_settings,
            open_photos,
            hide_tray,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // --- 메뉴바 트레이 (토마토 아이콘 + 남은 시간) ---
            let icon = app
                .default_window_icon()
                .cloned()
                .expect("default window icon (run `npm run icon` to generate)");
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(icon)
                .icon_as_template(false)
                .title("25:00")
                .tooltip("Pomotomo")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("tray") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                if let Ok(size) = win.outer_size() {
                                    let x = (position.x - size.width as f64 / 2.0).max(8.0);
                                    let y = position.y + 6.0;
                                    let _ = win.set_position(PhysicalPosition::new(x, y));
                                }
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // --- 트레이 드롭다운 창 (테두리 없는 떠있는 창, 처음엔 숨김) ---
            let tray_win = WebviewWindowBuilder::new(
                app,
                "tray",
                WebviewUrl::App("tray.html".into()),
            )
            .title("Pomotomo")
            .inner_size(300.0, 432.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .build()?;

            // 트레이 창은 포커스를 잃으면 닫힌다(메뉴 느낌).
            let tw = tray_win.clone();
            tray_win.on_window_event(move |e| {
                if let WindowEvent::Focused(false) = e {
                    let _ = tw.hide();
                }
            });

            // --- 메인 창: 닫기 → 종료 대신 숨김 (메뉴바 앱처럼 백그라운드 유지) ---
            if let Some(main) = app.get_webview_window("main") {
                let m = main.clone();
                main.on_window_event(move |e| {
                    if let WindowEvent::CloseRequested { api, .. } = e {
                        api.prevent_close();
                        let _ = m.hide();
                    }
                });
            }

            // 시작하자마자 메뉴바에 라이브 토마토를 반영
            broadcast(&handle);

            // --- 1초 틱 루프 ---
            thread::spawn(move || loop {
                thread::sleep(Duration::from_secs(1));
                let mut chimed = false;
                {
                    let st = handle.state::<AppState>();
                    let mut t = st.inner.lock().unwrap();
                    if t.running {
                        if t.left_sec > 1 {
                            t.left_sec -= 1;
                        } else if t.mode == Mode::Focus {
                            // 집중 끝 → 휴식. 자동시작이 켜져 있으면 바로 흐른다. 세션 +1.
                            t.mode = Mode::Break;
                            t.left_sec = t.break_min as i64 * 60;
                            t.running = t.auto_start_break;
                            t.sessions += 1;
                            chimed = t.sound_on;
                        } else {
                            // 휴식 끝 → 집중(정지 상태로 대기).
                            t.mode = Mode::Focus;
                            t.left_sec = t.focus_min as i64 * 60;
                            t.running = false;
                            chimed = t.sound_on;
                        }
                    }
                }
                broadcast(&handle);
                if chimed {
                    // 알림음/전환은 프런트가 처리하도록 신호만 보낸다.
                    let _ = handle.emit("timer://chime", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running pomotomo");
}
