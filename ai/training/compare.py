from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import resource
import signal
import sys
import time
from typing import Any


LABELS = ("A", "B", "C", "D")
REGULARIZATION = (0.1, 1.0, 10.0)
ENCODER = "sentence-transformers/all-MiniLM-L6-v2"
ENCODER_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
ENCODER_WEIGHTS_SHA256 = "53aa51172d142c89d9012cce15ae4d6cc0ca6895895114379cacb4fab128d9db"
SEED = 20261114
WALL_SECONDS = 900
ROOT = Path(__file__).resolve().parents[2]


def validate_folds(groups: list[str], labels: list[str], folds: list[tuple[list[int], list[int]]]) -> None:
    if not groups or len(groups) != len(labels) or set(labels) != set(LABELS) or len(folds) != 4:
        raise ValueError("The comparison requires four nonempty grouped folds.")
    seen: set[int] = set()
    universe = set(range(len(groups)))
    for training, validation in folds:
        train_indices, valid_indices = set(training), set(validation)
        if not train_indices or not valid_indices or len(train_indices) != len(training) or len(valid_indices) != len(validation):
            raise ValueError("Fold indices must be nonempty and unique.")
        if train_indices & valid_indices or train_indices | valid_indices != universe or seen & valid_indices:
            raise ValueError("Every row must be held out exactly once, with no overlap.")
        if {groups[index] for index in training} & {groups[index] for index in validation}:
            raise ValueError("Related scenario families must not cross a fold boundary.")
        if set(labels[index] for index in training) != set(LABELS) or set(labels[index] for index in validation) != set(LABELS):
            raise ValueError("Every training and validation fold must contain all four classes.")
        seen.update(valid_indices)
    if seen != universe:
        raise ValueError("Cross-validation did not cover every training row.")


def ordered_probabilities(classes: list[str], rows: list[list[float]]) -> list[list[float]]:
    if len(classes) != 4 or set(classes) != set(LABELS):
        raise ValueError("Every classifier must learn exactly the four routing classes.")
    order = [classes.index(label) for label in LABELS]
    result = []
    for row in rows:
        if len(row) != 4 or any(not math.isfinite(value) or value < 0 or value > 1 for value in row) or not math.isclose(sum(row), 1.0, abs_tol=1e-6):
            raise ValueError("Classifier probabilities must be finite, bounded and normalized.")
        result.append([float(row[index]) for index in order])
    return result


def routing_predictions(examples: list[dict[str, Any]], probabilities: list[list[float]], threshold: float, classes: list[str]) -> list[dict[str, Any]]:
    if len(examples) != len(probabilities) or not 0 <= threshold <= 1:
        raise ValueError("Predictions must cover every case with a bounded threshold.")
    checked = ordered_probabilities(classes, probabilities)
    predictions = []
    for example, row in zip(examples, checked, strict=True):
        winners = [LABELS[index] for index, value in enumerate(row) if value == max(row)]
        raw = winners[0] if len(winners) == 1 else "D"
        output = "D" if raw != "D" and max(row) < threshold else raw
        predictions.append({"id": example["id"], "status": "completed", "output": output, "rawOutput": raw, "tiedMaximum": len(winners) != 1, "probabilities": row, "threshold": threshold, "requiresHumanReview": True, "confidenceCalibrated": False})
    return predictions


def select_regularization(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    if len(candidates) != len(REGULARIZATION) or {entry.get("regularization") for entry in candidates} != set(REGULARIZATION):
        raise ValueError("Selection requires exactly the frozen regularization grid.")
    if any(type(entry.get("oofLogLoss")) not in (int, float) or not math.isfinite(entry["oofLogLoss"]) or entry["oofLogLoss"] < 0 for entry in candidates):
        raise ValueError("Every selection loss must be finite and nonnegative.")
    return min(candidates, key=lambda entry: (entry["oofLogLoss"], entry["regularization"]))


def comparison_fingerprint() -> str:
    digest = hashlib.sha256()
    for name in ("compare.py", "requirements-compare.txt", "requirements.txt", "quality-data.json", "quality.py", "train.py"):
        content = Path(__file__).with_name(name).read_bytes()
        digest.update(name.encode("utf-8"))
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def save_receipt(directory: Path, receipt: dict[str, Any]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    receipt["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (directory / "comparison.json").write_text(json.dumps(receipt, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def initial_receipt() -> dict[str, Any]:
    return {"schemaVersion": 1, "status": "started", "phase": "setup", "runUrl": f"https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/{os.environ['GITHUB_RUN_ID']}", "sourceSha": os.environ.get("GITHUB_SHA"), "protocolSha256": comparison_fingerprint(), "scope": "exploratory two-router comparison on exposed synthetic development data", "selection": {"folds": 4, "seed": SEED, "regularizationGrid": list(REGULARIZATION), "objective": "training-only out-of-fold log loss", "threshold": 0.0, "thresholdTuning": False, "calibratedConfidence": False}, "arms": {}, "confirmation": {"status": "not-accessed", "reason": "This exploratory comparison does not consume or rebind the reserved test."}, "productionReady": False, "phoneValidated": False, "localModelExecution": False}


def run_comparison(directory: Path, receipt: dict[str, Any]) -> None:
    import numpy as np
    import torch
    from huggingface_hub import snapshot_download
    from scipy.sparse import hstack
    from scipy.special import softmax
    from sklearn.exceptions import ConvergenceWarning
    from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer, TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import log_loss
    from sklearn.model_selection import StratifiedGroupKFold
    from sklearn.pipeline import FeatureUnion
    from threadpoolctl import threadpool_limits
    from transformers import AutoModel, AutoTokenizer
    import warnings

    from quality import load_quality_fixture, parity_examples, quality_gate
    from train import digest_file

    started = time.monotonic()
    fixture = load_quality_fixture()
    training, development = fixture["train"], fixture["development"]
    receipt["fixtureSha256"] = digest_file(Path(__file__).with_name("quality-data.json"))
    receipt["data"] = {"trainingRows": len(training), "trainingFamilies": len({entry["family"] for entry in training}), "developmentRows": len(development), "developmentFamilies": len({entry["family"] for entry in development}), "notice": "Development is already exposed and tuned; rows within a family are correlated."}
    receipt["versions"] = {name: importlib.metadata.version(name) for name in ("torch", "transformers", "scikit-learn", "numpy", "scipy", "huggingface-hub")}
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    threadpool_limits(limits=2)
    if torch.version.cuda is not None:
        raise RuntimeError("The comparison requires the CPU-only PyTorch build.")
    if any(not 0 < len(entry["input"]) <= 512 for entry in training + development):
        raise ValueError("Comparison input exceeds the common character cap.")

    def budget() -> None:
        if time.monotonic() - started > WALL_SECONDS or resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024 > 8 * 1024 ** 3:
            raise TimeoutError("The comparison reached its time or memory stop limit.")

    texts = [entry["input"] for entry in training]
    labels = [entry["expected"] for entry in training]
    groups = [entry["family"] for entry in training]
    splitter = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED)
    folds = [(train_indices.tolist(), valid_indices.tolist()) for train_indices, valid_indices in splitter.split(texts, labels, groups)]
    validate_folds(groups, labels, folds)
    receipt["folds"] = [{"trainingIds": [training[index]["id"] for index in train_indices], "validationIds": [training[index]["id"] for index in valid_indices]} for train_indices, valid_indices in folds]
    probes = parity_examples(training)
    probe_ids = {example["id"] for example in probes}
    probe_indices = [index for index, example in enumerate(training) if example["id"] in probe_ids]
    receipt["parityProbeIds"] = [example["id"] for example in probes]

    def prepare_encoder() -> tuple[Any, Any]:
        receipt["phase"] = "load-frozen-encoder"
        save_receipt(directory, receipt)
        snapshot = Path(snapshot_download(ENCODER, revision=ENCODER_REVISION, cache_dir=str(Path(os.environ["RUNNER_TEMP"]) / "pocketroute-encoder-cache"), allow_patterns=["model.safetensors", "config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt", "1_Pooling/config.json", "sentence_bert_config.json", "README.md"], token=False))
        if digest_file(snapshot / "model.safetensors") != ENCODER_WEIGHTS_SHA256:
            raise RuntimeError("Pinned encoder weight hash mismatch.")
        pooling = json.loads((snapshot / "1_Pooling/config.json").read_text(encoding="utf-8"))
        if pooling.get("word_embedding_dimension") != 384 or pooling.get("pooling_mode_mean_tokens") is not True or any(pooling.get(key) for key in ("pooling_mode_cls_token", "pooling_mode_max_tokens", "pooling_mode_mean_sqrt_len_tokens")):
            raise RuntimeError("Unexpected encoder pooling configuration.")
        receipt["encoder"] = {"id": ENCODER, "revision": ENCODER_REVISION, "licenseDeclaration": "Apache-2.0", "dimension": 384, "weightSha256": ENCODER_WEIGHTS_SHA256, "weightBytes": (snapshot / "model.safetensors").stat().st_size, "maximumTokens": 256, "pooling": "attention-mask mean pooling followed by L2 normalization", "files": {str(path.relative_to(snapshot)): digest_file(path) for path in snapshot.rglob("*") if path.is_file()}}
        os.environ["HF_HUB_OFFLINE"] = "1"
        tokenizer = AutoTokenizer.from_pretrained(str(snapshot), local_files_only=True, trust_remote_code=False)
        encoder = AutoModel.from_pretrained(str(snapshot), local_files_only=True, trust_remote_code=False, use_safetensors=True, dtype=torch.float32, attn_implementation="eager").eval()
        return tokenizer, encoder

    def encode(examples: list[dict[str, Any]], tokenizer: Any, encoder: Any) -> tuple[Any, dict[str, str]]:
        vectors = np.zeros((len(examples), 384), dtype=np.float32)
        errors = {}
        for index, example in enumerate(examples):
            budget()
            try:
                tokens = tokenizer(example["input"], add_special_tokens=True, truncation=False, return_tensors="pt")
                if tokens["input_ids"].shape[1] > 256:
                    raise ValueError("Input exceeds encoder token cap; no truncation performed.")
                with torch.inference_mode():
                    hidden = encoder(**tokens).last_hidden_state
                    mask = tokens["attention_mask"].unsqueeze(-1).expand(hidden.size()).float()
                    pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
                    vector = torch.nn.functional.normalize(pooled, p=2, dim=1)[0]
                if vector.shape[0] != 384 or not torch.isfinite(vector).all():
                    raise ValueError("Non-finite or invalid encoder vector.")
                vectors[index] = vector.numpy()
            except TimeoutError:
                raise
            except Exception as error:
                errors[example["id"]] = type(error).__name__
        return vectors, errors

    def features() -> Any:
        return FeatureUnion([("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, max_features=12000, dtype=np.float64)), ("character", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, max_features=20000, dtype=np.float64))])

    def classifier(value: float) -> Any:
        return LogisticRegression(C=value, solver="lbfgs", max_iter=2000, tol=1e-4, random_state=SEED)

    def fit(model: Any, matrix: Any, targets: list[str]) -> None:
        budget()
        with warnings.catch_warnings():
            warnings.simplefilter("error", ConvergenceWarning)
            model.fit(matrix, targets)

    def execute_arm(arm_name: str) -> None:
        budget()
        arm_started = time.monotonic()
        arm: dict[str, Any] = {"status": "started", "scope": "development comparison only", "selectionSource": "training families only"}
        receipt["arms"][arm_name] = arm
        receipt["phase"] = f"fit-{arm_name}"
        save_receipt(directory, receipt)
        if arm_name == "minilm-frozen-logistic":
            tokenizer, encoder = prepare_encoder()
            encoded_training, training_errors = encode(training, tokenizer, encoder)
            if training_errors:
                arm["trainingEncodingErrors"] = training_errors
                raise RuntimeError("Every training example must encode; no failed row may be dropped.")
            encoded_development, development_errors = encode(development, tokenizer, encoder)
            arm["developmentEncodingErrors"] = development_errors
            del encoder
        arm["featurePreparationMs"] = round((time.monotonic() - arm_started) * 1000)
        candidates = []
        for regularization in REGULARIZATION:
            out_of_fold = np.zeros((len(training), 4), dtype=np.float64)
            for training_indices, validation_indices in folds:
                if arm_name == "tfidf-logistic":
                    vectorizer = features()
                    train_matrix = vectorizer.fit_transform([texts[index] for index in training_indices])
                    validation_matrix = vectorizer.transform([texts[index] for index in validation_indices])
                else:
                    train_matrix, validation_matrix = encoded_training[training_indices], encoded_training[validation_indices]
                model = classifier(regularization)
                fit(model, train_matrix, [labels[index] for index in training_indices])
                out_of_fold[validation_indices] = ordered_probabilities(model.classes_.tolist(), model.predict_proba(validation_matrix).tolist())
            candidates.append({"regularization": regularization, "oofLogLoss": float(log_loss(labels, out_of_fold, labels=list(LABELS))), "oofPredictions": routing_predictions(training, out_of_fold.tolist(), 0.0, list(LABELS))})
        selected = select_regularization(candidates)
        arm["candidates"] = candidates
        arm["selectedRegularization"] = selected["regularization"]
        arm["selectedOofLogLoss"] = selected["oofLogLoss"]
        if arm_name == "tfidf-logistic":
            vectorizer = features()
            train_matrix = vectorizer.fit_transform(texts)
            development_matrix = vectorizer.transform([entry["input"] for entry in development])
        else:
            train_matrix, development_matrix = encoded_training, encoded_development
        model = classifier(selected["regularization"])
        fit(model, train_matrix, labels)
        probabilities = model.predict_proba(development_matrix)
        predictions = routing_predictions(development, probabilities.tolist(), 0.0, model.classes_.tolist())
        if arm_name == "minilm-frozen-logistic":
            for prediction in predictions:
                if prediction["id"] in development_errors:
                    prediction.update(status="error", output=None, rawOutput=None, probabilities=None, tiedMaximum=False, error=development_errors[prediction["id"]])
        arm["predictions"] = predictions
        arm["developmentGate"] = quality_gate(development, predictions)
        state: dict[str, Any] = {"schemaVersion": 1, "arm": arm_name, "classes": model.classes_.tolist(), "coefficients": model.coef_.tolist(), "intercept": model.intercept_.tolist(), "threshold": 0.0, "tiePolicy": "review", "encoder": receipt["encoder"] if arm_name != "tfidf-logistic" else None, "productionReady": False}
        if arm_name == "tfidf-logistic":
            state["vectorizers"] = [{"name": name, "analyzer": fitted.analyzer, "ngramRange": list(fitted.ngram_range), "vocabulary": {token: int(index) for token, index in fitted.vocabulary_.items()}, "idf": fitted.idf_.tolist(), "lowercase": True, "norm": "l2", "sublinearTf": True} for name, fitted in vectorizer.transformer_list]
        output = directory / "routers" / f"{arm_name}.json"
        output.parent.mkdir(exist_ok=True)
        output.write_text(json.dumps(state, allow_nan=False) + "\n", encoding="utf-8")
        restored = json.loads(output.read_text(encoding="utf-8"))
        if arm_name == "tfidf-logistic":
            restored_matrices = []
            for saved in restored["vectorizers"]:
                counter = CountVectorizer(analyzer=saved["analyzer"], ngram_range=tuple(saved["ngramRange"]), vocabulary=saved["vocabulary"], lowercase=saved["lowercase"])
                transformer = TfidfTransformer(norm=saved["norm"], sublinear_tf=saved["sublinearTf"])
                transformer.idf_ = np.asarray(saved["idf"])
                restored_matrices.append(transformer.transform(counter.transform([entry["input"] for entry in probes])))
            restored_features = hstack(restored_matrices).tocsr()
            original_features = train_matrix[probe_indices]
            if not np.allclose(restored_features.toarray(), original_features.toarray(), rtol=1e-10, atol=1e-10):
                raise RuntimeError("Reloaded TF-IDF features differ from fitted features.")
        else:
            restored_features = encoded_training[probe_indices]
            original_features = restored_features
        restored_probabilities = softmax(restored_features @ np.asarray(restored["coefficients"]).T + np.asarray(restored["intercept"]), axis=1)
        if not np.allclose(restored_probabilities, model.predict_proba(original_features), rtol=1e-8, atol=1e-10):
            raise RuntimeError("Exported classifier probabilities fail reload parity.")
        original_decisions = routing_predictions(probes, model.predict_proba(original_features).tolist(), 0.0, model.classes_.tolist())
        restored_decisions = routing_predictions(probes, restored_probabilities.tolist(), restored["threshold"], restored["classes"])
        if [entry["output"] for entry in original_decisions] != [entry["output"] for entry in restored_decisions]:
            raise RuntimeError("Reloaded classifier decisions differ.")
        arm.update(status="completed", reloadParity=True, reloadParityScope="TF-IDF features and classifier" if arm_name == "tfidf-logistic" else "classifier head on fixed in-memory encoder vectors; no encoder reload claim", exportedFile=str(output.relative_to(directory)), exportedBytes=output.stat().st_size, exportedSha256=digest_file(output), elapsedMs=round((time.monotonic() - arm_started) * 1000), timingScope="feature preparation, selection and final fitting; encoder arm includes initial model download, not comparable phone inference latency")
        save_receipt(directory, receipt)
    for arm_name in ("tfidf-logistic", "minilm-frozen-logistic"):
        try:
            execute_arm(arm_name)
        except TimeoutError:
            raise
        except Exception as error:
            receipt["arms"].setdefault(arm_name, {}).update(status="failed", error=f"{type(error).__name__}: {error}"[:500])
            save_receipt(directory, receipt)
    receipt["performance"] = {"wallMs": round((time.monotonic() - started) * 1000), "processPeakRssBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024, "scope": "GitHub CPU comparison process; not phone or energy evidence"}
    receipt["developmentQualifiedArms"] = [name for name, arm in receipt["arms"].items() if arm.get("status") == "completed" and arm.get("developmentGate", {}).get("passed")]
    complete = all(arm.get("status") == "completed" for arm in receipt["arms"].values())
    receipt.update(status="comparison-completed" if complete else "comparison-incomplete", phase="completed")


def main() -> int:
    from train import require_cloud

    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--run", action="store_true")
    modes.add_argument("--outcome", choices=["success", "failure", "cancelled"])
    arguments = parser.parse_args()
    require_cloud(dict(os.environ))
    directory = ROOT / "training-output" / f"{os.environ['GITHUB_RUN_ID']}-{os.environ.get('GITHUB_RUN_ATTEMPT', '1')}"
    if arguments.outcome:
        path = directory / "comparison.json"
        receipt = json.loads(path.read_text(encoding="utf-8")) if path.exists() else initial_receipt()
        receipt["jobStatus"] = arguments.outcome
        if receipt["status"] == "started":
            receipt.update(status="comparison-incomplete", error="The job ended before both arms completed.")
        save_receipt(directory, receipt)
        return 0
    if directory.exists():
        raise RuntimeError("Preserve the existing comparison receipt; use a new workflow attempt.")
    receipt = initial_receipt()
    save_receipt(directory, receipt)
    for key in ("GH_TOKEN", "GITHUB_TOKEN", "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"):
        os.environ.pop(key, None)

    def deadline(_signum: int, _frame: Any) -> None:
        raise TimeoutError("The 900-second comparison deadline expired.")

    signal.signal(signal.SIGALRM, deadline)
    signal.alarm(WALL_SECONDS)
    try:
        run_comparison(directory, receipt)
        result = int(receipt["status"] != "comparison-completed")
    except BaseException as error:
        receipt.update(status="comparison-incomplete", error=f"{type(error).__name__}: {error}"[:800])
        if not isinstance(error, Exception):
            raise
        result = 1
    finally:
        signal.alarm(0)
        save_receipt(directory, receipt)
    print(json.dumps({key: receipt.get(key) for key in ("status", "phase", "error", "developmentQualifiedArms", "confirmation", "productionReady")}, indent=2))
    return result


if __name__ == "__main__":
    sys.exit(main())