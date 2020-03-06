import { AspectDefinition, Record } from "./generated/registry/api";
import AspectBuilder from "./AspectBuilder";
import ConnectorRecordId from "./ConnectorRecordId";
import createServiceError from "./createServiceError";

/**
 * A base class for transformers for most any JSON-based catalog source.
 * A transformer takes source data and transforms it to registry records and aspects.
 */
export default abstract class JsonTransformer {
    public readonly sourceId: string;
    private datasetAspectBuilders: AspectBuilder[];
    private distributionAspectBuilders: AspectBuilder[];
    private organizationAspectBuilders: AspectBuilder[];
    private organizationAspects: CompiledAspects;
    private datasetAspects: CompiledAspects;
    private distributionAspects: CompiledAspects;
    private tenantId: number;

    constructor({
        sourceId,
        libraries = {},
        datasetAspectBuilders = [],
        distributionAspectBuilders = [],
        organizationAspectBuilders = []
    }: JsonTransformerOptions) {
        this.sourceId = sourceId;
        this.datasetAspectBuilders = datasetAspectBuilders.slice();
        this.distributionAspectBuilders = distributionAspectBuilders.slice();
        this.organizationAspectBuilders = organizationAspectBuilders.slice();

        const setupParameters: BuilderSetupFunctionParameters = {
            transformer: this,
            libraries
        };

        const datasetParameters = new DatasetBuilderFunctionParameters();
        datasetParameters.libraries = libraries;
        datasetParameters.transformer = this;

        const distributionParameters = new DistributionBuilderFunctionParameters();
        distributionParameters.libraries = libraries;
        distributionParameters.transformer = this;

        const organizationParameters = new OrganizationBuilderFunctionParameters();
        organizationParameters.libraries = libraries;
        organizationParameters.transformer = this;

        this.datasetAspects = buildersToCompiledAspects(
            datasetAspectBuilders,
            setupParameters,
            datasetParameters
        );
        this.distributionAspects = buildersToCompiledAspects(
            distributionAspectBuilders,
            setupParameters,
            distributionParameters
        );
        this.organizationAspects = buildersToCompiledAspects(
            organizationAspectBuilders,
            setupParameters,
            organizationParameters
        );
    }

    /**
     * Create a {@link Record} from JSON data representing an organization.
     *
     * @param {string} id The ID of the record.
     * @param {string} name The name of the record.
     * @param {object} jsonOrganization The JSON data representing the organization.
     * @returns {Record} The record.
     *
     * @memberof JsonConnector
     */
    organizationJsonToRecord(jsonOrganization: object): Record {
        this.organizationAspects.parameters.organization = jsonOrganization;

        const id = this.getIdFromJsonOrganization(
            jsonOrganization,
            this.sourceId
        );

        const name = this.getNameFromJsonOrganization(jsonOrganization);

        const theRecord = this.jsonToRecord(
            id,
            name,
            jsonOrganization,
            this.organizationAspects
        );

        return this.reviseOrganizationRecord(theRecord);
    }

    datasetJsonToRecord(jsonDataset: object): Record {
        this.datasetAspects.parameters.dataset = jsonDataset;

        const id = this.getIdFromJsonDataset(jsonDataset, this.sourceId);
        const name = this.getNameFromJsonDataset(jsonDataset);
        return this.jsonToRecord(id, name, jsonDataset, this.datasetAspects);
    }

    distributionJsonToRecord(
        jsonDistribution: object,
        jsonDataset: object
    ): Record {
        this.distributionAspects.parameters.dataset = jsonDataset;
        this.distributionAspects.parameters.distribution = jsonDistribution;

        const id = this.getIdFromJsonDistribution(
            jsonDistribution,
            jsonDataset,
            this.sourceId
        );
        const name = this.getNameFromJsonDistribution(
            jsonDistribution,
            jsonDataset
        );
        return this.jsonToRecord(
            id,
            name,
            jsonDistribution,
            this.distributionAspects
        );
    }

    getRequiredAspectDefinitions(): AspectDefinition[] {
        const allBuilders = this.datasetAspectBuilders
            .concat(this.distributionAspectBuilders)
            .concat(this.organizationAspectBuilders);
        const builderAspectDefinitions = allBuilders.map(
            builder => builder.aspectDefinition
        );
        return builderAspectDefinitions.concat([
            {
                id: "dataset-distributions",
                name: "Dataset Distributions",
                jsonSchema: require("@magda/registry-aspects/dataset-distributions.schema.json")
            },
            {
                id: "source",
                name: "Source",
                jsonSchema: require("@magda/registry-aspects/source.schema.json")
            },
            {
                id: "dataset-publisher",
                name: "Dataset Publisher",
                jsonSchema: require("@magda/registry-aspects/dataset-publisher.schema.json")
            }
        ]);
    }

    abstract getIdFromJsonOrganization(
        jsonOrganization: any,
        sourceId: string
    ): ConnectorRecordId;
    abstract getIdFromJsonDataset(
        jsonDataset: any,
        sourceId: string
    ): ConnectorRecordId;
    abstract getIdFromJsonDistribution(
        jsonDistribution: any,
        jsonDataset: any,
        sourceId: string
    ): ConnectorRecordId;

    abstract getNameFromJsonOrganization(jsonOrganization: any): string;
    abstract getNameFromJsonDataset(jsonDataset: any): string;
    abstract getNameFromJsonDistribution(
        jsonDistribution: any,
        jsonDataset: any
    ): string;

    reviseOrganizationRecord(record: Record): Record {
        return record;
    }

    public jsonToRecord(
        id: ConnectorRecordId,
        name: string,
        json: any,
        aspects: CompiledAspects
    ): Record {
        const problems: ProblemReport[] = [];

        function reportProblem(
            title: string,
            message?: string,
            additionalInfo?: any
        ) {
            problems.push({ title, message, additionalInfo });
        }

        aspects.parameters.reportProblem = reportProblem;

        const generatedAspects: Aspects = {};
        aspects.aspects.forEach(aspect => {
            try {
                aspects.parameters.setup = aspect.setupResult;
                const aspectValue = aspect.builderFunction(
                    ...aspects.parameterNames.map(
                        parameter => aspects.parameters[parameter]
                    )
                );
                if (aspectValue !== undefined) {
                    generatedAspects[aspect.id] = aspectValue;
                }
            } catch (e) {
                const exception = createServiceError(e);
                reportProblem(
                    "Exception while creating aspect " + aspect.id,
                    exception.toString()
                );
            }
        });

        if (!generatedAspects["source"]) {
            generatedAspects["source"] = {};
        }

        if (problems.length > 0) {
            generatedAspects["source"].problems = problems;
        } else {
            generatedAspects["source"].problems = undefined;
        }

        return {
            // If the id is undefined it'll be rejected by the JsonConnector
            id: id && id.toString(),
            name: name,
            aspects: generatedAspects,
            sourceTag: undefined,
            tenantId: this.tenantId,
            authnReadPolicyId: undefined
        };
    }
}

export function buildersToCompiledAspects(
    builders: AspectBuilder[],
    setupParameters: BuilderSetupFunctionParameters,
    buildParameters: BuilderFunctionParameters
): CompiledAspects {
    const setupParameterNames = Object.keys(setupParameters);
    const buildParameterNames = Object.keys(buildParameters);

    return {
        parameterNames: buildParameterNames,
        parameters: buildParameters,
        aspects: builders.map(builder => {
            let setupResult = undefined;
            if (builder.setupFunctionString) {
                const setupFunction = new Function(
                    ...setupParameterNames,
                    builder.setupFunctionString
                );
                const setupParametersUntyped: any = setupParameters;
                setupResult = setupFunction.apply(
                    undefined,
                    setupParameterNames.map(
                        name => setupParametersUntyped[name]
                    )
                );
            }

            const builderFunction = new Function(
                ...buildParameterNames,
                builder.builderFunctionString
            );

            return {
                id: builder.aspectDefinition.id,
                builderFunction: builderFunction,
                setupResult: setupResult
            };
        })
    };
}

export interface JsonTransformerOptions {
    sourceId: string;
    libraries?: object;
    datasetAspectBuilders?: AspectBuilder[];
    distributionAspectBuilders?: AspectBuilder[];
    organizationAspectBuilders?: AspectBuilder[];
    maxConcurrency?: number;
    tenantId: number;
}

export interface CompiledAspects {
    parameterNames: string[];
    parameters: BuilderFunctionParameters;
    aspects: CompiledAspect[];
}

interface CompiledAspect {
    id: string;
    builderFunction: Function;
    setupResult: any;
}

interface Aspects {
    [propName: string]: any;
}

interface ProblemReport {
    title: string;
    message?: string;
    additionalInfo?: any;
}

interface ReportProblem {
    (title: string, message?: string, additionalInfo?: any): void;
}

export interface BuilderSetupFunctionParameters {
    /**
     * The transformer that is building aspects.
     *
     * @type {JsonTransformer}
     * @memberof BuilderFunctionParameters
     */
    transformer: JsonTransformer;

    /**
     * Provides access to utility libraries that may be helpful in setting up the builder.
     *
     * @type {BuilderFunctionLibraries}
     * @memberOf BuilderFunctionParameters
     */
    libraries: object;
}

export abstract class BuilderFunctionParameters {
    /**
     * The result of invoking the {@link AspectBuilder#setupFunctionString}, or undefined if there is no
     * {@link AspectBuilder#setupFunctionString} defined for this builder.
     *
     * @type {*}
     * @memberOf BuilderFunctionParameters
     */
    setup: any = undefined;

    /**
     * The transformer that is building aspects.
     *
     * @type {JsonTransformer}
     * @memberof BuilderFunctionParameters
     */
    transformer: JsonTransformer;

    /**
     * Reports a non-fatal problem creating an aspect.
     *
     * @type {ReportProblem}
     * @memberOf BuilderFunctionParameters
     */
    reportProblem: ReportProblem = undefined;

    /**
     * Provides access to utility libraries that may be helpful in building aspects.
     *
     * @type {BuilderFunctionLibraries}
     * @memberOf BuilderFunctionParameters
     */
    libraries: object = undefined;

    [propName: string]: any;
}

class DatasetBuilderFunctionParameters extends BuilderFunctionParameters {
    /**
     * The JSON dataset from which to build aspects.
     *
     * @type {object}
     * @memberOf DatasetBuilderFunctionParameters
     */
    dataset: object = undefined;
}

class DistributionBuilderFunctionParameters extends BuilderFunctionParameters {
    /**
     * The JSON distribution from which to build aspects.
     *
     * @type {object}
     * @memberOf DistributionBuilderFunctionParameters
     */
    distribution: object = undefined;

    /**
     * The JSON dataset that owns the distribution.
     *
     * @type {object}
     * @memberOf DatasetBuilderFunctionParameters
     */
    dataset: object = undefined;
}

class OrganizationBuilderFunctionParameters extends BuilderFunctionParameters {
    /**
     * The JSON organization from which to build aspects.
     *
     * @type {object}
     * @memberOf OrganizationBuilderFunctionParameters
     */
    organization: object = undefined;
}
