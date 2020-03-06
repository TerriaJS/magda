ALTER TABLE recordaspects DROP CONSTRAINT recordaspects_aspectid_fkey;
ALTER TABLE aspects DROP CONSTRAINT aspects_pkey;
ALTER TABLE aspects ADD COLUMN tenantId bigint;
UPDATE aspects SET tenantId = 0 WHERE tenantId IS NULL;
ALTER TABLE aspects ADD CONSTRAINT aspects_pkey PRIMARY KEY (aspectid, tenantId);

ALTER TABLE recordaspects DROP CONSTRAINT recordaspects_recordid_fkey;
ALTER TABLE Records ADD COLUMN tenantId bigint;
UPDATE Records SET tenantId = 0 where tenantId is Null;
ALTER TABLE records DROP CONSTRAINT records_pkey;
ALTER TABLE records ADD CONSTRAINT records_pkey PRIMARY KEY (recordid, tenantId);

ALTER TABLE recordaspects ADD COLUMN tenantId bigint;
UPDATE recordaspects SET tenantId = 0 where tenantId is Null;
ALTER TABLE recordaspects DROP CONSTRAINT recordaspects_pkey;
ALTER TABLE recordaspects ADD CONSTRAINT recordaspects_pkey PRIMARY KEY (aspectid, recordid, tenantId);
ALTER TABLE recordaspects ADD CONSTRAINT recordaspects_aspectid_tenantid_fkey FOREIGN KEY (aspectId, tenantId)
    REFERENCES aspects(aspectid, tenantId) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE recordaspects ADD CONSTRAINT recordaspects_recordid_tenantid_fkey FOREIGN KEY (recordId, tenantId)
    REFERENCES records(recordId, tenantId) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

ALTER TABLE events ADD COLUMN tenantId bigint;

