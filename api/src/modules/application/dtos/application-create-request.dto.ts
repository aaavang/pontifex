import {Type} from "class-transformer";
import {ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString} from "class-validator";

export class CreateApplicationRequest {
    @IsNotEmpty()
    @IsString()
    applicationName: string;

    @IsArray()
    @ArrayNotEmpty()
    @Type(() => String)
    environments: string[];

    @IsOptional()
    @IsString()
    description?: string;
}