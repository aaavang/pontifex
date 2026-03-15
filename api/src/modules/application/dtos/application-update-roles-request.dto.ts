import {Type} from "class-transformer";
import {ArrayNotEmpty, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested} from "class-validator";

export class PontifexRoleDto {
    @IsNotEmpty()
    @IsString()
    displayName: string

    @IsOptional()
    @IsString()
    description?: string

    @IsNotEmpty()
    @IsString()
    claimValue: string

    @IsNotEmpty()
    @IsBoolean()
    sensitive: boolean
}

export class ApplicationUpdateRolesRequest {
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({each: true})
    @Type(() => PontifexRoleDto)
    roles: PontifexRoleDto[]
}
