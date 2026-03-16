import {Body, Controller, Get, Param, Patch, UseGuards} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {ResourceOwnerGuard} from "../../common/guards/resource-owner.guard";
import {PatchPermissionRequestStatusRequest} from "./dtos/patch-status.dto";
import {PermissionRequestService} from "./permission-request.service";

@ApiTags('permission-requests')
@Controller('permission-requests')
@UseGuards(ResourceOwnerGuard)
@ApiBearerAuth()
export class PermissionRequestController {
    constructor(private readonly permissionRequestService: PermissionRequestService) {
    }

    @Get(':id')
    @ApiOperation({summary: 'Get permission request by ID'})
    @ApiResponse({status: 200, description: 'Get permission request by ID'})
    @ApiResponse({status: 404, description: 'Permission request not found'})
    async getPermissionRequestById(@Param('id') id: string): Promise<any> {
        return this.permissionRequestService.get(id);
    }

    @Patch(':id')
    @ApiOperation({summary: 'Update permission request by ID'})
    @ApiResponse({status: 200, description: 'Permission request updated successfully'})
    @ApiResponse({status: 404, description: 'Permission request not found'})
    async updatePermissionRequest(@Param('id') id: string,
                                  @Body() updateData: PatchPermissionRequestStatusRequest): Promise<any> {
        return await this.permissionRequestService.updateStatus(id, updateData.status);
    }
}