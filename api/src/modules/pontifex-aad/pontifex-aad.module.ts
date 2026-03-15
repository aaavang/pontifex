import {Module} from '@nestjs/common';
import {PontifexAadController} from "./pontifex-aad.controller";
import {PontifexAadService} from "./pontifex-aad.service";

@Module({
            providers: [PontifexAadService],
            exports: [PontifexAadService],
            controllers: [PontifexAadController],
        })
export class PontifexAadModule {
}
