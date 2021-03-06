package object.registry.record.owner_orgunit

import data.object.registry.record.has_permission
import data.object.registry.record.owner
import data.object.registry.record.orgunit
import data.object.registry.record.base

read {
    has_permission.read
    owner
}

read {
    has_permission.read
    orgunit
}
