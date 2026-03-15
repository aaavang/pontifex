import {Module} from '@nestjs/common';
import {GremlinModule} from '../gremlin/gremlin.module';
import {PontifexAadModule} from '../pontifex-aad/pontifex-aad.module';
import {GroupController} from './group.controller';
import {GroupService} from './group.service';

@Module({
    imports: [GremlinModule, PontifexAadModule],
    controllers: [GroupController],
    providers: [GroupService],
    exports: [GroupService],
})
export class GroupModule {}
