import { db } from "../backend/src/infrastructure/adapter/postgresql.js";
import {
  comments,
  issueEvents,
  issueSnapshots,
  issuesRead,
  projects,
  users,
} from "../backend/src/infrastructure/persistence/schema.js";

const main = async () => {
  console.log("Clearing all data...");

  await db.delete(issueSnapshots);
  await db.delete(comments);
  await db.delete(issuesRead);
  await db.delete(issueEvents);
  await db.delete(projects);
  await db.delete(users);

  console.log("All data cleared.");
  process.exit(0);
};

main().catch((err) => {
  console.error("Clear failed:", err);
  process.exit(1);
});
