import {forwardRef, Module} from '@nestjs/common';
import {EmailModule} from "../email/email.module";
import {EnvironmentModule} from "../environment/environment.module";
import {GremlinModule} from "../gremlin/gremlin.module";
import {PontifexAadModule} from "../pontifex-aad/pontifex-aad.module";
import {RoleModule} from "../role/role.module";
import {ScopeModule} from "../scope/scope.module";
import {PermissionRequestController} from "./permission-request.controller";
import {PermissionRequestService} from "./permission-request.service";

@Module({
            imports: [GremlinModule, PontifexAadModule, RoleModule, ScopeModule, EmailModule, forwardRef(() => EnvironmentModule)],
            providers: [PermissionRequestService],
            controllers: [PermissionRequestController],
            exports: [PermissionRequestService]
        })
export class PermissionRequestModule {
}
