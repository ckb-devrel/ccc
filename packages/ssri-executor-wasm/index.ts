import * as wasmModule from "./pkg/ckb-ssri-executor-wasm";
import wasm from "./pkg/ckb-ssri-executor-wasm_bg.wasm";
wasmModule.initSync({ module: wasm });

export default wasmModule;
