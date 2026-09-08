// Profile URLs stay blank until confirmed; only configured profiles appear on the site.
// Enable membership only when its destination URL is configured.
export const site = {
  name: 'FIELDNOTES',
  author: 'Patrick Mannion',
  bio: {
    short: 'This is my notebook on industrial software, software development, and leading technical teams.',
    paragraphs: [
      'I’m Patrick Mannion. FIELDNOTES is where I’m putting longer notes about software, factory systems, and the people who build and maintain them.',
      'The questions behind this notebook are practical: how do you tell whether production data is fresh? What happens when an integration drops a message? Can someone else diagnose a failure while the usual expert is away?',
      'You’ll find notes on those questions, alongside experiments with AI and the decisions involved in running a technical team. I want each piece to explain a specific problem, the options, and what still needs testing.',
    ],
  },
  description: 'Patrick Mannion’s notebook on industrial software, reliable integrations, AI experiments, and leading technical teams.',
  siteUrl: 'https://awake-iris-z6ww.here.now/',
  github: { username: 'TheThoughtagen', repositories: [] },
  links: { linkedin: 'https://www.linkedin.com/in/mannionpatrick/', x: 'https://x.com/__pattym__', substack: '', patreon: '', booking: '', subscribe: '' },
  // Use a Buttondown username for the inline form, or links.subscribe for any provider.
  newsletter: { buttondownUsername: '' },
  membership: { enabled: false, url: '' },
};
