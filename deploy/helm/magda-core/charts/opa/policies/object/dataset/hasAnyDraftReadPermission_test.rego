package object.dataset

test_hasAnyDraftReadPermission_with_correct_permission {
    hasAnyDraftReadPermission with input as {
        "operationUri": "object/dataset/draft/read",
        "user": {
            "displayName": "Jacky Jiang",
            "email": "t83714@gmail.com",
            "id": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
            "isAdmin": false,
            "permissions": [
                {
                    "id": "72d52505-cf96-47b2-9b74-d0fdc1f5aee7",
                    "name": "View Draft Dataset (Own)",
                    "operations": [
                        {
                            "id": "bf946197-392a-4dbb-a7e1-789424e231a4",
                            "name": "Read Draft Dataset",
                            "uri": "object/dataset/draft/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ea5d2d58-165a-48cb-9b22-42edd6a3024a",
                    "resourceUri": "object/dataset/draft",
                    "userOwnershipConstraint": true
                },
                {
                    "id": "72d52505-cf96-47b2-9b74-d0fdc1f5aee7",
                    "name": "View Draft Dataset (Own)",
                    "operations": [
                        {
                            "id": "bf946197-392a-4dbb-a7e1-789424e231a4",
                            "name": "Read Draft Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ea5d2d58-165a-48cb-9b22-42edd6a3024a",
                    "resourceUri": "object/dataset/draft",
                    "userOwnershipConstraint": true
                }
            ],
            "photoURL": "//www.gravatar.com/avatar/bed026a33c154abec6852b4e313bf1ce",
            "roles": [
                {
                    "id": "00000000-0000-0002-0000-000000000000",
                    "name": "Authenticated Users",
                    "permissionIds": [
                        "e5ce2fc4-9f38-4f52-8190-b770ed2074e6"
                    ]
                },
                {
                    "id": "14ff3f57-e8ea-4771-93af-c6ea91a798d5",
                    "name": "Approvers",
                    "permissionIds": [
                        "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                        "72d52505-cf96-47b2-9b74-d0fdc1f5aee7"
                    ]
                }
            ],
            "source": "ckan"
        }
    }
}

test_hasAnyDraftReadPermission_with_no_correct_permission {
    not hasAnyDraftReadPermission with input as {
        "operationUri": "object/dataset/draft/read",
        "user": {
            "displayName": "Jacky Jiang",
            "email": "t83714@gmail.com",
            "id": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
            "isAdmin": false,
            "permissions": [
                {
                    "id": "72d52505-cf96-47b2-9b74-d0fdc1f5aee7",
                    "name": "View Draft Dataset (Own)",
                    "operations": [
                        {
                            "id": "bf946197-392a-4dbb-a7e1-789424e231a4",
                            "name": "Read Draft Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ea5d2d58-165a-48cb-9b22-42edd6a3024a",
                    "resourceUri": "object/dataset/draft",
                    "userOwnershipConstraint": true
                }
            ],
            "photoURL": "//www.gravatar.com/avatar/bed026a33c154abec6852b4e313bf1ce",
            "roles": [
                {
                    "id": "00000000-0000-0002-0000-000000000000",
                    "name": "Authenticated Users",
                    "permissionIds": [
                        "e5ce2fc4-9f38-4f52-8190-b770ed2074e6"
                    ]
                },
                {
                    "id": "14ff3f57-e8ea-4771-93af-c6ea91a798d5",
                    "name": "Approvers",
                    "permissionIds": [
                        "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                        "72d52505-cf96-47b2-9b74-d0fdc1f5aee7"
                    ]
                }
            ],
            "source": "ckan"
        }
    }
}