import {IsIn, IsString} from "class-validator";

export class PatchPermissionRequestStatusRequest {
    @IsString()
    @IsIn(["APPROVED", "REJECTED"], {message: 'String must be either "APPROVED" or "REJECTED"'})
    status: "APPROVED" | "REJECTED";
}