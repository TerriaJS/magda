package object.dataset

default hasAnyPublishedReadPermission = false

hasAnyPublishedReadPermission {
    input.user.permissions[_].operations[_].uri = "object/dataset/published/read"
}