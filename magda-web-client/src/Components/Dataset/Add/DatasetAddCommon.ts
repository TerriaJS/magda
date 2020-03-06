import uuidv4 from "uuid/v4";

import { ContactPointDisplayOption } from "constants/DatasetConstants";
import { fetchOrganization } from "api-clients/RegistryApis";
import { config } from "config";
import { User } from "reducers/userManagementReducer";

export type Distribution = {
    title: string;
    description?: string;
    issued?: string;
    modified: Date;
    license?: string;
    rights?: string;
    accessURL?: string;
    accessNotes?: string;
    downloadURL?: string;
    byteSize?: number;
    mediaType?: string;
    format?: string;

    datasetTitle?: string;
    author?: string;
    keywords?: string[];
    themes?: string[];
    temporalCoverage?: any;
    spatialCoverage?: any;

    similarFingerprint?: any;
    equalHash?: string;

    // --- An UUID for identify a file during the processing. array index is not a reliable id.
    id?: string;
    creationSource?: DistributionSource;
    _state: DistributionState;
    _progress?: number;
};

export enum DistributionSource {
    File,
    DatasetUrl,
    Api
}

export enum DistributionState {
    Added,
    Reading,
    Processing,
    Ready
}

export function distributionStateToText(state: DistributionState) {
    switch (state) {
        case DistributionState.Added:
            return "Added";
        case DistributionState.Reading:
            return "Reading";
        case DistributionState.Processing:
            return "Processing";
        case DistributionState.Ready:
            return "Ready";
        default:
            return "Unknown";
    }
}

export type DatasetAutocompleteChoice = {
    existingId?: string;
    name: string;
    shouldShowTooltip?: boolean;
};

export type OrganisationAutocompleteChoice = {
    existingId?: string;
    name: string;
};

export type KeywordsLike = {
    keywords: string[];
    derived: boolean;
};

export type Dataset = {
    title: string;
    description?: string;
    issued?: Date;
    modified?: Date;
    languages?: string[];
    publisher?: OrganisationAutocompleteChoice;
    accrualPeriodicity?: string;
    themes?: KeywordsLike;
    keywords?: KeywordsLike;
    defaultLicense?: string;

    accrualPeriodicityRecurrenceRule?: string;
    owningOrgUnitId?: string;
    custodianOrgUnitId?: string;
    contactPointDisplay?: string;
    landingPage?: string;
    importance?: string;
    accessLevel?: string;
    accessNotesTemp?: string;
};

export type Provenance = {
    mechanism?: string;
    sourceSystem?: string;
    derivedFrom?: DatasetAutocompleteChoice[];
    affiliatedOrganizations?: OrganisationAutocompleteChoice[];
    isOpenData?: boolean;
};

export type DatasetPublishing = {
    state: string;
    level: string;
    notesToApprover?: string;
    contactPointDisplay?: ContactPointDisplayOption;
    publishAsOpenData?: {
        [key: string]: boolean;
    };
};

type SpatialCoverage = {
    bbox?: [number, number, number, number];
    spatialDataInputMethod?: string;
    lv1Id?: string;
    lv2Id?: string;
    lv3Id?: string;
    lv4Id?: string;
    lv5Id?: string;
};

type InformationSecurity = {
    disseminationLimits?: string[];
    classification?: string;
};

export type CurrentStatusType = "CURRENT" | "SUPERSEDED" | "RETIRED";

type Currency = {
    status: CurrentStatusType;
    supersededBy?: DatasetAutocompleteChoice[];
    retireReason?: string;
};

export type State = {
    distributions: Distribution[];
    dataset: Dataset;
    datasetPublishing: DatasetPublishing;
    processing: boolean;
    spatialCoverage: SpatialCoverage;
    temporalCoverage: TemporalCoverage;
    datasetAccess: Access;
    informationSecurity: InformationSecurity;
    provenance: Provenance;
    currency: Currency;

    _lastModifiedDate: Date;
    _createdDate: Date;

    licenseLevel: "dataset" | "distribution";

    shouldUploadToStorageApi: boolean;

    isPublishing: boolean;
    error: Error | null;
};

type TemporalCoverage = {
    intervals: Interval[];
};

export type Interval = {
    start?: Date;
    end?: Date;
};

type Access = {
    location?: string;
    notes?: string;
};

export function createBlankState(user?: User): State {
    return {
        distributions: [],
        processing: false,
        dataset: {
            title: "",
            languages: ["eng"],
            owningOrgUnitId: user ? user.orgUnitId : undefined,
            defaultLicense: "world"
        },
        datasetPublishing: {
            state: "draft",
            level: "agency",
            contactPointDisplay: "team"
        },
        spatialCoverage: {
            // Australia, Mainland
            lv1Id: "1",
            bbox: [
                109.951171875,
                -45.398449976304086,
                155.0390625,
                -9.172601695217201
            ],
            spatialDataInputMethod: "region"
        },
        temporalCoverage: {
            intervals: []
        },
        datasetAccess: {},
        informationSecurity: {},
        provenance: {},
        currency: {
            status: "CURRENT"
        },
        licenseLevel: "dataset",
        isPublishing: false,
        shouldUploadToStorageApi: false,
        error: null,
        _createdDate: new Date(),
        _lastModifiedDate: new Date()
    };
}

// saving data in the local storage for now
// TODO: consider whether it makes sense to store this in registry as a custom state or something
export async function loadState(id: string, user?: User): Promise<State> {
    const stateString = localStorage[id];
    let state: State;
    if (stateString) {
        const dehydrated = JSON.parse(stateString);
        state = {
            ...dehydrated,
            dataset: {
                ...dehydrated.dataset,
                modified: dehydrated.modified && new Date(dehydrated.modified),
                issued: dehydrated.issued && new Date(dehydrated.issued)
            }
        };
    } else {
        state = createBlankState(user);
    }

    if (
        !state.dataset.publisher &&
        typeof config.defaultOrganizationId !== "undefined"
    ) {
        const org = await fetchOrganization(config.defaultOrganizationId);
        state.dataset.publisher = {
            name: org.name,
            existingId: org.id
        };
    }

    return state;
}

export function saveState(state: State, id = createId()) {
    state = Object.assign({}, state);

    state._lastModifiedDate = new Date();
    const dataset = JSON.stringify(state);
    localStorage[id] = dataset;
    return id;
}

export function createId(type = "ds") {
    return `magda-${type}-${uuidv4()}`;
}
