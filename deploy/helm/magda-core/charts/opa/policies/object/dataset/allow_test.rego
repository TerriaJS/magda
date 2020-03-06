package object.dataset

test_allow_no_constraints_permission_user_without_no_constraints_permission {
    not allow with input as {
        "operationUri": "object/dataset/draft/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"]
                },
                "publishingState": "draft"
            }
        },
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
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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

test_allow_no_constraints_permission_user_has_no_constraints_permission {
    allow with input as {
        "operationUri": "object/dataset/draft/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"]
                },
                "publishingState": "draft"
            }
        },
        "user": {
            "displayName": "Jacky Jiang",
            "email": "t83714@gmail.com",
            "id": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
            "isAdmin": false,
            "permissions": [
                {
                    "id": "3d913ce7-e728-4bd2-9542-5e9983e45fe1",
                    "name": "View Draft Dataset",
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
                    "userOwnershipConstraint": false
                },
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
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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
                        "72d52505-cf96-47b2-9b74-d0fdc1f5aee7",
                        "3d913ce7-e728-4bd2-9542-5e9983e45fe1"
                    ]
                }
            ],
            "source": "ckan"
        }
    }
}

test_allow_user_ownership_constraint_permission_user_is_not_owner {
    not allow with input as {
        "operationUri": "object/dataset/draft/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"]
                },
                "publishingState": "draft"
            }
        },
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
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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

test_allow_user_ownership_constraint_permission_user_is_owner {
    allow with input as {
        "operationUri": "object/dataset/draft/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"]
                },
                "publishingState": "draft"
            }
        },
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
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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

test_allow_user_ownership_constraint_permission_user_is_owner_wildcard_res_uri_test1 {
    allow with input as {
        "operationUri": "object/dataset/*/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"]
                },
                "publishingState": "draft"
            }
        },
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
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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

test_allow_user_ownership_constraint_permission_user_is_owner_wildcard_res_uri_test2 {
    allow with input as {
        "operationUri": "object/dataset/*/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"]
                },
                "publishingState": "published"
            }
        },
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
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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

test_allow_pre_Authorised_constraint_permission_user_permission_is_not_pre_authorised {
    not allow with input as {
        "operationUri": "object/dataset/draft/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"]
                },
                "publishingState": "draft"
            }
        },
        "user": {
            "displayName": "Jacky Jiang",
            "email": "t83714@gmail.com",
            "id": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
            "isAdmin": false,
            "permissions": [
                {
                    "id": "72d52505-cf96-47b2-9b74-d0fdc1f5aee7",
                    "name": "View Draft Dataset (pre-authorised)",
                    "operations": [
                        {
                            "id": "bf946197-392a-4dbb-a7e1-789424e231a4",
                            "name": "Read Draft Dataset",
                            "uri": "object/dataset/draft/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": true,
                    "resourceId": "ea5d2d58-165a-48cb-9b22-42edd6a3024a",
                    "resourceUri": "object/dataset/draft",
                    "userOwnershipConstraint": false
                },
                {
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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

test_allow_pre_Authorised_constraint_permission_user_permission_is_pre_authorised {
    allow with input as {
        "operationUri": "object/dataset/draft/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["72d52505-cf96-47b2-9b74-d0fdc1f5aee7"]
                },
                "publishingState": "draft"
            }
        },
        "user": {
            "displayName": "Jacky Jiang",
            "email": "t83714@gmail.com",
            "id": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
            "isAdmin": false,
            "permissions": [
                {
                    "id": "72d52505-cf96-47b2-9b74-d0fdc1f5aee7",
                    "name": "View Draft Dataset (pre-authorised)",
                    "operations": [
                        {
                            "id": "bf946197-392a-4dbb-a7e1-789424e231a4",
                            "name": "Read Draft Dataset",
                            "uri": "object/dataset/draft/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": true,
                    "resourceId": "ea5d2d58-165a-48cb-9b22-42edd6a3024a",
                    "resourceUri": "object/dataset/draft",
                    "userOwnershipConstraint": false
                },
                {
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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

test_allow_pre_Authorised_constraint_permission_user_permission_is_pre_authorised_for_incorrect_publishing_state {
    not allow with input as {
        "operationUri": "object/dataset/draft/read",
        "object": {
            "dataset": {
                "accessControl": {
                    "ownerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "orgUnitOwnerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
                    "preAuthorisedPermissionIds": ["72d52505-cf96-47b2-9b74-d0fdc1f5aee7"]
                },
                "publishingState": "published"
            }
        },
        "user": {
            "displayName": "Jacky Jiang",
            "email": "t83714@gmail.com",
            "id": "80a9dce4-91af-44e2-a2f4-9ddccb3f4c5e",
            "isAdmin": false,
            "permissions": [
                {
                    "id": "72d52505-cf96-47b2-9b74-d0fdc1f5aee7",
                    "name": "View Draft Dataset (pre-authorised)",
                    "operations": [
                        {
                            "id": "bf946197-392a-4dbb-a7e1-789424e231a4",
                            "name": "Read Draft Dataset",
                            "uri": "object/dataset/draft/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": true,
                    "resourceId": "ea5d2d58-165a-48cb-9b22-42edd6a3024a",
                    "resourceUri": "object/dataset/draft",
                    "userOwnershipConstraint": false
                },
                {
                    "id": "e5ce2fc4-9f38-4f52-8190-b770ed2074e6",
                    "name": "View Published Dataset",
                    "operations": [
                        {
                            "id": "f1e2af3e-5d98-4081-a4ff-7016f43002fa",
                            "name": "Read Publish Dataset",
                            "uri": "object/dataset/published/read"
                        }
                    ],
                    "orgUnitOwnershipConstraint": false,
                    "preAuthorisedConstraint": false,
                    "resourceId": "ef3b767f-d06b-46f4-9302-031ae5004275",
                    "resourceUri": "object/dataset/published",
                    "userOwnershipConstraint": false
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