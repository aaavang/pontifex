export interface PontifexAADConfig {
    tenantId?: string
    clientId?: string
    clientSecret?: string
    debugLogging?: boolean
}

export interface AddPasswordRequest {
    displayName: string
}

export interface RemovePasswordRequest {
    keyId: string
}