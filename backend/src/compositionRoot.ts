import { db } from "./infrastructure/adapter/postgresql.js";
import {
  type ApsClient,
  createApsClient,
} from "./infrastructure/external/apsClient.js";
import { createBlobStorage } from "./infrastructure/external/blobStorageImpl.js";
import { createMinioClient } from "./infrastructure/external/minioClient.js";
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

const requirePort = (name: string): number => {
  const raw = requireEnv(name);
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid port in environment variable ${name}: "${raw}" (expected 1-65535)`,
    );
  }
  return port;
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
const minioClient = createMinioClient({
  endPoint: requireEnv("MINIO_ENDPOINT"),
  port: requirePort("MINIO_PORT"),
  accessKey: requireEnv("MINIO_ACCESS_KEY"),
  secretKey: requireEnv("MINIO_SECRET_KEY"),
});
const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT;
const publicMinioClient = publicEndpoint
  ? createMinioClient({
      endPoint: publicEndpoint,
      port: requirePort("MINIO_PORT"),
      accessKey: requireEnv("MINIO_ACCESS_KEY"),
      secretKey: requireEnv("MINIO_SECRET_KEY"),
      region: "us-east-1",
    })
  : undefined;
export const blobStorage = createBlobStorage(
  minioClient,
  requireEnv("MINIO_BUCKET"),
  publicMinioClient,
);

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
