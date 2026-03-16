import {CanActivate, ExecutionContext, ForbiddenException, Injectable} from '@nestjs/common';
import {PontifexIdentity} from '../types/identity';

@Injectable()
export class AdminRoleGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const identity = request.user as PontifexIdentity;

        const roles: string[] = identity?.roles ?? [];
        if (!roles.includes('Admin')) {
            throw new ForbiddenException('Admin role required');
        }

        return true;
    }
}
