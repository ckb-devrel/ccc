import wasmModule from "@ckb-ccc/ssri-executor-wasm";
import {
  SSRIExecutorFunctionCall,
  SSRIExecutorWorkerInitializeOptions,
} from "./types.js";

onerror = (err) => {
  console.error(err);
};
let loaded = false;
onmessage = async (evt) => {
  if (!loaded) {
    const data = evt.data as SSRIExecutorWorkerInitializeOptions;
    console.log("Setting shared arrays");
    wasmModule.set_shared_array(data.inputBuffer, data.outputBuffer);
    console.log("Initiating WASM from Worker with log level", data.logLevel);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    wasmModule.initiate(data.logLevel, data.rpcUrl);
    self.postMessage({});
    loaded = true;
    return;
  }
  const data = evt.data as SSRIExecutorFunctionCall;

  try {
    self.postMessage({
      ok: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      data: (wasmModule as any)[data.name](...evt.data.args),
    });
  } catch (e) {
    self.postMessage({
      ok: false,
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      error: `${e}`,
    });
    console.error(e);
  }
};
export default {} as typeof Worker & { new (): Worker };
