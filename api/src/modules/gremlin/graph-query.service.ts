import {Injectable} from '@nestjs/common';
import {PontifexApplicationFromGremlin} from '../application/entities/application.entity';
import {PontifexApplication} from '../application/entities/application.entity';
import {GremlinService} from './gremlin.service';

@Injectable()
export class GraphQueryService {
    constructor(private readonly gremlinService: GremlinService) {}

    /**
     * Returns all applications a user has access to:
     * - directly owned by the user
     * - owned by groups the user owns
     * - owned by groups the user is a member of
     */
    async getApplicationsForUser(userId: string): Promise<PontifexApplication[]> {
        if (!userId) {
            throw new Error('userId cannot be empty or undefined');
        }

        const query = 'g.V(vid).union(fold().unfold(), out("owns").has("type", "group"), out("member of")).out("owns").has("type", "application").dedup()';
        const result = await this.gremlinService.submit(query, {vid: userId});
        return result._items.map(PontifexApplicationFromGremlin);
    }
}
