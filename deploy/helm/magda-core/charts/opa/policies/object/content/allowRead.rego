package object.content

import data.object.dataset.hasAnyDraftReadPermission
import data.object.dataset.hasAnyPublishedReadPermission

default allowRead = false

default isValidAllowReadUri = false

isValidAllowReadUri {
    ## res type must be resource object/content
    startswith(input.operationUri, "object/content/")
    
    ## Operation type must be read
    endswith(input.operationUri, "/read")

    ## if operation uri is in invalid form:
    ## minimun size uri: object/content/includeHtml/read
    ## more common example: object/content/header/*/read
    parts := split(input.operationUri, "/")
    count(parts) >= 4
}

getContentIdFromOperationUri(operationUri) = contentId {
    parts := split(operationUri, "/")
    contentId := concat("/", array.slice(parts, 2, count(parts)-1))
}

## unknowns input.content

### Define content items always allowed to access
allowRead {
    isValidAllowReadUri == true
    contentId := getContentIdFromOperationUri(input.operationUri)
    not glob.match(contentId, ["/"], "header/navigation/drafts")
    not glob.match(contentId, ["/"], "header/navigation/datasets")
}

### Define whether a user has access to header/navigation/drafts
allowRead {
    isValidAllowReadUri == true
    contentId := getContentIdFromOperationUri(input.operationUri)
    ## This rule handles the situation when contentId is not a pattern
    ## i.e. contentId doesn't contain '*' e.g. "header/navigation/drafts"
    contentId == "header/navigation/drafts"
    hasAnyDraftReadPermission == true
    input.object.content.id = "header/navigation/drafts"
}

### Define whether a user has access to header/navigation/datasets
allowRead {
    isValidAllowReadUri == true
    contentId := getContentIdFromOperationUri(input.operationUri)
    ## This rule handles the situation when contentId is not a pattern
    ## i.e. contentId doesn't contain '*' e.g. "header/navigation/datasets"
    contentId == "header/navigation/datasets"
    hasAnyPublishedReadPermission == true
    input.object.content.id = "header/navigation/datasets"
}

### Define combined logic
## Use generic glob parttern to match contentId
## example: header/** or header/*/datasets or header/navigation/datasets
## Please note: header/* won't match header/navigation/datasets

allowRead {
    isValidAllowReadUri == true
    contentId := getContentIdFromOperationUri(input.operationUri)
    ## This rule handles the situation when contentId is a pattern
    ## i.e. contentId contains '*' e.g. header/**
    contains(contentId, "*") == true
    glob.match(contentId, ["/"], "header/navigation/drafts")
    glob.match(contentId, ["/"], "header/navigation/datasets")
    hasAnyDraftReadPermission != true
    hasAnyPublishedReadPermission != true
    input.object.content.id != "header/navigation/drafts"
    input.object.content.id != "header/navigation/datasets"
}

allowRead {
    isValidAllowReadUri == true
    contentId := getContentIdFromOperationUri(input.operationUri)
    ## This rule handles the situation when contentId is a pattern
    ## i.e. contentId contains '*' e.g. header/**
    contains(contentId, "*") == true
    glob.match(contentId, ["/"], "header/navigation/drafts")
    glob.match(contentId, ["/"], "header/navigation/datasets")
    hasAnyDraftReadPermission == true
    hasAnyPublishedReadPermission != true
    input.object.content.id != "header/navigation/datasets"
}

allowRead {
    isValidAllowReadUri == true
    contentId := getContentIdFromOperationUri(input.operationUri)
    ## This rule handles the situation when contentId is a pattern
    ## i.e. contentId contains '*' e.g. header/**
    contains(contentId, "*") == true
    glob.match(contentId, ["/"], "header/navigation/drafts")
    glob.match(contentId, ["/"], "header/navigation/datasets")
    hasAnyDraftReadPermission != true
    hasAnyPublishedReadPermission == true
    input.object.content.id != "header/navigation/drafts"
}

allowRead {
    isValidAllowReadUri == true
    contentId := getContentIdFromOperationUri(input.operationUri)
    ## This rule handles the situation when contentId is a pattern
    ## i.e. contentId contains '*' e.g. header/**
    contains(contentId, "*") == true
    glob.match(contentId, ["/"], "header/navigation/drafts")
    glob.match(contentId, ["/"], "header/navigation/datasets")
    hasAnyDraftReadPermission == true
    hasAnyPublishedReadPermission == true
}