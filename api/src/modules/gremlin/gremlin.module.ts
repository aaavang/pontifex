import { Module } from '@nestjs/common';
import {GremlinService} from "./gremlin.service";

@Module({
    providers: [GremlinService],
    exports: [GremlinService]
})
export class GremlinModule {}
