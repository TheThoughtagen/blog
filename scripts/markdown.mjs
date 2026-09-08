// Article fields are plain text; escape Markdown syntax outside code blocks.
const plain = value => String(value).replace(/[\\`*_[\]<>]/g, '\\$&').replace(/^(\s*)(#{1,6}|>|[-+]|\d+\.) /gm, '$1\\$2 ');
export function renderMarkdown(site, article) {
  const path = `/notes/${article.slug}/`;
  const source = site.siteUrl ? new URL(path, site.siteUrl).href : path;
  const blocks = [
    `# ${plain(article.title)}`,
    plain(article.description),
    `${article.sample ? 'FIELDNOTES sample' : `By ${plain(site.author)}`} · ${article.date} · ${plain(article.category)} · ${article.readingMinutes} min read`,
    `Source: ${source}`,
  ];
  if (article.sample) blocks.push('> Sample note: demonstration content, not a published article by the site owner.');
  for (const section of article.sections) {
    blocks.push(`## ${plain(section.title)}`, ...section.paragraphs.map(plain));
    if (section.code) {
      const length = Math.max(3, ...[...section.code.text.matchAll(/`+/g)].map(match => match[0].length + 1));
      const fence = '`'.repeat(length);
      const language = String(section.code.language || '').replace(/[^\w+-]/g, '');
      blocks.push(`${fence}${language}\n${section.code.text}\n${fence}`);
    }
    if (section.list) blocks.push(section.list.map(item => `- ${plain(item).replace(/\n/g, '\n  ')}`).join('\n'));
    if (section.quote) blocks.push(plain(section.quote).split('\n').map(line => `> ${line}`).join('\n'));
  }
  if (article.tags.length) blocks.push(`Tags: ${article.tags.map(plain).join(', ')}`);
  return blocks.join('\n\n') + '\n';
}
