package object.dataset

default allow = false

breakdownOperationUri(operationUri) = [resourceType, operationType, resourceUriPrefix] {
    parts := split(operationUri, "/")
    operationType := parts[count(parts)-1]
    resourceType := parts[count(parts)-2]
    resourceUriPrefix := concat("/", array.slice(parts, 0, count(parts)-2))
}

getResourceTypeFromResourceUri(resourceUri) = resourceType {
    parts := split(resourceUri, "/")
    resourceType := parts[count(parts)-1]
}

# if find a permission with no any constraints
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType != "*"

    input.object.dataset.publishingState = resourceType

    resourceUri := concat("/", [resourceUriPrefix, resourceType])

    input.user.permissions[i].resourceUri = resourceUri

    input.user.permissions[i].userOwnershipConstraint = false
    input.user.permissions[i].orgUnitOwnershipConstraint = false
    input.user.permissions[i].preAuthorisedConstraint = false
    
    input.user.permissions[i].operations[_].uri = input.operationUri
}

# if find a permission with user ownership constraint
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType != "*"

    input.object.dataset.publishingState = resourceType

    resourceUri := concat("/", [resourceUriPrefix, resourceType])

    input.user.permissions[i].resourceUri = resourceUri
    
    input.user.permissions[i].userOwnershipConstraint = true
    input.user.permissions[i].orgUnitOwnershipConstraint = false
    input.user.permissions[i].preAuthorisedConstraint = false
    
    input.user.permissions[i].operations[_].uri = input.operationUri

    input.object.dataset.accessControl.ownerId = input.user.id
}

# if find a permission with org unit ownership constraint
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType != "*"

    input.object.dataset.publishingState = resourceType

    resourceUri := concat("/", [resourceUriPrefix, resourceType])

    input.user.permissions[i].resourceUri = resourceUri
    
    input.user.permissions[i].userOwnershipConstraint = false
    input.user.permissions[i].orgUnitOwnershipConstraint = true
    input.user.permissions[i].preAuthorisedConstraint = false
    
    input.user.permissions[i].operations[_].uri = input.operationUri

    input.user.managingOrgUnitIds[_] = input.object.dataset.accessControl.orgUnitOwnerId
}

# if find a permission with pre-authorised constraint
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType != "*"

    input.object.dataset.publishingState = resourceType

    resourceUri := concat("/", [resourceUriPrefix, resourceType])

    input.object.dataset.publishingState = resourceType

    input.user.permissions[i].resourceUri = resourceUri
    
    input.user.permissions[i].userOwnershipConstraint = false
    input.user.permissions[i].orgUnitOwnershipConstraint = false
    input.user.permissions[i].preAuthorisedConstraint = true
    
    input.user.permissions[i].operations[_].uri = input.operationUri

    input.object.dataset.accessControl.preAuthorisedPermissionIds[_] = input.user.permissions[i].id
}

##### Rules for wildcard resouce type e.g. object.dataset.*
# if find a permission with no any constraints
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType == "*"

    input.user.permissions[i].userOwnershipConstraint = false
    input.user.permissions[i].orgUnitOwnershipConstraint = false
    input.user.permissions[i].preAuthorisedConstraint = false

    permissionResourceType := getResourceTypeFromResourceUri(input.user.permissions[i].resourceUri)
    operationUri := concat("/", [resourceUriPrefix, permissionResourceType, operationType])
    resourceUri := concat("/", [resourceUriPrefix, permissionResourceType])
    
    input.user.permissions[i].resourceUri = resourceUri
    input.user.permissions[i].operations[_].uri = operationUri

    input.object.dataset.publishingState = permissionResourceType
}

# if find a permission with user ownership constraint
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType == "*"

    input.user.permissions[i].userOwnershipConstraint = true
    input.user.permissions[i].orgUnitOwnershipConstraint = false
    input.user.permissions[i].preAuthorisedConstraint = false

    permissionResourceType := getResourceTypeFromResourceUri(input.user.permissions[i].resourceUri)
    operationUri := concat("/", [resourceUriPrefix, permissionResourceType, operationType])
    resourceUri := concat("/", [resourceUriPrefix, permissionResourceType])
    
    input.user.permissions[i].resourceUri = resourceUri
    input.user.permissions[i].operations[_].uri = operationUri

    input.object.dataset.publishingState = permissionResourceType
    input.object.dataset.accessControl.ownerId = input.user.id
}

# if find a permission with org unit ownership constraint
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType == "*"

    input.user.permissions[i].userOwnershipConstraint = false
    input.user.permissions[i].orgUnitOwnershipConstraint = true
    input.user.permissions[i].preAuthorisedConstraint = false

    permissionResourceType := getResourceTypeFromResourceUri(input.user.permissions[i].resourceUri)
    operationUri := concat("/", [resourceUriPrefix, permissionResourceType, operationType])
    resourceUri := concat("/", [resourceUriPrefix, permissionResourceType])
    
    input.user.permissions[i].resourceUri = resourceUri
    input.user.permissions[i].operations[_].uri = operationUri

    input.object.dataset.publishingState = permissionResourceType
    input.user.managingOrgUnitIds[_] = input.object.dataset.accessControl.orgUnitOwnerId
}

# if find a permission with pre-authorised constraint
allow {
    [resourceType, operationType, resourceUriPrefix] := breakdownOperationUri(input.operationUri)

    resourceType == "*"

    input.user.permissions[i].userOwnershipConstraint = false
    input.user.permissions[i].orgUnitOwnershipConstraint = false
    input.user.permissions[i].preAuthorisedConstraint = true

    permissionResourceType := getResourceTypeFromResourceUri(input.user.permissions[i].resourceUri)
    operationUri := concat("/", [resourceUriPrefix, permissionResourceType, operationType])
    resourceUri := concat("/", [resourceUriPrefix, permissionResourceType])
    
    input.user.permissions[i].resourceUri = resourceUri
    input.user.permissions[i].operations[_].uri = operationUri

    input.object.dataset.publishingState = permissionResourceType
    input.object.dataset.accessControl.preAuthorisedPermissionIds[_] = input.user.permissions[i].id
}
