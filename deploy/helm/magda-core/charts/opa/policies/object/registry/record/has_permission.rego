package object.registry.record.has_permission

has_permission(permission) {
    input.user.permissions[_].operations[_].uri == permission
}

read {
    has_permission("object/registry/record/read")
}
