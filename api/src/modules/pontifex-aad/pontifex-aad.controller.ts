import {Group} from "@microsoft/microsoft-graph-types";
import {Controller, Get, Query} from "@nestjs/common";
import {ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {PontifexAadService} from "./pontifex-aad.service";

@ApiTags('pontifex-aad')
@Controller('pontifex-aad')
export class PontifexAadController {
    constructor(private readonly pontifexAadService: PontifexAadService) {
    }

    @Get('/groups')
    @ApiOperation({summary: 'Get role by ID'})
    @ApiResponse({status: 200, description: 'Get role by ID'})
    @ApiResponse({status: 404, description: 'Role not found'})
    async getAllGroups(): Promise<Group[]> {
        return await this.pontifexAadService.Instance.group.getAll()
    }

    @Get('/groups/search')
    @ApiOperation({summary: 'Search AAD groups by prefix'})
    @ApiResponse({status: 200, description: 'Returns AAD groups matching the prefix'})
    async searchApplications(@Query('prefix') prefix: string): Promise<Group[]> {
        return await this.pontifexAadService.Instance.group.searchByPrefix(prefix);
    }
}