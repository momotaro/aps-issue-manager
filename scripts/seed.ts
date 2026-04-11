import { db } from "../backend/src/infrastructure/adapter/postgresql.js";
import { seedMockUsers } from "../backend/src/infrastructure/persistence/seedMockUsers.js";
import { seedIssues } from "./seedIssues.js";
import { seedProject } from "./seedProject.js";

const main = async () => {
  console.log("Seeding mock users...");
  await seedMockUsers(db);

  console.log("Seeding project...");
  const projectId = await seedProject(db);

  console.log("Seeding issues...");
  await seedIssues(db, projectId);

  console.log("Seed complete.");
  process.exit(0);
};

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
