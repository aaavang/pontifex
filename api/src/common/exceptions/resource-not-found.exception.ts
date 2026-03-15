import {HttpException, HttpStatus} from "@nestjs/common";

export class ResourceNotFoundException extends HttpException {
    constructor(resourceType: string) {
        super(`${resourceType} not found`, HttpStatus.NOT_FOUND);
        this.name = 'ResourceNotFoundException'
    }
}