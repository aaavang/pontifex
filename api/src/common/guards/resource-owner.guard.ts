import {CanActivate, ExecutionContext, Injectable, Logger} from "@nestjs/common";
import {Observable} from "rxjs";
import {Reflector} from "@nestjs/core";
import {RequireResourceOwner} from "../decorators/resource-owner.decorator";

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
    private readonly logger = new Logger(ResourceOwnerGuard.name);
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const props = this.reflector.get(RequireResourceOwner, context.getHandler())
        if(!props) {
            return true
        }

        const request = context.switchToHttp().getRequest()
        const resourceId = request.params[props.queryParameterKey]
        const user = request.user

        this.logger.log(`validation ${user.id} owns ${props.resourceType} ${resourceId}`)
        switch (props.resourceType) {
            case "APPLICATION":
            case "ENVIRONMENT":
            case "PERMISSION_REQUEST":
            default:
                return true
        }
    }
}