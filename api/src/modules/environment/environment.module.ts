import {Module} from '@nestjs/common';
import {AuditEventModule} from "../audit-event/audit-event.module";
import {GremlinModule} from "../gremlin/gremlin.module";
import {PasswordModule} from "../password/password.module";
import {PermissionRequestModule} from "../permission-request/permission-request.module";
import {PontifexAadModule} from "../pontifex-aad/pontifex-aad.module";
import {RoleModule} from "../role/role.module";
import {ScopeModule} from "../scope/scope.module";
import {UserModule} from "../user/user.module";
import {EnvironmentController} from "./environment.controller";
import {EnvironmentService} from "./environment.service";

@Module({
            imports: [PasswordModule,
                      GremlinModule,
                      PontifexAadModule,
                      RoleModule,
                      ScopeModule,
                      PermissionRequestModule,
                      UserModule,
                      AuditEventModule],
            controllers: [EnvironmentController],
            providers: [EnvironmentService],
            exports: [EnvironmentService]
        })
export class EnvironmentModule {
}
