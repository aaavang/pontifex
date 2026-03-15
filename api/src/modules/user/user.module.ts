import {forwardRef, Module} from '@nestjs/common';
import {GremlinModule} from "../gremlin/gremlin.module";
import {PermissionRequestModule} from "../permission-request/permission-request.module";
import {UserController} from "./user.controller";
import {UserService} from "./user.service";

@Module({
            imports: [GremlinModule, forwardRef(() => PermissionRequestModule)],
            providers: [UserService],
            controllers: [UserController],
            exports: [UserService]
        })
export class UserModule {
}
