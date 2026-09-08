// Edit sections in display order; keep IDs stable and paragraphs and lists plain text.
// Samples are demonstration content, not publication history or personal experience.
export const articles = [
  {
    slug: 'the-factory-floor-is-not-a-staging-environment',
    title: 'The factory floor is not a staging environment',
    description: 'Set clear test boundaries, simulate failures, and review industrial software changes before live use.',
    date: '2026-09-07',
    category: 'Industrial software',
    tags: ['Testing', 'Change control', 'Reliability'],
    readingMinutes: 3,
    featured: true,
    sample: true,
    sections: [
      {
        id: 'define-the-test-boundary',
        title: 'Define the test boundary',
        paragraphs: [
          'An industrial application can influence operations without sending a machine command. A stale production count, a delayed notification, or a misleading status display can change a human decision. Start a test plan by naming the decisions the software supports, the systems it touches, and the consequences of incorrect information.',
          'Separate unit tests, interface tests, controlled simulation, and any approved live validation. Each provides different evidence. Passing a parser test says nothing about network isolation; passing a simulated workflow says nothing about the safety of a physical process. Record what each environment can demonstrate and what remains unverified.',
          'Keep development credentials and network paths separate from operational systems. Verify the separation rather than trusting an environment name. A read-only integration still creates load and exposes information, so its access and traffic need review too.',
        ],
      },
      {
        id: 'simulate-the-uncomfortable-cases',
        title: 'Simulate the uncomfortable cases',
        paragraphs: [
          'Build fixtures from synthetic or appropriately approved, sanitized data. Exercise missing fields, duplicated messages, out-of-order events, interrupted connections, and stale timestamps. Include recovery: a consumer that survives disconnection but processes a backlog incorrectly is not ready for release.',
          'Write expected outcomes before running the tests. For a stale measurement, the expected result might be an explicit unavailable state rather than a plausible-looking number. Check that logs explain the condition without exposing credentials or sensitive operational details. Use a planning record like this to make the boundary visible; these labels do not enforce isolation.',
        ],
        code: {
          language: 'json',
          text: '{\n  "testBoundary": "isolated simulation",\n  "dataSource": "synthetic fixtures",\n  "liveSystemAccess": false,\n  "equipmentCommands": false\n}',
        },
      },
      {
        id: 'make-review-a-release-input',
        title: 'Make review a release input',
        paragraphs: [
          'Treat the change description as part of the release, not paperwork added afterward. Explain the affected interfaces, changed assumptions, validation evidence, unresolved risks, and recovery approach. Include the people responsible for operations, software ownership, and applicable safety review before deciding whether live validation is appropriate.',
          'A software approval is not a substitute for site safety procedures or qualified engineering assessment. Changes involving control behavior, interlocks, or protective functions belong within the established safety and change-management process. Keep ordinary application testing outside that boundary.',
          'Agree on a validation window, an accountable observer, and stop conditions. A deployment should not depend on someone noticing trouble by chance. The release decision should acknowledge simulation limits rather than presenting simulated success as proof of safe physical behavior.',
        ],
      },
      {
        id: 'verify-recovery-not-just-startup',
        title: 'Verify recovery, not just startup',
        paragraphs: [
          'Define reliability in terms users can recognize: information freshness, delivery completeness, visible failure states, and time to restore service. A running process is only one signal. Compare expected and observed records, and make gaps distinguishable from legitimate periods of inactivity.',
          'Rehearse application recovery in the isolated environment, including configuration restoration and handling of partially processed data. Do not assume reverting application code reverses database changes or messages already delivered. Document where recovery requires reconciliation or an explicitly reviewed forward fix.',
          'After an approved release, inspect the agreed signals and ask the responsible operators whether the information remains understandable. Close the change with evidence and remaining limitations. Production can confirm carefully scoped assumptions; it should not become the place where basic failure behavior is first discovered.',
        ],
      },
    ],
  },
  {
    slug: 'boring-software-is-a-feature',
    title: 'Boring software is a feature',
    description: 'Choose predictable defaults and make failure, recovery, and maintenance part of the design.',
    date: '2026-09-07',
    category: 'Development',
    tags: ['Architecture', 'Reliability', 'Maintenance'],
    readingMinutes: 3,
    featured: false,
    sample: true,
    sections: [
      {
        id: 'start-with-the-operating-contract',
        title: 'Start with the operating contract',
        paragraphs: [
          'Boring software is software whose behavior is easy to predict and explain. That does not require old technology or an absence of ambition. It requires choosing complexity for a demonstrated need instead of treating complexity as evidence that a design is sophisticated.',
          'Before choosing an architecture, write a small operating contract. Who depends on the service? How fresh must its data be? What should happen when a dependency is unavailable? What data would be difficult to reconstruct? These answers give design discussions something more useful than competing preferences.',
          'Select the simplest design that meets those constraints and can be supported by the team. A single service may be appropriate; multiple services may have a concrete isolation or ownership benefit. Record the reason for the choice and the evidence that would justify revisiting it.',
        ],
      },
      {
        id: 'make-failure-behavior-explicit',
        title: 'Make failure behavior explicit',
        paragraphs: [
          'A dependency failure should lead to a deliberate outcome. Set bounded timeouts, limit concurrent work, and decide which operations are safe to retry. Retrying every error can amplify an outage or repeat a side effect. A retry policy needs an understanding of the operation, not just a timer.',
          'For operations that change state, define how repeated requests are recognized and how ambiguous outcomes are reconciled. A client timeout does not prove the server did nothing. If an idempotency key is used, specify its scope, retention period, and treatment of a reused key with different input.',
          'Make degraded behavior visible. Serving cached information can be useful when its age is displayed and the use case permits it. Silently substituting old data for current data turns an availability decision into a correctness problem.',
        ],
      },
      {
        id: 'test-at-the-boundaries',
        title: 'Test at the boundaries',
        paragraphs: [
          'Use focused unit tests for deterministic rules and interface tests for assumptions shared with other components. Reserve broader workflow tests for paths where the integration itself matters. A large test count is less informative than knowing which consequential assumptions are checked.',
          'Introduce failures through controlled simulation or isolated test doubles, not by disrupting a live dependency. Test slow responses, unavailable services, repeated requests, invalid input, and restart recovery. Check the user-visible result as well as the internal error. A technically accurate log message cannot compensate for a misleading success screen.',
          'Keep fixtures readable and representative of documented edge cases. When a defect is fixed, add a test at the narrowest boundary that would have exposed it. Document anything the test deliberately substitutes, especially persistence, authentication, and external delivery.',
        ],
      },
      {
        id: 'design-for-the-next-maintainer',
        title: 'Design for the next maintainer',
        paragraphs: [
          'Provide a short path from an alert to a useful diagnosis. Name the service owner, identify the signals that matter, and explain where to find recent changes. Logs should connect related work without copying secrets or unnecessary personal data into a new storage system.',
          'Before release, have a human reviewer examine migration behavior, configuration changes, and recovery limits alongside the code. Rehearse restoration using test data. A backup that has never been restored is an unverified recovery mechanism, and a rollback button cannot undo every external effect.',
          'Review complexity periodically. Remove unused options, retire duplicate paths, and document the few surprising decisions that remain. Predictability is not the absence of change. It is the ability to make a change, explain its boundaries, and recover when an assumption turns out to be wrong.',
        ],
      },
    ],
  },
  {
    slug: 'your-best-engineer-should-not-be-a-single-point-of-failure',
    title: 'Your best engineer should not be a single point of failure',
    description: 'Reduce knowledge bottlenecks with shared practice, usable runbooks, and clear decision ownership.',
    date: '2026-09-07',
    category: 'Leadership',
    tags: ['Team design', 'Knowledge sharing', 'Operations'],
    readingMinutes: 3,
    featured: false,
    sample: true,
    sections: [
      {
        id: 'map-dependencies-not-heroes',
        title: 'Map dependencies, not heroes',
        paragraphs: [
          'When every difficult question goes to one engineer, the immediate result may look efficient. The longer-term question is whether the team can make sound decisions when that person is unavailable. Treat concentrated knowledge as a system dependency, not as a personal failing or a reason to undervalue expertise.',
          'List the activities that currently need a particular person: diagnosing a recurring incident, approving an interface change, restoring a service, or explaining an undocumented business rule. Distinguish rare specialist judgment from routine work that has simply never been taught. They require different responses.',
          'Ask the specialist where interruptions are most costly and where mistakes would have the largest consequences. Prioritize a small number of high-value transfers. Trying to document everything at once can create a second workload without reducing the dependency that matters.',
        ],
      },
      {
        id: 'transfer-decisions-through-practice',
        title: 'Transfer decisions through practice',
        paragraphs: [
          'Pair on a real, bounded task, but make the learner drive the investigation. The experienced engineer should explain how evidence changes the next step: which signal rules out a hypothesis, which assumption needs checking, and when to stop and escalate. A recording of commands alone misses that reasoning.',
          'Use a controlled simulation for incident practice. Supply synthetic symptoms and an isolated environment, then ask the learner to identify the likely fault and propose a recovery plan. Do not create a live outage to manufacture a learning opportunity.',
          'Reverse the roles on a second exercise. The learner explains the diagnosis while the specialist observes. Success means demonstrating the agreed task and recognizing its limits, not memorizing a sequence or becoming an instant replacement for years of domain knowledge.',
        ],
      },
      {
        id: 'write-runbooks-with-stop-conditions',
        title: 'Write runbooks with stop conditions',
        paragraphs: [
          'A useful runbook starts with a recognizable symptom and ends with a way to verify the outcome. Include prerequisites, required permissions, read-only diagnostic checks, escalation contacts, and conditions that make the procedure inappropriate. Link to the authoritative source instead of copying credentials or sensitive data.',
          'Have someone other than the author follow the diagnostic path in a test environment. Note where they need unstated context, where names no longer match, and where a result could be misinterpreted. Those moments are concrete editing tasks, not evidence that the reader should have known better.',
          'Shared knowledge does not mean shared unrestricted access. Preserve approval boundaries and least-privilege permissions. For industrial or safety-related systems, training material must not authorize control changes or bypass qualified human review. Knowing when not to act is part of operational competence.',
        ],
      },
      {
        id: 'give-shared-ownership-room-to-work',
        title: 'Give shared ownership room to work',
        paragraphs: [
          'Assign a primary owner and a practiced backup for important services, with explicit decision and escalation responsibilities. Protect time for pairing, runbook maintenance, and exercises. Adding these expectations without changing delivery commitments can reward the same emergency heroics the team is trying to reduce.',
          'Look for evidence of resilience rather than counting documents. Can a second person explain a recent design decision? Can they diagnose a simulated failure and identify the required approver? Can the primary owner take planned time away without remaining an unofficial support channel?',
          'Keep deep expertise valuable. Specialists should still handle work that needs their judgment, while routine questions become easier for others to answer. The goal is not interchangeable people. It is a team that can continue useful, safe work without requiring any one person to be constantly available.',
        ],
      },
    ],
  },
  {
    slug: 'an-ai-demo-is-not-a-production-system',
    title: 'An AI demo is not a production system',
    description: 'Define a bounded AI task, evaluate meaningful failures, and keep consequential actions under human review.',
    date: '2026-09-07',
    category: 'AI & ML',
    tags: ['Evaluation', 'AI safety', 'Reliability'],
    readingMinutes: 3,
    featured: false,
    sample: true,
    sections: [
      {
        id: 'define-the-job-and-the-limit',
        title: 'Define the job and the limit',
        paragraphs: [
          'A convincing demonstration establishes that a system can produce a useful result for a particular input. It does not establish how often the system fails, what those failures cost, or whether anyone will notice them. Production readiness begins with a bounded task and an explicit definition of unacceptable behavior.',
          'Choose a narrow responsibility such as drafting a summary from an approved document set. State what the system must not do: invent missing facts, treat retrieved instructions as authority, disclose restricted information, or take consequential actions on its own. Define an abstention path when the evidence is insufficient.',
          'Separate output quality from authorization. A plausible answer is not permission to update a record, contact someone, or affect equipment. Keep any action pathway outside the model response and enforce permissions in the surrounding application.',
        ],
      },
      {
        id: 'evaluate-failures-that-matter',
        title: 'Evaluate failures that matter',
        paragraphs: [
          'Build an evaluation set that reflects the intended task, including incomplete inputs, contradictory sources, unsupported questions, and malicious instructions embedded in retrieved text. Use synthetic or appropriately approved data, and protect evaluation material that contains sensitive information. Preserve a held-out set rather than tuning repeatedly to every example.',
          'Score dimensions separately: factual support, completeness, appropriate abstention, access control, latency, and cost. An average quality score can conceal a small number of unacceptable disclosures or unauthorized actions. Define release criteria with the people accountable for those consequences.',
          'Use human review to calibrate automated scoring, particularly for ambiguous cases. Model-based judges can help organize evaluation, but their judgments also need checking. Record the model, prompt, retrieval configuration, and application version so comparisons have a meaningful reference point.',
        ],
      },
      {
        id: 'contain-the-runtime',
        title: 'Contain the runtime',
        paragraphs: [
          'Treat retrieved content and model output as untrusted input. Validate structured responses against the expected schema, constrain input and output sizes, and bound execution time and retries. Schema validity only establishes structure; it does not establish truth, relevance, or permission.',
          'Start with an isolated evaluation environment and no external side effects. A conceptual review record might look like the example below. It is not a security configuration: the application must actually enforce access restrictions and prevent tool execution. Where sensitive or safety-related decisions are involved, use qualified human review and the established change process.',
        ],
        code: {
          language: 'json',
          text: '{\n  "purpose": "draft summary for review",\n  "environment": "isolated evaluation",\n  "externalActions": false,\n  "humanApprovalRequired": true\n}',
        },
      },
      {
        id: 'operate-with-a-fallback',
        title: 'Operate with a fallback',
        paragraphs: [
          'Decide what users see when the model is unavailable, a response fails validation, or the source material is insufficient. A clear failure message and access to the underlying documents may be more useful than repeated attempts to produce an answer. Never silently turn an abstention into a guessed result.',
          'Monitor task-level outcomes alongside service health. Track validation failures, user corrections, abstentions, latency, and spending without indiscriminately retaining prompts or sensitive source text. Set a deliberate retention policy and make access to diagnostic records appropriately restricted.',
          'Reevaluate changes to models, prompts, retrieval, and permissions before release. A successful previous version does not certify a new combination. Maintain a way to disable the AI feature while preserving a usable manual workflow. Reliability includes making failure understandable and keeping the rest of the product useful when the model cannot help.',
        ],
      },
    ],
  },
  {
    slug: 'the-last-mile-between-ot-and-it',
    title: 'The last mile between OT and IT',
    description: 'Make industrial data interfaces explicit about meaning, time, quality, ownership, and recovery.',
    date: '2026-09-07',
    category: 'Industrial software',
    tags: ['OT and IT', 'Data contracts', 'Integration'],
    readingMinutes: 3,
    featured: false,
    sample: true,
    sections: [
      {
        id: 'agree-on-meaning-before-transport',
        title: 'Agree on meaning before transport',
        paragraphs: [
          'Moving a value between operational technology and an information system is only part of an integration. The receiving system also needs to know what the value means, when it was observed, whether it is trustworthy, and who can resolve a disagreement. A successful connection does not answer those questions.',
          'Write a data contract with both producers and consumers. Define names, units, allowed states, missing-value behavior, and the distinction between an observation and a derived result. Ask concrete questions: does a count reset, does a total include rejected items, and does unavailable mean disconnected or simply not measured?',
          'Use a small synthetic example to expose assumptions before discussing transport choices. If two teams interpret the same record differently, changing the protocol will not repair the disagreement. Resolve the meaning and assign an owner for future contract changes.',
        ],
      },
      {
        id: 'preserve-time-and-quality',
        title: 'Preserve time and quality',
        paragraphs: [
          'Distinguish observation time from ingestion time. A value received now may describe an earlier state, especially after a connection recovers. Document timestamp format, clock assumptions, and ordering behavior. If trustworthy observation time is unavailable, represent that limitation instead of substituting an ingestion timestamp without explanation.',
          'Carry quality explicitly. Missing, stale, invalid, and valid are different conditions, and zero may be a perfectly legitimate measurement. The synthetic record below illustrates an unavailable observation. It is a discussion fixture, not a device configuration or an instruction to connect to equipment.',
          'Define freshness rules per use case. A historical report and a current-status display may tolerate different delays. Consumers should surface the relevant quality and age rather than requiring users to infer them from a number.',
        ],
        code: {
          language: 'json',
          text: '{\n  "metric": "example_count",\n  "value": null,\n  "unit": "items",\n  "observedAt": null,\n  "quality": "unavailable",\n  "schemaVersion": 1\n}',
        },
      },
      {
        id: 'design-for-disconnection',
        title: 'Design for disconnection',
        paragraphs: [
          'Specify what happens when either side is unavailable. Buffering needs a capacity limit, a retention policy, and a visible outcome when that limit is reached. Backpressure should protect systems rather than allowing an integration to consume resources without a bound.',
          'Assume messages can be delayed, repeated, or delivered out of order unless the complete delivery path provides stronger guarantees. Define event identity and duplicate handling. Acknowledging receipt is not always equivalent to committing a business result, so document where responsibility transfers.',
          'Test backlog recovery in controlled simulation. Verify how current information is distinguished from replayed history and how gaps are reported. For records that affect accounting or traceability, agree on reconciliation rules with the responsible owners. Do not promise exactly-once business outcomes solely because one transport offers a delivery guarantee.',
        ],
      },
      {
        id: 'keep-ownership-and-safety-visible',
        title: 'Keep ownership and safety visible',
        paragraphs: [
          'Start with the minimum approved data access and preserve the boundary between observation and control. Read-only access can still create network load or expose sensitive information. Have network, operational, application, and applicable safety owners review the proposed access pattern and its failure behavior.',
          'Run contract and load tests against isolated fixtures or approved simulators. Live validation, if appropriate, needs an agreed scope, monitoring, stop conditions, and human change approval. Application integration work should not modify protective functions or substitute for qualified assessment of equipment behavior.',
          'Give each interface a named owner, a supported contract version, and a retirement process. Monitor freshness, rejected records, backlog age, and reconciliation status. The useful endpoint is not merely connected systems. It is information that consumers can interpret correctly, with a clear route to recovery when the connection or its assumptions fail.',
        ],
      },
    ],
  },
];
