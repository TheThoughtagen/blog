import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import {
  extractFrontmatter,
  renderDocument,
} from '@cruciblesoftware/fieldnotes-renderer';

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PUBLICATION_WARNING_CODES = new Set([
  'heading.duplicate-id',
  'image.remote-disabled',
]);

export async function loadPosts({ contentDir, schemaPath }) {
  const entries = await readContentDirectory(contentDir);
  if (entries.length === 0) return [];

  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  // The renderer's AJV instance is process-global. Avoid registering the same
  // informational schema identifier again when loadPosts is called repeatedly.
  delete schema.$id;
  const posts = [];
  const canonicalContentDirectory = await realpath(contentDir);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const postDirectory = resolve(contentDir, entry.name);
    const sourcePath = resolve(postDirectory, 'index.md');
    let source;
    try {
      const [postDetails, canonicalPostDirectory] = await Promise.all([
        lstat(postDirectory),
        realpath(postDirectory),
      ]);
      if (!postDetails.isDirectory() || !isWithin(canonicalContentDirectory, canonicalPostDirectory)) {
        throw new Error(`${entry.name} source failed: post directory escapes the content directory.`);
      }

      const [sourceDetails, canonicalSourcePath] = await Promise.all([
        lstat(sourcePath),
        realpath(sourcePath),
      ]);
      if (!sourceDetails.isFile() || !isWithin(canonicalPostDirectory, canonicalSourcePath)) {
        throw new Error(`${entry.name} source failed: index.md must be a regular file within the post directory.`);
      }
      source = await readFile(sourcePath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }

    const slug = entry.name;
    if (!SAFE_SLUG.test(slug)) {
      throw new Error(`Unsafe post slug: ${slug}`);
    }

    const extracted = extractFrontmatter(source);
    if (hasErrors(extracted.diagnostics)) {
      throw new Error(formatDiagnostics(slug, 'frontmatter', extracted.diagnostics));
    }

    const draft = extracted.data.draft === true;
    const rendered = await renderDocument(source, {
      sourcePath,
      allowRemoteImages: false,
      frontmatterSchema: schema,
      wordsPerMinute: 220,
    });
    const tags = normalizeTags(extracted.data.tags);
    const localAssets = rendered.assets.filter(asset => !asset.remote);
    const policyDiagnostics = [
      ...tagDiagnostics(tags),
      ...await assetDiagnostics(localAssets, dirname(sourcePath)),
      ...await hasRepeatedTitleH1(rendered.html, extracted.data.title)
        ? [{
            code: 'post.repeated-title-h1',
            message: 'The Markdown body must not repeat the frontmatter title as an H1.',
            severity: 'error',
          }]
        : [],
    ];
    rendered.diagnostics.push(...policyDiagnostics);

    posts.push({
      slug,
      source,
      sourcePath,
      title: extracted.data.title,
      description: extracted.data.description,
      date: extracted.data.date,
      category: extracted.data.category,
      tags,
      draft,
      featured: extracted.data.featured === true,
      rendered,
      localAssets,
      readingMinutes: Math.max(1, Math.ceil(rendered.wordCount / 220)),
    });
  }

  const published = posts.filter(post => !post.draft);
  for (const post of published) {
    const failures = post.rendered.diagnostics.filter(diagnostic =>
      diagnostic.severity === 'error' || PUBLICATION_WARNING_CODES.has(diagnostic.code));
    if (failures.length > 0) {
      throw new Error(formatDiagnostics(post.slug, 'publication', failures));
    }
  }
  validatePublishedCollection(published);

  return posts.sort(comparePosts);
}

export function publishedPosts(posts) {
  return posts.filter(post => post.draft !== true).sort(comparePosts);
}

export function selectFeatured(posts) {
  const published = publishedPosts(posts);
  const featured = published.filter(post => post.featured === true);
  if (featured.length > 1) {
    throw new Error('Multiple published posts are marked featured.');
  }
  return featured[0] ?? published[0] ?? null;
}

export function tagSlug(label) {
  const slug = String(label)
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase('und')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (slug === '') throw new Error('Tag slug cannot be empty.');
  return encodeURIComponent(slug);
}

async function readContentDirectory(contentDir) {
  try {
    return await readdir(contentDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function normalizeTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return value;
  return value.map(tag => typeof tag === 'string' ? tag.trim() : tag);
}

function tagDiagnostics(tags) {
  if (!Array.isArray(tags)) return [];
  const diagnostics = [];
  const seen = new Set();
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag === '') {
      diagnostics.push({
        code: 'post.tag-empty',
        message: 'Tags must be non-empty strings after trimming.',
        severity: 'error',
      });
      continue;
    }
    const identity = tag.normalize('NFKC').toLocaleLowerCase('und');
    if (seen.has(identity)) {
      diagnostics.push({
        code: 'post.tag-duplicate',
        message: `Duplicate tag in post: ${tag}`,
        severity: 'error',
      });
    }
    seen.add(identity);
  }
  return diagnostics;
}

async function assetDiagnostics(assets, postDirectory) {
  const diagnostics = [];
  const canonicalPostDirectory = await realpath(postDirectory);

  for (const asset of assets) {
    if (asset.resolvedPath === undefined) {
      diagnostics.push(assetDiagnostic('post.asset-unresolved', `Local asset could not be resolved: ${asset.source}`));
      continue;
    }
    const assetPath = resolve(asset.resolvedPath);
    if (!isWithin(postDirectory, assetPath)) {
      diagnostics.push(assetDiagnostic('post.asset-traversal', `Local asset escapes the post directory: ${asset.source}`));
      continue;
    }
    try {
      const [details, canonicalAssetPath] = await Promise.all([stat(assetPath), realpath(assetPath)]);
      if (!details.isFile() || !isWithin(canonicalPostDirectory, canonicalAssetPath)) {
        diagnostics.push(assetDiagnostic('post.asset-traversal', `Local asset is not a file within the post directory: ${asset.source}`));
      }
    } catch (error) {
      if (error?.code === 'ENOENT') {
        diagnostics.push(assetDiagnostic('post.asset-missing', `Missing local asset: ${asset.source}`));
        continue;
      }
      throw error;
    }
  }
  return diagnostics;
}

function assetDiagnostic(code, message) {
  return { code, message, severity: 'error' };
}

function isWithin(parent, child) {
  const pathFromParent = relative(parent, child);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}

async function hasRepeatedTitleH1(html, title) {
  if (typeof title !== 'string' || title.trim() === '') return false;
  const wanted = normalizeHeading(title);
  const headings = html.matchAll(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/giu);

  for (const [heading] of headings) {
    if (await renderedText(heading) === wanted) return true;
  }
  return false;
}

async function renderedText(source) {
  const inlineCodeAsText = source
    .replace(/<code(?:\s[^>]*)?>/giu, '<span>')
    .replace(/<\/code>/giu, '</span>');
  const rendered = await renderDocument(inlineCodeAsText);
  return normalizeHeading(rendered.plainText);
}

function normalizeHeading(value) {
  return value.trim().normalize('NFKC').replace(/\s+/gu, ' ');
}

function validatePublishedCollection(posts) {
  const featured = posts.filter(post => post.featured);
  if (featured.length > 1) throw new Error('Multiple published posts are marked featured.');

  const labelsBySlug = new Map();
  for (const post of posts) {
    for (const label of post.tags) {
      const slug = tagSlug(label);
      const identity = label.normalize('NFKC').toLocaleLowerCase('und');
      const prior = labelsBySlug.get(slug);
      if (prior !== undefined && prior !== identity) {
        throw new Error(`Published tag slug collision: ${label} and ${prior} both map to ${slug}.`);
      }
      labelsBySlug.set(slug, identity);
    }
  }
}

function comparePosts(left, right) {
  const byDate = String(right.date).localeCompare(String(left.date));
  return byDate || left.slug.localeCompare(right.slug);
}

function hasErrors(diagnostics) {
  return diagnostics.some(diagnostic => diagnostic.severity === 'error');
}

function formatDiagnostics(slug, stage, diagnostics) {
  return `${slug} ${stage} failed: ${diagnostics.map(diagnostic => `${diagnostic.code}: ${diagnostic.message}`).join('; ')}`;
}
