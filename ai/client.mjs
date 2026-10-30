import { fork } from "node:child_process";
import { resolve } from "node:path";
import { modelCandidates, inferencePolicy } from "./config.mjs";
import { validateServiceRequest } from "./contract.mjs";

export async function createServiceClassifier({ model, cacheDir, allowDownload = false, initializationTimeoutMs = inferencePolicy.initializationTimeoutMs } = {}) {
  if (!modelCandidates.some(candidate => candidate.key === model)) throw new TypeError("Choose a supported, pinned model key.");
  if (typeof cacheDir !== "string" || !cacheDir) throw new TypeError("An explicit model-cache directory is required.");
  if (!Number.isFinite(initializationTimeoutMs) || initializationTimeoutMs < 1000 || initializationTimeoutMs > 180000) throw new RangeError("Invalid initialization timeout.");
  const allowedEnvironment = ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "WINDIR", "LANG", "LC_ALL"];
  const environment = Object.fromEntries(allowedEnvironment.filter(key => process.env[key]).map(key => [key, process.env[key]]));
  environment.ONNXRUNTIME_NODE_INSTALL_CUDA = "skip";
  const child = fork(new URL("./worker.mjs", import.meta.url), [], { silent: true, execArgv: [], env: environment });
  child.stdout?.resume();
  child.stderr?.resume();
  let closed = false;
  let pending = null;
  let sequence = 0;
  const shutdown = () => { closed = true; if (!child.killed) child.kill("SIGKILL"); };
  const request = (kind, payload, timeoutMs, signal) => new Promise((resolveRequest, reject) => {
    if (closed) { reject(new Error("The classifier is closed. Create a new instance before retrying.")); return; }
    if (pending) { reject(new Error("The classifier is busy; concurrent requests are not queued.")); return; }
    if (signal?.aborted) { reject(new Error("Request aborted before inference.")); return; }
    const id = ++sequence;
    let timer;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); pending = null; };
    const abort = () => { cleanup(); shutdown(); reject(new Error("Request aborted; model process stopped.")); };
    pending = { id, accept: value => { cleanup(); resolveRequest(value); }, reject: error => { cleanup(); reject(error); } };
    timer = setTimeout(() => { cleanup(); shutdown(); reject(new Error(`${kind} deadline exceeded; model process stopped.`)); }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    child.send({ id, kind, ...payload }, error => { if (error && pending?.id === id) { pending.reject(new Error("Model process transport failed.")); shutdown(); } });
  });
  child.on("message", message => {
    if (!pending || message?.id !== pending.id) return;
    if (message.error) pending.reject(new Error(message.error));
    else pending.accept(message.result);
  });
  child.on("error", () => { pending?.reject(new Error("Model worker could not start.")); shutdown(); });
  child.on("exit", () => { closed = true; pending?.reject(new Error("Model worker exited before completing the request.")); });
  let metadata;
  try { metadata = await request("initialize", { model, cacheDir: resolve(cacheDir), allowDownload: allowDownload === true }, initializationTimeoutMs); }
  catch (error) { shutdown(); throw error; }
  return {
    metadata,
    classify(text, { timeoutMs = inferencePolicy.generationTimeoutMs, signal } = {}) {
      const input = validateServiceRequest(text);
      if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new RangeError("Timeout must be between 100 and 60,000 milliseconds.");
      return request("classify", { input }, timeoutMs, signal);
    },
    async close() {
      if (closed) return;
      const exited = new Promise(resolveExit => child.once("exit", resolveExit));
      pending?.reject(new Error("Classifier closed; pending work stopped."));
      shutdown();
      await exited;
    },
  };
}