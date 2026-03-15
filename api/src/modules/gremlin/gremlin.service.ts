import {Injectable, OnModuleDestroy, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as Gremlin from 'gremlin';
import {mapToObject} from "../../common/utils/obj";
import {Connections, ResourceType, UpsertVertexProps} from "./entities/gremlin.entity";

@Injectable()
export class GremlinService implements OnModuleInit, OnModuleDestroy {
    private client: Gremlin.driver.Client;

    constructor(private configService: ConfigService) {
    }

    onModuleInit() {
        try {
            // const authenticator = new Gremlin.driver.auth.PlainTextSaslAuthenticator(
            //     `/dbs/${this.configService.get<string>('PONTIFEX_DATABASE_NAME')}/colls/${this.configService.get<string>('PONTIFEX_COLLECTION_NAME')}`,
            //     this.configService.get<string>('PONTIFEX_DATABASE_PRIMARY_KEY')!
            // );

            this.client = new Gremlin.driver.Client(
                this.configService.get<string>('PONTIFEX_DATABASE_ENDPOINT')!,
                {
                    // authenticator,
                    traversalsource: 'g',
                    rejectUnauthorized: true,
                    mimeType: 'application/vnd.graphbinary-v1.0',
                }
            );
        } catch (e) {
            console.error('Failed to instantiate GremlinClient', e);
            this.client = {
                submit: () => {
                },
                close: () => {
                }
            } as any
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.close();
        }
    }

    expandGremlinQuerySafe(
        query: string,
        bindings: Record<string, any>
    ): string {
        // Single-pass regex: match string literals (to skip them) or
        // word-boundary-delimited identifiers (to replace if they're bindings).
        // Process longest keys first to avoid partial replacements.
        const keys = Object.keys(bindings).sort((a, b) => b.length - a.length);
        const keyPattern = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

        if (!keyPattern) return query;

        const pattern = new RegExp(
            `'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'|"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|\\b(${keyPattern})\\b`,
            'g',
        );

        return query.replace(pattern, (match, binding) => {
            if (binding === undefined) return match; // string literal — pass through

            const value = bindings[binding];
            if (typeof value === 'string') {
                return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
            } else if (Array.isArray(value)) {
                return `[${value.map(v => JSON.stringify(v)).join(', ')}]`;
            }
            return String(value);
        });
    }

    async submit(query: string, bindings: Record<string, any> = {}) {
        let response = await this.client.submit(this.expandGremlinQuerySafe(query, bindings));
        // console.log("Gremlin query executed:", query);
        // console.log("Bindings:", bindings);
        // if (response) {
        //     console.log("Response items:", response);
        // } else {
        //     console.log("No items in response");
        // }
        return response;
    }

    async getAllChildrenOfTypeWithGrandchildren<T>(
        id: string,
        pk: string,
        type: string,
        direction: "in" | "out" | string,
        edgeLabels: string[],
        secondStageLabels: string[],
        firstStepLabels?: string[]
    ): Promise<T[]> {
        const fsLabels = firstStepLabels?.map((_, i) => `fslabel${i}`).join(",");

        const labels = edgeLabels.map((_, i) => `label${i}`).join(",");

        const secondStageLabelsString = secondStageLabels
            .map((_, i) => `secondStageLabel${i}`)
            .join(",");

        const query = `
        g.V(vid).has('pk', pk)
        ${firstStepLabels ? `.out(${fsLabels})` : ""}
        .repeat(__.${direction}(${labels}))
        .until(has('type', type)).bothE(${secondStageLabelsString},${labels}).group().by(label).by(inV().group().by('type').by(fold()))
      `;

        const bindings = {
            vid: id,
            pk,
            type,
        };

        firstStepLabels?.forEach((label, i) => {
            const key = `fslabel${i}`;
            bindings[key] = label;
        });

        secondStageLabels?.forEach((label, i) => {
            const key = `secondStageLabel${i}`;
            bindings[key] = label;
        });

        edgeLabels.forEach((label, i) => {
            const key = `label${i}`;
            bindings[key] = label;
        });

        const result = await this.submit(query, bindings);

        return result._items[0];
    }

    // Utility methods for working with Gremlin
    async upsertVertex<T>(props: UpsertVertexProps<T>) {
        const defaultPropertiesMapping = this.mapProperties(props.defaultProperties);
        const updatedPropertiesMapping = this.mapProperties(props.updatedProperties);

        const bindings = {
            vid: props.id,
            pk: props.pk,
            ...defaultPropertiesMapping.propertyBindings,
            ...updatedPropertiesMapping.propertyBindings,
        };

        const query = `
      g.V(vid).has('pk', pk)
      .fold()
      .coalesce(
          unfold(),
          addV().property(T.id, vid).property('pk', pk)
          ${defaultPropertiesMapping.propertyString}
      )
      ${updatedPropertiesMapping.propertyString}
    `;
        const result = await this.submit(query, bindings);
        return result._items[0];
    }

    async upsertEdge(edge: {
        label: string;
        sourceVertexId: string;
        sourceVertexPk: string;
        destinationVertexId: string;
        destinationVertexPk: string;
        properties?: Record<string, any>;
    }) {
        const edgeId = `${edge.sourceVertexId}.${edge.sourceVertexPk}-${edge.label}-${edge.destinationVertexId}.${edge.destinationVertexPk}`;

        const {propertyString, propertyBindings} = this.mapProperties(edge.properties);

        const bindings = {
            edgeId,
            edgeLabel: edge.label,
            sourceVertexId: edge.sourceVertexId,
            sourceVertexPk: edge.sourceVertexPk,
            destinationVertexId: edge.destinationVertexId,
            destinationVertexPk: edge.destinationVertexPk,
            ...propertyBindings,
        };

        const query = `
      g.E(edgeId)
      .fold()
      .coalesce(
          unfold(),
          __.V(sourceVertexId).has('pk', sourceVertexPk).as('source')
          .V(destinationVertexId).has('pk', destinationVertexPk)
          .addE(edgeLabel).from('source').property(T.id, edgeId))
      ${propertyString}
    `;

        const result = await this.submit(query, bindings);
        return result._items[0];
    }

    async getVertex(id: string, pk: string) {
        const bindings = {vid: id, pk};
        const query = "g.V(vid).has('pk', pk)";
        const result = await this.submit(query, bindings);
        return result._items[0];
    }

    async getAllVerticesOfType(type: string) {
        const binding = {type};
        const query = "g.V().has('type', type)";
        const result = await this.submit(query, binding);
        return result._items;
    }

    async getAllChildrenOfType<T>(
        vid: string,
        pk: string,
        type: string,
        outboundLabels: string[],
        firstStepLabels?: string[]
    ): Promise<T[]> {
        const fsLabels = firstStepLabels?.map((_, i) => `fslabel${i}`).join(",");

        const labels = outboundLabels.map((_, i) => `label${i}`).join(",");

        const query = `
        g.V(vid).has('pk', pk)
        ${firstStepLabels ? `.out(${fsLabels})` : ""}
        .repeat(out(${labels}))
        .until(has('type', type))
      `;

        const bindings = {
            vid,
            pk,
            type,
        };

        firstStepLabels?.forEach((label, i) => {
            const key = `fslabel${i}`;
            bindings[key] = label;
        });

        outboundLabels.forEach((label, i) => {
            const key = `label${i}`;
            bindings[key] = label;
        });

        const result = await this.submit(query, bindings);

        return result._items;
    }

    async getVertexAndChildren<T>(id: string, pk: string, type: string): Promise<{
        vertex: T;
        connections: Connections
    }> {
        const vertex = await this.getVertex(id, pk);
        const bindings = {vid: id, pk, type};
        const query = `
      g.V(vid).has('pk', pk).has('type', type)
      .outE().group().by(label).by(inV().group().by('type').by(fold()))
    `;
        const result = await this.submit(query, bindings);
        const arr = await result.toArray();
        const connections = mapToObject(arr[0]);
        return {vertex, connections};
    }

    async dropVertex(vid: string, type: ResourceType) {
        await this.submit("g.V(vid).has('type', type).drop()", {vid, type});
    }

    async dropEdge(eid: string) {
        await this.submit("g.E(eid).drop()", {eid});
    }

    // Helper methods
    private mapProperties(properties: Record<string, any> = {}) {
        if (!properties || Object.keys(properties).length === 0) {
            return {
                propertyString: '',
                propertyBindings: {},
            };
        }

        const {dropPropertyString, dropBindings} = this.getDropStatements(properties);
        const {addPropertyString, addBindings} = this.getAddStatements(properties);

        return {
            propertyString: dropPropertyString + addPropertyString,
            propertyBindings: {
                ...dropBindings,
                ...addBindings,
            },
        };
    }

    private getDropStatements(properties: Record<string, any>) {
        let dropPropertyString = '';
        const dropBindings: Record<string, string> = {};

        for (const [key, value] of Object.entries(properties)) {
            if (Array.isArray(value)) {
                const dropBindingKey = `drop${key}`;
                dropBindings[dropBindingKey] = key;
                dropPropertyString += `.sideEffect(properties(${dropBindingKey}).drop())`;
            }
        }

        return {
            dropPropertyString,
            dropBindings,
        };
    }

    private getAddStatements(properties: Record<string, any>) {
        let addPropertyString = '';
        const addBindings: Record<string, string> = {};

        for (const [key, value] of Object.entries(properties)) {
            addBindings[key] = key;

            if (Array.isArray(value)) {
                for (const [index, val] of value.entries()) {
                    const valueBindingKey = `${key}${index}`;
                    addBindings[valueBindingKey] = val;
                    addPropertyString += `.property(Cardinality.list, ${key}, ${valueBindingKey})`;
                }
            } else {
                const valueBindingKey = `${key}0`;
                addBindings[valueBindingKey] = value;
                addPropertyString += `.property(Cardinality.single, ${key}, ${valueBindingKey})`;
            }
        }

        return {
            addPropertyString,
            addBindings,
        };
    }
}