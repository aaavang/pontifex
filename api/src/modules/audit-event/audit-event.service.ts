import {Injectable} from "@nestjs/common";
import {PontifexAuditEvent} from "./entities/audit-event.entity";

@Injectable()
export class AuditEventService {
    async publishEvent(event: PontifexAuditEvent): Promise<void> {
        // TODO
    }
}