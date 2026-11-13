import copy
import json
from pathlib import Path
import unittest

from train import BASE_MODEL, BASE_REVISION, adapter_card, chat_tokens, completion_labels, job_outcome, require_cloud, score, validate_fixture


class TrainingContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = json.loads(Path(__file__).with_name("pilot.json").read_text(encoding="utf-8"))

    def test_frozen_development_fixture(self) -> None:
        validate_fixture(self.fixture)

    def test_local_execution_rejected(self) -> None:
        with self.assertRaises(RuntimeError):
            require_cloud({})

    def test_wrong_repository_rejected(self) -> None:
        with self.assertRaises(RuntimeError):
            require_cloud({"GITHUB_ACTIONS": "true", "RUNNER_OS": "Linux", "RUNNER_ENVIRONMENT": "github-hosted", "GITHUB_REPOSITORY": "someone/other", "GITHUB_REPOSITORY_ID": "1438957003", "GITHUB_RUN_ID": "123"})

    def test_completion_only_mask(self) -> None:
        self.assertEqual(completion_labels([10, 11], [10, 11, 12, 13], 8), [-100, -100, 12, 13])

    def test_explicit_flat_tokenizer_output(self) -> None:
        class Tokenizer:
            def apply_chat_template(self, messages, *, tokenize, add_generation_prompt, return_dict):
                return {"input_ids": [1, 2]} if return_dict else [1, 2]

        self.assertEqual(chat_tokens(Tokenizer(), [{"role": "user", "content": "example"}], True), [1, 2])

    def test_interrupted_phase_is_preserved(self) -> None:
        receipt = job_outcome({"status": "started", "phase": "optimizer-updates", "steps": [{"step": 1}]}, "cancelled", True)
        self.assertEqual(receipt["status"], "interrupted")
        self.assertEqual(receipt["phase"], "optimizer-updates")
        self.assertEqual(len(receipt["steps"]), 1)
        early = job_outcome({"status": "started", "phase": "preflight"}, "failure", False)
        self.assertEqual(early["status"], "failed-before-training")

    def test_adapter_card_has_portable_identity_and_limits(self) -> None:
        card = adapter_card("a" * 40)
        self.assertIn(f"base_model: {BASE_MODEL}", card)
        self.assertIn(BASE_REVISION, card)
        self.assertIn("not a qualified orchestrator", card)
        self.assertIn("does not assert that a run passed", card)
        self.assertNotIn("/home/runner", card)
        self.assertNotIn("[More Information Needed]", card)

    def test_template_mismatch_and_truncation_rejected(self) -> None:
        for prompt, complete, maximum in [([1], [2, 3], 8), ([1], [1], 8), ([1], [1, 2, 3], 2), ([], [1, 2], 8)]:
            with self.subTest(prompt=prompt, complete=complete):
                with self.assertRaises(ValueError):
                    completion_labels(prompt, complete, maximum)

    def test_duplicate_and_cross_split_family_rejected(self) -> None:
        for key in ("id", "input", "family"):
            candidate = copy.deepcopy(self.fixture)
            candidate["development"][0][key] = candidate["train"][0][key]
            with self.subTest(key=key):
                with self.assertRaises(ValueError):
                    validate_fixture(candidate)

    def test_unauthorized_corpus_or_larger_run_rejected(self) -> None:
        for section, key, value in [("provenance", "distillation", True), ("provenance", "customerOrEmployerData", True), ("training", "steps", 800)]:
            candidate = copy.deepcopy(self.fixture)
            candidate[section][key] = value
            with self.subTest(key=key):
                with self.assertRaises(ValueError):
                    validate_fixture(candidate)

    def test_failed_attempt_stays_in_denominator(self) -> None:
        examples = self.fixture["development"]
        predictions = [{"id": example["id"], "status": "completed", "output": example["expected"]} for example in examples]
        predictions[0].update(status="timeout", output=None)
        result = score(examples, predictions)
        self.assertEqual((result["total"], result["correct"], result["errors"]), (8, 7, 1))
        self.assertFalse(result["qualified"])
        with self.assertRaises(ValueError):
            score(examples, predictions[:-1])
        with self.assertRaises(ValueError):
            score(examples, [predictions[0]] * 8)

    def test_review_false_acceptance_and_precision(self) -> None:
        examples = [{"id": "supported", "expected": "A"}, {"id": "unsupported", "expected": "D"}]
        predictions = [{"id": "supported", "status": "completed", "output": "A"}, {"id": "unsupported", "status": "completed", "output": "B"}]
        result = score(examples, predictions)
        self.assertEqual(result["unsafeAcceptances"], 1)
        self.assertEqual(result["acceptedPrecision"], 0.5)
        self.assertEqual(result["supportedCoverage"], 1.0)


if __name__ == "__main__":
    unittest.main()