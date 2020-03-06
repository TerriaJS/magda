package object.registry.record

# "esri-access-control" is the aspect id defined in the registry database.
esri_groups {
    input.object.registry.record["esri-access-control"].access != "private"
    input.object.registry.record["esri-access-control"].groups[_] == input.user.session["esriGroups"][_]
}
