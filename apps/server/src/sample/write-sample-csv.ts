/** Writes the sample statement into the web app's public folder, so visitors can download it. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSampleCsv } from './sample-statement';

const target = resolve(__dirname, '../../../web/public/sample-statement.csv');
writeFileSync(target, generateSampleCsv());
console.log(`Wrote ${target}`);
