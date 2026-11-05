import { Global, Module } from "@nestjs/common"
import { EmbeddingsService } from "./embeddings.service"

/** Optional semantic matching; inject EmbeddingsService with @Optional() elsewhere. */
@Global()
@Module({
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
