package object.registry.record

# Can only be accessed by the owner
esri_owner {
    input.object.registry.record["esri-access-control"].owner = input.user.session.esriUser
}
