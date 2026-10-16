---
title: Reverse Engineer Anything, Including Your Plant
description: Agents that take software apart are trending on GitHub. That's a security problem everywhere, and a bigger one for on-prem industrial software where production is king.
date: 2026-10-16
category: Industrial software
tags:
  - AI
  - Cybersecurity
  - OT
  - Reverse Engineering
  - Industrial Software
draft: true
---

If you've been anywhere near GitHub trending in the last couple of weeks, you've seen it. [REA - "Reverse Engineer Anything"](https://github.com/morluto/rea) went from a quiet repo to one of the most-starred projects on the site in about a week. It's sitting north of 280K stars as I write this.

The pitch is right there in the README: "See a feature you like. Understand how it works, down to the binary level."

Mechanically it's an MCP server. You wire it into Claude Code, Codex, Cursor, whatever, and your agent gets hands on Ghidra / Hopper / IDA for native binaries, plus analyzers for .NET assemblies, Electron and JavaScript apps, Android APKs, websites, saved network captures, firmware images, and even recorded logic signals. Point the agent at an app, ask how a feature works, and it comes back with pseudocode, call graphs, and the evidence behind its conclusions.

My first reaction was "cool." My second reaction, about 30 seconds later, was "oh no." 😬

---

## The barrier was never the tools

Ghidra has been free since 2019. IDA, Hopper, binwalk, Wireshark - none of this is new. What kept most software from being taken apart wasn't access to tools, it was the time and skill to use them. Reverse engineering a non-trivial binary is slow, tedious, expert work. That friction was quietly doing a lot of security work for a lot of vendors.

Agents remove the friction. Not completely - the hands-on reviews are fair that it's not a magic button yet - but the trend line is obvious. What took a specialist weeks takes a curious person with a coding agent an afternoon. And the next model release makes it better without anyone changing a line of REA.

So my main takeaway is simple: this is going to be a cybersecurity nightmare. Every closed binary, every "proprietary" protocol, every license check, every hardcoded credential that was protected mostly by being annoying to find - assume it's findable now. Security through obscurity was never a real control. Now it isn't even a speed bump.

---

## Why industrial software should be paying extra attention

Most of the commentary I've seen is about consumer apps and SaaS - "clone the feature you like." Fine. The part that keeps me up is the on-prem industrial stack. Look at what REA lists as supported targets, then look at what's running in a typical plant:

- .NET thick-client HMIs and engineering tools
- Java-based gateways and servers
- Embedded firmware on controllers, gateways, and network gear
- Proprietary protocols on the wire (and REA reads packet captures)
- Vendor license enforcement done on the client

That's... most of OT. A lot of it ships the same binary to every customer, a lot of it was designed assuming the network was trusted, and a lot of it has never had a serious outside look because nobody had the time.

Then layer on how plants actually run. Production is king. Downtime is measured in dollars per minute, so patches wait for a planned outage - which might be quarterly, annual, or "when the line goes down anyway." Plenty of plants run versions that are years past end-of-support because upgrading means requalifying the line. Air gaps that aren't really air gaps. Shared engineering workstations. Remote access that got bolted on in a hurry and never revisited.

In IT, the gap between "vulnerability found" and "patch deployed" is days to weeks. In a plant it can be months to years. Agentic reverse engineering shrinks the attacker's side of that gap. Nothing about it shrinks ours.

---

## It cuts both ways

I'm not going to pretend the answer is "ban the tool." It's MIT licensed with hundreds of thousands of stars - that ship has sailed. And the same capability is genuinely useful on defense:

- **Know what you're running.** What does that HMI client actually talk to? What's in that firmware image? What libraries are bundled, and at what versions? If an attacker can answer those in an afternoon, you should be able to as well.
- **Read your own network.** Take a capture off your control network and have an agent summarize what's talking to what. I'd bet most plants have at least one surprise in there.
- **Ask your vendors better questions.** Is the protocol authenticated? Are credentials compiled in? Is firmware signed? Where's the SBOM? These used to be nice-to-haves. Now an attacker can answer them for you if your vendor won't.
- **Stop counting on obscurity.** Segmentation, least-privilege remote access, a real asset inventory, monitoring that would notice something weird. The boring fundamentals don't care how the attacker found the bug.

Keep it legal. Reverse engineering vendor software can run into EULA terms, so loop in whoever owns those agreements before you go poking.

For vendors: assume your customers' adversaries already have your binary decompiled and explained. Design like it. If the only thing protecting a protocol, an update channel, or a license tier is that it's hard to read, that protection expired this month.

---

## Where I've landed

The interesting question isn't whether this tool is good or bad. The cost of understanding software just dropped by orders of magnitude, and every assumption built on that cost being high needs another look. In industrial environments those assumptions are baked into equipment that will be on the floor for another 15 years.

So go look at your own stack before someone else does.

Cheers 🥃
