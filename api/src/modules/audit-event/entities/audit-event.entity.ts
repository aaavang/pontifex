export interface PontifexAuditEvent {
    id?: string
    createDate?: string
    targetResourceId?: string | string[]
    associatedUserId?: string
    action: string
    value: string
}

export function PontifexAuditEventFromGremlin(vertex: any): PontifexAuditEvent {
    return {
        createDate: vertex["properties"]["createDate"][0]["value"],
        associatedUserId: vertex["properties"]["associatedUserId"]?.[0]["value"],
        id: vertex["id"],
        action: vertex["properties"]["action"][0]["value"],
        value: vertex["properties"]["value"]?.[0]["value"]
    }
}