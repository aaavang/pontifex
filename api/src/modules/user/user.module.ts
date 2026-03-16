import {Module} from '@nestjs/common';
import {GremlinModule} from "../gremlin/gremlin.module";
import {PermissionRequestModule} from "../permission-request/permission-request.module";
import {UserController} from "./user.controller";
import {UserService} from "./user.service";

@Module({
            imports: [GremlinModule, PermissionRequestModule],
            providers: [UserService],
            controllers: [UserController],
            exports: [UserService]
        })
export class UserModule {
}
