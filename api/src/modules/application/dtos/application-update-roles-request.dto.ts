export interface PontifexRoleDto {
    displayName: string
    description?: string
    claimValue: string
    sensitive: boolean
}

export interface ApplicationUpdateRolesRequest {
    roles: PontifexRoleDto[]
}