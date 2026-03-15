export interface Connections {
    contains?: Resource; // app -> env
    "contained by"?: Resource; // env -> app
    "requests permission"?: Resource; // env -> permission request, role -> permission request
    "request source"?: Resource; // permission request -> env
    "request target"?: Resource; // permission request -> role
    "request creator"?: Resource; // permission request -> user
    "created request"?: Resource; // user -> permission request
    owns?: Resource; // user -> app, user -> group
    "owned by"?: Resource; // app -> user, group -> user
    "has event"?: Resource; // ? -> event
    "is event for"?: Resource; // event -> ?
    "has password"?: Resource; // app -> password
    "is password for"?: Resource; // password -> app
    "has member"?: Resource; // group -> user
    "member of"?: Resource; // user -> group
    "has token group"?: Resource; // environment -> token group
    "is user token group for"?: Resource; // token group -> environment
    "has setting"?: Resource; // system-settings base -> system setting
    "is setting for"?: Resource; // system setting -> system-settings base
}

export interface Resource {
    application?: GremlinVertex[];
    environment?: GremlinVertex[];
    user?: GremlinVertex[];
    permissionRequest?: GremlinVertex[];
    role?: GremlinVertex[];
    scope?: GremlinVertex[];
    event?: GremlinVertex[];
    password?: GremlinVertex[];
    group?: GremlinVertex[];
    tokenGroup?: GremlinVertex[];
    systemSetting?: GremlinVertex[];
}

export type ResourceType = keyof Resource;

export interface GremlinVertex {
    id: string;
    pk: string;
    properties?: Record<string, any>;
}

export interface GremlinEdge {
    label: string;
    sourceVertexId: string;
    sourceVertexPk: string;
    destinationVertexId: string;
    destinationVertexPk: string;
    properties?: Record<string, any>;
}

export interface UpsertVertexProps<T> {
    id: string;
    pk: string;
    defaultProperties?: Partial<Record<keyof T, any>> & { type: ResourceType }; // every vertex has a type, but it's readonly
    updatedProperties?: Partial<Record<keyof T, any>>;
}