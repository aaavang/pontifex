import {Module} from '@nestjs/common';
import {GremlinModule} from '../gremlin/gremlin.module';
import {PontifexAadModule} from '../pontifex-aad/pontifex-aad.module';
import {TokenGroupService} from './token-group.service';

@Module({
    imports: [GremlinModule, PontifexAadModule],
    providers: [TokenGroupService],
    exports: [TokenGroupService],
})
export class TokenGroupModule {}
