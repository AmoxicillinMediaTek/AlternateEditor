use crate::{
    error::{ApiError, ApiResult},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path as StdPath, PathBuf};

pub const MAX_FILE_BYTES: usize = 4 * 1024 * 1024;
const MAX_FILES_PER_SYNC: usize = 2000;
const MAX_PATH_DEPTH: usize = 16;

pub fn validate_workspace_name(raw: &str) -> ApiResult<String> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("Workspace name is required."));
    }
    if name.len() > 48 {
        return Err(ApiError::bad_request("Workspace names are limited to 48 characters."));
    }
    if name == "." || name == ".." {
        return Err(ApiError::bad_request("That workspace name is reserved."));
    }
    if !name
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(ApiError::bad_request(
            "Workspace names may only use letters, numbers, dashes and underscores.",
        ));
    }
    Ok(name.to_string())
}

pub fn validate_relative_path(raw: &str) -> ApiResult<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request("A file path is required."));
    }
    if trimmed.len() > 512 {
        return Err(ApiError::bad_request("That path is too long."));
    }
    if trimmed.starts_with('/') || trimmed.contains('\\') {
        return Err(ApiError::bad_request("Paths must be relative to the workspace."));
    }
    let mut path = PathBuf::new();
    let mut depth = 0;
    for segment in trimmed.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err(ApiError::bad_request("That path is not allowed."));
        }
        if segment.len() > 120 {
            return Err(ApiError::bad_request("A path segment is too long."));
        }
        if segment.chars().any(|character| character.is_control()) {
            return Err(ApiError::bad_request("That path contains control characters."));
        }
        path.push(segment);
        depth += 1;
        if depth > MAX_PATH_DEPTH {
            return Err(ApiError::bad_request("That folder is nested too deeply."));
        }
    }
    Ok(path)
}

pub fn workspace_dir(state: &AppState, name: &str) -> ApiResult<PathBuf> {
    let name = validate_workspace_name(name)?;
    Ok(state.data_root.join(name))
}

async fn existing_workspace_dir(state: &AppState, name: &str) -> ApiResult<PathBuf> {
    let dir = workspace_dir(state, name)?;
    let canonical = tokio::fs::canonicalize(&dir)
        .await
        .map_err(|_| ApiError::not_found("That workspace does not exist on the server."))?;
    if !canonical.starts_with(state.data_root.as_path()) {
        return Err(ApiError::bad_request("That workspace path is not allowed."));
    }
    Ok(canonical)
}

async fn ensured_workspace_dir(state: &AppState, name: &str) -> ApiResult<PathBuf> {
    let dir = workspace_dir(state, name)?;
    tokio::fs::create_dir_all(&dir).await?;
    let canonical = tokio::fs::canonicalize(&dir).await?;
    if !canonical.starts_with(state.data_root.as_path()) {
        return Err(ApiError::bad_request("That workspace path is not allowed."));
    }
    Ok(canonical)
}

pub async fn resolve_existing(
    state: &AppState,
    workspace: &str,
    relative: &str,
) -> ApiResult<(PathBuf, PathBuf)> {
    let root = existing_workspace_dir(state, workspace).await?;
    let relative = validate_relative_path(relative)?;
    let candidate = root.join(&relative);
    let canonical = tokio::fs::canonicalize(&candidate).await?;
    if !canonical.starts_with(&root) {
        return Err(ApiError::bad_request("That path escapes the workspace."));
    }
    Ok((root.clone(), canonical))
}

async fn resolve_for_write(
    state: &AppState,
    workspace: &str,
    relative: &str,
) -> ApiResult<(PathBuf, PathBuf)> {
    let root = ensured_workspace_dir(state, workspace).await?;
    let relative = validate_relative_path(relative)?;
    let candidate = root.join(&relative);
    let parent = candidate
        .parent()
        .ok_or_else(|| ApiError::bad_request("That path has no parent."))?;
    tokio::fs::create_dir_all(parent).await?;
    let canonical_parent = tokio::fs::canonicalize(parent).await?;
    if !canonical_parent.starts_with(&root) {
        return Err(ApiError::bad_request("That path escapes the workspace."));
    }
    let file_name = candidate
        .file_name()
        .ok_or_else(|| ApiError::bad_request("That path has no file name."))?;
    Ok((root.clone(), canonical_parent.join(file_name)))
}

fn read_limited(path: &StdPath, max_bytes: usize) -> ApiResult<String> {
    let metadata = std::fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(ApiError::bad_request("That path is a folder, not a file."));
    }
    if metadata.len() > max_bytes as u64 {
        return Err(ApiError::bad_request("That file is too large to read here."));
    }
    let bytes = std::fs::read(path)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

pub fn count_files(path: &StdPath, depth: usize) -> usize {
    if depth > 8 {
        return 0;
    }
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    let mut total = 0;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_file() {
            total += 1;
        } else if file_type.is_dir() {
            total += count_files(&entry.path(), depth + 1);
        }
    }
    total
}

pub async fn read_workspace_file(
    state: &AppState,
    workspace: &str,
    relative: &str,
    max_bytes: usize,
) -> ApiResult<String> {
    let (_, canonical) = resolve_existing(state, workspace, relative).await?;
    read_limited(&canonical, max_bytes)
}

pub async fn health_payload() -> Value {
    json!({
        "status": "ok",
        "service": "quarry-server",
        "version": env!("CARGO_PKG_VERSION"),
    })
}

pub async fn list_workspaces(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let mut reader = tokio::fs::read_dir(state.data_root.as_path()).await?;
    let mut workspaces: Vec<Value> = Vec::new();
    while let Some(entry) = reader.next_entry().await? {
        let file_type = entry.file_type().await?;
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
        {
            continue;
        }
        let files = count_files(&entry.path(), 0);
        workspaces.push(json!({ "name": name, "files": files }));
    }
    workspaces.sort_by(|a, b| {
        a.get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .cmp(b.get("name").and_then(Value::as_str).unwrap_or_default())
    });
    Ok(Json(json!({ "workspaces": workspaces })))
}

#[derive(Deserialize)]
pub struct SyncFile {
    pub path: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct SyncRequest {
    pub name: String,
    #[serde(default)]
    pub files: Vec<SyncFile>,
}

pub async fn sync_workspace(
    State(state): State<AppState>,
    Json(request): Json<SyncRequest>,
) -> ApiResult<Json<Value>> {
    if request.files.len() > MAX_FILES_PER_SYNC {
        return Err(ApiError::bad_request("Too many files in one push."));
    }
    let name = validate_workspace_name(&request.name)?;
    let root = workspace_dir(&state, &name)?;
    if tokio::fs::try_exists(&root).await.unwrap_or(false) {
        tokio::fs::remove_dir_all(&root).await?;
    }
    tokio::fs::create_dir_all(&root).await?;
    let canonical_root = tokio::fs::canonicalize(&root).await?;
    let mut written = 0usize;
    for file in request.files.iter() {
        if file.content.len() > MAX_FILE_BYTES {
            return Err(ApiError::bad_request(format!(
                "{} is larger than the 4 MB limit.",
                file.path
            )));
        }
        let relative = validate_relative_path(&file.path)?;
        let target = canonical_root.join(relative);
        let parent = target
            .parent()
            .ok_or_else(|| ApiError::bad_request("That path has no parent."))?;
        tokio::fs::create_dir_all(parent).await?;
        tokio::fs::write(&target, file.content.as_bytes()).await?;
        written += 1;
    }
    tracing::info!(workspace = %name, files = written, "workspace synced");
    Ok(Json(json!({ "workspace": name, "written": written })))
}

pub async fn delete_workspace(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> ApiResult<Json<Value>> {
    let root = matching_workspace(&state, &name).await?;
    tokio::fs::remove_dir_all(root).await?;
    Ok(Json(json!({ "deleted": true })))
}

async fn matching_workspace(state: &AppState, name: &str) -> ApiResult<PathBuf> {
    let canonical = existing_workspace_dir(state, name).await?;
    Ok(canonical)
}

#[derive(Deserialize)]
pub struct PathQuery {
    pub path: Option<String>,
}

pub async fn read_file_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(query): Query<PathQuery>,
) -> ApiResult<Json<Value>> {
    let relative = query
        .path
        .ok_or_else(|| ApiError::bad_request("A file path is required."))?;
    let content = read_workspace_file(&state, &name, &relative, MAX_FILE_BYTES).await?;
    Ok(Json(json!({ "path": relative, "content": content })))
}

#[derive(Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
}

pub async fn write_file_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(request): Json<WriteFileRequest>,
) -> ApiResult<Json<Value>> {
    if request.content.len() > MAX_FILE_BYTES {
        return Err(ApiError::bad_request("That file is larger than the 4 MB limit."));
    }
    let (_, target) = resolve_for_write(&state, &name, &request.path).await?;
    tokio::fs::write(&target, request.content.as_bytes()).await?;
    Ok(Json(json!({ "written": true, "path": request.path })))
}

#[derive(Deserialize)]
pub struct DirRequest {
    pub path: String,
}

pub async fn make_dir_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(request): Json<DirRequest>,
) -> ApiResult<Json<Value>> {
    let root = ensured_workspace_dir(&state, &name).await?;
    let relative = validate_relative_path(&request.path)?;
    let target = root.join(relative);
    tokio::fs::create_dir_all(&target).await?;
    let canonical = tokio::fs::canonicalize(&target).await?;
    if !canonical.starts_with(&root) {
        return Err(ApiError::bad_request("That path escapes the workspace."));
    }
    Ok(Json(json!({ "created": true, "path": request.path })))
}

#[derive(Deserialize)]
pub struct RenameRequest {
    pub from: String,
    pub to: String,
}

pub async fn rename_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(request): Json<RenameRequest>,
) -> ApiResult<Json<Value>> {
    let (_, source) = resolve_existing(&state, &name, &request.from).await?;
    let (root, target) = resolve_for_write(&state, &name, &request.to).await?;
    if tokio::fs::try_exists(&target).await.unwrap_or(false) {
        return Err(ApiError::conflict("That name is already in use."));
    }
    tokio::fs::rename(&source, &target).await?;
    let _ = root;
    Ok(Json(json!({ "renamed": true })))
}

pub async fn delete_entry_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(query): Query<PathQuery>,
) -> ApiResult<Json<Value>> {
    let relative = query
        .path
        .ok_or_else(|| ApiError::bad_request("A path is required."))?;
    let (_, target) = resolve_existing(&state, &name, &relative).await?;
    let metadata = tokio::fs::metadata(&target).await?;
    if metadata.is_dir() {
        tokio::fs::remove_dir_all(&target).await?;
    } else {
        tokio::fs::remove_file(&target).await?;
    }
    Ok(Json(json!({ "deleted": true })))
}

#[derive(Serialize)]
struct TreeNode {
    name: String,
    path: String,
    kind: &'static str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    children: Vec<TreeNode>,
}

fn build_tree(path: &StdPath, relative: &str, depth: usize) -> Vec<TreeNode> {
    if depth > 8 {
        return Vec::new();
    }
    let Ok(entries) = std::fs::read_dir(path) else {
        return Vec::new();
    };
    let mut folders: Vec<TreeNode> = Vec::new();
    let mut files: Vec<TreeNode> = Vec::new();
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') && name != ".gitignore" {
            continue;
        }
        let child_relative = if relative.is_empty() {
            name.clone()
        } else {
            format!("{relative}/{name}")
        };
        if file_type.is_dir() {
            folders.push(TreeNode {
                name,
                path: child_relative.clone(),
                kind: "folder",
                children: build_tree(&entry.path(), &child_relative, depth + 1),
            });
        } else if file_type.is_file() {
            files.push(TreeNode {
                name,
                path: child_relative,
                kind: "file",
                children: Vec::new(),
            });
        }
    }
    folders.sort_by(|a, b| a.name.cmp(&b.name));
    files.sort_by(|a, b| a.name.cmp(&b.name));
    folders.extend(files);
    folders
}

pub async fn tree_handler(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> ApiResult<Json<Value>> {
    let root = existing_workspace_dir(&state, &name).await?;
    let name = validate_workspace_name(&name)?;
    let children = build_tree(&root, "", 0);
    Ok(Json(json!({
        "name": name,
        "path": "",
        "kind": "folder",
        "children": serde_json::to_value(children).unwrap_or(Value::Array(Vec::new())),
    })))
}

