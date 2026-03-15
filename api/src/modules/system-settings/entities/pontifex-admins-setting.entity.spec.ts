import { PontifexAdminsSettingFromGremlin } from './pontifex-admins-setting.entity';

describe('PontifexAdminsSettingFromGremlin', () => {
  it('should parse a Gremlin vertex into a PontifexAdminsSetting', () => {
    const vertex = {
      id: 'setting-pontifex-admins',
      properties: {
        name: [{ value: 'Pontifex_Admins' }],
        aadGroupId: [{ value: 'aad-object-id-123' }],
        aadGroupName: [{ value: 'Pontifex_Admins' }],
      },
    };

    const result = PontifexAdminsSettingFromGremlin(vertex);

    expect(result).toEqual({
      settingId: 'setting-pontifex-admins',
      name: 'Pontifex_Admins',
      aadGroupId: 'aad-object-id-123',
      aadGroupName: 'Pontifex_Admins',
    });
  });
});
