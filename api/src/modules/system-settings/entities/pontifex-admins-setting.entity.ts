export interface PontifexAdminsSetting {
    settingId: string;
    name: string;
    aadGroupId: string;
    aadGroupName: string;
}

export const PONTIFEX_ADMINS_SETTING_ID = 'setting-pontifex-admins';
export const PONTIFEX_ADMINS_GROUP_NAME = 'Pontifex_Admins';

export function PontifexAdminsSettingFromGremlin(vertex: any): PontifexAdminsSetting {
    return {
        settingId: vertex['id'],
        name: vertex['properties']['name'][0]['value'],
        aadGroupId: vertex['properties']['aadGroupId'][0]['value'],
        aadGroupName: vertex['properties']['aadGroupName'][0]['value'],
    };
}
