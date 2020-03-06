package object.registry.record.owner_orgunit

test_allow_read_if_user_has_admin_role {
    read with input as {
        "user": {
            "roles": ["00000000-0000-0003-0000-000000000000"]
        }
    }
}

test_allow_read_if_owner_and_permission_are_correct {
    read with input as {
        "user": {
            "id": "personA",
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "managingOrgUnitIds": ["1", "2"]
        },

        "object": {
            "registry": {
                "record": {
                    "dataset-access-control": {
                        "ownerId": "personA",
                        "orgUnitOwnerId": "3"
                    }
                }
            }
        }
    }
}

test_allow_read_if_orgunit_and_permission_are_correct {
    read with input as {
        "user": {
            "id": "personA",
            "permissions": [
                {
                   "operations": [
                       {
                           "id": "some_id",
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "managingOrgUnitIds": ["1", "2", "3"]
        },

        "object": {
            "registry": {
                "record": {
                    "dataset-access-control": {
                    "ownerId": "personB",
                        "orgUnitOwnerId": "3"
                    }
                }
            }
        }
    }
}

test_deny_read_if_both_owner_and_orgunit_are_incorrect {
    not read with input as {
        "user": {
            "id": "personA",
            "managingOrgUnitIds": ["1", "2"],
            "permissions": [
                {
                   "operations": [
                       {
                           "id": "some_id",
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ]
        },

        "object": {
            "registry": {
                "record": {
                    "dataset-access-control": {
                        "ownerId": "personB",
                        "orgUnitOwnerId": "3"
                    }
                }
            }
        }
    }
}

test_deny_read_if_permission_is_incorrect {
    not read with input as {
        "user": {
            "id": "personA",
            "managingOrgUnitIds": ["1", "2", "3"],
            "permissions": [
                {
                   "operations": [
                       {
                           "id": "some_id",
                           "uri": "object/registry/record/not_read"
                       }
                   ]
                }
            ]
        },

        "object": {
            "registry": {
                "record": {
                    "dataset-access-control": {
                        "ownerId": "personA",
                        "orgUnitOwnerId": "3"
                    }
                }
            }
        }
    }
}

