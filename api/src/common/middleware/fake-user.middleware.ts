import {Injectable, NestMiddleware} from "@nestjs/common";
import {NextFunction} from "express";

type ExtendedRequest = Request & { user: any}

@Injectable()
export class FakeUserMiddleware implements NestMiddleware {
    use(req: ExtendedRequest, res: Response, next: NextFunction) {
        req.user = {id: 'fake-user-id'}
        next();
    }
}

export function fakeUserMiddleware(req: ExtendedRequest, res: Response, next: NextFunction) {
    req.user = {id: 'fake-user-id'}
    next();
}