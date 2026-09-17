#!/usr/bin/env node
// Ověří, že Android hlásí stejnou verzi jako iOS.
// Android versionName == iOS MARKETING_VERSION a Android versionCode >= iOS CURRENT_PROJECT_VERSION.
// Verze se v obou projektech udržují ručně, takže se snadno rozejdou (viz 1.3.0:
// iOS byl bumpnutý, Android zůstal na 1.2.3).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const gradle = readFileSync(join(root, 'android/app/build.gradle'), 'utf8');
const pbx = readFileSync(join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');

const fail = (msg) => { console.error(`VERSION_PARITY_FAIL: ${msg}`); process.exit(1); };

const androidName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const androidCode = gradle.match(/versionCode\s+(\d+)/)?.[1];
if (!androidName) fail('v android/app/build.gradle chybí versionName');
if (!androidCode) fail('v android/app/build.gradle chybí versionCode');

// Xcode drží obě hodnoty v každé build konfiguraci — sesbírat všechny a trvat na shodě,
// jinak by se dala parita "splnit" proti jedné zapomenuté konfiguraci.
const marketing = [...pbx.matchAll(/MARKETING_VERSION\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
const project = [...pbx.matchAll(/CURRENT_PROJECT_VERSION\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
if (marketing.length === 0) fail('v project.pbxproj chybí MARKETING_VERSION');
if (project.length === 0) fail('v project.pbxproj chybí CURRENT_PROJECT_VERSION');

const uniqMarketing = [...new Set(marketing)];
const uniqProject = [...new Set(project)];
if (uniqMarketing.length > 1) fail(`iOS MARKETING_VERSION se liší mezi konfiguracemi: ${uniqMarketing.join(', ')}`);
if (uniqProject.length > 1) fail(`iOS CURRENT_PROJECT_VERSION se liší mezi konfiguracemi: ${uniqProject.join(', ')}`);

const iosName = uniqMarketing[0];
const iosBuild = Number(uniqProject[0]);
if (!Number.isInteger(iosBuild)) fail(`iOS CURRENT_PROJECT_VERSION není celé číslo: ${uniqProject[0]}`);

if (androidName !== iosName) fail(`versionName ${androidName} != iOS MARKETING_VERSION ${iosName}`);
if (Number(androidCode) < iosBuild) fail(`versionCode ${androidCode} < iOS build ${iosBuild}`);

console.log(`Android ${androidName} (code ${androidCode}) · iOS ${iosName} (build ${iosBuild})`);
console.log('VERSION_PARITY_OK');
