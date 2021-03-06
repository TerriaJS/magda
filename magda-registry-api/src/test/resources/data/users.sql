--
--              +---------+
--              |  Dep. A |
--              |  t1000  |
--              +----+----+
--                   |
--          +--------+--------+
--          |                 |
--     +----+----+       +----+----+
--     | Branch A|       | Branch B|
--     |  t1001  |       |  t1002  |
--     +---------+       +----+----+
--                            |
--              +--------------------------+
--              |             |            |
--          +----+----+  +----+----+  +----+----+
--          |Section A|  |Section B|  |Section C|
--          |         |  |         |  |  t1003  |
--          +---------+  +---------+  +---------+


INSERT INTO users (id, "displayName", "email", "source", "sourceId", "orgUnitId", "isAdmin") VALUES
    ('00000000-0000-1000-0000-000000000000', 't1000', 't1001@email.com', 'manual', 't1000', '00000000-0000-2000-0001-000000000000', true),
    ('00000000-0000-1000-0001-000000000000', 't1001', 't1001@email.com', 'manual', 't1001', '00000000-0000-2000-0002-000000000000', false),
    ('00000000-0000-1000-0002-000000000000', 't1002', 't1002@email.com', 'manual', 't1002', '00000000-0000-2000-0003-000000000000', false),
    ('00000000-0000-1000-0003-000000000000', 't1003', 't1003@email.com', 'manual', 't1003', '00000000-0000-2000-0006-000000000000', false);

-- As the above users are manually inserted into the database, they are not automatically
-- assigned the authenticated user roles. We must manually assign them the roles.
INSERT INTO user_roles ("user_id", "role_id") VALUES
    ('00000000-0000-1000-0000-000000000000', '00000000-0000-0002-0000-000000000000'),
    ('00000000-0000-1000-0001-000000000000', '00000000-0000-0002-0000-000000000000'),
    ('00000000-0000-1000-0002-000000000000', '00000000-0000-0002-0000-000000000000'),
    ('00000000-0000-1000-0003-000000000000', '00000000-0000-0002-0000-000000000000');
