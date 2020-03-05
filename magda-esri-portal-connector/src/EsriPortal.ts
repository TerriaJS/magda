import AsyncPage, {
    forEachAsync
} from "@magda/typescript-common/dist/AsyncPage";
import EsriPortalUrlBuilder from "./EsriPortalUrlBuilder";
import formatServiceError from "@magda/typescript-common/dist/formatServiceError";
import { ConnectorSource } from "@magda/typescript-common/dist/JsonConnector";
import retry from "@magda/typescript-common/dist/retry";
import request from "@magda/typescript-common/dist/request";
import fetch from "node-fetch";
import * as URI from "urijs";

export interface EsriPortalThing {
    id: string;
    name: string;
    [propName: string]: any;
}

export interface EsriPortalResource extends EsriPortalThing {}

export interface EsriPortalDataset extends EsriPortalThing {
    resources: EsriPortalResource[];
}

export interface EsriPortalOrganization extends EsriPortalThing {}

export interface EsriPortalDataSearchResponse {
    count: number;
    nextStart: number;
    results: any[];
}

export interface EsriPortalOrganizationListResponse {
    result: EsriPortalOrganization[];
    [propName: string]: any;
}

export interface EsriPortalOptions {
    baseUrl: string;
    esriOrgGroup: string;
    id: string;
    name: string;
    arcgisUserId?: string;
    arcgisUserPassword?: string;
    pageSize?: number;
    maxRetries?: number;
    secondsBetweenRetries?: number;
}

export default class EsriPortal implements ConnectorSource {
    public readonly esriOrgGroup: string;
    public readonly id: string;
    public readonly name: string;
    public readonly pageSize: number;
    public readonly maxRetries: number;
    public readonly secondsBetweenRetries: number;
    public readonly urlBuilder: EsriPortalUrlBuilder;
    public readonly hasFirstClassOrganizations: boolean = false;
    private harvestedGroups = new Map<string, any>();

    constructor({
        baseUrl,
        esriOrgGroup,
        id,
        name,
        pageSize = 1000,
        maxRetries = 10,
        secondsBetweenRetries = 10
    }: EsriPortalOptions) {
        this.esriOrgGroup = esriOrgGroup;
        this.id = id;
        this.name = name;
        this.pageSize = pageSize;
        this.maxRetries = maxRetries;
        this.secondsBetweenRetries = secondsBetweenRetries;
        this.urlBuilder = new EsriPortalUrlBuilder({
            id: id,
            name: name,
            baseUrl
        });
    }

    public getToken(username: string, password: string) {
        const that = this;
        return new Promise<any>((resolve, reject) => {
            request.post(
                {
                    url: this.urlBuilder.getTokenUrl(),
                    json: true,
                    form: {
                        username: username,
                        password: password,
                        f: "pjson",
                        expiration: 1440, // 1 day
                        client: "referer",
                        referer: "http://localhost:6113"
                    }
                },
                function(err, resp, body) {
                    console.log("Token Retrieved");
                    that.urlBuilder.token = body.token;
                    resolve();
                }
            );
        });
    }

    /**
     * Gets the known groups from the portal. The returned array will be empty until
     * {@link EsriPortal#itemsSearch}.
     */
    public getPortalGroups(): any[] {
        return Array.from(this.harvestedGroups.values());
    }

    private itemsSearch(options?: {
        start?: number;
        title?: string;
    }): AsyncPage<EsriPortalDataSearchResponse> {
        const url = new URI(this.urlBuilder.getDataSearchUrl());

        const startStart = options.start || 0;
        let startIndex = startStart;

        return AsyncPage.create<EsriPortalDataSearchResponse>(previous => {
            if (previous) {
                startIndex = previous.nextStart;
                if (previous.nextStart === -1) return undefined;
            }
            return this.requestDataSearchPage(url, startIndex);
        });
    }

    public getJsonDatasets(): AsyncPage<any[]> {
        const itemsPages = this.itemsSearch({});
        return itemsPages.map(itemsPage => itemsPage.results);
    }

    public getJsonDataset(id: string): Promise<any> {
        const url = this.urlBuilder.getContentItemUrl(id);

        return new Promise<any>((resolve, reject) => {
            request(url, { json: true }, (error, response, body) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(body.result);
            });
        });
    }

    public getJsonDistributions(dataset: any): AsyncPage<any[]> {
        // Esri datasets represent a single distribution.
        return AsyncPage.single<any[]>([dataset]);
    }

    public searchDatasetsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]> {
        return undefined;
    }

    public getJsonFirstClassOrganizations(): AsyncPage<any[]> {
        return undefined;
    }

    public getJsonFirstClassOrganization(id: string): Promise<any> {
        return undefined;
    }

    public searchFirstClassOrganizationsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]> {
        return undefined;
    }

    public getJsonDatasetPublisherId(dataset: any): string {
        return undefined;
    }

    getJsonDatasetPublisher(dataset: any): Promise<any> {
        return undefined;
    }

    private requestDatasetGroupInformation(contentId: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            request(
                this.urlBuilder.getContentItemGroups(contentId),
                { json: true },
                (error, response, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(body);
                }
            );
        });
    }

    // private requestDistributionInformation(
    //     distributionUrl: string
    // ): Promise<any> {
    //     return new Promise<any>((resolve, reject) => {
    //         request(
    //             this.urlBuilder.getResource(distributionUrl),
    //             { json: true },
    //             (error, response, body) => {
    //                 if (error) {
    //                     reject(error);
    //                     return;
    //                 }
    //                 resolve(body);
    //             }
    //         );
    //     });
    // }

    private requestDataSearchPage(
        url: uri.URI,
        startIndex: number
    ): Promise<EsriPortalDataSearchResponse> {
        const pageUrl = url.clone();
        pageUrl.addSearch("start", startIndex);
        pageUrl.addSearch("num", this.pageSize);
        const operation = async () => {
            const requestUrl = pageUrl.toString();
            console.log(requestUrl);
            console.log(
                `Requesting start = ${startIndex}, num = ${this.pageSize}`
            );

            const res = await fetch(requestUrl);
            let body = await res.json();

            // Add group info to the shared items, loading from up to 10 at a time.
            const singlePage = AsyncPage.single(body.results as any[]);
            await forEachAsync(singlePage, 10, (item: any) => {
                // An item could have both 'public' access attribute and group membership at the same time.
                if (
                    item.access === "shared" ||
                    item.access === "public" ||
                    item.access === "private" ||
                    item.access === "org"
                ) {
                    const groupInfoPromise = this.requestDatasetGroupInformation(
                        item.id
                    );

                    return groupInfoPromise.then(groupInfoRaw => {
                        // We record all "org" access items in the same way as "shared" access
                        // items.
                        //
                        // We create an org group with id given by esriOrgGroup that is unique to
                        // a specific esri portal. If an item's access attribute is "org", the
                        // item will be accessible by the org group. We also create a group record
                        // with "group" aspect whose data propery "members" contains all "org"
                        // access items. The group record also has the same esri-access-control
                        // aspect as those of "members".
                        //
                        // Note the group record's esri-access-control aspect's data property
                        // "access" has value of "org" in stead of "shared", which is achieved by
                        // setting
                        //
                        //    "other" --> "access": "any authenticated users"
                        //
                        // where "any authenticated users" is the value to be checked by
                        // aspect-templates/group-esri-access-control.js.
                        //
                        // The esri-access-control aspect data property "access" is
                        // compulsory -- its value is "public", "private", "shared" or "org".
                        const groupInfo =
                            item.access === "org"
                                ? {
                                      admin: [],
                                      member: [],
                                      other: [
                                          {
                                              id: this.esriOrgGroup,
                                              title:
                                                  "For any portal authenticated users",
                                              access: "any authenticated users"
                                          }
                                      ]
                                  }
                                : groupInfoRaw;

                        const groups = [
                            ...groupInfo.admin,
                            ...groupInfo.member,
                            ...groupInfo.other
                        ];
                        groups.forEach(rawGroup => {
                            const group = rawGroup.description
                                ? rawGroup
                                : { ...rawGroup, description: undefined };
                            const id = group.id;
                            if (!this.harvestedGroups.has(id)) {
                                group.__members = [];
                                this.harvestedGroups.set(id, group);
                            }

                            // Record the items that are members of this group.
                            const groupRecord = this.harvestedGroups.get(id);
                            groupRecord.__members.push(item.id);
                        });
                        item.groups = groupInfo;
                    });
                } else {
                    return Promise.resolve();
                }
            });

            return body;
        };

        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to GET start = ${startIndex}, num = ${
                            this.pageSize
                        }.`,
                        e,
                        retriesLeft
                    )
                )
        );
    }

    // private async processItem(item: any) {
    //     const distUri = new URI(item.url);

    //     // We're looking at an individual layer (could be either map or feature service)
    //     // eg https://maps.six.nsw.gov.au/arcgis/rest/services/public/Valuation/MapServer/0
    //     if (!isNaN(parseInt(distUri.segment(-1)))) {
    //         try {
    //             await this.processIndividualLayerAsDataset(item, distUri);
    //         } catch (err) {
    //             console.error(
    //                 `Broke on item url: ${item.url}, dist uri: ${distUri}`
    //             );
    //             console.error(err);
    //         }

    //         // We're looking at a group of layers which we may need to iterate over
    //         // to get multiple distributions
    //         // eg https://maps.six.nsw.gov.au/arcgis/rest/services/public/Valuation/MapServer
    //     } else {
    //         try {
    //             const distInfo = await this.requestDistributionInformation(
    //                 item.url
    //             );
    //             if (distInfo.error) return;

    //             // We're dealing with a tiled layer that doesn't have crawlable sublayers
    //             if (
    //                 item.type !== "Feature Service" &&
    //                 distInfo.singleFusedMapCache !== false
    //             ) {
    //                 await this.processTiledLayerAsDistribution(
    //                     item,
    //                     distInfo,
    //                     distUri
    //                 );
    //                 return;
    //             }

    //             await this.processRootMapServiceAsDistribution(
    //                 item,
    //                 distInfo,
    //                 distUri
    //             );

    //             // Collect additional distributions - this is commented for now
    //             // because it may be used in the future.
    //             // const layersLength = distInfo.layers
    //             //     ? distInfo.layers.length
    //             //     : 0;
    //             // for (let ii = 0; ii < layersLength; ++ii) {
    //             //     const lyr = distInfo.layers[ii];
    //             //     await this.processLayerAsDistribution(lyr, item, distUri);
    //             // }
    //         } catch (err) {
    //             console.error(
    //                 `Broke on item url: ${item.url}, dist uri: ${distUri}`
    //             );
    //             console.error(err);
    //         }
    //     }
    // }

    // private async processSharedItem(item: any) {
    //     const groupInfo = await this.requestDatasetGroupInformation(item.id);

    //     const adminGroupIds = groupInfo.admin.map((g: any) => g.id);
    //     const memberGroupIds = groupInfo.member.map((g: any) => g.id);
    //     const otherGroupIds = groupInfo.other.map((g: any) => g.id);

    //     const allGroups = adminGroupIds.concat(memberGroupIds, otherGroupIds);
    //     const uniqueGroups = allGroups.filter(
    //         (it: any, idx: any) => allGroups.indexOf(it) === idx
    //     );
    //     item.esriGroups = uniqueGroups.length > 0 ? uniqueGroups : [];
    //     if (item.esriGroups === []) {
    //         console.log(
    //             `Shared item ${item.id}, ${
    //                 item.title
    //             }, will not be accessible by any esri groups.`
    //         );
    //     }
    //     item.esriOwner = item.owner;
    //     item.esriAccess = "shared";
    //     item.esriExpiration = Date.now() + this.updateInterval;
    //     await this.processItem(item);
    // }

    // private async processOrgItem(item: any) {
    //     item.esriGroups = [this.esriOrgGroup];
    //     item.esriOwner = item.owner;
    //     item.esriAccess = "org";
    //     item.esriExpiration = Date.now() + this.updateInterval;
    //     await this.processItem(item);
    // }

    // private async processPrivateItem(item: any) {
    //     item.esriGroups = [];
    //     item.esriOwner = item.owner;
    //     item.esriAccess = "private";
    //     item.esriExpiration = Date.now() + this.updateInterval;
    //     await this.processItem(item);
    // }

    // private async processPublicItem(item: any) {
    //     item.esriGroups = undefined;
    //     item.esriOwner = item.owner;
    //     item.esriAccess = "public";
    //     item.esriExpiration = Date.now() + this.updateInterval;
    //     await this.processItem(item);
    // }

    // private async processIndividualLayerAsDataset(item: any, distUri: any) {
    //     try {
    //         const distInfo = await this.requestDistributionInformation(
    //             item.url
    //         );
    //         if (distInfo.error) return;
    //         const dist = {
    //             title: distInfo.name,
    //             name: distInfo.name,
    //             description: distInfo.description,
    //             accessURL: distUri.clone().toString(),
    //             type: distInfo.type,
    //             id: `${item.id}-0`
    //         };
    //         item.distributions.push(dist);
    //     } catch (err) {
    //         console.error(
    //             `Broke on item url: ${item.url}, dist uri: ${distUri}`
    //         );
    //         console.error(err);
    //     }
    // }

    // private async processTiledLayerAsDistribution(
    //     item: any,
    //     distInfo: any,
    //     distUri: any
    // ) {
    //     try {
    //         let distName = null;
    //         if (item.type === "Map Service") {
    //             // Sometimes people don't populate the documentInfo
    //             distName =
    //                 distInfo.documentInfo &&
    //                 distInfo.documentInfo.Title &&
    //                 distInfo.documentInfo.Title.length > 0
    //                     ? distInfo.documentInfo.Title
    //                     : distInfo.mapName;
    //         } else {
    //             // An image service doesnt have documentInfo
    //             distName = distInfo.name;
    //         }
    //         const dist = {
    //             name: distName,
    //             description: distInfo.serviceDescription,
    //             accessURL: item.url,
    //             type: "Esri Tiled Map Service",
    //             id: `${item.id}-0`
    //         };
    //         item.distributions.push(dist);

    //         if (
    //             distInfo.supportedExtensions &&
    //             distInfo.supportedExtensions.indexOf("WMSServer") > -1
    //         ) {
    //             const wmtsDist = JSON.parse(JSON.stringify(dist));
    //             wmtsDist.name = wmtsDist.name.concat(" WMTS");
    //             wmtsDist.id = `${item.id}-1`;
    //             wmtsDist.accessURL = distUri
    //                 .clone()
    //                 .segment("WMTS")
    //                 .segment("1.0.0")
    //                 .segment("WMTSCapabilities.xml")
    //                 .toString()
    //                 .replace("/rest", "");
    //             wmtsDist.type = "WMTS";
    //             item.distributions.push(wmtsDist);
    //         }
    //     } catch (err) {
    //         console.error(
    //             `Broke on item url: ${item.url}, dist uri: ${distUri}`
    //         );
    //         console.error(err);
    //     }
    // }

    // Collect additional distributions - this is commented for now
    // because it may be used in the future.

    // private async processLayerAsDistribution(
    //     lyr: any,
    //     item: any,
    //     distUri: any
    // ) {
    //     try {
    //         const lyrUrl = distUri
    //             .clone()
    //             .segment(lyr.id.toString())
    //             .toString();
    //         const subDistInfo = await this.requestDistributionInformation(
    //             lyrUrl
    //         );
    //         if (subDistInfo.error) {
    //             return;
    //         }
    //         const subDist = {
    //             accessURL: lyrUrl,
    //             title: subDistInfo.name,
    //             name: subDistInfo.name,
    //             description: subDistInfo.description,
    //             type: `Esri ${subDistInfo.type}`,
    //             id: `${item.id}-c${lyr.id}`
    //         };
    //         item.distributions.push(subDist);
    //     } catch (err) {
    //         console.error(
    //             `Broke on item url: ${
    //                 item.url
    //             }, dist uri: ${distUri}, layer id: ${lyr.id}`
    //         );
    //         console.error(err);
    //     }
    // }

    // private async processRootMapServiceAsDistribution(
    //     item: any,
    //     distInfo: any,
    //     distUri: any
    // ) {
    //     let distName = null;
    //     if (item.type === "Map Service") {
    //         // Sometimes people don't populate the documentInfo
    //         distName =
    //             distInfo.documentInfo.Title.length > 0
    //                 ? distInfo.documentInfo.Title
    //                 : distInfo.mapName;
    //     } else {
    //         // An image service doesnt have documentInfo
    //         distName = distInfo.name;
    //     }
    //     const distDesc = distInfo.description;
    //     const dist = {
    //         name: distName,
    //         description:
    //             distDesc.length > 0 ? distDesc : distInfo.serviceDescription,
    //         accessURL: distUri.clone().toString(),
    //         type: `Esri ${item.type}`,
    //         id: `${item.id}-0`
    //     };

    //     item.distributions.push(dist);

    //     if (
    //         distInfo.supportedExtensions &&
    //         distInfo.supportedExtensions.indexOf("WMSServer") > -1
    //     ) {
    //         const wmsDist = JSON.parse(JSON.stringify(dist));
    //         wmsDist.name = wmsDist.name.concat(" WMS");
    //         wmsDist.id = `${item.id}-1`;
    //         wmsDist.accessURL = distUri
    //             .clone()
    //             .segment("WMSServer")
    //             .addSearch({
    //                 request: "GetCapabilities",
    //                 service: "WMS"
    //             })
    //             .toString()
    //             .replace("/rest", "");
    //         wmsDist.type = "WMS";
    //         item.distributions.push(wmsDist);
    //     }
    // }
}
