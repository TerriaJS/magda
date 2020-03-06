package object.registry.record.esri_owner_groups

test_allow_read_if_user_has_admin_role {
    read with input as {
        "user": {
            "roles": ["00000000-0000-0003-0000-000000000000"]
        }
    }
}

test_allow_read_if_groups_and_permission_are_correct {
    read with input as {
        "user": {
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "session": {
                "esriGroups": ["G1", "G2"]
            }
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "groups": ["G2", "G3"],
                        "access": "shared"
                    }
                }
            }
        }
    }
}

test_allow_read_if_owner_and_permission_are_correct {
    read with input as {
        "user": {
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "session": {
                "esriUser": "Person.A"
            }
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "owner": "Person.A"
                    }
                }
            }
        }
    }
}

test_allow_read_if_public {
    read with input as {
        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

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

test_deny_read_if_no_access_attributes {
    not read with input as {
        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                    }
                }
            }
        }
    }
}


test_allow_read_if_not_owner_but_groups_and_permission_are_correct {
    read with input as {
        "user": {
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "session": {
                "esriGroups": ["G1", "G2"],
                "esriUser": "Person.A"
            }
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "groups": ["G2", "G3"],
                        "owner": "Person.B",
                        "access": "shared"
                    }
                }
            }
        }
    }
}

test_allow_read_if_owner_but_groups_are_incorrect {
    read with input as {
        "user": {
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "session": {
                "esriGroups": ["G1", "G2"],
                "esriUser": "Person.A"
            }
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "groups": ["G4", "G5"],
                        "owner": "Person.A"
                    }
                }
            }
        }
    }
}

test_deny_read_if_owner_and_groups_are_incorrect {
    not read with input as {
        "user": {
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "session": {
                "esriGroups": ["G1", "G2"],
                "esriUser": "Person.A"
            }
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "groups": ["G4", "G5"],
                        "owner": "Person.B"
                    }
                }
            }
        }
    }
}

test_deny_read_if_groups_are_incorrect {
    not read with input as {
        "user": {
            "session": {
                "esriGroups": ["G1", "G2"]
            },
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ]
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "groups": ["G3", "G4"]
                    }
                }
            }
        }
    }
}

test_deny_read_if_owner_is_incorrect {
    not read with input as {
        "user": {
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/read"
                       }
                   ]
                }
            ],
            "session": {
                "esriUser": "Person.A"
            }
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                "record": {
                    "esri-access-control": {
                        "owner": "Person.B"
                    }
                }
            }
        }
    }
}

test_deny_read_if_permission_is_incorrect {
    not read with input as {
        "user": {
            "session": {
                "esriGroups": ["G1", "G2"]
            },
            "permissions": [
                {
                   "operations": [
                       {
                           "uri": "object/registry/record/not_read"
                       }
                   ]
                }
            ]
        },

        "timestamp": 1569385456740893300,

        "extra": {
            "nsw-portal": {
                "last crawl expiration": 9569380434535153100
            }
        },

        "object": {
            "registry": {
                
                "record": {
                    "esri-access-control": {
                        "orgUnitOwnerId": ["G1", "G2"]
                    }
                }
            }
        }
    }
}
