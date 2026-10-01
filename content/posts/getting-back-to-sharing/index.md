---
title: Coming up for air - a reflection of the last 3 or so years of learning & building.  
description: A few notes on what I've been building, and getting back to writing about it.
date: 2026-09-21
category: Development
tags:
  - Developer tools
  - Ignition
  - FIELDNOTES
draft: true
---

As I near my 3-year anniversary with Whiskey House - I've been intentional about stepping away from the keyboard, closing the terminal, and trying to be reflective and open about sharing what we've been building. 

Since hopping over here under the one and only Roger Henley in December 2023 - the AI space has rapidly transformer from ChatGPT, copy and pasting between your browser, and banging your head on your keyboard after hours of frustrating turns with ChatGPT as it hallucinated and toiled with out the rigth context - to now; where I can fully build entire systems agentically and even have begun to allow our end users to meaningingfully contribute (requirements, PRs, etc).

Since I joined, we always had this vision - that the new LLM-based AI era would **enable** our human stakeholders and end-users, in a way we never could have imagined. 

Nearly every decision at Whiskey House over the past 2 years and 9 months has been made with that aim. 

Just to list a handful of things we've built in that time... (show and tell to come in subsequent posts...):
- First of its kind, fully customizable recipe and batch oriented whiskey production system, allowing for unparalleled customization and routing of distillate production on our already state-of-the-art distillery. This allows us to be able to run __47 unique distillate recipes, and handle blending, barreling, and bulk distillate operations, all in one unified system. Recently this has been updated to provide full traceability to ensure compliance with FSSC ISO policy. 
- Another first of its kind, distillery rickhouse management system (RMS) with full a offline Android application. This application not only services the needs of our finance, sales, and quality teams, but was built in strong collaboration with the warehouse operaitons team - keeping their needs front and center. Per our last audit, this has reduced our rate of inventory data issues down to 0.1%.
- Tightly couple ERP integration, leveraging NetSuite's RESTlets in a bi-directional syncing engine.
- An agentic Rockwell PLC development lifecycle, allowing for unit testing, simulated FAT testing, ladder logic and FBD rendering in Github, including CI pipelines to test. 
- A handful of Ignition open source development tools that we apply internally..
  - Ignition-git-module
  - Ignition-cli
  - Ignition-mcp
  - Ignition-ide-tools - Neovim ❤️
  - Ignition-lint
- A fully CI/CD handled simulated staging environment, with fully connected staging environments and simulation for nearly all of our systems
- Our first Customer Portal... where I learned more than I ever could have imagined - especially on overestimating with AI
- A beautiful v2 of the Customer Portal, with tons of data at our customers fingertips and a fully rendered 3D barrel rickhouse - COMING SOON 🍾
- A custom media center to control all display TVs and edge NUCs driving various control rooms and displays around the facility.
- Our own linear-backed support portal to manage feature requests, provide end-user and stakeholder awareness of our team activities, and allow for agetic context around feature requests, like code intelligence and backlog capacity
- A soon-to-be open sourced `QuestDB` backed historian, with an ignition module, and the ability to process over 500k tags/s. Now with a CLI and TUI. Actively building a DataOps engine, and a ML training and deployment module to hook into
- A digital twin knowledge graph with MQTT, OPC integration, with P&ID machine vision model trained on ingestion. Still in development but progressing nicely
- `forge-sdk` - an sdk to hook into our many apps and provide a unified data hub source. Including a FACTs testing framework for test integrity. 
- A network topology and monitoring application
- A GRC and framework to reach compliance for ISO 27001 and 42001 next year
- An agnetic project management OS, because I don't have time to properly wear the project manager hat..
- ... and more I'm sure i'm forgetting 🤷🏼‍♂️

I love Whiskey House - the people and the mission. We have an amazing leadership group backing us and placing their trust in us. Like any startup, its been intense and has had plenty of ups and downs. But I've grown more than I could have imagined and wouldn't trade a moment. 

I've allowed myself to probably be more heads down than I should have - but I'm coming up for air and will do my best to keep this up. 

Oh and since then I've became a father, because why not join a start up in the final 5 months of your first pregnancy and have the plant commissioning happen with a two month old? I only know the hard way. 

To my own suprise, not a word of this was AI. I'm sure my writing and grammar isn't the best but hey - that's not what I get paid for. 

Cheers 🥃,

Patrick