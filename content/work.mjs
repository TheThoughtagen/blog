// Curated portfolio copy. Keep private repository links, customer data, and
// operational metrics out of this public module. Dates describe this review,
// not the release date or production status of a project.
export const portfolio = {
  reviewed: '2026-10-18',
  whiskeyHouse: [
    {
      id: 'production', number: '01', area: 'PRODUCTION SYSTEMS',
      title: 'Follow a batch from recipe to lot.',
      name: 'Manufacturing execution',
      description: 'Recipes, production orders, scheduling, and lot traceability for whiskey production.',
      problem: 'A production order has to retain its recipe, input lots, equipment, and output history as work moves between systems.',
      approach: 'I work on recipe management, production scheduling, quality records, and ERP handoffs. The batch record ties those steps to the materials and equipment used in the run.',
      focus: 'Batch and lot identifiers that carry through production records and ERP handoffs.',
      tags: ['TypeScript', 'NestJS', 'GraphQL', 'Prisma', 'MQTT'],
    },
    {
      id: 'warehouse', number: '02', area: 'WAREHOUSE OPERATIONS',
      title: 'Track a barrel through the warehouse.',
      name: 'Warehouse management',
      description: 'Barrel inventory, warehouse locations, scanning workflows, and movement history.',
      problem: 'The inventory record needs to show where a barrel is now and the movements that put it there.',
      approach: 'Scan a barrel, record a move, and find its warehouse location. The web application and scanning workflows share the barrel’s inventory and event history.',
      focus: 'A barrel identifier that links its physical movements to its recorded history.',
      tags: ['Next.js', 'NestJS', 'PostgreSQL', 'GraphQL', 'Android'],
      demo: 'https://whk-wms-demo.vercel.app/dashboard', demoLabel: 'Open warehouse demo',
      access: 'Whiskey House sign-in required.',
    },
    {
      id: 'forge', number: '03', area: 'INDUSTRIAL KNOWLEDGE GRAPH',
      title: 'Find the equipment behind a reading.',
      name: 'Forge Cortex workbench',
      description: 'An industrial knowledge graph workbench with equipment exploration, model authoring, and agent-assisted changes.',
      problem: 'Historian tags, drawings, and process records need links to the equipment they describe.',
      approach: 'Forge Cortex lets us browse equipment, inspect linked records, and edit the plant model in versioned sessions. The walkthroughs show queries, type libraries, and agent-drafted changes.',
      focus: 'Validate model changes and review their evidence before accepting them.',
      tags: ['Go', 'Neo4j', 'Next.js', 'Knowledge graphs', 'AI agents'],
      demo: '#forge-walkthroughs', demoLabel: 'Watch the workbench in use',
    },
  ],
  openSource: [
    {
      id: 'ignition-cli', title: 'Ignition CLI', label: 'GATEWAY OPERATIONS',
      description: 'Inspect gateway health, read tags, and manage projects from the command line or terminal UI. Agents can use the same commands through MCP.',
      tags: ['Rust', 'CLI', 'MCP'],
      source: 'https://github.com/TheThoughtagen/ignition-cli',
      docs: 'https://thethoughtagen.github.io/ignition-cli/',
      recording: 'https://thethoughtagen.github.io/ignition-cli/docs/demos/',
    },
    {
      id: 'ignition-mcp', title: 'Ignition MCP', label: 'WHISKEY HOUSE / OPEN SOURCE',
      description: 'Give an AI client tools to inspect Ignition tags, diagnose a gateway, and work through project promotion using the CLI.',
      tags: ['Python', 'MCP', 'Ignition'],
      source: 'https://github.com/WhiskeyHouse/ignition-mcp',
      docs: 'https://whiskeyhouse.github.io/ignition-mcp/',
      recording: 'https://whiskeyhouse.github.io/ignition-mcp/docs/demos/',
    },
    {
      id: 'agentic-ignition-stack', title: 'Agentic Ignition Stack', label: 'DEVELOPMENT ENVIRONMENT',
      description: 'Start an Ignition development environment with Docker Compose, keep its configuration in Git, and run gateway and browser checks.',
      tags: ['Docker', 'Git', 'Playwright'],
      source: 'https://github.com/TheThoughtagen/agentic-ignition-stack',
    },
    {
      id: 'ignition-dev-tools', title: 'Ignition Dev Tools', label: 'EDITOR WORKFLOWS',
      description: 'Edit Ignition scripts and project resources in VS Code, Neovim, or Zed, with API documentation, completion, and resource navigation.',
      tags: ['VS Code', 'Neovim', 'Zed'],
      source: 'https://github.com/TheThoughtagen/ignition-ide-plugins',
      docs: 'https://thethoughtagen.github.io/ignition-ide-plugins/',
      recording: 'https://thethoughtagen.github.io/ignition-ide-plugins/docs/demos/',
    },
    {
      id: 'ignition-lint', title: 'ignition-lint', label: 'CHECKS BEFORE DEPLOYMENT',
      description: 'Check Jython scripts and Perspective resources locally or in CI, and review the findings before changing a gateway.',
      tags: ['Python', 'Jython', 'CI'],
      source: 'https://github.com/TheThoughtagen/ignition-lint',
      docs: 'https://thethoughtagen.github.io/ignition-lint/',
    },
    {
      id: 'ignition-git-module', title: 'Ignition Git Module', label: 'WHISKEY HOUSE / OPEN SOURCE',
      description: 'Git integration inside Ignition. My work continues the upstream module with Whiskey House development and documentation.',
      tags: ['Java', 'Git', 'Ignition'],
      source: 'https://github.com/WhiskeyHouse/ignition-git-module',
      docs: 'https://whiskeyhouse.github.io/ignition-git-module/',
      credit: 'Continues the upstream work by AXONE-IO.',
    },
  ],
};

// Existing recordings of the actual tools, copied unchanged from their
// published demo assets. They run against an isolated demonstration gateway.
export const demos = [
  {
    id: 'cli-session', clip: 'cli', title: 'Ignition CLI',
    description: 'Inspect a running gateway, discover its projects, browse batch tags, and read process values from the terminal.',
    url: 'https://thethoughtagen.github.io/ignition-cli/docs/demos/',
    cast: '/assets/recordings/cli.cast', tags: ['Rust', 'CLI', 'Ignition'],
  },
  {
    id: 'tui-session', clip: 'tui', title: 'Ignition CLI TUI',
      description: 'Check gateway health, browse tags, inspect a reading, and discover projects in the terminal UI.',
    url: 'https://thethoughtagen.github.io/ignition-cli/docs/demos/#ignition-cli-tui',
    cast: '/assets/recordings/tui.cast', tags: ['Rust', 'TUI', 'Ignition'],
  },
  {
    id: 'mcp-session', clip: 'pi', title: 'Ignition MCP + Agent',
    description: 'An agent checks gateway health, browses tags, reads batch conditions, and follows traceability records through MCP.',
    url: 'https://whiskeyhouse.github.io/ignition-mcp/docs/demos/',
    cast: '/assets/recordings/pi.cast', tags: ['MCP', 'AI agents', 'Whiskey House'],
  },
  {
    id: 'neovim-session', clip: 'nvim', title: 'Ignition Neovim',
    description: 'Look up an Ignition API, complete and edit a script, then navigate from a Perspective component to its JSON source in Neovim.',
    url: 'https://thethoughtagen.github.io/ignition-ide-plugins/docs/demos/',
    cast: '/assets/recordings/nvim.cast', tags: ['Neovim', 'LSP', 'Ignition'],
  },
];

// Videos from the actual Forge Cortex workbench walkthrough suite.
export const workbenchVideos = [
  { id: 'forge-explorer', title: 'Equipment explorer', file: 'workbench-explorer', poster: 'forge-explorer', description: 'Search equipment, inspect its properties and relationships, explore its graph neighbourhood, and build a model query.' },
  { id: 'forge-authoring', title: 'Model authoring', file: 'workbench-authoring', poster: 'forge-authoring', description: 'Open an authoring session, edit an equipment model, validate the changes, and prepare them for review.' },
  { id: 'forge-design', title: 'Library & domain design', file: 'workbench-design', poster: 'forge-design', description: 'Work with type libraries, imported models, domains, and the rules that govern model changes.' },
  { id: 'forge-agents', title: 'Agents in the workbench', file: 'workbench-agents', poster: 'forge-agents', description: 'Ask an agent to draft equipment and relationship changes in its own session, with evidence and validation visible for review.' },
];

export const portalFilm = {
  id: 'customer-portal', title: 'Customer portal launch film',
  description: 'Production insight, inventory, barrel traceability, and a 3D rickhouse in a customer-facing view of the connected plant.',
  file: 'customer-portal', poster: 'customer-portal',
};

export function portfolioSearchEntries() {
  return [
    { title: 'Whiskey House customer portal', description: portalFilm.description, category: 'Whiskey House', tags: ['Customer portal', 'Governance', 'Traceability', '3D'], url: '/work/#customer-portal' },
    { title: 'Forge Cortex graph / Whiskey House', description: 'Explore randomized MES, CMMS, electrical wiring, and process flow through shared equipment.', category: 'Whiskey House', tags: ['Graph', 'Forge Cortex', 'MES', 'CMMS', 'Electrical', 'Process flow'], url: '/work/#cortex-graph' },
    { title: 'Forge Cortex Plant 3D / live and historical readings', description: 'Explore the native Cortex 3D viewer with schematic equipment, generated telemetry, and 24-hour historical playback linked to the graph.', category: 'Interactive demo', tags: ['3D', 'Forge Cortex', 'Historian', 'Telemetry', 'Digital twin'], url: '/work/#plant3d' },
    ...portfolio.whiskeyHouse.map(project => ({ title: `${project.name} / Whiskey House`, description: project.description, category: 'Whiskey House', tags: project.tags, url: `/work/#${project.id}` })),
    ...portfolio.openSource.map(project => ({ title: project.title, description: project.description, category: 'Open source', tags: project.tags, url: `/work/#${project.id}` })),
    ...demos.map(demo => ({ title: demo.title + ' walkthrough', description: demo.description, tags: demo.tags, category: 'Recorded demo', url: '/work/?demo=' + demo.clip + '#demos' })),
    ...workbenchVideos.map(video => ({ title: 'Forge Cortex / ' + video.title, description: video.description, tags: ['Whiskey House', 'Forge Cortex'], category: 'Recorded demo', url: '/work/#' + video.id })),
  ];
}
