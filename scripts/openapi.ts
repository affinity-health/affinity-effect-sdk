type Document = {
  paths: Record<string, unknown>;
  components: Record<string, Record<string, unknown>>;
};

// Internal operator APIs are absent from public discovery. Keep their previously
// shipped contract separately pinned when regenerating the public operations.
export async function loadOpenApi() {
  const root = `${import.meta.dir}/../spec`;
  const publicApi: Document = await Bun.file(`${root}/affinity.openapi.json`).json();
  const internalApi: Document = await Bun.file(`${root}/affinity.internal.openapi.json`).json();
  for (const [path, item] of Object.entries(internalApi.paths)) {
    if (publicApi.paths[path]) throw new Error(`Duplicate internal API path: ${path}`);
    publicApi.paths[path] = item;
  }
  for (const [kind, entries] of Object.entries(internalApi.components)) {
    const target = (publicApi.components[kind] ??= {});
    for (const [name, value] of Object.entries(entries)) {
      if (target[name] && JSON.stringify(target[name]) !== JSON.stringify(value))
        throw new Error(`Conflicting internal component: ${kind}/${name}`);
      target[name] = value;
    }
  }
  return publicApi;
}
