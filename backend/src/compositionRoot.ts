import { db } from "./infrastructure/adapter/postgresql.js";
import {
  type ApsClient,
  createApsClient,
} from "./infrastructure/external/apsClient.js";
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

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const minioHost = requireEnv("MINIO_ENDPOINT");
const minioPort = requireEnv("MINIO_PORT");

const blobConfig: BlobStorageConfig = {
  endpoint: `http://${minioHost}:${minioPort}`,
  region: process.env.MINIO_REGION ?? "us-east-1",
  bucket: requireEnv("MINIO_BUCKET"),
  accessKeyId: requireEnv("MINIO_ACCESS_KEY"),
  secretAccessKey: requireEnv("MINIO_SECRET_KEY"),
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

// --- APS (optional) ---
const apsClientId = process.env.APS_CLIENT_ID;
const apsClientSecret = process.env.APS_CLIENT_SECRET;
export const apsClient: ApsClient | null =
  apsClientId && apsClientSecret
    ? createApsClient(apsClientId, apsClientSecret)
    : (() => {
        console.warn(
          "APS_CLIENT_ID / APS_CLIENT_SECRET not set — APS token endpoint disabled",
        );
        return null;
      })();
