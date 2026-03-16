import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ApplicationService} from '../application/application.service';
import {EnvironmentService} from '../environment/environment.service';
import {GremlinService} from '../gremlin/gremlin.service';
import {GroupService} from '../group/group.service';
import {PontifexAadService} from '../pontifex-aad/pontifex-aad.service';
import {TokenGroupService} from '../token-group/token-group.service';
import {UserService} from '../user/user.service';
import {SYSTEM_SETTINGS_BASE_ID} from './entities/system-settings-base.entity';
import {PONTIFEX_ADMINS_GROUP_NAME, PONTIFEX_ADMINS_SETTING_ID} from './entities/pontifex-admins-setting.entity';
import {DEFAULT_ENVIRONMENT_LEVELS, ENVIRONMENT_LEVELS_SETTING_ID} from './entities/environment-levels-setting.entity';
import {
    PONTIFEX_ADMIN_TOKEN_GROUP_ID,
    PONTIFEX_APP_ID,
    PONTIFEX_APP_NAME,
    PONTIFEX_MANAGED_TAG,
} from './entities/pontifex-app-setting.entity';

@Injectable()
export class SystemSettingsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SystemSettingsService.name);

    constructor(
        private readonly gremlinService: GremlinService,
        private readonly applicationService: ApplicationService,
        private readonly environmentService: EnvironmentService,
        private readonly groupService: GroupService,
        private readonly pontifexAadService: PontifexAadService,
        private readonly configService: ConfigService,
        private readonly tokenGroupService: TokenGroupService,
        private readonly userService: UserService,
    ) {}

    async onApplicationBootstrap() {
        try {
            await this.ensureSystemSettingsBase();
            await this.ensureSystemUser();
            const adminGroupId = await this.ensurePontifexAdminsGroup();
            await this.ensureEnvironmentLevels();
            await this.ensurePontifexApplication(adminGroupId);
        } catch (error) {
            this.logger.error('Failed to initialize system settings', error);
        }
    }

    private async ensureSystemUser() {
        await this.userService.update({
            id: 'system',
            name: 'System',
            email: '',
            normalizedName: 'system',
        });
    }

    private async ensurePontifexAdminsGroup(): Promise<string> {
        const {group, aadGroupId} = await this.groupService.ensureGroup(
            PONTIFEX_ADMINS_GROUP_NAME,
            'Pontifex administrators group',
        );

        // Store admin group reference as a system setting
        await this.gremlinService.upsertVertex<{ type: string; name: string; aadGroupId: string; aadGroupName: string }>({
            id: PONTIFEX_ADMINS_SETTING_ID,
            pk: PONTIFEX_ADMINS_SETTING_ID,
            defaultProperties: {
                type: 'systemSetting',
                name: PONTIFEX_ADMINS_GROUP_NAME,
            },
            updatedProperties: {
                aadGroupId,
                aadGroupName: group.name,
            },
        });
        await this.linkSettingToBase(PONTIFEX_ADMINS_SETTING_ID);

        // Sync group membership from Azure AD
        await this.groupService.sync(aadGroupId);

        return aadGroupId;
    }

    private async ensureEnvironmentLevels() {
        await this.gremlinService.upsertVertex<{ type: string; name: string; levels: string[] }>({
            id: ENVIRONMENT_LEVELS_SETTING_ID,
            pk: ENVIRONMENT_LEVELS_SETTING_ID,
            defaultProperties: {
                type: 'systemSetting',
                name: 'environment-levels',
                levels: DEFAULT_ENVIRONMENT_LEVELS,
            },
        });
        await this.linkSettingToBase(ENVIRONMENT_LEVELS_SETTING_ID);
        this.logger.log(`Environment levels setting initialized with defaults: ${DEFAULT_ENVIRONMENT_LEVELS.join(', ')}`);
    }

    private async ensurePontifexApplication(adminGroupId: string) {
        const clientId = this.configService.get<string>('PONTIFEX_CLIENT_ID')!;

        // Look up the Pontifex AAD app to get its object ID for the environment
        const aadApp = await this.pontifexAadService.Instance.application.getByAppId(clientId);
        if (!aadApp) {
            throw new Error(`Pontifex AAD application not found for clientId: ${clientId}`);
        }
        const envId = aadApp.id!;

        // Tag the Pontifex AAD app so the recovery script can identify it
        const currentTags = aadApp.tags ?? [];
        if (!currentTags.includes(PONTIFEX_MANAGED_TAG)) {
            await this.pontifexAadService.Instance.application.update(envId, {
                tags: [...currentTags, PONTIFEX_MANAGED_TAG],
                notes: JSON.stringify({pontifexAppId: PONTIFEX_APP_ID, pontifexAppName: PONTIFEX_APP_NAME}),
            });
        }

        // Create the Pontifex application via ApplicationService
        await this.applicationService.update({
            id: PONTIFEX_APP_ID,
            name: PONTIFEX_APP_NAME,
            creator: 'system',
            description: 'Pontifex application management platform',
        });

        // Create the Pontifex environment via EnvironmentService (using the AAD app object ID)
        await this.environmentService.update({
            id: envId,
            name: PONTIFEX_APP_NAME,
            level: 'prod',
            clientId,
            spaRedirectUrls: [],
            webRedirectUrls: [],
        });

        // Wire application -> environment
        await this.environmentService.addApplicationAssociation(PONTIFEX_APP_ID, envId);

        // Wire admin group ownership -> application
        await this.applicationService.addUserOwnerAssociation(PONTIFEX_APP_ID, adminGroupId);

        // Create the admin token group via TokenGroupService
        await this.tokenGroupService.createWithKnownIds(
            PONTIFEX_ADMIN_TOKEN_GROUP_ID,
            envId,
            clientId,
            {
                name: PONTIFEX_ADMINS_GROUP_NAME,
                claimValue: 'Admin',
                groupId: adminGroupId,
                description: 'Pontifex administrators token group',
            },
        );

        this.logger.log(`Pontifex application bootstrapped (envId: ${envId}, clientId: ${clientId}, owned by ${PONTIFEX_ADMINS_GROUP_NAME})`);
    }

    private async ensureSystemSettingsBase() {
        await this.gremlinService.upsertVertex({
            id: SYSTEM_SETTINGS_BASE_ID,
            pk: SYSTEM_SETTINGS_BASE_ID,
            defaultProperties: {type: 'systemSetting', name: 'system-settings'},
        });
    }

    private async linkSettingToBase(settingId: string) {
        await this.gremlinService.upsertEdge({
            label: 'has setting',
            sourceVertexId: SYSTEM_SETTINGS_BASE_ID,
            sourceVertexPk: SYSTEM_SETTINGS_BASE_ID,
            destinationVertexId: settingId,
            destinationVertexPk: settingId,
        });

        await this.gremlinService.upsertEdge({
            label: 'is setting for',
            sourceVertexId: settingId,
            sourceVertexPk: settingId,
            destinationVertexId: SYSTEM_SETTINGS_BASE_ID,
            destinationVertexPk: SYSTEM_SETTINGS_BASE_ID,
        });
    }
}
