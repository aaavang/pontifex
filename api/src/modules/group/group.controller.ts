import {Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {GroupService} from "./group.service";

@ApiTags('groups')
@Controller('groups')
@ApiBearerAuth()
export class GroupController {
    constructor(private readonly groupService: GroupService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Create a new group'})
    @ApiResponse({status: 201, description: 'Group created successfully'})
    async createGroup(@Body() body: { name: string }, @Req() req) {
        const group = await this.groupService.create(body.name, req.user.oid);
        return {group};
    }

    @Get('search')
    @ApiOperation({summary: 'Search groups by prefix'})
    @ApiResponse({status: 200, description: 'Returns groups matching the prefix'})
    async searchGroups(@Query('prefix') prefix: string) {
        const groups = await this.groupService.searchByPrefix(prefix);
        return {groups};
    }

    @Get(':id')
    @ApiOperation({summary: 'Get group by ID'})
    @ApiResponse({status: 200, description: 'Returns the group'})
    @ApiResponse({status: 404, description: 'Group not found'})
    async getGroup(@Param('id') id: string) {
        return await this.groupService.get(id);
    }

    @Patch(':id/owners')
    @ApiOperation({summary: 'Update group owners'})
    @ApiResponse({status: 200, description: 'Group owners updated'})
    async updateOwners(@Param('id') id: string, @Body() body: { ownerIds: string[] }) {
        const bundle = await this.groupService.get(id);
        const currentOwnerIds = bundle.owners.map(o => o.id);

        const toAdd = body.ownerIds.filter(id => !currentOwnerIds.includes(id));
        const toRemove = currentOwnerIds.filter(id => !body.ownerIds.includes(id));

        for (const userId of toAdd) {
            await this.groupService.addOwner(id, userId);
        }
        for (const userId of toRemove) {
            await this.groupService.removeOwner(id, userId);
        }

        return {id};
    }

    @Patch(':id/members')
    @ApiOperation({summary: 'Update group members'})
    @ApiResponse({status: 200, description: 'Group members updated'})
    async updateMembers(@Param('id') id: string, @Body() body: { memberIds: string[] }) {
        const bundle = await this.groupService.get(id);
        const currentMemberIds = bundle.members.map(m => m.id);

        const toAdd = body.memberIds.filter(id => !currentMemberIds.includes(id));
        const toRemove = currentMemberIds.filter(id => !body.memberIds.includes(id));

        for (const userId of toAdd) {
            await this.groupService.addMember(id, userId);
        }
        for (const userId of toRemove) {
            await this.groupService.removeMember(id, userId);
        }

        return {id};
    }

    @Post(':id/members/:userId')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Add a member to a group'})
    @ApiResponse({status: 201, description: 'Member added'})
    async addMember(@Param('id') id: string, @Param('userId') userId: string) {
        await this.groupService.addMember(id, userId);
        return {id, userId};
    }

    @Delete(':id/members/:userId')
    @ApiOperation({summary: 'Remove a member from a group'})
    @ApiResponse({status: 200, description: 'Member removed'})
    async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
        await this.groupService.removeMember(id, userId);
        return {id, userId};
    }

    @Delete(':id')
    @ApiOperation({summary: 'Delete a group'})
    @ApiResponse({status: 200, description: 'Group deleted'})
    @ApiResponse({status: 404, description: 'Group not found'})
    async deleteGroup(@Param('id') id: string) {
        await this.groupService.delete(id);
        return {id};
    }

    @Post(':id/sync')
    @ApiOperation({summary: 'Sync group membership from Azure AD'})
    @ApiResponse({status: 200, description: 'Group synced with Azure AD'})
    async syncGroup(@Param('id') id: string) {
        const result = await this.groupService.sync(id);
        return result;
    }
}
