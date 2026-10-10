fn main() {
    println!("cargo:rerun-if-changed=binaries");
    println!("cargo:rerun-if-changed=sidecar/recorder.swift");
    tauri_build::build()
}
