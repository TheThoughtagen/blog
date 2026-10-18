// Curated portfolio copy. Keep private repository links, customer data, and
// operational metrics out of this public module. Dates describe this review,
// not the release date or production status of a project.
export const portfolio = {
  reviewed: '2026-10-18',
  whiskeyHouse: [
    {
      id: 'production', number: '01', area: 'PRODUCTION SYSTEMS',
      title: 'Adapt recipes to the production run.',
      name: 'Manufacturing execution',
      description: 'Configurable recipes and schedules connected to material lots, equipment events, quality records, and ERP handoffs.',
      problem: 'A batch needs a consistent record across its recipe, material consumption, equipment, quality checks, and ERP handoffs.',
      approach: 'The MES links recipes, production orders, schedules, material lots, and quality records. I connect warehouse events to inventory and lot records, equipment events through MQTT, and ERP handoffs through queued messages.',
      focus: 'Per-run recipe instances carry their own parameters and material requirements while retaining their link to the master recipe. Different products and production runs can use the same execution system.',
      tags: ['TypeScript', 'NestJS', 'GraphQL', 'Prisma', 'MQTT'],
    },
    {
      id: 'warehouse', number: '02', area: 'WAREHOUSE OPERATIONS',
      title: 'Keep barrel movements tied to production.',
      name: 'Warehouse management',
      description: 'Barrel identity, lot traceability, warehouse jobs, and inventory shared across scanning workflows and the customer portal.',
      problem: 'Filling, moving, or dumping a barrel changes more than its location. The job, lot, inventory balance, and movement history need to stay connected.',
      approach: 'I connect warehouse jobs, barrel and lot records, scanning workflows, and the web application around the same inventory and event history. Those records also supply the customer portal, with access scoped to the signed-in customer.',
      focus: 'Chained jobs carry work from one warehouse operation into the next. Configurable event rules let other systems receive the changes they need through MQTT.',
      tags: ['Next.js', 'NestJS', 'PostgreSQL', 'GraphQL', 'Android'],
      demo: 'https://whk-wms-demo.vercel.app/dashboard', demoLabel: 'Open warehouse demo',
      access: 'Whiskey House sign-in required.',
    },
    {
      id: 'forge', number: '03', area: 'INDUSTRIAL KNOWLEDGE GRAPH',
      title: 'Extend the plant model across disciplines.',
      name: 'Forge Cortex workbench',
      description: 'A typed plant model connecting equipment, historian context, engineering evidence, and extensible operational domains.',
      problem: 'A tag value, a drawing, and a work order describe different parts of the same equipment. Linking those records lets you move from a reading to its engineering and operational context.',
      approach: 'My work on Forge Cortex connects equipment with historian tags and engineering evidence through graph exploration, 3D views, and agent queries. Model changes go through versioned authoring sessions, validation, and review.',
      focus: 'Typed libraries define MES and maintenance references, electrical wiring, and process connections. We can extend the model while keeping source record identities, drawing evidence, and review requirements explicit.',
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
  { id: 'forge-explorer', title: 'Equipment explorer', file: 'workbench-explorer', poster: 'forge-explorer', description: 'Start with equipment, follow its linked records, inspect properties and relationships, and build a query across the model.' },
  { id: 'forge-authoring', title: 'Model authoring', file: 'workbench-authoring', poster: 'forge-authoring', description: 'Open an authoring session, edit an equipment model, validate the changes, and prepare them for review.' },
  { id: 'forge-design', title: 'Library & domain design', file: 'workbench-design', poster: 'forge-design', description: 'Extend the plant model through type libraries, imported models, and domains with explicit rules for changes.' },
  { id: 'forge-agents', title: 'Agents in the workbench', file: 'workbench-agents', poster: 'forge-agents', description: 'Ask an agent to draft equipment and relationship changes in its own session, with evidence and validation visible for review.' },
];

export const portalFilm = {
  id: 'customer-portal', title: 'Customer portal launch film',
  description: 'Customer-scoped production, inventory, barrel traceability, and a 3D rickhouse, connected to the MES and warehouse systems.',
  file: 'customer-portal', poster: 'customer-portal',
};

export function portfolioSearchEntries() {
  return [
    { title: 'Whiskey House customer portal', description: portalFilm.description, category: 'Whiskey House', tags: ['Customer portal', 'Governance', 'Traceability', '3D'], url: '/work/#customer-portal' },
    { title: 'Forge Cortex graph / Whiskey House', description: 'Follow production, maintenance, electrical, and process references through shared equipment in a randomized plant model.', category: 'Whiskey House', tags: ['Graph', 'Forge Cortex', 'MES', 'CMMS', 'Electrical', 'Process flow'], url: '/work/#cortex-graph' },
    { title: 'Forge Cortex Plant 3D / live and historical readings', description: 'Move between equipment in 3D, mapped readings, 24-hour history, and the connected graph. Fictional scene and generated telemetry.', category: 'Interactive demo', tags: ['3D', 'Forge Cortex', 'Historian', 'Telemetry', 'Digital twin'], url: '/work/#plant3d' },
    ...portfolio.whiskeyHouse.map(project => ({ title: `${project.name} / Whiskey House`, description: project.description, category: 'Whiskey House', tags: project.tags, url: `/work/#${project.id}` })),
    ...portfolio.openSource.map(project => ({ title: project.title, description: project.description, category: 'Open source', tags: project.tags, url: `/work/#${project.id}` })),
    ...demos.map(demo => ({ title: demo.title + ' walkthrough', description: demo.description, tags: demo.tags, category: 'Recorded demo', url: '/work/?demo=' + demo.clip + '#demos' })),
    ...workbenchVideos.map(video => ({ title: 'Forge Cortex / ' + video.title, description: video.description, tags: ['Whiskey House', 'Forge Cortex'], category: 'Recorded demo', url: '/work/#' + video.id })),
  ];
}
