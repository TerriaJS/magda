package object.registry.record.has_permission

test_allow_right_permission {
    read with input as {
        "user": {
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
        }
    }
}

test_deny_wrong_permission {
    not read with input as {
        "user": {
            "permissions": [
                {
                   "operations": [
                       {
                           "id": "some_id",
                           "uri": "object/registry/record/write"
                       }
                   ]
                }
            ]
        }
    }
}
