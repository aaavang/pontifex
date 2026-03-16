import {Module} from '@nestjs/common';
import {ConfigModule} from "@nestjs/config";
import {APP_GUARD} from "@nestjs/core";
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AzureAdAuthGuard, AUTH_GUARD} from "./common/guards/azure-ad-auth.guard";
import {AdminModule} from "./modules/admin/admin.module";
import {ApplicationTokenGroupModule} from "./modules/application-token-group/application-token-group.module";
import {ApplicationModule} from "./modules/application/application.module";
import {AuditEventModule} from "./modules/audit-event/audit-event.module";
import {AuthModule} from "./modules/auth/auth.module";
import {EnvironmentModule} from "./modules/environment/environment.module";
import {GroupModule} from "./modules/group/group.module";
import {PasswordModule} from "./modules/password/password.module";
import {PermissionRequestModule} from "./modules/permission-request/permission-request.module";
import {RoleModule} from "./modules/role/role.module";
import {ScopeModule} from "./modules/scope/scope.module";
import {SystemSettingsModule} from "./modules/system-settings/system-settings.module";
import {UserModule} from "./modules/user/user.module";

@Module({
            imports: [ConfigModule.forRoot({isGlobal: true}),
                      AdminModule,
                      ApplicationModule,
                      ApplicationTokenGroupModule,
                      EnvironmentModule,
                      GroupModule,
                      PermissionRequestModule,
                      RoleModule,
                      ScopeModule,
                      UserModule,
                      PasswordModule,
                      GroupModule,
                      AuditEventModule,
                      AuthModule,
                      SystemSettingsModule],
            controllers: [AppController],
            providers: [
                {
                    provide: AUTH_GUARD,
                    useClass: AzureAdAuthGuard,
                },
                {
                    provide: APP_GUARD,
                    useExisting: AUTH_GUARD,
                },
                AppService],
        })
export class AppModule {
}
