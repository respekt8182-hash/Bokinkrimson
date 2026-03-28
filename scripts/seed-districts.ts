// Seed script: upserts Crimea districts and municipal/city okrugs into the DB.
// Run with:  npx tsx scripts/seed-districts.ts
import { PrismaClient } from "@prisma/client";
import { CRIMEA_DISTRICTS } from "../src/lib/crimea-districts";

const db = new PrismaClient();

async function main() {
  console.log(`Seeding ${CRIMEA_DISTRICTS.length} Crimea districts/okrugs…`);

  for (const district of CRIMEA_DISTRICTS) {
    const result = await db.excursionDistrict.upsert({
      where: { slug: district.slug },
      update: { name: district.name, isActive: true },
      create: { slug: district.slug, name: district.name, isActive: true },
    });
    console.log(`  ${result.isActive ? "✓" : "~"} ${result.name}  (id: ${result.id})`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
