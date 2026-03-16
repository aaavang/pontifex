import {Module} from '@nestjs/common';
import {ApplicationModule} from '../application/application.module';
import {GremlinModule} from '../gremlin/gremlin.module';
import {TokenGroupModule} from '../token-group/token-group.module';
import {ApplicationTokenGroupController} from './application-token-group.controller';

@Module({
    imports: [ApplicationModule, TokenGroupModule, GremlinModule],
    controllers: [ApplicationTokenGroupController],
})
export class ApplicationTokenGroupModule {}
