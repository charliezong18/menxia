**English** · [中文](zhongshumenxia-infra-design.zh-CN.md)

# System Design 08 · Infra (selection · requirements · scaling)

> The infrastructure chapter, added to the #43 series. **One-line duty**: what iron 中书门下 runs on, why that iron, and what happens when the iron runs out.
> Prior context: selection comparison (#58), decision close-out D1–D10 (#57), runtime & 班子 (sys-07). Division of labor with sys-07: sys-07 owns "how many installations, who sees which"; this doc owns "machine, network, capacity, money".

**Date**: 2026-07-31

---

## I. Requirements (criteria first, choices second)

### Functional

| # | Requirement | Source |
|---|---|---|
| F1 | Run happy2 server (Fastify + SQLite) + Docker plugin containers (1 GiB cap each) | sys-02/07, M0 |
| F2 | Worker and phone can reach in from outside; **the server never dials into the home machine** | topology iron rule |
| F3 | Backups can leave the island (off-site second copy, against whole-host loss) | C6 |
| F4 | From M5, Rig agent containers run on the same box | dispatch-1pager |

### Non-functional

| # | Requirement | Criterion |
|---|---|---|
| N1 | **Budget**: ≤$20/mo, and the billing model must be **structurally runaway-proof** — hourly-capped-at-monthly beats pure pay-as-you-go | ruled 2026-07-31 |
| N2 | **Availability SLO: self-alerting, not high availability.** Single box, single disk, no HA; targets RTO ≤ 4 h (provision.sh + restore) and RPO ≤ 24 h (daily backups). **A silently dead doorbell is the only unacceptable failure** — covered by the worker self-alert (C7), not by more machines | #56 F4 (approved) |
| N3 | **Security**: Contract 3 (bodies never at rest) is the main line; plugin egress-open enters the threat model as fact (D2); the smaller the exposed surface the better (§V) | sys-02 §IX |
| N4 | **Operability**: bare metal to B1 in one command (provision.sh, annotation adopted); upstream pinned at tag v0.0.22, upgrades rehearsed locally first | #57 annotation, sys-07 |
| N5 | **Legal hygiene**: personal account, personal payment, throughout; **never any employer-affiliated cloud account/credits** (that is precisely how §2870's "used employer resources" exception gets triggered) | happy2-as-base §4② |

---

## II. Selection (verdict + why the hyperscalers are out)

**Primary: Hetzner CPX21 @ Hillsboro (3 vCPU / 4 GB / 80 GB, ≈$12.53/mo)**; fallback Vultr 4 GB ($20, at cap). The four-way comparison with sources is #58; not repeated here.

**Why AWS/GCP/Azure are out as a class** (the 2026-07-31 follow-up question, archived here):

1. **Every 4 GB tier prices out before extras**: EC2 t4g.medium ≈$24.5 + EBS + IPv4 (now billed) + metered egress ≈ $30+; GCP e2-medium the same class. Even Lightsail at the line only buys "a pricier Hetzner with an AWS login".
2. **The billing model is N1 inverted**: pure pay-as-you-go, metered egress, no spend ceiling — the classic accident shape for an unattended personal box. Hetzner's hourly-capped-at-monthly satisfies N1 structurally.
3. **Complexity tax with zero payback**: IAM/VPC/egress rate cards are the entry fee for managed services; this design is one VPS + SQLite — none of the hyperscaler strengths get used.
4. Free tiers (1 GB) can't hold F1; GCP's $300 credit buys two free months at the price of one forced migration — not worth it.

**Lock-in backstop**: N4's provision.sh + C6 backups compress "picked the wrong host" to hours — this decision does not need to be perfect.

---

## III. Topology

![infra topology](assets/infra-topology.png)

All three streams are **outbound-only** (worker → server); the phone browser and Telegram are the only two human-facing entrances. Three trust zones: the VPS (housing the plugin container, a "tenant with open egress"), the mini (holds all local credentials, never reachable inbound), the phone (read-only consumer). GitHub is an external source, pulled one-way by the worker.

---

## IV. Capacity and scaling

### How the 4 GB gets spent (M1–M4 budget)

| Consumer | Budget | Basis |
|---|---|---|
| OS + sshd + Caddy | ~0.4 GB | routine |
| happy2 server | ~0.3–0.5 GB | Fastify + SQLite, light |
| Plugin container × 1 (self-use 班子) | ≤1 GiB | upstream hard cap |
| Plugin container × 2 (M3 collab 班子) | ≤1 GiB | ditto |
| **Headroom** | **~1–1.2 GB** | bursts + page cache |

**Conclusion: 4 GB carries M1–M4 comfortably; 2 GB starts pinching at M3's second 班子** — which is exactly why the 2 GB tier wasn't chosen.

### Disk (80 GB)

Item metadata is KB-scale, 敕草 snapshots MB-scale — business data won't fill it in a decade. The real consumer is **Docker images and build cache**: the ops contract gains a weekly `docker system prune` timer, and disk >80% joins the worker self-alert probes.

### Traffic (US 1 TB/mo)

All three streams are KB-scale metadata packets; body fetch-back is MB-scale and human-triggered. **Cannot hit the ceiling by orders of magnitude** — not designed for.

### Scaling path (by trigger, not by date)

| Trigger | Action | Note |
|---|---|---|
| **M5 Rig lands** and memory is measured tight | CPX21 → CPX31 (8 GB, ≈$23/mo, **over cap — needs your budget re-approval**); Hetzner supports in-place rescale (disk only grows) | the single foreseeable vertical step |
| Disk persistently >80% | prune first, grow later | almost always image junk |
| One box not enough (multi-user, agent concurrency) | **Explicit non-goal.** If that day comes, the project's nature has changed — redesign then, nothing pre-built here | anti-overengineering |

**Explicitly not done**: HA/standby, load balancing, K8s, multi-region. N2's SLO is met by "self-alert + hours-scale rebuild", not by a second machine.

---

## V. ⏳ Decision box A · Exposure staging (tailnet-first vs public day-1)

sys-07 says "public HTTPS + upstream auth", reasoned from the second user and phone deep links. But **during M1–M2 you are the only user, and your phone is already in the tailnet** — public exposure buys nothing in that window, while parking a 395-commits-in-60-days young Fastify in front of internet-wide scanning.

> **Recommendation (a) | tailnet-first, flip public at M3**: for M1–M2 the server joins Tailscale only; happy2/Caddy bind the tailnet address; TLS via `tailscale cert` (ts.net name, phones trust it natively); worker and phone deep links all work unchanged. When the friend joins at M3, flip to public + upstream auth (rebind Caddy + domain, half a day). **Side benefit: the domain purchase defers to M3 — #58's domain question dissolves.**
> **Option (b) | public from day 1**: sys-07 as written. Saves the half-day flip at M3, at the cost of the whole build period's exposure.
>
> Recommending (a). No conflict with sys-07's "Tailscale is wrong once the second user joins" — that ruling governs M3+; this box governs M1–M2 only.

## VI. ⏳ Decision box B · The honest trade on server-disk encryption

"Full-disk encryption" on an unattended single VPS has an unavoidable knot: **auto-mount requires the key on the same disk (encryption theater), while manual unlock means every reboot leaves the hub down until you show up** (you're out = doorbell dead, violating N2).

> **Recommendation (a) | skip server-disk encryption, spend encryption where it pays**: the at-rest sensitive surface is already minimized by Contract 3 (SQLite metadata + 敕草 snapshots from M4); the off-site backup lands on the mini's FileVault disk (already encrypted); server-side, backup dir 0700 and snapshots never in logs. Accept the residual "provider disk-recycling" risk.
> **Option (b) | LUKS on the data dir + manual unlock**: closes the disk-recycling risk fully, at the cost of a human present at every reboot — in tension with N2's self-healing goal.
>
> Recommending (a). If 敕草 snapshot sensitivity actually escalates after M4 (immigration/finance folders flowing in), revisit (b) — or the app-layer fix ("sensitive sources refuse attach_doc"), which treats the cause rather than the disk.

---

## VII. Ops contract (code-to-infra, annotation adopted)

| Item | Contract |
|---|---|
| **Provisioning** | `provision.sh`, idempotent, in-repo: bare metal → Docker + happy2@v0.0.22 + Caddy/TLS + account + backup cron + prune timer, one command; **acceptance = replay on a clean box reaches B1** |
| **Config** | everything in-repo; secrets never — `.env` on the server (0600), README states how each is regenerated |
| **Upgrades** | pinned tag; upgrade = verify on a local happy2 instance → apply on server → rerun the Day-1 probes. **Never track trunk** |
| **Backups** | daily `VACUUM INTO` → on-island backup dir (outside plugins.directory); worker pulls a daily copy to the mini (FileVault disk, never a Drive path); **the restore drill is an M1 exit criterion** (C6) |
| **Monitoring** | no monitoring stack. Three probes, all via the worker self-alert (C7): bridge unreachable / disk >80% / backup older than 48 h |
| **Rehosting** | new box: provision.sh + restore = how RTO ≤ 4 h is achieved; every restore drill re-proves it |

## VIII. Cost

| Item | Monthly |
|---|---|
| CPX21 | ≈$12.53 |
| IPv4 add-on (skippable during M1–M2 under box A option (a)) | ≈$0.6–1 |
| Domain (deferred to M3 under (a); ~$10–15/yr then) | ~$1 amortized |
| **Total** | **≈$13–14.5 against a $20 cap — ~30% headroom** |

## IX. Failure modes

| Failure | Symptom | Handling |
|---|---|---|
| VPS lost / lapsed / wiped | all three streams stop; worker self-alert fires | provision.sh + mini-side backup rebuild (RTO ≤4 h, RPO ≤24 h) |
| Plugin container OOM (1 GiB cap) | that 班子 503s, doorbell decisions stop | worker self-alert (same probe as bridge-loss); container restart self-heals |
| Hetzner signup verification stalls | can't rent the primary | fallback Vultr 4 GB; provision.sh is host-agnostic |
| Docker image junk fills the disk | >80% alert | prune timer + alert backstop |
| Upstream upgrade breaks the plugin surface | probes red after upgrade | roll back to the tag; **always rehearse locally first** (sys-07 §VI) |

## X. Open items

1. Decision boxes A (exposure staging) and B (disk encryption) — **yours to rule**.
2. Budget re-approval for the CPX31 upsize — parked on the M5 trigger, not decided now.
3. Whether Hetzner US offers ARM (CAX) tiers — check on the order page; if yes, more RAM at the same price is free upside (images must be arm64; the M0 spike kit's node:24-alpine is multi-arch, no obstacle).
