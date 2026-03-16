import {Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {AdminRoleGuard} from "../../common/guards/admin-role.guard";
import {GremlinService} from "../gremlin/gremlin.service";
import {mapToObject} from "../../common/utils/obj";

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(AdminRoleGuard)
export class AdminController {
    constructor(private readonly gremlinService: GremlinService) {}

    @Post('gremlin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({summary: 'Execute a raw Gremlin query'})
    @ApiResponse({status: 200, description: 'Query results'})
    async executeGremlin(@Body() body: { query: string }) {
        const result = await this.gremlinService.submit(body.query);
        const items = result._items.map((item: any) => {
            if (item instanceof Map) {
                return mapToObject(item);
            }
            return item;
        });
        return {items};
    }

    @Get('graph')
    @ApiOperation({summary: 'Get vertices and their connecting edges for graph visualization'})
    @ApiResponse({status: 200, description: 'Vertices and edges'})
    async getGraph(@Query('type') type?: string, @Query('limit') limit?: string) {
        const vertexLimit = Math.min(Number(limit) || 100, 500);

        // Fetch vertices
        const vertexQuery = type
            ? `g.V().has('type', type).limit(${vertexLimit})`
            : `g.V().limit(${vertexLimit})`;
        const vertexResult = await this.gremlinService.submit(vertexQuery, type ? {type} : {});
        const vertices = vertexResult._items;

        // Collect vertex IDs
        const vertexIds = vertices.map((v: any) => v.id);

        // Fetch all edges between these vertices
        let edges: any[] = [];
        if (vertexIds.length > 0) {
            const edgeResult = await this.gremlinService.submit(
                `g.V(ids).bothE().where(otherV().hasId(within(ids)))`,
                {ids: vertexIds},
            );
            edges = edgeResult._items;
        }

        return {vertices, edges};
    }
}
