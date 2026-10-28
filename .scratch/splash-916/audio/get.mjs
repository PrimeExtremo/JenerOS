// Downloads ElevenLabs renders: node get.mjs name=url ...
import { writeFileSync } from 'node:fs';
for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf('=');
  const name = arg.slice(0, i), url = arg.slice(i + 1);
  const res = await fetch(url);
  if (!res.ok) throw new Error(name + ' ' + res.status);
  writeFileSync(new URL(name, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log(name);
}
