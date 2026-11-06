import { Global, Module } from "@nestjs/common"
import { QueueService } from "./queue.service"

/** Background job queue (BullMQ with Redis, in-process without). See QueueService. */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
