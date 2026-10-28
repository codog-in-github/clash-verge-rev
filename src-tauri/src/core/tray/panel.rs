use anyhow::Result;
use tauri::{Manager as _, PhysicalPosition, PhysicalSize, Rect, Theme, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::core::handle::Handle;

const PANEL_LABEL: &str = "tray-panel";
const PANEL_WIDTH: f64 = 360.0;
const PANEL_HEIGHT: f64 = 600.0;

pub(super) fn toggle_from_menu(theme_mode: Option<&str>) -> Result<()> {
    let app = Handle::app_handle();
    let rect = app
        .tray_by_id(super::TRAY_ID)
        .map(|tray| tray.rect())
        .transpose()?
        .flatten();
    let rect = match rect {
        Some(rect) => rect,
        None => {
            let position = app.primary_monitor()?.map_or(PhysicalPosition::new(0, 0), |monitor| {
                let area = monitor.work_area();
                PhysicalPosition::new(area.position.x + area.size.width as i32, area.position.y)
            });
            Rect {
                position: position.into(),
                size: PhysicalSize::new(0_u32, 0_u32).into(),
            }
        }
    };
    toggle(rect, theme_mode)
}

pub(super) fn toggle(rect: Rect, theme_mode: Option<&str>) -> Result<()> {
    let app = Handle::app_handle();
    let window = match app.get_webview_window(PANEL_LABEL) {
        Some(window) => {
            if window.is_visible()? {
                window.hide()?;
                return Ok(());
            }
            window
        }
        None => {
            let theme = match theme_mode {
                Some("dark") => Some(Theme::Dark),
                Some("light") => Some(Theme::Light),
                _ => None,
            };
            let dark = theme == Some(Theme::Dark)
                || (theme.is_none() && !matches!(dark_light::detect().ok(), Some(dark_light::Mode::Light)));
            let background = if dark {
                tauri::utils::config::Color(15, 17, 20, 255)
            } else {
                tauri::utils::config::Color(245, 247, 249, 255)
            };
            let window = WebviewWindowBuilder::new(app, PANEL_LABEL, WebviewUrl::App("tray".into()))
                .title("Clash Verge")
                .inner_size(PANEL_WIDTH, PANEL_HEIGHT)
                .decorations(false)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .skip_taskbar(true)
                .always_on_top(true)
                .theme(theme)
                .background_color(background)
                .visible(false)
                .build()?;
            let panel = window.clone();
            window.on_window_event(move |event| match event {
                WindowEvent::Focused(false) => {
                    let _ = panel.hide();
                }
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = panel.hide();
                }
                _ => {}
            });
            window
        }
    };

    // Tray coordinates are physical; the popover dimensions are logical on HiDPI displays.
    let anchor = rect.position.to_physical::<f64>(1.0);
    let monitor = app.monitor_from_point(anchor.x, anchor.y)?.or(app.primary_monitor()?);
    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        let icon_size = rect.size.to_physical::<f64>(scale);
        let area = monitor.work_area();
        let margin = 8.0 * scale;
        let width = (PANEL_WIDTH * scale).min(f64::from(area.size.width) - margin * 2.0);
        let height = (PANEL_HEIGHT * scale).min(f64::from(area.size.height) - margin * 2.0);
        let left = f64::from(area.position.x) + margin;
        let top = f64::from(area.position.y) + margin;
        let right = f64::from(area.position.x) + f64::from(area.size.width) - width - margin;
        let bottom = f64::from(area.position.y) + f64::from(area.size.height) - height - margin;
        let x = (anchor.x + icon_size.width / 2.0 - width / 2.0).clamp(left, right.max(left));
        let below = anchor.y + icon_size.height + margin;
        let y = if below <= bottom {
            below
        } else {
            anchor.y - height - margin
        }
        .clamp(top, bottom.max(top));
        window.set_size(PhysicalSize::new(width, height))?;
        window.set_position(PhysicalPosition::new(x, y))?;
    }
    window.show()?;
    window.set_focus()?;
    Ok(())
}
