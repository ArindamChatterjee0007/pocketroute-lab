from __future__ import annotations

from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import random
import re
from typing import Any

from train import score


LABELS = ("A", "B", "C", "D")
QUALITY_PATH = Path(__file__).with_name("quality-data.json")
CONFIRMATION_PATH = Path(__file__).with_name("quality-confirmation.json")


def protocol_fingerprint() -> str:
    digest = hashlib.sha256()
    for name in ("train.py", "quality.py", "quality-data.json", "requirements.txt"):
        content = Path(__file__).with_name(name).read_bytes()
        digest.update(name.encode("utf-8"))
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def training_order(size: int, steps: int, seed: int) -> list[int]:
    if size <= 0 or steps <= 0 or steps % size:
        raise ValueError("Training must use complete, nonempty shuffled epochs.")
    generator = random.Random(seed)
    order = []
    for _epoch in range(steps // size):
        indices = list(range(size))
        generator.shuffle(indices)
        order.extend(indices)
    return order


def parity_examples(examples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected = []
    counts = Counter()
    families = set()
    for example in examples:
        if counts[example["expected"]] < 2 and example["family"] not in families:
            selected.append(example)
            counts[example["expected"]] += 1
            families.add(example["family"])
    if any(counts[label] != 2 for label in LABELS):
        raise ValueError("Reload probes need two distinct families per category.")
    return selected


def load_quality_fixture() -> dict[str, Any]:
    fixture = json.loads(QUALITY_PATH.read_text(encoding="utf-8"))
    if fixture.get("schemaVersion") != 2 or fixture.get("version") != "routing-quality-candidate-v2-2026-11-14":
        raise ValueError("Unexpected quality protocol version.")
    expected_settings = {"steps": 432, "seed": 20261114, "maximumTokens": 192, "learningRate": 0.0001, "rank": 8, "alpha": 16, "targetModules": ["q_proj", "v_proj"], "threads": 2, "wallSeconds": 900, "maximumRssBytes": 10737418240}
    if fixture.get("training") != expected_settings or fixture.get("choices") != {"A": "python", "B": "infrastructure", "C": "architect", "D": "review"}:
        raise ValueError("The frozen quality recipe changed.")
    provenance = fixture.get("provenance", {})
    if provenance.get("distillation") is not False or provenance.get("customerOrEmployerData") is not False:
        raise ValueError("Only the approved original synthetic corpus is accepted.")
    fixture["train"], fixture["development"] = [], []
    families, inputs = set(), set()
    counts = Counter()
    for family in fixture["families"]:
        identifier, split, expected, task = (family[key] for key in ("id", "split", "expected", "task"))
        if identifier in families or split not in ("train", "development") or expected not in LABELS or not isinstance(task, str) or not 10 <= len(task) <= 256:
            raise ValueError("Invalid or duplicated intent family.")
        families.add(identifier)
        counts[(split, expected)] += 1
        lower_start = task[0].lower() + task[1:]
        for index, text in enumerate((task, f"Please {lower_start}", f"Task: {task}", f"I need you to {lower_start}")):
            normalized = " ".join(text.casefold().split())
            if normalized in inputs:
                raise ValueError("Duplicate training or validation text.")
            inputs.add(normalized)
            fixture[split].append({"id": f"{identifier}-{index + 1}", "family": identifier, "input": text, "expected": expected})
    if any(counts[("train", label)] != (12 if label == "D" else 8) or counts[("development", label)] != 4 for label in LABELS):
        raise ValueError("Expected 36 training families, including 12 review families, and 16 validation families.")
    return fixture


def load_confirmation(fixture: dict[str, Any]) -> list[dict[str, Any]]:
    bundle = json.loads(CONFIRMATION_PATH.read_text(encoding="utf-8"))
    cases = bundle.get("cases", [])
    if bundle.get("schemaVersion") != 1 or bundle.get("scope") != "independently authored synthetic confirmation; not human or field data" or len(cases) != 64 or bundle.get("protocolSha256") != protocol_fingerprint():
        raise ValueError("A separately authored 64-case confirmation bundle is required.")
    ids, families, inputs = set(), set(), set()
    old_families = {entry["family"] for split in ("train", "development") for entry in fixture[split]}
    old_inputs = {" ".join(entry["input"].casefold().split()) for split in ("train", "development") for entry in fixture[split]}
    counts = Counter()
    for entry in cases:
        if not all(isinstance(entry.get(key), str) and entry[key].strip() for key in ("id", "family", "input", "expected")):
            raise ValueError("Incomplete confirmation case.")
        normalized = " ".join(entry["input"].casefold().split())
        if entry["id"] in ids or entry["family"] in families | old_families or normalized in inputs | old_inputs or entry["expected"] not in LABELS or len(entry["input"]) > 512:
            raise ValueError("Duplicate, overlapping or invalid confirmation case.")
        ids.add(entry["id"])
        families.add(entry["family"])
        inputs.add(normalized)
        counts[entry["expected"]] += 1
    if any(counts[label] != 16 for label in LABELS):
        raise ValueError("Confirmation must contain exactly 16 cases per class.")
    return cases


def quality_gate(examples: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    if not examples or len({example["id"] for example in examples}) != len(examples) or any(example["expected"] not in LABELS for example in examples):
        raise ValueError("Quality cases need unique IDs and canonical expected labels.")
    metrics = score(examples, predictions)
    metrics["scope"] = "frozen synthetic routing sample; not deployment evidence"
    counts = Counter(example["expected"] for example in examples)
    reasons = []
    if len(examples) < 64 or any(counts[label] < 16 for label in LABELS):
        reasons.append("At least 64 cases and 16 per class are required.")
    if metrics["accuracy"] <= 0.9:
        reasons.append("Accuracy must exceed 90%.")
    if metrics["acceptedPrecision"] is None or metrics["acceptedPrecision"] < 0.95:
        reasons.append("Accepted-label precision is below 95% or undefined.")
    if metrics["supportedCoverage"] is None or metrics["supportedCoverage"] < 0.8:
        reasons.append("Supported-request coverage is below 80% or undefined.")
    if metrics["unsafeAcceptances"]:
        reasons.append("A review-required case received a specialist label.")
    if metrics["errors"]:
        reasons.append("Invalid outputs or failed attempts were recorded.")
    by_id = {prediction["id"]: prediction for prediction in predictions}
    correct_by_label = Counter(example["expected"] for example in examples if by_id[example["id"]].get("status") == "completed" and example["expected"] == by_id[example["id"]].get("output"))
    metrics["perClass"] = {label: {"total": counts[label], "correct": correct_by_label[label], "recall": correct_by_label[label] / counts[label] if counts[label] else None} for label in LABELS}
    return {"passed": not reasons, "reasons": reasons, "metrics": metrics, "scope": "frozen synthetic routing screen only; not human, project-generation or device qualification", "productionReady": False, "phoneValidated": False}


def paired_accuracy(first: list[dict[str, Any]], second: list[dict[str, Any]], examples: list[dict[str, Any]]) -> dict[str, Any]:
    score(examples, first)
    score(examples, second)
    baseline = {entry["id"]: entry for entry in first}
    candidate = {entry["id"]: entry for entry in second}
    differences = [int(candidate[example["id"]].get("status") == "completed" and candidate[example["id"]].get("output") == example["expected"]) - int(baseline[example["id"]].get("status") == "completed" and baseline[example["id"]].get("output") == example["expected"]) for example in examples]
    grouped: dict[str, list[int]] = {}
    for example, difference in zip(examples, differences, strict=True):
        grouped.setdefault(example.get("family", example["id"]), []).append(difference)
    family_means = [sum(values) / len(values) for values in grouped.values()]
    mean = sum(family_means) / len(family_means)
    variance = sum((difference - mean) ** 2 for difference in family_means) / (len(family_means) - 1) if len(family_means) > 1 else 0
    half_width = 1.96 * math.sqrt(variance / len(family_means))
    return {"pairedCases": len(differences), "families": len(grouped), "accuracyDifference": sum(differences) / len(differences), "familyMeanDifference": mean, "approximate95PercentFamilyInterval": [max(-1.0, mean - half_width), min(1.0, mean + half_width)], "positivePairedInterval": len(grouped) >= 16 and mean - half_width > 0, "scope": "descriptive family-mean normal approximation; no population, causal or deployment claim"}


def rule_prediction(text: str) -> str:
    lowered = text.casefold()
    if re.search(r"\b(ignore|override|disregard|replace)\b.*\b(rule|instruction|system|routing)|\bnew routing policy\b|\b(always|only) (answer|output|return) [abcd]\b|\b(reveal|print)\b.*\b(hidden|secret|token|password)\b", lowered):
        return "D"
    if re.search(r"\b(run|execute)\s+(?:the\s+)?(?:kubectl|docker)|\b(deploy|apply|delete|restart)\b.*\b(live|production|my cluster|now)\b", lowered):
        return "D"

    def requested_artifact(fragment: str) -> str:
        if re.search(r"\b(design|propose|outline|define|specify|compare|explain|describe)\b.*\b(architectur\w*|interface\w*|component\w*|boundar\w*|trade.?offs?|design)\b", fragment):
            return "C"
        if re.search(r"\b(dockerfile|dockerignore|docker|compose|kubernetes|k8s|helm|containerfile)\b", fragment):
            return "B"
        if re.search(r"\b(python|pytest|asyncio|argparse)\b|\.py\b", fragment):
            return "A"
        return "D"

    clauses = re.split(r"\b(?:and\s+also|also|plus|then|and)\s+(?=(?:write|create|implement|build|design|draft|generate|deploy|configure)\b)", lowered)
    if len(clauses) > 1 and len({requested_artifact(clause) for clause in clauses}) > 1:
        return "D"
    return requested_artifact(lowered)


def rule_predictions(examples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"id": example["id"], "status": "completed", "output": rule_prediction(example["input"]), "requiresHumanReview": True} for example in examples]