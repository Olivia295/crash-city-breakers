# CRASH-04.0 simulation notes

The observed reference rules were supplied by the parent agent after watching gameplay. The numbers below are local prototype tuning, except Rush Hour's 90-second duration and Road Trip's five-escape failure condition. They are not claimed to reproduce the original game's unpublished values.

## Rules represented

- Road Trip: ordinary traffic is counted once on its first accident or intact exit. Five intact escapes fail the round. A safely exiting ambulance removes one earlier escape. Features follow resolved waves; successful completion runs a Super Feature before results.
- Rush Hour: 90 seconds. Every ten newly crashed traffic vehicles advances the next Pizza arrival, subject to its visible warning and spacing limits. Destroying it chooses a temporary feature. Time expiry causes a large player-centered blast, followed by a 4.5-second physical settlement window.
- Pile Up: finite traffic, then Inferno. Burning slows Inferno's countdown; new destruction extends it. Escapes reduce the final multiplier.
- Stars: three score milestones, one end-event achievement, and one explicitly labeled local challenge. Building collapse or collecting bank cash substitutes for the unimplemented original Dunk challenge; this is not presented as Dunk.
- Sandbox retains the original prototype's manual mechanisms and experimental booster/magnet traffic. These are excluded from the reference-oriented rulesets.

## Local values

- Road Trip: 60 actual vehicles, three waves of 20. The first 20 are already on the approach roads. Good Cops and Magnet follow the first two waves. Route-specific finales are Tornado / Air Strike / Tidal Wave for hill / market / pier. Finale duration: eight seconds.
- Road Trip finale power is `max(0.8, 4 * (1 - escapes / 5))`: zero escapes gives POWER ×4, four gives POWER ×0.8. Disaster damage and linear impulses scale by `finalePower / 4`, so those finales apply 100% and 20% strength respectively. These are local balancing values; the original game's exact power curve is not asserted.
- Pile Up: 30 actual vehicles. Inferno starts at ten seconds, drains at 0.32 speed while something burns, gains 0.65 seconds per new destruction, caps the displayed remaining time at 18 seconds and the total Inferno stage at 40 seconds. Final multiplier is `max(1, 5 - escapes)`.
- Finite modes have a 180-second emergency timeout. It is a guard against a stuck round, not their intended completion condition. The current simple-policy calibration's successful Road Trip runs finished in 76.5–108.4 seconds with all 60 vehicles resolved.
- Score stars: Road Trip $0.45M / $1.4M / $4M; Rush Hour $0.35M / $1.2M / $3.8M; Pile Up $0.25M / $0.9M / $3M. Sandbox remains $0.15M / $0.35M / $0.65M. Two further stars require the end event and local challenge.
- Sandbox has no Super Feature: its fourth achievement is completing the full 120-second round. It is awarded only on normal completion, never while the round is still running.
- Crashbreaker: passive recovery takes 14 seconds, or 17 for the heavy truck; first player collision fills it. A newly hit vehicle contributes 0.17 charge; a new property target contributes 0.045. First destruction of a vehicle adds 0.035. A single player's explosion can immediately refill at most 0.72. Repeated hits on the same object do not give new-target charge. Sandbox retains its faster 3.8 / 4.8-second recharge.
- Shared player stats affect actual physics: blast radius `10 + power * 1.2`, blast strength `0.85 + power * 0.06`, Aftertouch force `10 + aftertouch * 1.35`, with 1.15 air and 0.65 heavy-passive factors.
- Ordinary destroyed vehicles detonate after 0.65–1.20 seconds through the fuse queue, with 10.5-metre radius and 0.9 strength. Tankers retain their 2.5-second warning fuse. Destruction chains use physics steps rather than recursively detonating all ordinary cars.
- Explosion Combo: at least three previously undestroyed vehicles destroyed by one blast, $1,500 per vehicle. Explosion Chain: $750 times causal depth. Smash Chain: three or more property destructions within 2.5 seconds, $400 times chain length. Landing skillshot: more than 12 metres from the blast origin, $150/metre capped at $12,000. These remain separate visible events, aggregated into the three public score groups rather than claiming the original six-category accounting.
- Bank: five $5,000 bags, collected within 4.5 metres. Bad Cop contact locks blasting for two seconds. Ice Cream freeze: six seconds within 24 metres. Magnet acts within 25 metres and temporarily suppresses the affected cars' motors. Good Cops physically closes one exit for its eight-second feature, then the blocker is removed.
- Buildings: 340 health, stages at 68%, 34%, and zero health. Colliders remain fixed and shrink with damage; a destroyed building leaves a 0.55-metre foundation. Base building value is $18,000 distributed over first hit, two damage stages and collapse.

## Traffic and physics safeguards

Natural traffic, bonus/surge traffic, physical scatter and feature selection use separate seeded random streams. A finite candidate is retained until it really enters. After 1.8 seconds of congestion, an alternative available entry may be used; that rerouting is a local playability adjustment. Cleanup never counts as an escape or a resolved vehicle.

Heavy vehicle motor interpolation must overcome tire friction. Actual contact with an existing wreck lasting 1.2 seconds registers one low-speed accident; this uses Rapier contact pairs rather than proximity. Decorative money pickups do not block the driving AI.

Above 95 entities, at most four old, stationary, destroyed pieces are reclaimed per second. They must have had no interaction for at least 12 seconds. Buildings, players, moving chains and magnet-controlled pieces are protected. The traffic budget is 125 entities, with bounded extra debris for collapses and bonus events.

Already resolved vehicles outside the playable area (`abs(x) > 64` or `abs(z) > 64`) can also be reclaimed after 12 untouched seconds if stationary, even when the entity budget is below 95. This prevents abandoned off-screen approach wrecks blocking all later arrivals. At most four are removed per second; pending vehicles are protected, and reclamation never changes scores or escape/resolution counters.

## Version 0.3 cities, abilities and vehicle differences

- City data is shared with rendering. San Francisco retains sloping crossroads and rail-bound trams. Sydney uses offset junctions with turning connections; London traffic follows the outer roundabout path. Lane arc-length placement and per-vehicle waypoint steering affect the actual rigid bodies. Building footprints are physical, and out-of-bounds player recovery chooses a clear road position.
- Each city has 20 initial traffic vehicles. Sydney's local pool includes utes and road trains; London's includes black cabs and double deckers. Trams only occur in San Francisco's ordinary traffic. Finite-mode arrival interval is the seeded 1.0–1.55 seconds multiplied by 0.7; local pools consume the same count of random draws. City, route, rules and vehicle/build are separate record groups.
- Compact: two seconds of attraction, then a damaging bounce; 12-second cooldown, 0.15 energy cost. Sport: three aimed piercing pulses over 0.78 seconds; 10-second cooldown, 0.20 cost. Pickup: throw up to five nearby wrecks and sweep forward; 11-second cooldown, 0.10 cost. Semi: radial ground strike and a 1.1-second broadside hold; 15-second cooldown, 0.25 cost. The shared `PLAYER_ABILITIES` definitions supply costs and cooldowns. Insufficient charge refuses activation without spending cooldown; pause freezes all ability timing.
- Double decker: first damage tips it sideways with real angular velocity. Black cab: choose a clear flank, dash for 0.65 seconds, then wait 2.4 seconds before another escape attempt. Ute: three physical toolboxes on first damage and one directional thrust when first affected by an explosion. Road train: detach two separately simulated heavy trailers on first damage; the tractor collider shortens. Payloads never inflate finite arrival quotas.
- City targets accumulate three nearby player blasts, or nine distinct physical collision pairs, or a combination. Each target fires and pays its $18,000 bonus only once. San Francisco releases two runaway trams; Sydney drops seven physical payloads, including two cargo trailers; London adds four double deckers following the ring approaches. These event reinforcements do not increase the finite traffic quota. City event counters are local to each run.
- Ability and city-event sounds are original synthesized cues, subject to the existing event deduplication and voice budgets.

## Version 0.4 entry fairness and seeded rewards

- Initial traffic still counts as exactly 20 ordinary arrivals. All 20 now start in upstream queues, 12 metres apart, with the lead vehicle 32 metres along its lane. A queue member overlapping the selected player entry is moved farther upstream. Fresh traffic accelerates from 55% to 100% of its normal driving speed over four seconds. This replaces the former partly downstream starting traffic that could cause five unavoidable early escapes. The ground collider extends to ±180 metres to support upstream queues; player recovery remains at ±65 metres. Road Trip remains 60 vehicles, Pile Up 30, and Road Trip still fails at five escapes.
- Every mode schedules its first Pizza truck at four seconds and warns 2.5 seconds before arrival. An intact Pizza truck blocks further Pizza scheduling; after its destruction or departure, the next countdown is 18–24 seconds. Rush Hour's ten-crash milestones can shorten that countdown, but arrivals remain at least ten seconds apart. Bonus vehicles do not count toward finite quotas. No fresh Pizza is scheduled during Inferno, a finale, or after completion.
- Destroying a Pizza truck draws an eight-second positive reward from an independently seeded shuffled bag: Good Cops, Magnet, Double Trouble, or Freeze. Each set of four includes all four; the bag boundary cannot immediately repeat the prior reward. The selection is independent of traffic, physical debris, and feature-position random draws. The actual selected feature and Pizza draw event are published together. One truck can award exactly one draw.
- Every second successful draw adds one seeded special encounter: a bank van, ice cream van, missile carrier, or cargo carrier. These all have existing physical payload mechanics. The extra vehicle is uncounted traffic. Pizza scheduling stops above 140 entities; the additional encounter requires fewer than 135 entities. Existing global cleanup and bounded payload limits remain in force.
- A queued Road Trip wave feature waits for the active Pizza reward to finish, so it does not immediately hide the player's selected reward. The Super Feature takes priority at finale start; an old Pizza destroyed during the finale cannot replace it. Pause freezes arrival countdowns, rewards, physics and draw counters.
- Passive recharge, new-target recharge, player blast strength, traffic arrival interval, building health and Inferno multiplier are unchanged in this revision. Buildings were moved closer to roads by the city authoring changes; this is part of the measured combined revision, not an isolated threshold experiment.

### Calibration evidence and limits

The same 36 scenarios were run before and after: three cities × three main modes × two seeds (72191, 19073) × two simple policies. Both use the compact car and hill entry, attempt Crashbreaker every 2.5 seconds, and aim toward the city centre. The `junction` policy supplies no Aftertouch. The `occasional` policy looks for one intact vehicle within 32 metres every eight seconds, follows that fixed target for two seconds, then returns its aim to the centre; it only moves toward the centre when more than 22 metres away. It attempts the ability every 16 seconds. It does not continuously know or pursue the nearest car. The initial ability attempt has insufficient charge; baseline early failures can finish before the next attempt.

| Measure | Before | Final v0.4 |
| --- | ---: | ---: |
| Total stars at least three | 23 / 36 | 34 / 36 |
| Third score milestone reached | 10 / 36 | 15 / 36 |
| All five stars | 8 / 36 | 14 / 36 |
| Road Trip completes all 60 vehicles | 6 / 12 | 10 / 12 |
| At least one real Pizza draw | 12 / 36 | 32 / 36 |

All 18 final `occasional` runs completed naturally and drew at least one Pizza reward. All 12 Pile Up runs resolved 30 arrivals and settled Inferno, and all 12 Rush Hour runs completed their 90 seconds plus finale. Neither final Road Trip failure used the timeout: both stationary London policies aimed at the empty roundabout island, failed after 18.2–18.3 seconds and five escapes, and still need active redirection toward the circulating traffic. London's two stationary Pile Up runs also missed the Pizza truck. A visible reward arrival is guaranteed in the opening schedule; destroying it remains a player objective.

| Mode | Previous score milestones | Current score milestones |
| --- | --- | --- |
| Road Trip | $0.8M / $2.5M / $5M | $0.45M / $1.4M / $4M |
| Rush Hour | $0.6M / $1.8M / $4M | $0.35M / $1.2M / $3.8M |
| Pile Up | $0.5M / $1.5M / $3M | $0.25M / $0.9M / $3M |

The full recorded baseline is `tests/balance-baseline-v3.csv` (transcribed from the pre-edit calibration output); the final machine-produced rows are `tests/balance-final-v4.jsonl`. The current probe is `tests/balance-probe.ts`, run with `node node_modules/vite-node/vite-node.mjs tests/balance-probe.ts [city]`. These small deterministic scripted samples establish reachable outcomes, not a human win rate or a representative player difficulty study. The fourth and fifth goals remain separate achievements; score alone awards at most three stars.
