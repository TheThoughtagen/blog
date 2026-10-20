---
title: Agents that survive a crash - Pi Durable and the orchestration I've been building
description: Pi Durable makes the agent loop itself durable. Here's how that fits with the multi-agent orchestration I've been building - Foundry, Cask Agents, and a pile of Pi extensions.
date: 2026-10-27
category: AI & ML
tags:
  - AI
  - Agents
  - Orchestration
  - Pi
  - Developer tools
draft: true
---

Running one coding agent in a terminal works fine at this point. Running a dozen of them - across different models, machines, and repos with different rules about where their code is allowed to go - and still knowing what happened when one of them falls over is where I've been spending most of my time.

So when Earendil shipped Pi 1.0 at the start of the month with an experimental package called [Pi Durable](https://github.com/earendil-works/pi/tree/main/packages/durable) alongside it, it landed right in the middle of what I've been building.

---

## What Pi Durable actually is

Pi Durable is a durable agent harness. The core rule is simple: conversations, model turns, tool calls, and your own state are committed to storage *before* anything is shown. If the process dies mid-turn, you reopen the storage and the work picks up where it stopped.

A few of the ideas that make it click for me:

- **Everything is a commit.** Appending transcript entries, editing state documents, and creating tasks all happen in one atomic write - all of it lands or none of it does.
- **Tasks are durable state machines.** Each one checkpoints at every step. A model generation is a task, and it owns the tool-call tasks it spawns. Restart the process and they continue from the last checkpoint.
- **Subagents, child tasks, forks, and a task graph** are first-class, not bolted on.
- It's still marked experimental - the API changes between releases - so I'm treating it like one, not like a foundation I'd bet production on yet.

**[PATRICK: what you're building on Pi Durable goes here - what it is, why durability mattered for it, and anything that surprised you.]**

---

## Foundry: routing the work

The bigger thing I've been building is Foundry (not public yet). It routes coding-agent work across my Claude and Codex subscriptions and other model providers - without letting private code leave the boundary it's allowed to be in.

Every job gets classified from its repo - every git remote, fork parents, live GitHub visibility - as org-private, org-public, or personal. Anything it can't classify is treated as org-private. That class decides which backends are even allowed to touch it. Cheaper models can take public and personal work. Private work only goes to approved endpoints.

Jobs for external models go to a runner that holds no credentials. The repo goes over as a git bundle, the agent runs in a sandbox with file tools and a shell, its API key lives in a proxy outside the sandbox, and its commits come back as a branch. The runner never talks to GitHub. The sandbox has no network of its own beyond an allowlist.

Foundry has its own durability layer. A dispatched job is a series of idempotent steps - ship, start, poll, collect, push - recorded on a job record, and every step is safe to run again after a crash. Who runs those steps is pluggable: inline in your terminal, a built-in SQLite-backed queue with retries and leases, or Temporal if you already run it. Tag a Linear issue and Foundry will run the task, test the change in the sandbox, have a second model review it, retry with the findings if it fails, and open a draft PR when it passes.

Pi Durable makes the *agent loop* durable. Foundry makes the *job around the agent* durable. I think you end up wanting both.

---

## Cask Agents: a teammate in Linear

At Whiskey House we've been building Cask Agents - our own take on a Linear-native development teammate. Assign it an issue (or mention it), and it gets worked by Claude Code in an isolated workspace and comes back as a branch and a pull request, with progress posted on the issue.

The most important design choice is that work runs per developer. Each person's runs use their own Claude credentials and their own repo checkouts, coordinated by a central control plane that handles webhooks, configuration, and routing - and holds as little sensitive material as it can get away with. Runners use the same protocol whether they're on a laptop or a cloud box.

The first phase of that project was durable run state.

---

## The everyday layer: Pi extensions

Day to day, a lot of my orchestration actually happens inside Pi itself, through extensions I've written for my own setup:

- **Subagents** - spin up Claude Code or Codex as subagents from Pi, take over a running one, and get results delivered back into the main conversation.
- **Workflows** - multi-step workflows run in a sandboxed child process, with artifacts and a dashboard to watch them.
- **Background terminals** - long-running processes the agent can start, check on, and read output from without blocking.
- **herdr integration** - so every agent pane reports its state back to [herdr](https://herdr.dev), and I can see at a glance which ones are working, waiting, or done.

It's plumbing, but it lets one person keep a handful of agents busy without babysitting each one.

---

## What I've learned so far

1. **Durability is the first wall.** Agents are slow, non-deterministic, and expensive to re-run. If a crash means starting over, you'll stop trusting the system fast.
2. **Make every step safe to run twice.** Idempotent steps beat clever recovery logic every time.
3. **Decide where code is allowed to go before you decide which model to use.**
4. **Review is still the bottleneck.** More agents means more pull requests. A second-model review and tests in the sandbox help, but a human still decides what "good" looks like.

Cheers 🥃
