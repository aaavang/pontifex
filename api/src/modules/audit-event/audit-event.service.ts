import {Injectable} from "@nestjs/common";
import {v4 as uuid} from "uuid";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexAuditEvent} from "./entities/audit-event.entity";

@Injectable()
export class AuditEventService {
    constructor(private readonly gremlinService: GremlinService) {}

    async publishEvent(event: PontifexAuditEvent): Promise<void> {
        const eventId = uuid();
        const createDate = event.createDate ?? new Date().toISOString();

        await this.gremlinService.upsertVertex({
            id: eventId,
            pk: eventId,
            defaultProperties: {
                type: 'event',
                action: event.action,
                value: event.value,
                createDate,
                ...(event.associatedUserId && {associatedUserId: event.associatedUserId}),
            },
        });

        const targetResourceIds = Array.isArray(event.targetResourceId)
            ? event.targetResourceId
            : event.targetResourceId
                ? [event.targetResourceId]
                : [];

        for (const targetResourceId of targetResourceIds) {
            // target resource -> "has event" -> event
            await this.gremlinService.upsertEdge({
                label: 'has event',
                sourceVertexId: targetResourceId,
                sourceVertexPk: targetResourceId,
                destinationVertexId: eventId,
                destinationVertexPk: eventId,
            });

            // event -> "is event for" -> target resource
            await this.gremlinService.upsertEdge({
                label: 'is event for',
                sourceVertexId: eventId,
                sourceVertexPk: eventId,
                destinationVertexId: targetResourceId,
                destinationVertexPk: targetResourceId,
            });
        }
    }
}