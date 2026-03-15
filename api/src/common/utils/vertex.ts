export function vertexToObject(vertex: any): Record<string, any> {
    if (!vertex || typeof vertex !== 'object') {
        return {};
    }

    const {id, label, properties} = vertex;
    const result: Record<string, any> = {id, label};

    if (Array.isArray(properties)) {
        for (const prop of properties) {
            if (prop && prop.key && prop.value !== undefined) {
                result[prop.key] = prop.value;
            }
        }
    }

    return result;
}