import {Injectable} from "@nestjs/common";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";

@Injectable()
export class GroupService {
    constructor(private readonly pontifexAadService: PontifexAadService) {
    }

}