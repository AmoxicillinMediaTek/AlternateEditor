mod error;
mod workspace;

use axum::{
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde_json::Value;
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
pub struct AppState {
    pub data_root: Arc<PathBuf>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("quarry_server=info,tower_http=info")),
        )
        .init();

    let data_dir = std::env::var("QUARRY_DATA_DIR").unwrap_or_else(|_| "data".to_string());
    tokio::fs::create_dir_all(&data_dir).await?;
    let data_root = tokio::fs::canonicalize(&data_dir).await?;
    let display_root = data_root.display().to_string();
    let state = AppState {
        data_root: Arc::new(data_root),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/v1/workspaces", get(workspace::list_workspaces))
        .route("/api/v1/workspaces/sync", post(workspace::sync_workspace))
        .route("/api/v1/workspaces/{name}", delete(workspace::delete_workspace))
        .route("/api/v1/workspaces/{name}/tree", get(workspace::tree_handler))
        .route(
            "/api/v1/workspaces/{name}/file",
            get(workspace::read_file_handler).put(workspace::write_file_handler),
        )
        .route(
            "/api/v1/workspaces/{name}/dir",
            post(workspace::make_dir_handler),
        )
        .route(
            "/api/v1/workspaces/{name}/rename",
            post(workspace::rename_handler),
        )
        .route(
            "/api/v1/workspaces/{name}/entry",
            delete(workspace::delete_entry_handler),
        )
        .route("/ws/terminal", get(terminal_unavailable))
        .fallback(fallback)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let bind = std::env::var("QUARRY_BIND").unwrap_or_else(|_| "127.0.0.1:8080".to_string());
    let address: SocketAddr = bind
        .parse()
        .map_err(|error| anyhow::anyhow!("Invalid QUARRY_BIND value: {error}"))?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!(%address, "quarry server listening");
    println!("quarry server listening on http://{address}");
    println!("data directory: {display_root}");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<Value> {
    Json(workspace::health_payload().await)
}

async fn terminal_unavailable() -> (StatusCode, Json<Value>) {
    (
        StatusCode::GONE,
        Json(serde_json::json!({
            "error": "The server terminal was replaced by StackBlitz WebContainer in the browser."
        })),
    )
}

async fn fallback() -> (StatusCode, Json<Value>) {
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "Unknown endpoint." })),
    )
}
