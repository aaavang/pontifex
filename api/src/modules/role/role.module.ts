import {Module} from '@nestjs/common';
import {GremlinModule} from "../gremlin/gremlin.module";
import {RoleController} from "./role.controller";
import {RoleService} from "./role.service";

@Module({
            imports: [GremlinModule],
            providers: [RoleService],
            controllers: [RoleController],
            exports: [RoleService]
        })
export class RoleModule {
}
