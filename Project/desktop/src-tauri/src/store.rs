use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const STORE_LIMIT: u64 = 256 * 1024 * 1024;
const MAX_ENTRIES: usize = 100_000;
const BACKUP_INTERVAL_MS: u128 = 15 * 60 * 1000;
const BACKUP_COUNT: usize = 10;
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    pub schema_version: u32,
    pub revision: String,
    pub entries: BTreeMap<String, Value>,
}

impl Default for Snapshot {
    fn default() -> Self {
        Self {
            schema_version: 1,
            revision: "0".into(),
            entries: BTreeMap::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub name: String,
    pub created_ms: u128,
    pub bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreInfo {
    pub data_directory: String,
    pub backup_directory: String,
    pub backups: Vec<BackupInfo>,
}

pub struct Store {
    pub directory: PathBuf,
    gate: Mutex<()>,
}

pub fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn unique_stamp() -> String {
    format!(
        "{}-{:020}",
        now_ms(),
        SEQUENCE.fetch_add(1, Ordering::Relaxed)
    )
}

fn regular_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|_| "Could not create the desktop data folder.")?;
    inspect_directory(path)
}

fn inspect_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|_| "Could not inspect the data folder.")?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("The desktop data folder must be a regular directory.".into());
    }
    Ok(())
}

fn validate_key(key: &str) -> Result<(), String> {
    if key.is_empty()
        || key.len() > 512
        || !key
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
        || ["__proto__", "constructor", "prototype"].contains(&key)
    {
        return Err("Invalid desktop workspace key.".into());
    }
    Ok(())
}

fn validate_value(value: &Value, depth: usize, nodes: &mut usize) -> Result<(), String> {
    *nodes += 1;
    if depth > 80 || *nodes > 2_000_000 {
        return Err("The desktop workspace is too deeply nested or too complex.".into());
    }
    match value {
        Value::Array(items) => {
            for item in items {
                validate_value(item, depth + 1, nodes)?;
            }
        }
        Value::Object(items) => {
            for (key, item) in items {
                if ["__proto__", "constructor", "prototype"].contains(&key.as_str()) {
                    return Err("A reserved JSON key is present in the workspace.".into());
                }
                validate_value(item, depth + 1, nodes)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn validate_snapshot(snapshot: &Snapshot) -> Result<(), String> {
    if snapshot.schema_version != 1
        || snapshot.revision.is_empty()
        || snapshot.revision.len() > 1000
        || snapshot.entries.len() > MAX_ENTRIES
    {
        return Err("The desktop workspace format is invalid or unsupported.".into());
    }
    let mut nodes = 0;
    for (key, value) in &snapshot.entries {
        validate_key(key)?;
        if !value.is_object() {
            return Err("Desktop workspace records must be JSON objects.".into());
        }
        validate_value(value, 0, &mut nodes)?;
        if key.starts_with("pwm_") {
            let text = value.get("s").and_then(Value::as_str);
            if text.is_none() || text.unwrap().encode_utf16().count() > 180_000 {
                return Err("A saved desktop model chunk is invalid or oversized.".into());
            }
            if let Some(n) = value.get("n") {
                if !n.as_u64().is_some_and(|count| (1..=4096).contains(&count)) {
                    return Err("A saved desktop model chunk count is invalid.".into());
                }
            }
            if let Some(enc) = value.get("enc") {
                if enc != "json" && enc != "dr64" {
                    return Err("A saved desktop model encoding is unsupported.".into());
                }
            }
        }
        if key == "pw_index"
            && (!value.get("pfs").is_some_and(Value::is_array)
                || !value.get("props").is_some_and(Value::is_array))
        {
            return Err("The saved desktop library index is invalid.".into());
        }
    }
    Ok(())
}

fn encoded(snapshot: &Snapshot) -> Result<Vec<u8>, String> {
    validate_snapshot(snapshot)?;
    let bytes =
        serde_json::to_vec(snapshot).map_err(|_| "Could not encode the desktop workspace.")?;
    if bytes.len() as u64 > STORE_LIMIT {
        return Err("The desktop library exceeds its 256 MiB storage limit. Export or split portfolios before saving.".into());
    }
    Ok(bytes)
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("The destination folder is invalid.")?;
    if let Ok(metadata) = fs::symlink_metadata(path) {
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err("The destination must be a regular file, not a link or folder.".into());
        }
    }
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|_| {
        "Could not create a temporary save file. Check disk space and folder permissions."
    })?;
    temporary
        .write_all(bytes)
        .and_then(|_| temporary.as_file().sync_all())
        .map_err(|_| "Could not write the complete file. The previous file was preserved.")?;
    temporary
        .persist(path)
        .map_err(|_| "Could not replace the destination file. The previous file was preserved.")?;
    #[cfg(unix)]
    if let Ok(folder) = File::open(parent) {
        let _ = folder.sync_all();
    }
    Ok(())
}

impl Store {
    pub fn new(directory: PathBuf) -> Result<Self, String> {
        regular_directory(&directory)?;
        regular_directory(&directory.join("backups"))?;
        Ok(Self {
            directory,
            gate: Mutex::new(()),
        })
    }

    fn read_unlocked(&self) -> Result<Snapshot, String> {
        inspect_directory(&self.directory)?;
        let path = self.directory.join("workspace.json");
        let metadata = match fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Snapshot::default())
            }
            Err(_) => return Err("Could not inspect the saved desktop workspace.".into()),
        };
        if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > STORE_LIMIT
        {
            return Err("The saved desktop workspace is invalid, linked, or oversized. Preserve it and recover a backup before continuing.".into());
        }
        let file = File::open(path).map_err(|_| "Could not open the saved desktop workspace.")?;
        let mut bytes = Vec::new();
        file.take(STORE_LIMIT + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Could not read the saved desktop workspace.")?;
        if bytes.len() as u64 > STORE_LIMIT {
            return Err("The saved desktop workspace exceeds its size limit.".into());
        }
        let snapshot: Snapshot = serde_json::from_slice(&bytes).map_err(|_| "The saved desktop workspace is damaged. It was not overwritten. Preserve workspace.json and recover a backup.")?;
        validate_snapshot(&snapshot)?;
        Ok(snapshot)
    }

    pub fn read(&self) -> Result<Snapshot, String> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| "Desktop storage is unavailable.")?;
        self.read_unlocked()
    }

    fn backups_unlocked(&self) -> Result<Vec<BackupInfo>, String> {
        inspect_directory(&self.directory.join("backups"))?;
        let mut backups = Vec::new();
        for entry in fs::read_dir(self.directory.join("backups"))
            .map_err(|_| "Could not list desktop backups.")?
        {
            let entry = entry.map_err(|_| "Could not inspect a desktop backup.")?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let stamp = name
                .strip_prefix("workspace-")
                .and_then(|v| v.strip_suffix(".json"));
            let Some(stamp) = stamp else { continue };
            if !stamp.bytes().all(|c| c.is_ascii_digit() || c == b'-') {
                continue;
            }
            let Some(created_ms) = stamp.split('-').next().and_then(|v| v.parse::<u128>().ok())
            else {
                continue;
            };
            let metadata = fs::symlink_metadata(entry.path())
                .map_err(|_| "Could not inspect a desktop backup.")?;
            if !metadata.is_file() || metadata.file_type().is_symlink() {
                continue;
            }
            backups.push(BackupInfo {
                name,
                created_ms,
                bytes: metadata.len(),
            });
        }
        backups.sort_by(|a, b| {
            b.created_ms
                .cmp(&a.created_ms)
                .then_with(|| b.name.cmp(&a.name))
        });
        Ok(backups)
    }

    fn backup_unlocked(&self, snapshot: &Snapshot) -> Result<String, String> {
        let name = format!("workspace-{}.json", unique_stamp());
        atomic_write(
            &self.directory.join("backups").join(&name),
            &encoded(snapshot)?,
        )?;
        for old in self.backups_unlocked()?.into_iter().skip(BACKUP_COUNT) {
            // Only our generated regular snapshot files can be removed.
            fs::remove_file(self.directory.join("backups").join(old.name)).map_err(|_| {
                "Could not rotate an old desktop backup. Check backup folder permissions."
            })?;
        }
        Ok(name)
    }

    pub fn commit(
        &self,
        expected_revision: &str,
        puts: BTreeMap<String, Value>,
        deletes: Vec<String>,
    ) -> Result<Snapshot, String> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| "Desktop storage is unavailable.")?;
        let current = self.read_unlocked()?;
        if current.revision != expected_revision {
            return Err("The desktop library changed before saving. Reload the library before retrying; your current edits have not been discarded.".into());
        }
        if puts.len() > MAX_ENTRIES || deletes.len() > MAX_ENTRIES {
            return Err("The desktop transaction has too many records.".into());
        }
        let mut next = current.clone();
        for key in deletes {
            validate_key(&key)?;
            if puts.contains_key(&key) {
                return Err("A desktop transaction cannot save and delete the same record.".into());
            }
            next.entries.remove(&key);
        }
        for (key, value) in puts {
            validate_key(&key)?;
            next.entries.insert(key, value);
        }
        next.revision = unique_stamp();
        let bytes = encoded(&next)?;
        if !current.entries.is_empty() {
            let latest = self
                .backups_unlocked()?
                .first()
                .map(|value| value.created_ms);
            if latest.is_none_or(|time| {
                now_ms() < time || now_ms().saturating_sub(time) >= BACKUP_INTERVAL_MS
            }) {
                self.backup_unlocked(&current)?;
            }
        }
        atomic_write(&self.directory.join("workspace.json"), &bytes)?;
        Ok(next)
    }

    pub fn backup(&self) -> Result<String, String> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| "Desktop storage is unavailable.")?;
        self.backup_unlocked(&self.read_unlocked()?)
    }

    pub fn info(&self) -> Result<StoreInfo, String> {
        let _guard = self
            .gate
            .lock()
            .map_err(|_| "Desktop storage is unavailable.")?;
        Ok(StoreInfo {
            data_directory: self.directory.to_string_lossy().into_owned(),
            backup_directory: self
                .directory
                .join("backups")
                .to_string_lossy()
                .into_owned(),
            backups: self.backups_unlocked()?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fixture() -> (tempfile::TempDir, Store) {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::new(directory.path().join("basis")).unwrap();
        (directory, store)
    }

    fn record(name: &str) -> BTreeMap<String, Value> {
        BTreeMap::from([("pw_index".into(), json!({"pfs":[],"props":[],"name":name}))])
    }

    #[test]
    fn atomic_commit_reopens_with_exact_values_and_rejects_stale_revision() {
        let (_directory, store) = fixture();
        let first = store.commit("0", record("First"), vec![]).unwrap();
        assert_eq!(store.read().unwrap().entries["pw_index"]["name"], "First");
        assert!(store.commit("0", record("Stale"), vec![]).is_err());
        assert_eq!(store.read().unwrap().revision, first.revision);
        let second = store
            .commit(&first.revision, record("Second"), vec![])
            .unwrap();
        assert_ne!(first.revision, second.revision);
        assert_eq!(store.info().unwrap().backups.len(), 1);
    }

    #[test]
    fn malformed_snapshot_is_preserved_without_reset() {
        let (_directory, store) = fixture();
        let path = store.directory.join("workspace.json");
        fs::write(&path, b"{broken").unwrap();
        assert!(store.read().is_err());
        assert!(store.commit("0", record("Discard"), vec![]).is_err());
        assert_eq!(fs::read(path).unwrap(), b"{broken");
        assert!(store.info().is_ok());
    }

    #[test]
    fn invalid_records_and_conflicting_transaction_leave_previous_file_unchanged() {
        let (_directory, store) = fixture();
        let snapshot = store.commit("0", record("Keep"), vec![]).unwrap();
        let path = store.directory.join("workspace.json");
        let original = fs::read(&path).unwrap();
        let bad = BTreeMap::from([("../escape".into(), json!({}))]);
        assert!(store.commit(&snapshot.revision, bad, vec![]).is_err());
        assert!(store
            .commit(&snapshot.revision, record("Lost"), vec!["pw_index".into()])
            .is_err());
        assert_eq!(fs::read(path).unwrap(), original);
    }

    #[test]
    fn backups_retain_ten_valid_whole_workspace_snapshots() {
        let (_directory, store) = fixture();
        store.commit("0", record("Retained"), vec![]).unwrap();
        for _ in 0..12 {
            store.backup().unwrap();
        }
        let backups = store.info().unwrap().backups;
        assert_eq!(backups.len(), BACKUP_COUNT);
        for backup in backups {
            let content = fs::read(store.directory.join("backups").join(backup.name)).unwrap();
            let snapshot: Snapshot = serde_json::from_slice(&content).unwrap();
            assert_eq!(snapshot.entries["pw_index"]["name"], "Retained");
        }
    }

    #[test]
    fn failed_replacement_preserves_destination() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("a-folder");
        fs::create_dir(&destination).unwrap();
        assert!(atomic_write(&destination, b"new").is_err());
        assert!(destination.is_dir());
    }

    #[test]
    fn chunks_and_nested_reserved_keys_are_rejected() {
        let (_directory, store) = fixture();
        let bad = BTreeMap::from([("pwm_one".into(), json!({"s":"x","n":0}))]);
        assert!(store.commit("0", bad, vec![]).is_err());
        let bad = BTreeMap::from([(
            "pw_index".into(),
            json!({"pfs":[],"props":[],"constructor":{}}),
        )]);
        assert!(store.commit("0", bad, vec![]).is_err());
        assert_eq!(store.read().unwrap().revision, "0");
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_workspace_and_backup_folder_are_rejected() {
        use std::os::unix::fs::symlink;
        let (directory, store) = fixture();
        let external = directory.path().join("external.json");
        fs::write(&external, b"keep").unwrap();
        symlink(&external, store.directory.join("workspace.json")).unwrap();
        assert!(store.read().is_err());
        assert!(store.commit("0", record("Lost"), vec![]).is_err());
        assert_eq!(fs::read(&external).unwrap(), b"keep");
        fs::remove_dir(store.directory.join("backups")).unwrap();
        symlink(directory.path(), store.directory.join("backups")).unwrap();
        assert!(store.info().is_err());
    }
}
