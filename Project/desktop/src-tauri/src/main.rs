#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod store;

use base64::Engine;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Notify;

const REQUEST_LIMIT: usize = 32 * 1024 * 1024;
const RESPONSE_LIMIT: usize = 8 * 1024 * 1024;
const SAVE_LIMIT: usize = 256 * 1024 * 1024;
const KEY_SERVICE: &str = "com.basisstudio.desktop.ai";

struct NativeState {
    // Initialization failure is retained and exposed to the app. Never silently
    // substitute an empty library when existing files cannot be read.
    store: Result<Arc<store::Store>, String>,
    client: reqwest::Client,
    requests: Mutex<RequestBook>,
}

#[derive(Default)]
struct RequestBook {
    active: HashMap<String, Arc<Notify>>,
    cancelled: HashMap<String, u128>,
}

impl RequestBook {
    fn register(&mut self, request_id: &str) -> Result<Arc<Notify>, String> {
        let now = store::now_ms();
        self.cancelled
            .retain(|_, time| now.saturating_sub(*time) < 120_000);
        if self.cancelled.remove(request_id).is_some() {
            return Err("The AI request was cancelled.".into());
        }
        if self.active.len() >= 4 || self.active.contains_key(request_id) {
            return Err("Another AI request is active. Wait or cancel it before retrying.".into());
        }
        let cancel = Arc::new(Notify::new());
        self.active.insert(request_id.to_string(), cancel.clone());
        Ok(cancel)
    }

    fn cancel(&mut self, request_id: String) {
        if let Some(cancel) = self.active.get(&request_id) {
            cancel.notify_one();
        } else {
            // IPC calls may be dispatched out of order. Remember an early cancel
            // so it stops a request not yet entered into the active registry.
            let now = store::now_ms();
            self.cancelled
                .retain(|_, time| now.saturating_sub(*time) < 120_000);
            if self.cancelled.len() < 128 {
                self.cancelled.insert(request_id, now);
            }
        }
    }
}

impl NativeState {
    fn store(&self) -> Result<Arc<store::Store>, String> {
        self.store.as_ref().cloned().map_err(Clone::clone)
    }
}

#[tauri::command]
async fn desktop_store_read(
    state: tauri::State<'_, NativeState>,
) -> Result<store::Snapshot, String> {
    let store = state.store()?;
    tauri::async_runtime::spawn_blocking(move || store.read())
        .await
        .map_err(|_| "The desktop storage task could not complete.".to_string())?
}

#[tauri::command]
async fn desktop_store_commit(
    expected_revision: String,
    puts: BTreeMap<String, Value>,
    deletes: Vec<String>,
    state: tauri::State<'_, NativeState>,
) -> Result<store::Snapshot, String> {
    let store = state.store()?;
    tauri::async_runtime::spawn_blocking(move || store.commit(&expected_revision, puts, deletes))
        .await
        .map_err(|_| "The desktop storage task could not complete.".to_string())?
}

#[tauri::command]
async fn desktop_store_info(
    state: tauri::State<'_, NativeState>,
) -> Result<store::StoreInfo, String> {
    let store = state.store()?;
    tauri::async_runtime::spawn_blocking(move || store.info())
        .await
        .map_err(|_| "The desktop storage task could not complete.".to_string())?
}

#[tauri::command]
async fn desktop_backup_create(state: tauri::State<'_, NativeState>) -> Result<String, String> {
    let store = state.store()?;
    tauri::async_runtime::spawn_blocking(move || store.backup())
        .await
        .map_err(|_| "The desktop backup task could not complete.".to_string())?
}

#[tauri::command]
fn desktop_open_backup_folder(state: tauri::State<'_, NativeState>) -> Result<(), String> {
    let path = state.store()?.directory.join("backups");
    #[cfg(windows)]
    {
        // Fixed executable and app-controlled argument; no renderer path or shell.
        std::process::Command::new("explorer.exe")
            .arg(path)
            .spawn()
            .map_err(|_| "Could not open the desktop backup folder.")?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("Opening the backup folder is supported in the Windows desktop build.".into())
    }
}

fn valid_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty()
        || filename.len() > 240
        || filename == "."
        || filename == ".."
        || filename
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || filename.ends_with('.')
        || filename.ends_with(' ')
    {
        return Err("The suggested save filename is invalid.".into());
    }
    Ok(())
}

#[tauri::command]
async fn desktop_save_file(
    filename: String,
    data_base64: String,
    app: tauri::AppHandle,
) -> Result<&'static str, String> {
    valid_filename(&filename)?;
    if data_base64.len() > (SAVE_LIMIT + 2) / 3 * 4 {
        return Err("The export exceeds the 256 MiB desktop save limit.".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|_| "The export data is not valid base64.")?;
    if bytes.len() > SAVE_LIMIT {
        return Err("The export exceeds the 256 MiB desktop save limit.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let Some(selected) = app
            .dialog()
            .file()
            .set_file_name(&filename)
            .blocking_save_file()
        else {
            return Ok("declined");
        };
        let path = selected
            .into_path()
            .map_err(|_| "The selected save location is not a local file.")?;
        store::atomic_write(&path, &bytes)?;
        Ok("saved")
    })
    .await
    .map_err(|_| "The native save dialog could not complete.".to_string())?
}

fn provider_url(provider: &str) -> Result<&'static str, String> {
    match provider {
        "openai" => Ok("https://api.openai.com/v1/responses"),
        "anthropic" => Ok("https://api.anthropic.com/v1/messages"),
        _ => Err("Choose a supported AI provider.".into()),
    }
}

#[cfg(windows)]
fn credential(provider: &str) -> Result<keyring::Entry, String> {
    provider_url(provider)?;
    keyring::Entry::new(KEY_SERVICE, provider)
        .map_err(|_| "Windows Credential Manager is unavailable.".to_string())
}

#[cfg(windows)]
fn read_key(provider: &str) -> Result<Option<String>, String> {
    match credential(provider)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read this provider's key from Windows Credential Manager.".into()),
    }
}

#[cfg(not(windows))]
fn read_key(provider: &str) -> Result<Option<String>, String> {
    provider_url(provider)?;
    Ok(None)
}

fn validate_api_key(key: &str) -> Result<(), String> {
    if key.trim().is_empty() || key.len() > 4096 || key.chars().any(char::is_control) {
        return Err("Enter a valid API key for the selected provider.".into());
    }
    Ok(())
}

#[tauri::command]
fn desktop_key_status(provider: String) -> Result<bool, String> {
    Ok(read_key(&provider)?.is_some())
}

#[tauri::command]
fn desktop_key_store(provider: String, api_key: String) -> Result<(), String> {
    provider_url(&provider)?;
    validate_api_key(&api_key)?;
    #[cfg(windows)]
    {
        credential(&provider)?
            .set_password(api_key.trim())
            .map_err(|_| "Could not save the API key in Windows Credential Manager.".to_string())
    }
    #[cfg(not(windows))]
    {
        Err("Remembering API keys is supported by the Windows desktop build.".into())
    }
}

#[tauri::command]
fn desktop_key_delete(provider: String) -> Result<(), String> {
    provider_url(&provider)?;
    #[cfg(windows)]
    {
        match credential(&provider)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Could not remove the API key from Windows Credential Manager.".into()),
        }
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[derive(Serialize)]
struct AiResponse {
    status: u16,
    body: String,
}

fn validate_request_id(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 128
        || !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
    {
        return Err("Invalid AI request identifier.".into());
    }
    Ok(())
}

#[tauri::command]
fn desktop_ai_cancel(
    request_id: String,
    state: tauri::State<'_, NativeState>,
) -> Result<(), String> {
    validate_request_id(&request_id)?;
    let mut requests = state
        .requests
        .lock()
        .map_err(|_| "AI requests are unavailable.")?;
    requests.cancel(request_id);
    Ok(())
}

#[tauri::command]
async fn desktop_ai_request(
    provider: String,
    body: String,
    api_key: Option<String>,
    request_id: Option<String>,
    state: tauri::State<'_, NativeState>,
) -> Result<AiResponse, String> {
    let url = provider_url(&provider)?;
    if body.len() > REQUEST_LIMIT {
        return Err("The AI request exceeds the 32 MiB desktop request limit.".into());
    }
    let parsed: Value =
        serde_json::from_str(&body).map_err(|_| "The AI request must be valid JSON.")?;
    if !parsed.is_object()
        || !parsed
            .get("model")
            .and_then(Value::as_str)
            .is_some_and(|m| !m.is_empty() && m.len() <= 200)
    {
        return Err("The AI request must include a supported model name.".into());
    }
    let key = match api_key.filter(|key| !key.is_empty()) {
        Some(key) => key,
        None => read_key(&provider)?
            .ok_or("No saved API key exists for this provider. Enter a key in AI settings.")?,
    };
    validate_api_key(&key)?;
    let request_id = request_id.unwrap_or_else(|| format!("native-{}", store::now_ms()));
    validate_request_id(&request_id)?;
    let cancel = {
        let mut requests = state
            .requests
            .lock()
            .map_err(|_| "AI requests are unavailable.")?;
        requests.register(&request_id)?
    };
    let perform = async {
        let mut request = state
            .client
            .post(url)
            .header("Content-Type", "application/json");
        request = if provider == "openai" {
            request.bearer_auth(key)
        } else {
            request
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
        };
        let mut response = request.body(body).send().await.map_err(|_| {
            "Could not reach the AI provider. Check your connection and API settings."
        })?;
        let status = response.status().as_u16();
        if response
            .content_length()
            .is_some_and(|size| size > RESPONSE_LIMIT as u64)
        {
            return Err("The AI response exceeds the desktop response limit.".into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "The AI response could not be read.")?
        {
            if bytes.len().saturating_add(chunk.len()) > RESPONSE_LIMIT {
                return Err("The AI response exceeds the desktop response limit.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        let body =
            String::from_utf8(bytes).map_err(|_| "The AI provider returned invalid UTF-8.")?;
        Ok(AiResponse { status, body })
    };
    let result = tokio::select! {
        result = perform => result,
        _ = cancel.notified() => Err("The AI request was cancelled.".into()),
    };
    if let Ok(mut requests) = state.requests.lock() {
        requests.active.remove(&request_id);
    }
    result
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let diagnostics = std::env::var("BASIS_DESKTOP_DIAGNOSTICS").as_deref() == Ok("1");
            let stage = |message: &str| {
                if diagnostics {
                    eprintln!("[Basis desktop startup] {message}");
                }
            };
            stage("before store initialization");
            let store = app
                .path()
                .app_data_dir()
                .map_err(|_| "Could not locate the desktop data folder.".to_string())
                .and_then(store::Store::new)
                .map(Arc::new);
            stage("after store initialization");
            stage("before HTTP client initialization");
            let client = reqwest::Client::builder()
                .https_only(true)
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(15))
                .timeout(Duration::from_secs(90))
                .user_agent("BasisStudioDesktop/0.7.30")
                .build()?;
            stage("after HTTP client initialization");
            app.manage(NativeState {
                store,
                client,
                requests: Mutex::new(RequestBook::default()),
            });
            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .ok_or("The main desktop window configuration is missing.")?;
            stage("before WebView window build");
            tauri::WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(|url| {
                    (url.scheme() == "https" && url.host_str() == Some("tauri.localhost"))
                        || (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                })
                .build()?;
            stage("after WebView window build");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_store_read,
            desktop_store_commit,
            desktop_store_info,
            desktop_backup_create,
            desktop_open_backup_folder,
            desktop_save_file,
            desktop_key_status,
            desktop_key_store,
            desktop_key_delete,
            desktop_ai_request,
            desktop_ai_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("Could not start Basis Studio Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_http_only_allows_fixed_provider_endpoints() {
        assert_eq!(
            provider_url("openai").unwrap(),
            "https://api.openai.com/v1/responses"
        );
        assert!(provider_url("http://localhost").is_err());
        assert!(provider_url("OPENAI").is_err());
    }

    #[test]
    fn filenames_and_keys_cannot_inject_paths_or_headers() {
        assert!(valid_filename("Model.basiscre").is_ok());
        assert!(valid_filename("../Model.json").is_err());
        assert!(valid_filename("C:\\model.json").is_err());
        assert!(validate_api_key("key\r\nAuthorization: bad").is_err());
        assert!(validate_request_id("../../bad").is_err());
    }

    #[test]
    fn cancellation_before_registration_prevents_request_start() {
        let mut requests = RequestBook::default();
        requests.cancel("early".into());
        assert!(requests.register("early").is_err());
        assert!(requests.active.is_empty());
        for i in 0..200 {
            requests.cancel(format!("early-{i}"));
        }
        assert!(requests.cancelled.len() <= 128);
    }

    #[test]
    fn active_request_ids_are_unique_and_concurrency_is_bounded() {
        let mut requests = RequestBook::default();
        requests.register("one").unwrap();
        assert!(requests.register("one").is_err());
        for id in ["two", "three", "four"] {
            requests.register(id).unwrap();
        }
        assert!(requests.register("five").is_err());
        requests.active.remove("one");
        assert!(requests.register("five").is_ok());
    }
}
