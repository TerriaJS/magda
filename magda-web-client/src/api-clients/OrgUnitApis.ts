import fetch from "isomorphic-fetch";
import { config } from "config";
import URI from "urijs";

export type OrgUnit = {
    id: string;
    name: string;
    description: string;
};

type ListOrgUnitParams = {
    orgUnitsOnly?: boolean;
    relationshipOrgUnitId?: string;
};

export async function listOrgUnits({
    orgUnitsOnly: leafNodesOnly,
    relationshipOrgUnitId
}: ListOrgUnitParams): Promise<OrgUnitWithRelationship[]> {
    let uri = URI(config.authApiUrl)
        .segment("orgunits")
        .addQuery("leafNodesOnly", leafNodesOnly || false);

    if (relationshipOrgUnitId) {
        uri = uri.addQuery("relationshipOrgUnitId", relationshipOrgUnitId);
    }

    const res = await fetch(uri.toString(), config.fetchOptions);

    if (!res.ok) {
        throw new Error("Rejected with " + res.statusText);
    } else {
        return await res.json();
    }
}

export interface OrgUnitWithRelationship extends OrgUnit {
    relationship?: string;
}

/**
 * List all OrgUnits at certain org tree level.
 * Optionally provide a test Org Unit Id that will be used to
 * test the relationship with each of returned orgUnit item.
 * Possible Value: 'ancestor', 'descendant', 'equal', 'unrelated'.
 *
 * @export
 * @param {number} orgLevel - The level number (starts from 1) where org Units of the tree are taken horizontally.
 * @param {string} [relationshipOrgUnitId] - Optional; The org unit id that is used to test the relationship with each of returned orgUnit item.
 * @returns {Promise<OrgUnitWithRelationship[]>}
 */
export async function listOrgUnitsAtLevel(
    orgLevel: number,
    relationshipOrgUnitId?: string
): Promise<OrgUnitWithRelationship[]> {
    const uri = `${config.authApiUrl}orgunits/bylevel/${orgLevel}${
        relationshipOrgUnitId
            ? `?relationshipOrgUnitId=${relationshipOrgUnitId}`
            : ""
    }`;

    const res = await fetch(uri, config.fetchOptions);

    if (!res.ok) {
        throw new Error("Rejected with " + res.statusText);
    } else {
        return await res.json();
    }
}

/**
 * Get Org Unit Details By Id
 *
 * @export
 * @param {string} id
 * @returns {Promise<OrgUnit>}
 */
export async function getOrgUnitById(id: string): Promise<OrgUnit> {
    const res = await fetch(
        `${config.authApiUrl}orgunits/${id}`,
        config.fetchOptions
    );

    if (!res.ok) {
        throw new Error("Rejected with " + res.statusText);
    } else {
        return await res.json();
    }
}
