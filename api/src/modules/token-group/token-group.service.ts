import {Injectable} from "@nestjs/common";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";

@Injectable()
export class TokenGroupService {
    constructor(private readonly pontifexAadService: PontifexAadService) {
    }
}