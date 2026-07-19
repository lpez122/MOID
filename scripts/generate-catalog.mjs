import { readdir, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, "..");
const sourceRoot = resolve(siteRoot, "../images_finalized/done");
const publicRoot = join(siteRoot, "public");
const imageOutputRoot = join(publicRoot, "images");
const catalogFile = join(publicRoot, "catalog.json");
const conceptTarget = 200;
const imagesPerConcept = 10;
const longestEdge = 640;
const jpegQuality = 72;
const excludedConcepts = new Set([
  "animals/crustaceans/blue_crab"
]);
const conceptReplacements = new Map([
  [
    "electronics_and_appliances/phones_and_tablets/satellite_phone",
    "electronics_and_appliances/phones_and_tablets/smartphone"
  ]
]);
const excludedImages = new Set([
  "animals/crustaceans/crab/crab_3.jpg",
  "animals/crustaceans/crab/crab_4.jpg",
  "animals/crustaceans/crab/crab_7.jpg",
  "animals/crustaceans/crab/crab_8.jpg",
  "animals/crustaceans/king_crab/king_crab_1.jpg",
  "animals/crustaceans/king_crab/king_crab_2.jpg",
  "animals/crustaceans/king_crab/king_crab_3.jpg",
  "animals/crustaceans/king_crab/king_crab_4.jpg",
  "animals/crustaceans/king_crab/king_crab_5.jpg",
  "animals/crustaceans/king_crab/king_crab_7.jpg",
  "animals/crustaceans/king_crab/king_crab_8.jpg",
  "animals/crustaceans/king_crab/king_crab_10.jpg"
]);

const titleCase = (value) => value
  .replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const natural = new Intl.Collator("en", { numeric: true }).compare;

function hash(value) {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return walk(path);
    if (entry.isFile() && entry.name.endsWith(".png") && folder.endsWith(`${sep}framed_nearedge`)) {
      return [path];
    }
    return [];
  }));
  return nested.flat();
}

function runSips(source, destination) {
  return new Promise((resolvePromise, reject) => {
    const process = spawn("sips", [
      "-s", "format", "jpeg",
      "-s", "formatOptions", String(jpegQuality),
      "-Z", String(longestEdge),
      source,
      "--out", destination
    ], { stdio: "ignore" });
    process.on("error", reject);
    process.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`sips exited with code ${code}`)));
  });
}

async function mapConcurrent(items, concurrency, worker) {
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

const sourceFiles = await walk(sourceRoot);
const concepts = new Map();

for (const file of sourceFiles) {
  const parts = relative(sourceRoot, file).split(sep);
  const [category, collection, concept] = parts;
  const key = `${category}/${collection}/${concept}`;
  if (!concepts.has(key)) concepts.set(key, { category, collection, concept, files: [] });
  concepts.get(key).files.push(file);
}

const eligible = [...concepts.values()].filter((concept) => {
  const conceptPath = `${concept.category}/${concept.collection}/${concept.concept}`;
  return concept.files.length >= imagesPerConcept && !excludedConcepts.has(conceptPath);
});
const byCategory = Map.groupBy(eligible, (concept) => concept.category);
const categories = [...byCategory.keys()].sort(natural);
const selectedConcepts = [];

for (const category of categories) {
  byCategory.set(category, byCategory.get(category)
    .sort((a, b) => hash(`${a.collection}/${a.concept}`) - hash(`${b.collection}/${b.concept}`)));
}

let round = 0;
while (selectedConcepts.length < conceptTarget) {
  let addedThisRound = 0;
  for (const category of categories) {
    const candidate = byCategory.get(category)[round];
    if (candidate && selectedConcepts.length < conceptTarget) {
      selectedConcepts.push(candidate);
      addedThisRound += 1;
    }
  }
  if (addedThisRound === 0) break;
  round += 1;
}

if (selectedConcepts.length !== conceptTarget) {
  throw new Error(`Could only select ${selectedConcepts.length} eligible concepts; expected ${conceptTarget}.`);
}

for (const [replacedPath, replacementPath] of conceptReplacements) {
  const replacedIndex = selectedConcepts.findIndex((concept) =>
    `${concept.category}/${concept.collection}/${concept.concept}` === replacedPath);
  if (replacedIndex === -1) continue;

  const replacement = eligible.find((concept) =>
    `${concept.category}/${concept.collection}/${concept.concept}` === replacementPath);
  if (!replacement) throw new Error(`Replacement concept is unavailable: ${replacementPath}`);
  if (!selectedConcepts.includes(replacement)) selectedConcepts[replacedIndex] = replacement;
}

const jobs = selectedConcepts.flatMap((concept) => concept.files
  .sort(natural)
  .slice(0, imagesPerConcept)
  .map((source, index) => {
    const filename = `${concept.concept}_${index + 1}.jpg`;
    const webPath = [concept.category, concept.collection, concept.concept, filename].join("/");
    const destination = join(imageOutputRoot, concept.category, concept.collection, concept.concept, filename);
    return { ...concept, source, destination, filename, webPath };
  }))
  .filter((job) => !excludedImages.has(job.webPath));

await rm(imageOutputRoot, { recursive: true, force: true });
await mkdir(imageOutputRoot, { recursive: true });

let completed = 0;
await mapConcurrent(jobs, 8, async (job) => {
  await mkdir(dirname(job.destination), { recursive: true });
  await runSips(job.source, job.destination);
  completed += 1;
  if (completed % 200 === 0) console.log(`Optimized ${completed.toLocaleString()} / ${jobs.length.toLocaleString()} images…`);
});

const images = jobs.map((job, index) => ({
  id: index + 1,
  name: titleCase(job.concept),
  slug: job.concept,
  category: titleCase(job.category),
  categorySlug: job.category,
  collection: titleCase(job.collection),
  image: `images/${job.webPath.split("/").map(encodeURIComponent).join("/")}`
}));

const payload = {
  generatedAt: new Date().toISOString(),
  stats: {
    images: images.length,
    totalImages: sourceFiles.length,
    concepts: selectedConcepts.length,
    categories: categories.length
  },
  categories: categories.map(titleCase),
  images
};

await writeFile(catalogFile, JSON.stringify(payload));
console.log(`Built a ${images.length.toLocaleString()}-image showcase across ${selectedConcepts.length} concepts and ${categories.length} categories.`);
