package object.registry.record.esri_owner_groups

import data.object.registry.record.has_permission
import data.object.registry.record.esri_groups
import data.object.registry.record.esri_owner
import data.object.registry.record.esri_public
import data.input.registry.nsw_portal_expiration
import data.object.registry.record.admin_role

read {
    admin_role
}

read {
    has_permission.read
    esri_groups
    nsw_portal_expiration
}

read {
    has_permission.read
    esri_owner
    nsw_portal_expiration
}

read {
    esri_public
    nsw_portal_expiration
}
