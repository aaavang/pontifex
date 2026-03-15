import {Module} from '@nestjs/common';
import {AuditEventService} from "./audit-event.service";

@Module({
            providers: [AuditEventService],
            exports: [AuditEventService]
        })
export class AuditEventModule {
}
