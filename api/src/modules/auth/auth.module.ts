import {Module} from '@nestjs/common';
import {PassportModule} from '@nestjs/passport';
import {AzureAdStrategy} from '../../common/strategies/azure-ad.strategy';

@Module({
            imports: [PassportModule.register({session: true})],
            providers: [AzureAdStrategy],
            exports: [],
        })
export class AuthModule {
}
