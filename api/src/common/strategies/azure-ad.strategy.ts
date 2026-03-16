import {Injectable, UnauthorizedException} from '@nestjs/common';
import {ConfigService} from "@nestjs/config";
import {PassportStrategy} from '@nestjs/passport';
import {BearerStrategy} from 'passport-azure-ad';
import {PontifexIdentity} from '../types/identity';

@Injectable()
export class AzureAdStrategy extends PassportStrategy(BearerStrategy, 'azure-ad') {
    constructor(private readonly configService: ConfigService) {
        const tenantId = configService.get<string>('PONTIFEX_TENANT_ID');
        const clientId = configService.get<string>('PONTIFEX_CLIENT_ID');

        if (!tenantId) {
            throw new Error('Missing tenantId in configuration');
        }
        if (!clientId) {
            throw new Error('Missing clientId in configuration');
        }

        super({
                  identityMetadata: `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
                  clientID: clientId,
                  audience: clientId,
                  validateIssuer: true,
                  loggingLevel: 'info',
                  passReqToCallback: false,
              });
    }

    async validate(token: any): Promise<PontifexIdentity> {
        const isAppToken = (token.azp || token.appid) && !token.preferred_username && !token.scp;

        if (isAppToken) {
            const roles: string[] = token.roles ?? [];
            if (!roles.includes('ProgrammaticAccess')) {
                throw new UnauthorizedException('Service principal lacks ProgrammaticAccess role');
            }

            return {
                id: token.oid,
                name: token.azp ?? token.appid ?? token.oid,
                email: '',
                type: 'application',
                roles,
                clientId: token.azp ?? token.appid,
            };
        }

        return {
            id: token.oid,
            name: token.name ?? token.oid,
            email: token.preferred_username ?? '',
            type: 'user',
            roles: token.roles ?? [],
        };
    }
}
