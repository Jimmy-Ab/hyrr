import { Logger } from "@nestjs/common"
import { LocalStorageDriver } from "./local-storage.driver"
import { s3ConfigFromEnv, S3StorageDriver } from "./s3-storage.driver"
import { StorageDriver } from "./storage.driver"

const logger = new Logger("StorageDriver")

/** STORAGE_DRIVER=local (default) | s3. A misconfigured s3 driver falls back to local with a warning. */
export function createStorageDriver(): StorageDriver {
  const kind = (process.env.STORAGE_DRIVER || "local").trim().toLowerCase()
  if (kind === "s3") {
    const config = s3ConfigFromEnv()
    if (config) return new S3StorageDriver(config)
    logger.warn("STORAGE_DRIVER=s3 but S3_BUCKET is not set; falling back to local storage")
  } else if (kind !== "local") {
    logger.warn(`Unknown STORAGE_DRIVER "${kind}"; using local storage`)
  }
  return new LocalStorageDriver()
}
