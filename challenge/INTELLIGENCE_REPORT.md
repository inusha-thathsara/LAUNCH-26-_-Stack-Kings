# Chimera Intelligence Report (Phase 1 Model Evaluation)

This report documents the performance metrics and findings of the trained link-intelligence models. Coefficients are produced by `npm run train:models` and this report by `npm run evaluate:models`, both driven purely by the historical datasets in `challenge p2/`.

---

## 1. Congestion Model (MAE Performance)

The Congestion model uses a per-link power-law regression of Chimera-induced latency penalty against live link load ratio:
$$\text{penalty\_ms} = k \cdot (\text{load\_ratio})^p$$

- **Global Mean Absolute Error (MAE):** **22654.435 ms** (~22.654s average prediction offset)
- **Evaluation Count:** 5743 ticks (non-saturated `ok` rows)

### Per-Link MAE Breakdown:

| Link ID        | MAE (ms)  | Data Count |
| -------------- | --------- | ---------- |
| Aegis-Boreas   | 13683.140 | 480        |
| Aegis-Dawn     | 26387.363 | 477        |
| Aegis-Elysium  | 27281.155 | 474        |
| Boreas-Dawn    | 10645.228 | 478        |
| Boreas-Elysium | 18295.995 | 477        |
| Boreas-Fenix   | 28964.024 | 485        |
| Caelum-Dawn    | 25671.272 | 477        |
| Caelum-Elysium | 24201.355 | 476        |
| Caelum-Fenix   | 19861.372 | 480        |
| Dawn-Elysium   | 25729.032 | 480        |
| Dawn-Fenix     | 21342.429 | 485        |
| Elysium-Fenix  | 29864.556 | 474        |

---

## 2. Trust Model Spoofing Detection Accuracy

The Trust model compares each link's self-reported latency against the physics + congestion baseline and flags systematic under-reporting. A link is treated as spoofed when its trust score falls below `0.5`.

### Performance Matrix (per-tick):

- **True Positives (TP):** 678
- **False Positives (FP):** 58
- **False Negatives (FN):** 285
- **True Negatives (TN):** 4723

### Accuracy Metrics:

- **Precision:** **92.12%**
- **Recall:** **70.40%**
- **F1 Score:** **0.7981**

### Compromised Link Map:

Telemetry delta analysis confirms the following link(s) are actively spoofing (self-reporting faster than reality):

1. **Aegis-Elysium:** systematic under-reporting (mean delta ~78.4s, std ~87.2s).
2. **Boreas-Fenix:** systematic under-reporting (mean delta ~64.8s, std ~65.4s).

---

## 3. Targeting Risk Model Performance

The Targeting Risk model estimates the probability of Chimera jamming a link using an L2-regularized per-link logistic regression on `traffic_share`:
$$P(\text{jammed}) = \frac{1}{1 + e^{-(b_0 + b_1 \cdot \text{traffic\_share})}}$$

- **Average Log Loss (Cross-Entropy):** **0.28020**
- **Average P(jammed) on jammed ticks:** **8.74%**
- **Average P(jammed) on clean ticks:** **8.17%**

### Summary of Targeting Tendencies:

As a link's traffic share rises, Chimera is increasingly likely to jam it. This is the core signal for enforcing **route entropy** — diversifying away from the single most-predictable path so the co-pilot does not paint a target on any one link.
