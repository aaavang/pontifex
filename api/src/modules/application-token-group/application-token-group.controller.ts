import {
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards
} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {ResourceOwnerGuard} from "../../common/guards/resource-owner.guard";
import {ApplicationService} from "../application/application.service";
import {GremlinService} from "../gremlin/gremlin.service";
import {CreateTokenGroupDto, TokenGroupService} from "../token-group/token-group.service";

@ApiTags('application-token-groups')
@Controller('applications/:appId/token-groups')
@UseGuards(ResourceOwnerGuard)
@ApiBearerAuth()
export class ApplicationTokenGroupController {
    constructor(
        private readonly applicationService: ApplicationService,
        private readonly tokenGroupService: TokenGroupService,
        private readonly gremlinService: GremlinService,
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Create a token group for all environments of an application'})
    @ApiResponse({status: 201, description: 'Token group created successfully'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async create(
        @Param('appId') appId: string,
        @Body() body: CreateTokenGroupDto,
    ) {
        const appBundle = await this.applicationService.get(appId);

        const results: any[] = [];
        for (const env of appBundle.environments) {
            const tokenGroup = await this.tokenGroupService.create(env.id, env.clientId, body);
            results.push(tokenGroup);
        }

        return {tokenGroups: results};
    }

    @Patch(':id')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Update a token group description'})
    @ApiResponse({status: 201, description: 'Token group updated successfully'})
    async update(
        @Param('appId') appId: string,
        @Param('id') id: string,
        @Body() body: { description: string },
    ) {
        await this.gremlinService.upsertVertex({
            id,
            pk: id,
            updatedProperties: {
                description: body.description,
            },
        });

        return {id};
    }

    @Delete()
    @ApiOperation({summary: 'Delete a token group by name'})
    @ApiResponse({status: 200, description: 'Token group deleted successfully'})
    async remove(
        @Param('appId') appId: string,
        @Body() body: { name: string },
    ) {
        const result = await this.gremlinService.submit(
            "g.V().has('type', type).has('name', name)",
            {type: 'tokenGroup', name: body.name},
        );

        for (const vertex of result._items) {
            await this.gremlinService.dropVertex(vertex.id, 'tokenGroup');
        }

        return {name: body.name};
    }
}
