import {Module} from '@nestjs/common';
import {GremlinModule} from '../gremlin/gremlin.module';
import {AdminController} from './admin.controller';

@Module({
    imports: [GremlinModule],
    controllers: [AdminController],
})
export class AdminModule {}
