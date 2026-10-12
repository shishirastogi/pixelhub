import path from "node:path";
import PQueue from "p-queue";
import { uploadBlob, type UploadTarget } from "./api.js";

const UPLOAD_ATTEMPTS = 5;
const UPLOAD_CONCURRENCY = 4;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Uploads presigned blobs with bounded concurrency and exponential backoff. */
export async function uploadTargets(
  root: string,
  targets: UploadTarget[],
): Promise<number> {
  if (targets.length === 0) return 0;

  const queue = new PQueue({ concurrency: UPLOAD_CONCURRENCY });
  let uploaded = 0;

  await Promise.all(
    targets.map((target) =>
      queue.add(async () => {
        const absolute = path.join(root, ...target.path.split("/"));
        for (let attempt = 1; ; attempt += 1) {
          try {
            await uploadBlob(target, absolute);
            uploaded += 1;
            return;
          } catch (error) {
            if (attempt >= UPLOAD_ATTEMPTS) {
              const message =
                error instanceof Error ? error.message : String(error);
              console.error(`  ! upload failed for ${target.path}: ${message}`);
              return;
            }
            await delay(1000 * 2 ** (attempt - 1));
          }
        }
      }),
    ),
  );

  return uploaded;
}
