warning: unused import: `AtomicBool`
 --> src-tauri/src/export.rs:8:25
  |
8 | use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
  |                         ^^^^^^^^^^
  |
  = note: `#[warn(unused_imports)]` (part of `#[warn(unused)]`) on by default
warning: unused import: `Arc`
 --> src-tauri/src/export.rs:9:17
  |
9 | use std::sync::{Arc, Mutex, OnceLock};
  |                 ^^^
warning: unused imports: `WebviewUrl` and `WebviewWindowBuilder`
  --> src-tauri/src/export.rs:10:24
   |
10 | use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
   |                        ^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^
warning: variable does not need to be mutable
    --> src-tauri/src/commands.rs:2435:9
     |
2435 |     let mut cmd = Command::new(program);
     |         ----^^^
     |         |
     |         help: remove this `mut`
     |
     = note: `#[warn(unused_mut)]` (part of `#[warn(unused)]`) on by default
warning: unused variable: `filter_name`
   --> src-tauri/src/export.rs:194:5
    |
194 |     filter_name: String,
    |     ^^^^^^^^^^^ help: if this is intentional, prefix it with an underscore: `_filter_name`
    |
    = note: `#[warn(unused_variables)]` (part of `#[warn(unused)]`) on by default
warning: unused variable: `extensions`
   --> src-tauri/src/export.rs:195:5
    |
195 |     extensions: Vec<String>,
    |     ^^^^^^^^^^ help: if this is intentional, prefix it with an underscore: `_extensions`
warning: unused variable: `app`
   --> src-tauri/src/export.rs:871:5
    |
871 |     app: AppHandle,
    |     ^^^ help: if this is intentional, prefix it with an underscore: `_app`
warning: unused variable: `landscape`
   --> src-tauri/src/export.rs:874:5
    |
874 |     landscape: Option<bool>,
    |     ^^^^^^^^^ help: if this is intentional, prefix it with an underscore: `_landscape`
warning: `app` (lib) generated 8 warnings (run `cargo fix --lib -p app` to apply 8 suggestions)
    Finished `release` profile [optimized] target(s) in 5m 06s
