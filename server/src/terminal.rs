use crate::{
    error::ApiResult,
    workspace::{
        list_directory, read_workspace_file, resolve_existing, validate_workspace_name,
        workspace_dir,
    },
    AppState,
};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::Response,
};
use serde::Deserialize;
use serde_json::json;

const MAX_COMMAND_LENGTH: usize = 2000;
const MAX_COMMANDS_PER_SESSION: usize = 120;
const CAT_BYTES: usize = 64 * 1024;

const HELP: &str = "\
Rust sandbox · read-only workspace commands

  ls [path]      list a folder
  cat <file>     print a file (first 64 KB)
  pwd            print the server workspace path
  echo <text>    print text
  whoami         print the session user
  help           show this text

File editing happens in the browser. This service never spawns a shell or
runs programs.";

#[derive(Deserialize)]
pub struct TerminalQuery {
    workspace: Option<String>,
}

#[derive(Deserialize)]
struct CommandMessage {
    #[serde(default)]
    command: String,
}

pub async fn handler(
    upgrade: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<TerminalQuery>,
) -> Response {
    let workspace = query
        .workspace
        .unwrap_or_else(|| "workspace".to_string());
    upgrade.on_upgrade(move |socket| run(socket, state, workspace))
}

async fn send(socket: &mut WebSocket, payload: serde_json::Value) -> bool {
    socket
        .send(Message::Text(payload.to_string().into()))
        .await
        .is_ok()
}

async fn run(mut socket: WebSocket, state: AppState, workspace: String) {
    let name = match validate_workspace_name(&workspace) {
        Ok(name) => name,
        Err(error) => {
            let _ = send(
                &mut socket,
                json!({ "type": "error", "data": error.to_string() }),
            )
            .await;
            return;
        }
    };
    let dir = match workspace_dir(&state, &name) {
        Ok(dir) => dir,
        Err(error) => {
            let _ = send(
                &mut socket,
                json!({ "type": "error", "data": error.to_string() }),
            )
            .await;
            return;
        }
    };
    if !tokio::fs::try_exists(&dir).await.unwrap_or(false) {
        let _ = send(
            &mut socket,
            json!({"type": "system", "data": format!("Workspace \"{name}\" is not on the server yet. Push the workspace first.")}),
        )
        .await;
    }

    if !send(
        &mut socket,
        json!({ "type": "system", "data": format!("Rust sandbox attached to /workspace/{name}. Type help.") }),
    )
    .await
    {
        return;
    }

    let mut remaining = MAX_COMMANDS_PER_SESSION;
    while let Some(Ok(message)) = socket.recv().await {
        match message {
            Message::Text(text) => {
                if remaining == 0 {
                    let _ = send(
                        &mut socket,
                        json!({ "type": "error", "data": "Session command limit reached. Reconnect to continue." }),
                    )
                    .await;
                    continue;
                }
                remaining -= 1;

                let line = match serde_json::from_str::<CommandMessage>(&text) {
                    Ok(parsed) if !parsed.command.trim().is_empty() => parsed.command,
                    Ok(_) => continue,
                    Err(_) => text.to_string(),
                };
                if line.len() > MAX_COMMAND_LENGTH {
                    let _ = send(
                        &mut socket,
                        json!({ "type": "error", "data": "That command is too long." }),
                    )
                    .await;
                    continue;
                }

                let reply = execute(&state, &name, line.trim()).await;
                let payload = match reply {
                    Ok(output) => json!({ "type": "output", "data": output }),
                    Err(error) => json!({ "type": "error", "data": error }),
                };
                if !send(&mut socket, payload).await {
                    break;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}

async fn execute(state: &AppState, workspace: &str, line: &str) -> Result<String, String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    let mut parts = trimmed.splitn(2, char::is_whitespace);
    let command = parts.next().unwrap_or_default();
    let argument = parts.next().unwrap_or("").trim();

    match command {
        "help" => Ok(HELP.to_string()),
        "pwd" => Ok(format!("/workspace/{workspace}")),
        "whoami" => Ok("you".to_string()),
        "echo" => Ok(argument.to_string()),
        "ls" => match list_directory(state, workspace, argument).await {
            Ok(items) => {
                if items.is_empty() {
                    Ok("(empty)".to_string())
                } else {
                    Ok(items
                        .into_iter()
                        .map(|(name, _)| name)
                        .collect::<Vec<_>>()
                        .join("  "))
                }
            }
            Err(error) => Err(error.to_string()),
        },
        "cat" => {
            if argument.is_empty() {
                return Err("Usage: cat <file>".to_string());
            }
            match read_workspace_file(state, workspace, argument, CAT_BYTES).await {
                Ok(content) => Ok(content),
                Err(error) => Err(error.to_string()),
            }
        }
        "open" => Ok("open is handled by the editor. Use the file explorer.".to_string()),
        "cd" => Ok("There is no working directory. Paths are relative to the workspace.".to_string()),
        "theme" => Ok("Theme is a UI setting. Open Settings.".to_string()),
        "clear" => Ok(String::new()),
        _ => Err(format!(
            "{command}: command not available. The sandbox is read-only. Type help."
        )),
    }
}

#[allow(dead_code)]
async fn stat_path(state: &AppState, workspace: &str, relative: &str) -> ApiResult<String> {
    let (_, path) = resolve_existing(state, workspace, relative).await?;
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|error| crate::error::ApiError::internal(error.to_string()))?;
    let kind = if metadata.is_dir() { "folder" } else { "file" };
    Ok(format!("{relative}: {kind}, {} bytes", metadata.len()))
}
