import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexEnvironment} from "../../environment/entities/environment.entity";
import {PontifexRole} from "../../role/entities/role.entity";
import {PontifexScope} from "../../scope/entities/scope.entity";

export interface PontifexPermissionRequest {
    id: string; // source-env-id.app-role-id
    requestor: string;
    createDate: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    permissionType: string;
    roleAssignmentId?: string;
    scopeAssignmentId?: string;
    sourceEnvironmentName: string;
    sourceEnvironmentId: string;
    targetEnvironmentName: string;
    targetEnvironmentId: string;
    targetPermissionName: string
    targetPermissionId: string;
}

export interface PontifexPermissionRequestBundle {
    permissionRequest: PontifexPermissionRequest;
    sourceEnvironment: PontifexEnvironment;
    targetRole?: PontifexRole;
    targetScope?: PontifexScope;
    targetEnvironment?: PontifexEnvironment;
}

export type PermissionRequestDirection = "inbound" | "outbound";

export function PontifexPermissionRequestFromGremlin(
    vertex: any
): PontifexPermissionRequest {

    const obj = vertexToObject(vertex)
    return {
        id: obj["id"],
        requestor: obj["requestor"],
        createDate: obj["createDate"],
        status: obj["status"],
        permissionType: obj["permissionType"]
            ? obj["permissionType"]
            : "Role", // backwards compatible for old permission requests without permissionType
        roleAssignmentId: obj["roleAssignmentId"],
        scopeAssignmentId: obj["scopeAssignmentId"],
        targetPermissionName: obj["targetPermissionName"],
        sourceEnvironmentId: obj["sourceEnvironmentId"],
        sourceEnvironmentName: obj["sourceEnvironmentName"],
        targetEnvironmentId: obj["targetEnvironmentId"],
        targetEnvironmentName: obj["targetEnvironmentName"],
        targetPermissionId: obj["targetPermissionId"]
    };
}