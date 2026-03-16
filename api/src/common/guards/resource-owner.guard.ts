import {CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger} from "@nestjs/common";
import {ModuleRef, Reflector} from "@nestjs/core";
import {RequireResourceOwner, ResourceType} from "../decorators/resource-owner.decorator";
import {PontifexIdentity} from "../types/identity";
import {ApplicationService} from "../../modules/application/application.service";
import {EnvironmentService} from "../../modules/environment/environment.service";
import {PermissionRequestService} from "../../modules/permission-request/permission-request.service";

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
    private readonly logger = new Logger(ResourceOwnerGuard.name);
    constructor(private reflector: Reflector,
                private readonly moduleRef: ModuleRef) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const props = this.reflector.get(RequireResourceOwner, context.getHandler())
        if(!props) {
            return true
        }

        const request = context.switchToHttp().getRequest()
        const resourceId = request.params[props.queryParameterKey]
        const identity = request.user as PontifexIdentity;

        if (!identity || !resourceId) {
            throw new ForbiddenException('Missing identity or resource ID');
        }

        const isOwner = await this.checkOwnership(identity.id, props.resourceType, resourceId);

        if (!isOwner) {
            this.logger.warn(`Access denied: ${identity.id} (${identity.type}) does not own ${props.resourceType} ${resourceId}`);
            throw new ForbiddenException(`You do not have ownership of this ${props.resourceType.toLowerCase()}`);
        }

        this.logger.log(`Access granted: ${identity.id} (${identity.type}) owns ${props.resourceType} ${resourceId}`);
        return true;
    }

    private async checkOwnership(identityId: string, resourceType: ResourceType, resourceId: string): Promise<boolean> {
        switch (resourceType) {
            case "APPLICATION": {
                const appService = this.moduleRef.get(ApplicationService, {strict: false});
                return appService.isOwnedBy(resourceId, identityId);
            }
            case "ENVIRONMENT": {
                const envService = this.moduleRef.get(EnvironmentService, {strict: false});
                return envService.isOwnedBy(resourceId, identityId);
            }
            case "PERMISSION_REQUEST": {
                const prService = this.moduleRef.get(PermissionRequestService, {strict: false});
                return prService.isOwnedBy(resourceId, identityId);
            }
            default:
                return false;
        }
    }
}
