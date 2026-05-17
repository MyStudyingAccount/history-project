#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const MENU_LINKS = new Map([
  ['https://www.history.com/topics/great-depression', 'Background.html'],
  ['https://www.history.com/topics/inventions', 'How_is_it_a_turning_point:economic.html'],
  ['https://www.history.com/topics/natural-disasters-and-environment', 'How_is_it_a_turning_point:social.html'],
  ['https://www.history.com/collections/archaeology', 'How_is_it_a_turning_point:democratic.html'],
]);

function parseArgs(argv) {
  const args = argv.slice(2);
  let dryRun = false;
  const paths = [];

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg.startsWith('-')) {
      continue;
    }

    paths.push(arg);
  }

  return {
    dryRun,
    roots: paths.length > 0 ? paths : ['.'],
  };
}

async function collectHtmlFiles(rootPath, files) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await collectHtmlFiles(entryPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(entryPath);
    }
  }
}

function updateHeaderLinks(content) {
  const headerStart = content.indexOf('<header class="m12f2p9 x4or4w6"');
  if (headerStart === -1) {
    return { updatedContent: content, changed: false };
  }

  const headerEnd = content.indexOf('</header>', headerStart);
  if (headerEnd === -1) {
    return { updatedContent: content, changed: false };
  }

  const header = content.slice(headerStart, headerEnd);
  let updatedHeader = header;

  for (const [oldHref, newHref] of MENU_LINKS) {
    updatedHeader = updatedHeader.replaceAll(`href="${oldHref}"`, `href="${newHref}"`);
  }

  if (updatedHeader === header) {
    return { updatedContent: content, changed: false };
  }

  return {
    updatedContent: content.slice(0, headerStart) + updatedHeader + content.slice(headerEnd),
    changed: true,
  };
}

async function main() {
  const { dryRun, roots } = parseArgs(process.argv);
  const htmlFiles = [];

  for (const root of roots) {
    await collectHtmlFiles(path.resolve(root), htmlFiles);
  }

  const changedFiles = [];

  for (const filePath of htmlFiles) {
    const original = await fs.readFile(filePath, 'utf8');
    const { updatedContent, changed } = updateHeaderLinks(original);

    if (!changed) {
      continue;
    }

    changedFiles.push(filePath);

    if (!dryRun) {
      await fs.writeFile(filePath, updatedContent, 'utf8');
    }
  }

  const mode = dryRun ? 'dry-run' : 'updated';
  console.log(`${mode}: ${changedFiles.length} file(s)`);
  for (const filePath of changedFiles) {
    console.log(path.relative(process.cwd(), filePath));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});