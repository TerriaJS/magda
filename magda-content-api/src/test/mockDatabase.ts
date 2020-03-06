import mockContentDataStore from "./mockContentStore";
import { Maybe } from "tsmonad";
import arrayToMaybe from "magda-typescript-common/src/util/arrayToMaybe";
import { Query, Database } from "../Database";
const wildcard = require("wildcard");

import { Content } from "../model";

export default class MockDatabase implements Database {
    getContentById(id: string): Promise<Maybe<Content>> {
        return new Promise(function(resolve, reject) {
            resolve(
                arrayToMaybe(
                    mockContentDataStore.getContentById(id).map(
                        item =>
                            ({
                                id: item.id,
                                content: item.content
                            } as Content)
                    )
                )
            );
        });
    }

    setContentById(id: string, type: string, content: string): Promise<any> {
        return new Promise(function(resolve, reject) {
            resolve(mockContentDataStore.setContentById(id, type, content));
        });
    }

    async getContentSummary(
        queries: Query[],
        inlineContentIfType: string[]
    ): Promise<any> {
        return mockContentDataStore
            .getContentSummary()
            .filter(item =>
                queries.some(query =>
                    query.patterns.some(
                        pattern => !!wildcard(pattern, item[query.field])
                    )
                )
            )
            .map(item => {
                if (inlineContentIfType.indexOf(item.type) > -1) {
                    return item;
                } else {
                    return { ...item, content: undefined };
                }
            });
    }

    async deleteContentById(id: string): Promise<any> {
        return mockContentDataStore.deleteContentById(id);
    }

    check() {}
}
