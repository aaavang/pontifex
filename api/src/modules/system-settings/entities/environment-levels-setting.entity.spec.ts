import { EnvironmentLevelsSettingFromGremlin } from './environment-levels-setting.entity';

describe('EnvironmentLevelsSettingFromGremlin', () => {
  it('should parse a Gremlin vertex into an EnvironmentLevelsSetting', () => {
    const vertex = {
      id: 'setting-environment-levels',
      properties: {
        name: [{ value: 'environment-levels' }],
        levels: [
          { value: 'dev' },
          { value: 'test' },
          { value: 'qa' },
          { value: 'prod' },
        ],
      },
    };

    const result = EnvironmentLevelsSettingFromGremlin(vertex);

    expect(result).toEqual({
      settingId: 'setting-environment-levels',
      name: 'environment-levels',
      levels: ['dev', 'test', 'qa', 'prod'],
    });
  });
});
