import {Controller, Get, Param, UseGuards} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {ResourceOwnerGuard} from "../../common/guards/resource-owner.guard";
import {RoleService} from "./role.service";

@ApiTags('roles')
@Controller('roles')
@UseGuards(ResourceOwnerGuard)
@ApiBearerAuth()
export class RoleController {
    constructor(private readonly roleService: RoleService) {
    }

    @Get(':id')
    @ApiOperation({summary: 'Get role by ID'})
    @ApiResponse({status: 200, description: 'Get role by ID'})
    @ApiResponse({status: 404, description: 'Role not found'})
    async getRoleById(@Param('id') id: string): Promise<any> {
        return await this.roleService.get(id)
    }

    @Get(':id/owners')
    @ApiOperation({summary: 'Get owners of a role by ID'})
    @ApiResponse({status: 200, description: 'Get owners of a role by ID'})
    @ApiResponse({status: 404, description: 'Role not found'})
    async getRoleOwnersById(@Param('id') id: string): Promise<any> {
        return {owners: await this.roleService.getOwners(id)}
    }
}