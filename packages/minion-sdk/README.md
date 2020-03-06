### MAGDA Minion SDK

A minion is a [Magda](https://github.com/magda-io/magda) service that listens for new records or changes to existing records, performs some kind of operation and then writes the result back to the [Magda registry](https://github.com/magda-io/magda#registry). For instance, we have a broken link minion that listens for changes to distributions, retrieves the URLs described, records whether they were able to be accessed successfully and then writes that back to the registry in its own aspect.

Other aspects exist that are written to by many minions - for instance, we have a "quality" aspect that contains a number of different quality ratings from different sources, which are averaged out and used by search.

While develops a custom build Magda minion, this SDK helps you to focus on the core minion logic without starting from scratch.

### Get Started

```javascript
import minion, { commonYargs } from "@magda/minion-sdk";
import onRecordFound from "./onRecordFound";

const MINION_ID = "minion-format";
const argv = commonYargs(6311, "http://localhost:6311");

const aspectDefinition = {
    id: "dataset-format",
    name: "Details about the format of the distribution",
    jsonSchema: require("@magda/registry-aspects/dataset-format.schema.json")
};

// --- will be called when changes are made to records in magda registry
async function onRecordFound(record, authorizedRegistryClient) {
    // --- adding logic of based on the current record data, create / update extra data and save back to registry via `authorizedRegistryClient`
}

minion({
    argv,
    // --- monitor `dcat-distribution-strings` aspect
    aspects: ["dcat-distribution-strings"],
    async: true,
    id: MINION_ID,
    onRecordFound,
    optionalAspects: [],
    writeAspectDefs: [aspectDefinition]
}).catch((e: Error) => {
    console.error("Error: " + e.message, e);
    process.exit(1);
});
```
