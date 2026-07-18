import { readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(scriptDirectory);
const corpusDirectory = join(projectDirectory, "..", "images_finalized", "done");
const outputPath = join(projectDirectory, "public", "taxonomy.json");
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const labelFromSlug = (slug) => slug
  .replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

async function directoryNames(path) {
  return (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort(collator.compare);
}

const categorySlugs = await directoryNames(corpusDirectory);
const categories = [];

for (const categorySlug of categorySlugs) {
  const categoryPath = join(corpusDirectory, categorySlug);
  const groupSlugs = await directoryNames(categoryPath);
  const groups = [];

  for (const groupSlug of groupSlugs) {
    const groupPath = join(categoryPath, groupSlug);
    const conceptSlugs = await directoryNames(groupPath);
    groups.push({
      id: `${categorySlug}/${groupSlug}`,
      slug: groupSlug,
      label: labelFromSlug(groupSlug),
      concepts: conceptSlugs.map((conceptSlug) => ({
        id: `${categorySlug}/${groupSlug}/${conceptSlug}`,
        slug: conceptSlug,
        label: labelFromSlug(conceptSlug)
      }))
    });
  }

  categories.push({
    id: categorySlug,
    slug: categorySlug,
    label: labelFromSlug(categorySlug),
    groups
  });
}

const taxonomy = {
  generatedAt: new Date().toISOString(),
  stats: {
    categories: categories.length,
    groups: categories.reduce((total, category) => total + category.groups.length, 0),
    concepts: categories.reduce(
      (total, category) => total + category.groups.reduce((sum, group) => sum + group.concepts.length, 0),
      0
    )
  },
  categories
};

await writeFile(outputPath, `${JSON.stringify(taxonomy)}\n`);
console.log(`Wrote ${taxonomy.stats.categories} categories, ${taxonomy.stats.groups} groups, and ${taxonomy.stats.concepts} labels to ${outputPath}`);
