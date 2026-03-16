import {Type} from "class-transformer";
import {IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested} from "class-validator";

export class PontifexScopeDto {
    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @IsString()
    displayName: string

    @IsOptional()
    @IsString()
    description?: string
}

export class ApplicationUpdateScopesRequest {
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => PontifexScopeDto)
    scopes: PontifexScopeDto[]
}
