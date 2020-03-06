ALTER TABLE records ADD COLUMN authnReadPolicyId VARCHAR;
CREATE INDEX records_authnreadpolicyid_idx
    ON records USING btree
    (authnreadpolicyid ASC NULLS LAST)
    TABLESPACE pg_default;

UPDATE records SET authnReadPolicyId = 'object.registry.record.public' WHERE recordid IN (SELECT recordid FROM records_without_access_control);

DROP VIEW records_without_access_control;
DROP VIEW records_with_access_control;