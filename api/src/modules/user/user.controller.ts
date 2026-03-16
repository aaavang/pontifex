import {Controller, Get, Put, Query, Req} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {PermissionRequestService} from "../permission-request/permission-request.service";
import {PontifexUser} from "./entities/user.entity";
import {UserService} from "./user.service";

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
    constructor(private readonly userService: UserService,
                private readonly permissionRequestService: PermissionRequestService) {
    }

    @Put('create')
    @ApiOperation({summary: 'Create a new user'})
    @ApiResponse({status: 200, description: 'User created successfully'})
    @ApiResponse({status: 400, description: 'Bad request'})
    async createUser(@Req() req) {
        const jwtToken = req.user; // Assuming the JWT token is attached to the request object
        const user: PontifexUser = {
            id: jwtToken.oid as string,
            name: jwtToken.name as string ?? jwtToken.oid as string,
            normalizedName: (jwtToken.name as string ?? jwtToken.oid as string).toLowerCase(),
            email: jwtToken.preferred_username as string ?? ""
        }

        const createdUser = await this.userService.update(user)
        return {
            user: createdUser
        }
    }

    @Get('me')
    @ApiOperation({summary: 'Get current user'})
    @ApiResponse({status: 200, description: 'Returns the current user'})
    async getCurrentUser(@Req() req) {
        const jwtToken = req.user; // Assuming the JWT token is attached to the request object
        const userId = jwtToken.oid as string;

        const bundle = await this.userService.get(userId);

        return {bundle}
    }

    @Get('me/permission-requests/pending')
    @ApiOperation({summary: 'Get pending permission requests for current user'})
    @ApiResponse({status: 200, description: 'Returns pending permission requests'})
    async getPendingPermissionRequests(@Req() req) {
        const jwtToken = req.user; // Assuming the JWT token is attached to the request object
        const userId = jwtToken.oid as string;

        return await this.permissionRequestService.getPendingForUser(req.user.oid)
    }

    @Get('search')
    @ApiOperation({summary: 'Search users by prefix'})
    @ApiResponse({status: 200, description: 'Returns users matching the prefix'})
    async searchUsers(@Query('prefix') prefix: string) {
        const users = await this.userService.searchByPrefix(prefix);
        return {users};
    }

    @Get(':id')
    @ApiOperation({summary: 'Get user by ID'})
    @ApiResponse({status: 200, description: 'Returns the user'})
    @ApiResponse({status: 404, description: 'User not found'})
    async getUserById(@Req() req) {
        const userId = req.params.id;

        const bundle = await this.userService.get(userId);

        return {bundle};
    }
}