import { Global, Module } from "@nestjs/common"
import { SearchService } from "./search.service"

/** Optional Meilisearch job index (enabled by MEILI_HOST). PrismaModule and QueueModule are global. */
@Global()
@Module({
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
