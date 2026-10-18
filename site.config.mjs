// Profile URLs stay blank until confirmed; only configured profiles appear on the site.
// Enable membership only when its destination URL is configured.
export const site = {
  name: 'FIELDNOTES',
  author: 'Patrick Mannion',
  bio: {
    short: 'I build connected production, warehouse, and customer software at Whiskey House, and open-source tools for Ignition. This is where I share the work and the notes behind it.',
    paragraphs: [
      'At Whiskey House, I build connections between MES, warehouse operations, customer access, and industrial data. Configurable recipes, API and event integrations, and typed plant models let that work adapt to different workflows. I also build Ignition tools for gateway access, editing, linting, and version control.',
      'The questions behind this notebook are practical: how do you tell whether production data is fresh? What happens when an integration drops a message? Can someone else diagnose a failure while the usual expert is away?',
      'You’ll find notes on those questions, alongside experiments with AI and the decisions involved in running a technical team. I want each piece to explain a specific problem, the options, and what still needs testing.',
    ],
  },
  description: 'Patrick Mannion’s notebook on industrial software, reliable integrations, AI experiments, and leading technical teams.',
  email: 'patrick@cruciblesoftware.co',
  siteUrl: 'https://patrickmannion.dev/',
  github: { username: 'TheThoughtagen', repositories: [] },
  ignitionTools: [
    {
      name: 'Ignition Dev Tools',
      description: 'IDE support for Ignition across VS Code, Neovim, and Zed, with completions, navigation, embedded-script editing, and diagnostics.',
      documentationUrl: 'https://thethoughtagen.github.io/ignition-ide-plugins/',
      repositoryUrl: 'https://github.com/TheThoughtagen/ignition-ide-plugins',
    },
    {
      name: 'ignition-lint',
      description: 'A linting toolkit for Ignition projects that catches Perspective schema, expression, naming, and Jython issues before runtime.',
      documentationUrl: 'https://thethoughtagen.github.io/ignition-lint/',
      repositoryUrl: 'https://github.com/TheThoughtagen/ignition-lint',
    },
    {
      name: 'Ignition CLI',
      description: 'A scriptable command-line interface for inspecting and operating Ignition 8.3+ gateways, projects, tags, and local rigs.',
      documentationUrl: 'https://thethoughtagen.github.io/ignition-cli/',
      repositoryUrl: 'https://github.com/TheThoughtagen/ignition-cli',
    },
    {
      name: 'ignition-mcp',
      description: 'An MCP server that gives AI assistants a curated interface to Ignition Gateway REST APIs for projects, resources, tags, alarms, and more.',
      documentationUrl: 'https://whiskeyhouse.github.io/ignition-mcp/',
      repositoryUrl: 'https://github.com/WhiskeyHouse/ignition-mcp',
    },
    {
      name: 'Ignition Git Module',
      description: 'An Ignition Designer module with embedded Git workflows for commits, branches, merges, stashes, synchronization, and gateway configuration.',
      documentationUrl: 'https://whiskeyhouse.github.io/ignition-git-module/',
      repositoryUrl: 'https://github.com/WhiskeyHouse/ignition-git-module',
    },
  ],
  links: { linkedin: 'https://www.linkedin.com/in/mannionpatrick/', x: 'https://x.com/__pattym__', substack: '', patreon: '', booking: 'https://cal.com/patrick-mannion-rebycs', subscribe: '' },
  // Use a Buttondown username for the inline form, or links.subscribe for any provider.
  newsletter: { buttondownUsername: '' },
  membership: { enabled: false, url: '' },
};
