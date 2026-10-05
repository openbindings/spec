// A versioned authority citation can be both the declaration and the reference.
// null leaves older candidates to their existing two-location consistency checks.
export function conciseCoreAuthorityErrors(markdown, label, expectedVersion) {
  if (!/^This kind incorporates /m.test(markdown)) return null;
  const declarations = [...markdown.matchAll(/^This kind incorporates \[OpenBindings Specification (\d+\.\d+\.\d+)\]\(\.\.\/\.\.\/openbindings\.md\)\.$/gm)];
  const starts = [...markdown.matchAll(/^This kind incorporates /gm)];
  const references = [...markdown.matchAll(/\[OpenBindings Specification(?: (\d+\.\d+\.\d+))?\]\(\.\.\/\.\.\/openbindings\.md\)/g)];
  if (declarations.length !== 1 || starts.length !== 1 || references.length !== 1 || /incorporates exactly version/.test(markdown)) {
    return [`${label}: must declare one unambiguous versioned OpenBindings Core authority`];
  }
  if (expectedVersion && declarations[0][1] !== expectedVersion) {
    return [`${label}: Core declaration and normative reference must both name ${expectedVersion}`];
  }
  return [];
}
