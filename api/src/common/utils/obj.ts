export function omit(obj: any, ...fields: string[]): any {
    const ret = {}
    for (const [k, v] of Object.entries(obj)) {
        if (!(fields.includes(k))) {
            ret[k] = v
        }
    }
    return ret
}

export function mapToObject(obj) {
    if (obj instanceof Map) {
        const plain = {};
        for (const [key, value] of obj.entries()) {
            const normalizedKey = normalizeKey(key);
            plain[normalizedKey] = mapToObject(value);
        }
        return plain;
    } else if (Array.isArray(obj)) {
        return obj.map(mapToObject);
    }
    return obj;
}

function normalizeKey(key) {
    if (typeof key === 'object' && key.elementName) {
        return key.elementName; // For EnumValue keys like T.id, T.label
    }
    return String(key);
}