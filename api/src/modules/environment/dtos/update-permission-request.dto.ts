import {Type} from "class-transformer";
import {IsArray, IsString} from "class-validator";

export class Permission {
    @IsString()
    id: string;

    @IsString()
    applicationObjectId: string;

    @IsString()
    type: "Scope" | "Role"; // Scope (for delegated permissions) or Role (for app roles)
}

export class EnvironmentUpdatePermissionsRequest {
    @IsArray()
    @Type(() => Permission)
    permissions: Permission[];

    @IsString()
    targetEnvironmentId: string;
}