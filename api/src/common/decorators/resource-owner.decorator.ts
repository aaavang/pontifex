import {Reflector} from "@nestjs/core";

export type ResourceType = 'APPLICATION' | 'ENVIRONMENT' | 'PERMISSION_REQUEST'

export interface ResourceOwnerDecoratorProps {
    resourceType: ResourceType
    queryParameterKey: string
}


export const RequireResourceOwner = Reflector.createDecorator<ResourceOwnerDecoratorProps>()