import { Module } from '@nestjs/common';
import {PasswordService} from "./password.service";
import {GremlinModule} from "../gremlin/gremlin.module";

@Module({
    imports: [GremlinModule],
    providers: [PasswordService],
    exports: [PasswordService]
})
export class PasswordModule {}
