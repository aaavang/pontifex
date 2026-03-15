import {Injectable} from '@nestjs/common';
import {ConfigService} from "@nestjs/config";
import {PassportStrategy} from '@nestjs/passport';
import {BearerStrategy} from 'passport-azure-ad';

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

    async validate(token: any): Promise<any> {
        // token contains JWT claims
        return token;
    }
}
