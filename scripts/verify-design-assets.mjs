import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Canonical geometry from openbindings/design@cb7ea5, identity revision 1.
const canonicalGeometryDigest = 'dcd721e3d7939ad49963c50fc12556dd969232863f4a6a74edb4efc114045bdd';

function geometryDigest(source) {
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
  const paths = [...source.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
  return {
    digest: createHash('sha256').update(JSON.stringify({ viewBox, paths })).digest('hex'),
    pathCount: paths.length,
  };
}

for (const [path, color] of [
  ['icon.svg', 'black'],
  ['icon-dark.svg', 'white'],
]) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const geometry = geometryDigest(source);

  if (geometry.digest !== canonicalGeometryDigest || geometry.pathCount !== 5) {
    throw new Error(`${path} must preserve OpenBindings Design identity revision 1 geometry`);
  }

  if (
    !source.includes(`color="${color}"`) ||
    !source.includes('fill="none"') ||
    (source.match(/stroke="currentColor"/g) ?? []).length !== 5 ||
    (source.match(/stroke-width="30"/g) ?? []).length !== 5
  ) {
    throw new Error(`${path} may set one contextual color but must preserve the canonical stroke`);
  }
}

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
for (const fragment of [
  'srcset="icon-dark.svg"',
  '<img alt="OpenBindings" src="icon.svg" width="80">',
]) {
  if (!readme.includes(fragment)) {
    throw new Error(`README identity presentation is missing: ${fragment}`);
  }
}

console.log('design assets: identity revision 1 current');
