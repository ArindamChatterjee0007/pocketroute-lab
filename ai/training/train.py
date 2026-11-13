from __future__ import annotations

import argparse
import gc
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import resource
import shutil
import signal
import sys
import time
from typing import Any


BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
BASE_REVISION = "7ae557604adf67be50417f59c2c2f167def9a775"
REPOSITORY = "ArindamChatterjee0007/pocketroute-lab"
ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = Path(__file__).with_name("pilot.json")


def require_cloud(environment: dict[str, str]) -> None:
    required = {
        "GITHUB_ACTIONS": "true",
        "RUNNER_OS": "Linux",
        "RUNNER_ENVIRONMENT": "github-hosted",
        "GITHUB_REPOSITORY": REPOSITORY,
        "GITHUB_REPOSITORY_ID": "1438957003",
    }
    if any(environment.get(key) != value for key, value in required.items()):
        raise RuntimeError("Training and checks require the authorized GitHub-hosted Linux repository. Local execution is disabled.")
    if not environment.get("GITHUB_RUN_ID", "").isdigit():
        raise RuntimeError("A GitHub run identifier is required.")


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_fixture(fixture: dict[str, Any]) -> None:
    if fixture.get("schemaVersion") != 1 or fixture.get("choices") != {"A": "python", "B": "infrastructure", "C": "architect", "D": "review"}:
        raise ValueError("Unsupported fixture contract.")
    if fixture.get("provenance", {}).get("distillation") is not False or fixture["provenance"].get("customerOrEmployerData") is not False:
        raise ValueError("This pilot does not accept teacher distillation or private data.")
    if fixture.get("scope") != "synthetic-development-only; not independent quality or mobile evidence":
        raise ValueError("The exposed fixture must remain development-only.")
    identifiers: set[str] = set()
    inputs: set[str] = set()
    families: set[str] = set()
    for split in ("train", "development"):
        examples = fixture.get(split)
        if not isinstance(examples, list) or len(examples) != 8:
            raise ValueError("The frozen smoke needs eight cases per split.")
        counts = dict.fromkeys(fixture["choices"], 0)
        for example in examples:
            if not all(isinstance(example.get(key), str) and example[key].strip() for key in ("id", "family", "input", "expected")):
                raise ValueError("Incomplete example.")
            normalized = " ".join(example["input"].casefold().split())
            if example["id"] in identifiers or normalized in inputs or example["family"] in families:
                raise ValueError("Duplicate identifier, input or declared family.")
            if example["expected"] not in counts or len(example["input"]) > 512:
                raise ValueError("Invalid target or oversized input.")
            identifiers.add(example["id"])
            inputs.add(normalized)
            families.add(example["family"])
            counts[example["expected"]] += 1
        if set(counts.values()) != {2}:
            raise ValueError("Each split needs two examples per category.")
    configuration = fixture.get("training", {})
    expected = {"steps": 8, "seed": 42, "maximumTokens": 128, "learningRate": 0.0002, "rank": 4, "alpha": 8, "targetModules": ["q_proj", "v_proj"], "threads": 2, "wallSeconds": 900, "maximumRssBytes": 10737418240}
    if configuration != expected:
        raise ValueError("The bounded pilot configuration changed; review and freeze a new protocol.")


def completion_labels(prompt: list[int], complete: list[int], maximum: int) -> list[int]:
    if not prompt or len(complete) <= len(prompt) or complete[:len(prompt)] != prompt:
        raise ValueError("The generation-ready prompt must prefix a nonempty completion.")
    if len(complete) > maximum:
        raise ValueError("Example exceeds the token cap; silent truncation is forbidden.")
    labels = [-100] * len(prompt) + complete[len(prompt):]
    if all(value == -100 for value in labels[1:]):
        raise ValueError("No completion token survives causal shifting.")
    return labels


def chat_tokens(tokenizer: Any, messages: list[dict[str, str]], generation_prompt: bool) -> list[int]:
    tokens = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=generation_prompt, return_dict=False)
    if not isinstance(tokens, list) or not tokens or any(type(token) is not int for token in tokens):
        raise ValueError("The tokenizer must return a nonempty flat integer token list.")
    return tokens


def job_outcome(receipt: dict[str, Any], status: str, receipt_existed: bool) -> dict[str, Any]:
    receipt["jobStatus"] = status
    if receipt["status"] == "started":
        if not receipt_existed or receipt.get("phase") == "preflight":
            receipt.update(status="failed-before-training", phase="dependency-or-test-setup")
        else:
            receipt.update(status="interrupted", error="The job ended without a completed model-stage receipt.")
    return receipt


def adapter_card(source_sha: str) -> str:
        return f"""---
base_model: {BASE_MODEL}
library_name: peft
license: apache-2.0
tags:
    - lora
    - experimental
---

# PocketRoute Experimental Routing Adapter

This is a bounded CPU adaptation smoke, not a qualified orchestrator, coding specialist or phone-ready model.

- Base: `{BASE_MODEL}` at revision `{BASE_REVISION}`.
- Training implementation source: `{source_sha}`.
- Protocol: rank-four q/v LoRA, eight updates and eight original synthetic training examples.
- Evaluation: eight exposed development examples; no independent quality or generalization claim.
- The base weights are frozen and are not included. Load this adapter only with the pinned compatible base.
- Every suggested route requires human review. No specialist worker or generated code is executed.
- Read the accompanying `receipt.json` for actual update, reload, prediction and failure evidence. This card does not assert that a run passed.
- No distillation, merging, mobile quantization, physical-phone test or energy measurement is established.

Retain `LICENSE-QWEN`, the base revision, adapter hashes and the receipt when transferring this research artifact.
"""


def score(examples: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    expected = {example["id"]: example for example in examples}
    if len(predictions) != len(expected) or {prediction["id"] for prediction in predictions} != set(expected):
        raise ValueError("Every frozen case needs exactly one recorded attempt.")
    accepted = correct_accepted = supported_accepted = correct = unsafe = errors = 0
    supported = sum(example["expected"] != "D" for example in examples)
    for prediction in predictions:
        target = expected[prediction["id"]]["expected"]
        output = prediction.get("output") if prediction.get("status") == "completed" else None
        errors += output not in ("A", "B", "C", "D")
        correct += output == target
        if output in ("A", "B", "C"):
            accepted += 1
            correct_accepted += output == target
            supported_accepted += target != "D"
            unsafe += target == "D"
    return {"total": len(examples), "correct": correct, "accuracy": correct / len(examples), "acceptedPrecision": correct_accepted / accepted if accepted else None, "supportedCoverage": supported_accepted / supported if supported else None, "unsafeAcceptances": unsafe, "errors": errors, "qualified": False, "scope": "exposed synthetic development smoke only"}


def output_directory() -> Path:
    return ROOT / "training-output" / f"{os.environ['GITHUB_RUN_ID']}-{os.environ.get('GITHUB_RUN_ATTEMPT', '1')}"


def initial_receipt() -> dict[str, Any]:
    return {"schemaVersion": 1, "status": "started", "phase": "preflight", "runUrl": f"https://github.com/{REPOSITORY}/actions/runs/{os.environ['GITHUB_RUN_ID']}", "sourceSha": os.environ.get("GITHUB_SHA"), "baseModel": BASE_MODEL, "baseRevision": BASE_REVISION, "fixtureSha256": digest_file(FIXTURE_PATH), "implementationSha256": digest_file(Path(__file__)), "scope": "CPU adapter plumbing and exposed development comparison; not distillation or a qualified specialist", "steps": [], "productionReady": False, "phoneValidated": False, "specialistsQualified": 0, "distillationPerformed": False, "localBuildsOrTests": 0}


def write_receipt(destination: Path, receipt: dict[str, Any]) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    receipt["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (destination / "receipt.json").write_text(json.dumps(receipt, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def run_training(fixture: dict[str, Any], receipt: dict[str, Any], destination: Path) -> None:
    import torch
    from huggingface_hub import snapshot_download
    from peft import LoraConfig, PeftModel, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer

    settings = fixture["training"]
    started = time.monotonic()
    torch.manual_seed(settings["seed"])
    torch.set_num_threads(settings["threads"])
    torch.set_num_interop_threads(1)
    receipt["environment"] = {"python": platform.python_version(), "platform": platform.platform(), "versions": {name: importlib.metadata.version(name) for name in ("torch", "transformers", "peft", "accelerate", "safetensors", "huggingface-hub")}, "cudaBuild": torch.version.cuda}
    if torch.version.cuda is not None:
        raise RuntimeError("Only the explicitly selected CPU PyTorch build is permitted.")
    receipt["phase"] = "download"
    write_receipt(destination, receipt)
    snapshot = Path(snapshot_download(BASE_MODEL, revision=BASE_REVISION, cache_dir=str(Path(os.environ["RUNNER_TEMP"]) / "pocketroute-training-cache"), allow_patterns=["config.json", "generation_config.json", "tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt", "model.safetensors", "LICENSE", "README.md"], token=False))
    required = ["model.safetensors", "config.json", "tokenizer_config.json", "tokenizer.json", "LICENSE"]
    if any(not (snapshot / name).is_file() for name in required) or "Apache License" not in (snapshot / "LICENSE").read_text(encoding="utf-8"):
        raise RuntimeError("Pinned model artifacts or Apache license are missing.")
    receipt["modelFiles"] = {name: {"sha256": digest_file(snapshot / name), "bytes": (snapshot / name).stat().st_size} for name in required}
    shutil.copyfile(snapshot / "LICENSE", destination / "LICENSE-QWEN")
    os.environ["HF_HUB_OFFLINE"] = "1"
    tokenizer = AutoTokenizer.from_pretrained(str(snapshot), local_files_only=True, trust_remote_code=False)
    choices = list(fixture["choices"])
    encoded_choices = [tokenizer.encode(choice, add_special_tokens=False) for choice in choices]
    if any(len(encoded) != 1 for encoded in encoded_choices) or len({encoded[0] for encoded in encoded_choices}) != 4:
        raise RuntimeError("The four routing choices must have unique single-token encodings.")
    choice_ids = [encoded[0] for encoded in encoded_choices]

    def prompt_tokens(example: dict[str, Any]) -> list[int]:
        return chat_tokens(tokenizer, [{"role": "system", "content": fixture["systemPrompt"]}, {"role": "user", "content": example["input"]}], True)

    def budget() -> None:
        if time.monotonic() - started > settings["wallSeconds"] or resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024 > settings["maximumRssBytes"]:
            raise RuntimeError("The pilot reached its wall-time or process-memory stop limit.")

    def load_base() -> Any:
        budget()
        return AutoModelForCausalLM.from_pretrained(str(snapshot), local_files_only=True, trust_remote_code=False, use_safetensors=True, dtype=torch.float32, attn_implementation="eager")

    def evaluate(model: Any) -> list[dict[str, Any]]:
        model.eval()
        results = []
        for example in fixture["development"]:
            budget()
            began = time.monotonic()
            prediction = {"id": example["id"], "expected": example["expected"], "status": "error", "output": None, "requiresHumanReview": True}
            try:
                tokens = prompt_tokens(example)
                if len(tokens) >= settings["maximumTokens"]:
                    raise ValueError("Development prompt exceeds the token cap.")
                with torch.inference_mode():
                    logits = model(input_ids=torch.tensor([tokens]), use_cache=False).logits[0, -1, choice_ids].float()
                if not torch.isfinite(logits).all():
                    raise ValueError("Non-finite choice logits.")
                prediction.update(status="completed", output=choices[int(logits.argmax())], choiceLogits=logits.tolist())
            except TimeoutError:
                raise
            except Exception as error:
                prediction["error"] = f"{type(error).__name__}: {error}"[:300]
            prediction["elapsedMs"] = round((time.monotonic() - began) * 1000)
            results.append(prediction)
        return results

    def tensor_digest(model: Any, trainable: bool) -> str:
        digest = hashlib.sha256()
        for name, parameter in model.named_parameters():
            if parameter.requires_grad == trainable:
                digest.update(name.encode("utf-8"))
                digest.update(parameter.detach().cpu().contiguous().numpy().tobytes())
        return digest.hexdigest()

    def assert_parity(first: list[dict[str, Any]], second: list[dict[str, Any]]) -> None:
        for original, reloaded in zip(first, second, strict=True):
            if original["status"] != "completed" or reloaded["status"] != "completed" or original["output"] != reloaded["output"] or not torch.allclose(torch.tensor(original["choiceLogits"]), torch.tensor(reloaded["choiceLogits"]), rtol=1e-5, atol=1e-5):
                raise RuntimeError("Choice-logit or output parity failed.")

    receipt["phase"] = "base-and-zero-adapter"
    model = get_peft_model(load_base(), LoraConfig(task_type="CAUSAL_LM", r=settings["rank"], lora_alpha=settings["alpha"], target_modules=settings["targetModules"], lora_dropout=0.0, bias="none"))
    model.config.use_cache = False
    with model.disable_adapter():
        receipt["baseline"] = evaluate(model)
    assert_parity(receipt["baseline"], evaluate(model))
    receipt["zeroAdapterParity"] = True
    base_before = tensor_digest(model, False)
    adapter_before = tensor_digest(model, True)
    trainable = [parameter for parameter in model.parameters() if parameter.requires_grad]
    if not trainable or any("lora_" not in name for name, parameter in model.named_parameters() if parameter.requires_grad):
        raise RuntimeError("Only LoRA parameters may be trainable.")
    receipt["trainableParameters"] = sum(parameter.numel() for parameter in trainable)
    encoded = []
    for example in fixture["train"]:
        messages = [{"role": "system", "content": fixture["systemPrompt"]}, {"role": "user", "content": example["input"]}, {"role": "assistant", "content": example["expected"]}]
        complete = chat_tokens(tokenizer, messages, False)
        labels = completion_labels(prompt_tokens(example), complete, settings["maximumTokens"])
        encoded.append((torch.tensor([complete]), torch.tensor([labels])))
    optimizer = torch.optim.AdamW(trainable, lr=settings["learningRate"], weight_decay=0.0)
    model.train()
    receipt["phase"] = "optimizer-updates"
    for step in range(settings["steps"]):
        budget()
        began = time.monotonic()
        input_ids, labels = encoded[step % len(encoded)]
        optimizer.zero_grad(set_to_none=True)
        result = model(input_ids=input_ids, labels=labels, use_cache=False)
        loss = result.loss
        independent_loss = torch.nn.functional.cross_entropy(result.logits[:, :-1, :].float().reshape(-1, result.logits.shape[-1]), labels[:, 1:].reshape(-1), ignore_index=-100)
        if not torch.isfinite(loss) or not torch.allclose(loss, independent_loss, rtol=1e-5, atol=1e-5):
            raise RuntimeError("Completion-only causal loss is non-finite or inconsistent.")
        loss.backward()
        gradient_norm = torch.nn.utils.clip_grad_norm_(trainable, 1.0, error_if_nonfinite=True)
        if not math.isfinite(float(gradient_norm)) or float(gradient_norm) <= 0:
            raise RuntimeError("No finite nonzero adapter gradient.")
        optimizer.step()
        receipt["steps"].append({"step": step + 1, "exampleId": fixture["train"][step % len(encoded)]["id"], "loss": float(loss.detach()), "gradientNorm": float(gradient_norm), "elapsedMs": round((time.monotonic() - began) * 1000)})
        del result, loss, independent_loss
        write_receipt(destination, receipt)
    adapter_after = tensor_digest(model, True)
    base_after = tensor_digest(model, False)
    if adapter_before == adapter_after or base_before != base_after:
        raise RuntimeError("Adapter weights did not change, or frozen base parameters changed.")
    receipt["weights"] = {"adapterBefore": adapter_before, "adapterAfter": adapter_after, "frozenBaseBefore": base_before, "frozenBaseAfter": base_after, "adapterChanged": True, "baseUnchanged": True}
    receipt["adapted"] = evaluate(model)
    receipt["phase"] = "save-and-reload"
    adapter_directory = destination / "adapter"
    model.peft_config["default"].base_model_name_or_path = BASE_MODEL
    model.peft_config["default"].revision = BASE_REVISION
    model.config._name_or_path = BASE_MODEL
    model.save_pretrained(str(adapter_directory), safe_serialization=True, save_embedding_layers=False)
    (adapter_directory / "README.md").write_text(adapter_card(receipt["sourceSha"]), encoding="utf-8")
    del optimizer, trainable, model
    gc.collect()
    model = PeftModel.from_pretrained(load_base(), str(adapter_directory), is_trainable=False, local_files_only=True)
    receipt["reloaded"] = evaluate(model)
    assert_parity(receipt["adapted"], receipt["reloaded"])
    receipt["reloadParity"] = True
    receipt["metrics"] = {"baseline": score(fixture["development"], receipt["baseline"]), "adapted": score(fixture["development"], receipt["adapted"])}
    receipt["performance"] = {"wallMs": round((time.monotonic() - started) * 1000), "processPeakRssBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024, "scope": "GitHub CPU training process only; not phone inference or energy"}
    receipt["adapterFiles"] = {path.name: {"sha256": digest_file(path), "bytes": path.stat().st_size} for path in adapter_directory.iterdir() if path.is_file()}
    if sum(entry["bytes"] for entry in receipt["adapterFiles"].values()) > 10 * 1024 * 1024:
        raise RuntimeError("The adapter exceeded the 10 MiB artifact limit.")
    receipt.update(status="adaptation-smoke-passed", phase="completed")


def main() -> int:
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--check", action="store_true")
    modes.add_argument("--run", action="store_true")
    modes.add_argument("--outcome", choices=["success", "failure", "cancelled"])
    arguments = parser.parse_args()
    require_cloud(dict(os.environ))
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    validate_fixture(fixture)
    if arguments.check:
        print(json.dumps({"fixtureValidated": True, "trainingCases": 8, "developmentCases": 8, "modelExecuted": False}))
        return 0
    destination = output_directory()
    if arguments.outcome:
        receipt_path = destination / "receipt.json"
        receipt = json.loads(receipt_path.read_text(encoding="utf-8")) if receipt_path.is_file() else initial_receipt()
        write_receipt(destination, job_outcome(receipt, arguments.outcome, receipt_path.is_file()))
        return 0
    if destination.exists():
        raise RuntimeError("A run receipt already exists; preserve it and use a new workflow attempt.")
    destination.mkdir(parents=True)
    receipt = initial_receipt()
    write_receipt(destination, receipt)
    shutil.copyfile(FIXTURE_PATH, destination / "fixture.json")
    for key in tuple(os.environ):
        if key in {"GH_TOKEN", "GITHUB_TOKEN", "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"}:
            os.environ.pop(key)

    def deadline(_signum: int, _frame: Any) -> None:
        raise TimeoutError("The 900-second training smoke deadline expired.")

    signal.signal(signal.SIGALRM, deadline)
    signal.alarm(fixture["training"]["wallSeconds"])
    try:
        run_training(fixture, receipt, destination)
        return_code = 0
    except BaseException as error:
        receipt.update(status="failed" if isinstance(error, Exception) else "interrupted", error=f"{type(error).__name__}: {error}"[:800])
        if not isinstance(error, Exception):
            raise
        return_code = 1
    finally:
        signal.alarm(0)
        write_receipt(destination, receipt)
    print(json.dumps({key: receipt.get(key) for key in ("status", "phase", "error", "metrics", "productionReady", "phoneValidated")}, indent=2))
    return return_code


if __name__ == "__main__":
    sys.exit(main())