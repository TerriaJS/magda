package object.dataset

default hasAnyDraftReadPermission = false

hasAnyDraftReadPermission {
    input.user.permissions[_].operations[_].uri = "object/dataset/draft/read"
}