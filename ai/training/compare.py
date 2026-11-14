from __future__ import annotations

import math
from typing import Any


LABELS = ("A", "B", "C", "D")
REGULARIZATION = (0.1, 1.0, 10.0)


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