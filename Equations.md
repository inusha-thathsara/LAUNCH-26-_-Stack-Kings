expand tune chat_spark 

## Universe Routing & Latency Mathematical Reference 

## 1. Void Distance ( _L_ ) 

**==> picture [338 x 15] intentionally omitted <==**

## Symbol Definitions: 

- _x_ 1, _y_ 1 / _[x]_ 2, _y_ 2 : Coordinates of the origin / destination planet centers, as specified in the configuration. 

- _S_ : coordinate_scale_unit_km (from universe_metadata ) — converts grid units to km. 

- _R_ 1 / _R_ 2 : radius_km of the origin / destination planet. _h_ 1 / _h_ 2 : atmosphere_thickness_km of the origin / destination planet. 

## 2. Void Travel Time ( _Tv_ ) 

**==> picture [181 x 29] intentionally omitted <==**

## Symbol Definitions: 

- _h_ 1 / _h_ 2 : atmosphere_thickness_km of the origin / destination planet. _n_ 1 / _n_ 2 : refraction_index of the origin / destination planet. 

- _L_ : Void distance from Formula 1. 

- _C_ : speed_of_light_kms (from universe_metadata ; defaults to 300,000 km/s). 

## 3. Internal Crust Transit Time ( _T_ ) _p_ 

**==> picture [158 x 30] intentionally omitted <==**

## Symbol Definitions: 

- _r_ : radius_km of the current planet. 

- _N_ : active_towers of the current planet (total towers on the ring). 

- _s_ : Number of segments traveled along the ring between entry and exit tower (angular distance ÷ 360∘/ _N_ ). Note that _s_ = 0 if entry tower = exit tower. 

- _m_ : Number of distinct towers hit (for the processing-delay charge). _m_ = _s_ + 1 in general; _m_ = 1 when entry tower = exit tower (the dedup case). 

- _f_ : fiber_speed_fraction (from universe_metadata ; defaults to 0.67 ). 

- _C_ : speed_of_light_kms (same constant as in _Tv_ ). 

- Δ _t_ : tower_processing_delay_ms (from universe_metadata ; defaults to 7 ms). 

## End-to-End Route Composition 

**==> picture [262 x 40] intentionally omitted <==**

## Core Rules: 

- One _Tp_ per planet visited (handling internal routing and tower delay). 

- One _Tv_ per void hop between consecutive planets. 

- No double-counting, and / _t_ Δ _t_ only ever enters through the _m_ × Δ _t_ term inside _Tp_ . 

