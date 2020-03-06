package object.registry.record

test_allow_owner {
    esri_owner with input as {
        "user": {
            "session": {
                "esriUser": "personA"
            }
        },
        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "owner": "personA"
                    }
                }
            }
        }
    }
}

test_deny_non_owner {
    not esri_owner with input as {
        "user": {
            "session": {
                "esriUser": "personA"
            }
        },
        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "owner": "personB",
                        "access": "private"
                    }
                }
            }
        }
    }
}

test_deny_if_missing_owner_property_when_access_is_private {
    not esri_owner with input as {
        "user": {
            "session": {
                "esriUser": "personA"
            }
        },
        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "someOtherKey": "personA",
                        "access": "private"
                    }
                }
            }
        }
    }
}
