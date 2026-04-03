import { db } from "./infrastructure/adapter/postgresql.js";
import {
  type BlobStorageConfig,
  createBlobStorage,
} from "./infrastructure/external/blobStorageImpl.js";
import { createEventProjector } from "./infrastructure/persistence/eventProjectorImpl.js";
import { createEventStore } from "./infrastructure/persistence/eventStoreImpl.js";
import { createIssueQueryService } from "./infrastructure/persistence/issueQueryServiceImpl.js";
import { createIssueRepository } from "./infrastructure/persistence/issueRepositoryImpl.js";
import { createProjectRepository } from "./infrastructure/persistence/projectRepositoryImpl.js";
import { createUserRepository } from "./infrastructure/persistence/userRepositoryImpl.js";

const blobConfig: BlobStorageConfig = {
  endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
  region: process.env.MINIO_REGION ?? "us-east-1",
  bucket: process.env.MINIO_BUCKET ?? "issues",
  accessKeyId: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
  secretAccessKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
};

// --- Factory ---
const eventStoreFactory = createEventStore(db);
const eventProjectorFactory = createEventProjector(db);

// --- Repositories ---
export const issueRepository = createIssueRepository(
  db,
  eventStoreFactory,
  eventProjectorFactory,
);
export const issueQueryService = createIssueQueryService(db);
export const userRepository = createUserRepository(db);
export const projectRepository = createProjectRepository(db);

// --- Services ---
export const blobStorage = createBlobStorage(blobConfig);
