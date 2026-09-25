use std::env;

fn main() {
  println!("cargo:rerun-if-env-changed=DEBUG_GENERATED_CODE");
  println!("cargo:rerun-if-env-changed=TYPE_DEF_TMP_PATH");
  println!("cargo:rerun-if-env-changed=CARGO_CFG_NAPI_RS_CLI_VERSION");
  println!("cargo::rerun-if-env-changed=NAPI_DEBUG_GENERATED_CODE");
  println!("cargo::rerun-if-env-changed=NAPI_TYPE_DEF_TMP_FOLDER");
  println!("cargo::rerun-if-env-changed=NAPI_FORCE_BUILD_LUMINA_CORE");

  let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
  let target_env = env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();

  if target_os != "windows" || target_env != "gnu" {
    napi_build::setup();
  }
}

