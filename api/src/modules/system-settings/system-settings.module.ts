import {forwardRef, Module} from '@nestjs/common';
import {ApplicationModule} from '../application/application.module';
import {EnvironmentModule} from '../environment/environment.module';
import {GremlinModule} from '../gremlin/gremlin.module';
import {GroupModule} from '../group/group.module';
import {PontifexAadModule} from '../pontifex-aad/pontifex-aad.module';
import {TokenGroupModule} from '../token-group/token-group.module';
import {UserModule} from '../user/user.module';
import {SystemSettingsService} from './system-settings.service';

@Module({
    imports: [
        GremlinModule,
        GroupModule,
        PontifexAadModule,
        TokenGroupModule,
        forwardRef(() => ApplicationModule),
        forwardRef(() => EnvironmentModule),
        forwardRef(() => UserModule),
    ],
    providers: [SystemSettingsService],
    exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
