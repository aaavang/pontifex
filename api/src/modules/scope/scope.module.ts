import {Module} from '@nestjs/common';
import {GremlinModule} from "../gremlin/gremlin.module";
import {ScopeService} from "./scope.service";

@Module({
            imports: [GremlinModule],
            providers: [ScopeService],
            exports: [ScopeService]
        })
export class ScopeModule {
}
