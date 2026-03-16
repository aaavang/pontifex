import {Module} from '@nestjs/common';
import {AuditEventModule} from "../audit-event/audit-event.module";
import {EnvironmentModule} from "../environment/environment.module";
import {GremlinModule} from "../gremlin/gremlin.module";
import {PasswordModule} from "../password/password.module";
import {PermissionRequestModule} from "../permission-request/permission-request.module";
import {PontifexAadModule} from "../pontifex-aad/pontifex-aad.module";
import {RoleModule} from "../role/role.module";
import {ScopeModule} from "../scope/scope.module";
import {ApplicationController} from "./application.controller";
import {ApplicationOrchestrationService} from "./application-orchestration.service";
import {ApplicationService} from "./application.service";

@Module({
            imports: [GremlinModule,
                      EnvironmentModule,
                      PasswordModule,
                      RoleModule,
                      ScopeModule,
                      PontifexAadModule,
                      PermissionRequestModule,
                      AuditEventModule],
            controllers: [ApplicationController],
            providers: [ApplicationService, ApplicationOrchestrationService],
            exports: [ApplicationService, ApplicationOrchestrationService]
        })
export class ApplicationModule {
}
