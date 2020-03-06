package object.registry.record

test_allow_public {
    esri_public with input as {
        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "access": "public"
                    }
                }
            }
        }
    }
}

test_deny_non_public {
    not esri_public with input as {
        "object": {
            "record": {
                "esri-access-control": {
                    "access": "not public"
                }
            }
        }
    }
}

test_deny_no_access_attributes {
    not esri_public with input as {
        "object": {
            "record": {
                "esri-access-control": {
                }
            }
        }
    }
}

test_deny_no_access_control_info {
    not esri_public with input as {
        "object": {
            "record": {
                "esri-access-control": {
                    "someOtherKey": "public"
                }
            }
        }
    }
}
