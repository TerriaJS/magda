package object.registry.record

# "dataset-access-control" is the aspect id defined in the registry database.
orgunit {
    input.object.registry.record["dataset-access-control"].orgUnitOwnerId == input.user.managingOrgUnitIds[_]
}
