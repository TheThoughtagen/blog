---
title: "Done means diagnosable"
description: "A first field note on why production integrations are only done when the next person can trace stale data, retries, and ownership."
date: "2026-09-18"
category: "Industrial software"
tags: ["Ignition", "Integrations", "Diagnostics", "Reliability"]
featured: true
---
## The failure mode

Most integration failures do not announce themselves as one clean outage.

They look more like this:

- a tag value that is technically present but no longer fresh
- an ERP handoff that accepted a payload but did not create the expected work
- a historian query that returns yesterday's answer quickly
- a retry loop that is busy enough to feel alive and quiet enough to miss
- a screen that says "running" because the last good state never expired

That is why "the API returned 200" is not a definition of done on the plant floor. It is one piece of evidence. Sometimes it is the least interesting piece.

## A better definition

For factory software, I want "done" to mean that the next responsible person can diagnose the system without hunting through tribal memory.

That usually means answering a small set of boring questions:

| Question | Evidence I want in the system |
| --- | --- |
| Is the data fresh? | Source timestamp, received timestamp, and an age threshold that is visible where people make decisions. |
| Did the handoff finish? | A durable correlation ID shared across the gateway, queue, service, and target system. |
| What happened when it failed? | The exact boundary that failed, the payload class, retry state, and the next safe action. |
| Who owns the next move? | A runbook note or alert route that names the team, not just the server. |

None of this is glamorous. It is the work that keeps a fix from depending on the one person who remembers where the logs are.

## What I can show publicly

This notebook's [Lab](/lab/) currently points to five Ignition-facing projects:

- **Ignition Dev Tools** for editor support across VS Code, Neovim, and Zed
- **ignition-lint** for checking Perspective schema, expressions, naming, and Jython issues before runtime
- **Ignition CLI** for inspecting and operating gateways, projects, tags, and local rigs from a terminal
- **ignition-mcp** for giving AI assistants a curated interface to Ignition Gateway REST APIs
- **Ignition Git Module** for bringing Git workflows into Designer and gateway configuration work

That is the proof I can point to here: tools and documentation aimed at making Ignition work more inspectable, scriptable, checked, and versioned. It is not a customer story, a metric, or a logo slide, so I am not going to dress it up as one.

The pattern behind those tools is the same pattern I want in production integrations: make the boundary visible before it becomes a mystery.

## The small design choice

When an integration crosses from Ignition into another system, I like to draw the boundary as if a stranger will have to debug it later.

```text
[gateway event]
  correlation_id = "batch-2026-09-18-1432"
  source_time    = "2026-09-18T14:32:10Z"
  received_time  = "2026-09-18T14:32:12Z"
        |
        v
[handoff]
  target         = "mes.work-order"
  attempt        = 3
  state          = "retrying"
  next_retry     = "2026-09-18T14:37:12Z"
        |
        v
[operator view]
  status         = "delayed"
  last_good      = "2026-09-18T14:20:04Z"
  next_action    = "check MES receiver before rerun"
```

The names will change from plant to plant. The principle stays useful: the screen, the log, and the retry mechanism should describe the same event in language a maintainer can follow.

## What this changes

It changes the review conversation.

Instead of asking, "Does the integration work?" ask:

1. Where does freshness expire?
2. What identifier follows the work across systems?
3. What does an operator see when the downstream system is slow?
4. What can the next engineer check first?
5. What is unsafe to retry automatically?

Those questions are not a replacement for tests. They are the shape tests and monitoring should take.

## Field note

If we meet at Ignition Community Conference, I would be happy to compare notes on this kind of thing: not the brochure version of integration work, but the part where a line is waiting, the data is suspicious, and the system needs to explain itself.

That is the standard I want this notebook to keep. Problems, decisions, examples. Proof where I have it. Plain notes where I do not.
