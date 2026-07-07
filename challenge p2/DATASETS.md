# Dataset Column Descriptions

This guide describes the columns for the three training history CSV files distributed to teams: `link_traffic_history.csv`, `link_telemetry.csv`, and `link_incident_history.csv`.

---

## 1. `link_traffic_history.csv`

Used to train the **congestion-prediction** model.

| Column                | Type    | Description                                                                                                                                                           |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `link_id`             | String  | Unique identifier of the interplanetary link (e.g., `Aegis-Boreas`).                                                                                                  |
| `tick`                | Integer | The snapshot index.                                                                                                                                                   |
| `load_units`          | Float   | The amount of simulated traffic load currently on the link.                                                                                                           |
| `load_ratio`          | Float   | The ratio of load to capacity (`load_units / capacity_units`). Ranges from `0.0` to just under `1.0`.                                                                 |
| `status`              | String  | The link status. `"ok"` under normal conditions; `"saturated"` if `load_ratio` meets or exceeds `SATURATION_LOAD_RATIO` (0.90 by default), indicating a link failure. |
| `observed_latency_ms` | Float   | The actual measured latency on the link (empty/null if the link is saturated/failed).                                                                                 |

---

## 2. `link_telemetry.csv`

Used to train the **trust/reliability** model.

| Column                     | Type    | Description                                                                                                                                     |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `link_id`                  | String  | Unique identifier of the interplanetary link.                                                                                                   |
| `tick`                     | Integer | The snapshot index.                                                                                                                             |
| `self_reported_latency_ms` | Float   | The latency reported by the link itself. Can be manipulated/discounted if the link is compromised, or contain normal reporting noise if honest. |
| `measured_latency_ms`      | Float   | The actual ground-truth latency experienced on the link during that tick.                                                                       |

---

## 3. `link_incident_history.csv`

Used to train the **targeting-risk** model.

| Column          | Type    | Description                                                                                                                   |
| --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `link_id`       | String  | Unique identifier of the interplanetary link.                                                                                 |
| `tick`          | Integer | The snapshot index.                                                                                                           |
| `traffic_share` | Float   | This link's slice of total interplanetary traffic at that tick (0 to 1). Sums to 1.0 across all active links in a given tick. |
| `jammed_flag`   | Boolean | `True` if the link was successfully disrupted/jammed during this tick; `False` otherwise.                                     |
