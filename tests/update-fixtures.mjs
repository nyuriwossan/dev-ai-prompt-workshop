// 依頼文のスナップショットを作り直す。依頼文の文言を意図して変えたときだけ実行する。
//   node tests/update-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { representativeCases, TARGET_VALUES } from './helpers.js';
import { buildPrompt } from '../src/prompts/build.js';
import { getMode } from '../src/data/modes.js';

const out = {};
for (const c of representativeCases()) {
  for (const target of TARGET_VALUES) {
    for (const purpose of getMode(c.mode).purposes) {
      out[`${c.name}/${target}/${purpose}`] = buildPrompt(c.mode, c.values, { target, purpose });
    }
  }
}
writeFileSync(new URL('./fixtures/prompts.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${Object.keys(out).length} prompts`);
