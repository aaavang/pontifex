import { Module } from '@nestjs/common';
import {GraphQueryService} from "./graph-query.service";
import {GremlinService} from "./gremlin.service";

@Module({
    providers: [GremlinService, GraphQueryService],
    exports: [GremlinService, GraphQueryService]
})
export class GremlinModule {}
