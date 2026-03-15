import {Injectable} from "@nestjs/common";
import {PontifexAAD} from "./pontifex-aad";

@Injectable()
export class PontifexAadService {
    private _instance: PontifexAAD;

    constructor() {
        this._instance = new PontifexAAD();
    }

    public get Instance() {
        return this._instance || (this._instance = new PontifexAAD());
    }
}