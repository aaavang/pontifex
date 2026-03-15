export interface EnvironmentLevelsSetting {
    settingId: string;
    name: string;
    levels: string[];
}

export const ENVIRONMENT_LEVELS_SETTING_ID = 'setting-environment-levels';
export const DEFAULT_ENVIRONMENT_LEVELS = ['dev', 'test', 'qa', 'prod'];

export function EnvironmentLevelsSettingFromGremlin(vertex: any): EnvironmentLevelsSetting {
    return {
        settingId: vertex['id'],
        name: vertex['properties']['name'][0]['value'],
        levels: vertex['properties']['levels'].map((l: any) => l['value']),
    };
}
