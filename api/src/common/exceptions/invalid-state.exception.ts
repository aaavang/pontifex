import {HttpException, HttpStatus} from "@nestjs/common";

export class InvalidStateException extends HttpException {
    constructor(message: string) {
        super(message, HttpStatus.CONFLICT);
        this.name = 'InvalidStateException'
    }
}