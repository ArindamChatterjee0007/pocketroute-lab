from __future__ import annotations

from collections import Counter
import math
import re
from typing import Any

from train import score


LABELS = ("A", "B", "C", "D")


def quality_gate(examples: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    if not examples or len({example["id"] for example in examples}) != len(examples) or any(example["expected"] not in LABELS for example in examples):
        raise ValueError("Quality cases need unique IDs and canonical expected labels.")
    metrics = score(examples, predictions)
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
    mean = sum(differences) / len(differences)
    variance = sum((difference - mean) ** 2 for difference in differences) / (len(differences) - 1) if len(differences) > 1 else 0
    half_width = 1.96 * math.sqrt(variance / len(differences))
    return {"pairedCases": len(differences), "accuracyDifference": mean, "approximate95PercentInterval": [max(-1.0, mean - half_width), min(1.0, mean + half_width)], "improvementEstablished": mean - half_width > 0, "scope": "paired descriptive normal approximation on this synthetic sample, not population or deployment evidence"}


def rule_prediction(text: str) -> str:
    lowered = text.casefold()
    if re.search(r"\b(ignore|override|disregard)\b.*\b(rule|instruction|system|routing)|\bnew routing policy\b|\b(always|only) (answer|output|return) [abcd]\b", lowered):
        return "D"
    infrastructure = bool(re.search(r"\b(dockerfile|docker|kubernetes|kubectl|k8s|helm|containerfile)\b", lowered))
    python = bool(re.search(r"\bpython\b", lowered))
    architecture = bool(re.search(r"\b(architecture|architectural|component boundaries|interfaces|tradeoffs|trade-offs)\b", lowered))
    if sum((infrastructure, python, architecture)) > 1:
        return "D"
    return "B" if infrastructure else "A" if python else "C" if architecture else "D"


def rule_predictions(examples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"id": example["id"], "status": "completed", "output": rule_prediction(example["input"]), "requiresHumanReview": True} for example in examples]