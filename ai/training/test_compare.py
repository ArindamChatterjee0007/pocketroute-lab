import unittest

from compare import ordered_probabilities, routing_predictions, select_regularization, validate_folds


class RouterComparisonContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.groups = [f"family-{index // 2}" for index in range(32)]
        self.labels = [("A", "B", "C", "D")[(index // 2) % 4] for index in range(32)]
        self.folds = [([index for index in range(32) if index // 8 != fold], [index for index in range(32) if index // 8 == fold]) for fold in range(4)]

    def test_grouped_folds_cover_every_training_case(self) -> None:
        validate_folds(self.groups, self.labels, self.folds)

    def test_related_families_cannot_cross_folds(self) -> None:
        groups = list(self.groups)
        groups[8] = groups[0]
        with self.assertRaises(ValueError):
            validate_folds(groups, self.labels, self.folds)

    def test_duplicate_or_missing_held_out_rows_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            validate_folds(self.groups, self.labels, [self.folds[0]] * 4)
        with self.assertRaises(ValueError):
            validate_folds(self.groups, self.labels, self.folds[:-1])

    def test_missing_class_is_rejected_before_fitting(self) -> None:
        with self.assertRaises(ValueError):
            validate_folds(self.groups, ["A"] * 32, self.folds)
        labels = list(self.labels)
        labels[:8] = ["A"] * 8
        with self.assertRaises(ValueError):
            validate_folds(self.groups, labels, self.folds)

    def test_classifier_class_order_is_explicit(self) -> None:
        self.assertEqual(ordered_probabilities(["D", "C", "B", "A"], [[0.1, 0.2, 0.3, 0.4]]), [[0.4, 0.3, 0.2, 0.1]])

    def test_invalid_probabilities_are_not_silently_accepted(self) -> None:
        for row in ([float("nan"), 0, 0, 1], [1, 1, 0, 0], [-1, 0, 0, 2]):
            with self.assertRaises(ValueError):
                ordered_probabilities(["A", "B", "C", "D"], [row])

    def test_rejection_does_not_change_an_existing_review(self) -> None:
        examples = [{"id": "uncertain"}, {"id": "review"}]
        result = routing_predictions(examples, [[0.4, 0.3, 0.2, 0.1], [0.1, 0.2, 0.1, 0.6]], 0.8, ["A", "B", "C", "D"])
        self.assertEqual([entry["output"] for entry in result], ["D", "D"])
        self.assertTrue(all(entry["requiresHumanReview"] for entry in result))

    def test_missing_predictions_fail_instead_of_changing_denominator(self) -> None:
        with self.assertRaises(ValueError):
            routing_predictions([{"id": "missing"}], [], 0.5, ["A", "B", "C", "D"])

    def test_exact_tie_defers_to_review(self) -> None:
        result = routing_predictions([{"id": "tie"}], [[0.4, 0.4, 0.1, 0.1]], 0.0, ["A", "B", "C", "D"])
        self.assertEqual(result[0]["output"], "D")
        self.assertTrue(result[0]["tiedMaximum"])

    def test_regularization_selection_uses_oof_loss_only(self) -> None:
        candidates = [{"regularization": 10.0, "oofLogLoss": 0.4}, {"regularization": 1.0, "oofLogLoss": 0.2}, {"regularization": 0.1, "oofLogLoss": 0.2}]
        self.assertEqual(select_regularization(candidates)["regularization"], 0.1)

    def test_nonfinite_loss_and_unfrozen_grid_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            select_regularization([{"regularization": value, "oofLogLoss": float("nan") if value == 0.1 else 0.2} for value in (0.1, 1.0, 10.0)])
        with self.assertRaises(ValueError):
            select_regularization([{"regularization": 0.2, "oofLogLoss": 0.1}])


if __name__ == "__main__":
    unittest.main()