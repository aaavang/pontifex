import {Module} from '@nestjs/common';
import {GremlinModule} from "../gremlin/gremlin.module";
import {AuditEventService} from "./audit-event.service";

@Module({
            imports: [GremlinModule],
            providers: [AuditEventService],
            exports: [AuditEventService]
        })
export class AuditEventModule {
}
