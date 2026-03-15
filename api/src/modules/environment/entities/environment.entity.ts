import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexApplication} from "../../application/entities/application.entity";
import {PontifexPassword} from "../../password/entities/password.entity";
import {PontifexPermissionRequest} from "../../permission-request/entities/permision-request.entity";
import {PontifexRole} from "../../role/entities/role.entity";
import {PontifexScope} from "../../scope/entities/scope.entity";
import {PontifexTokenGroup} from "../../token-group/entities/token-group.entity";

export interface PontifexEnvironment {
    name: string; // app registration name + dev/stage/prod
    id: string; // app registration object id
    level: string; // dev-stage-prod
    clientId: string;
    spaRedirectUrls: string[];
    webRedirectUrls: string[];
}

export interface PontifexEnvironmentBundle {
    environment: PontifexEnvironment;
    roles: PontifexRole[];
    scopes: PontifexScope[];
    permissionRequests: PontifexPermissionRequest[];
    outboundPermissionRequests: PontifexPermissionRequest[];
    inboundPermissionRequests: PontifexPermissionRequest[];
    application: PontifexApplication;
    passwords: PontifexPassword[];
    tokenGroups: PontifexTokenGroup[];
}

export interface CreateEnvironmentDto {
    name: string;
    level: string;
    clientId: string;
    spaRedirectUrls?: string[];
    webRedirectUrls?: string[];
}

export interface UpdateEnvironmentDto {
    name?: string;
    level?: string;
    clientId?: string;
    spaRedirectUrls?: string[];
    webRedirectUrls?: string[];
}

export interface AddPasswordDto {
    displayName: string
}

export function isAddPasswordDto(obj: any): obj is AddPasswordDto {
    return obj.displayName !== undefined && typeof obj.displayName === "string";
}

export function PontifexEnvironmentFromGremlin(
    vertex: any
): PontifexEnvironment {
    const obj = vertexToObject(vertex)

    // redirectUrls is the old way of representing SPA redirect URLS
    const redirectUrlsString =
        obj["redirectUrls"] ?? "";
    const spaRedirectUrlsString =
        obj["spaRedirectUrls"] ?? "";
    const webRedirectUrlsString =
        obj["webRedirectUrls"] ?? "";

    const migrated = obj["spaRedirectUrls"] !== undefined;

    const redirectUrls: string[] =
        redirectUrlsString === "" ? [] : redirectUrlsString.split(",");
    const spaRedirectUrls: string[] =
        spaRedirectUrlsString === "" ? [] : spaRedirectUrlsString.split(",");
    const webRedirectUrls: string[] =
        webRedirectUrlsString === "" ? [] : webRedirectUrlsString.split(",");
    return {
        id: obj["id"],
        name: obj["name"],
        level: obj["level"],
        clientId: obj["clientId"],
        spaRedirectUrls: migrated ? spaRedirectUrls : redirectUrls,
        webRedirectUrls,
    };
}