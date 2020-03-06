import "mocha";
import pg from "pg";
import _ from "lodash";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import NestedSetModelQueryer, {
    NodeRecord,
    CompareNodeResult
} from "../NestedSetModelQueryer";
import getTestDBConfig from "./getTestDBConfig";
import { Maybe } from "tsmonad";

chai.use(chaiAsPromised);
const { expect } = chai;

async function checkNodeLeftRight(
    queryer: NestedSetModelQueryer,
    nodeName: string,
    expectedLeft: number,
    expectedRight: number
) {
    queryer.defaultSelectFieldList = ["id", "name", "left", "right"];
    const testNode = (await queryer.getNodes({ name: nodeName }))[0];
    expect(testNode.left).to.equal(expectedLeft);
    expect(testNode.right).to.equal(expectedRight);
}

describe("Test NestedSetModelQueryer", function(this: Mocha.ISuiteCallbackContext) {
    this.timeout(10000);
    let pool: pg.Pool = null;
    const createTables: string[] = [];
    const dbConfig = getTestDBConfig();

    before(async function() {
        // --- you have to supply a db name to connect to pg
        pool = new pg.Pool({ ...dbConfig });
        try {
            await pool.query("CREATE database test");
        } catch (e) {
            // --- if database `test` already there
            // --- then mute the error
            if (e.code !== "42P04") {
                throw e;
            }
        }
        // --- end the current one & create a new one
        await pool.end();
        pool = new pg.Pool({ ...dbConfig, database: "test" });
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    });

    after(async function() {
        if (pool) {
            for (let i = 0; i < createTables.length; i++) {
                await pool.query(`DROP TABLE IF EXISTS "${createTables[i]}"`);
            }
            pool.end();
            pool = null;
        }
    });

    async function createTestTable() {
        const tableName = `test_tbl_${Math.random()
            .toString()
            .replace(".", "")}`;
        await pool.query(`CREATE TABLE "${tableName}" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "name" varchar(250) NOT NULL DEFAULT ''::character varying,
            "desc" varchar(250) NOT NULL DEFAULT ''::character varying,
            "left" int4 NOT NULL,
            "right" int4 NOT NULL,
            PRIMARY KEY ("id")
        ) WITH (
            OIDS = FALSE
        )`);
        createTables.push(tableName);
        return tableName;
    }

    /**
     * Create test data as followings:
     *
     *         +---------+
     *         |  Albert |
     *         | 1     12|
     *         +----+----+
     *              |
     *     +--------+--------+
     *     |                 |
     * +----+----+       +----+----+
     * |   Bert  |       |  Chuck  |
     * | 2     3 |       | 4     11|
     * +---------+       +----+----+
     *                        |
     *         +-------------------------+
     *         |             |            |
     *     +----+----+  +----+----+  +----+----+
     *     |  Donna  |  |  Eddie  |  |   Fred  |
     *     | 5     6 |  | 7     8 |  | 9     10|
     *     +---------+  +---------+  +---------+
     *
     * @returns
     */
    async function createTestTableWithTestData() {
        const tableName = await createTestTable();
        await pool.query(`INSERT INTO "${tableName}" ("name", "left", "right") VALUES
        ('Albert', 1, 12),
        ('Bert', 2, 3),
        ('Chuck', 4, 11),
        ('Donna', 5, 6),
        ('Eddie', 7, 8),
        ('Fred', 9, 10)`);
        return tableName;
    }

    async function getNodeIdFromName(tableName: string, name: string) {
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const nodes = await queryer.getNodes({ name });
        if (!nodes) throw new Error(`Can't find node by name: ${name}`);
        return nodes[0]["id"];
    }

    it("`getNodesByName` should return the node with specified name", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const nodes = await queryer.getNodes({ name: "Chuck" });
        expect(nodes.length).to.equal(1);
        expect(nodes[0]["name"]).to.equal("Chuck");
    });

    it("`getNodeById` should return the node with the specified id", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const nodes = await queryer.getNodes({ name: "Chuck" });
        expect(nodes.length).to.equal(1);
        expect(nodes[0]["name"]).to.equal("Chuck");
        const testNode = await queryer.getNodeById(nodes[0]["id"]);
        expect(testNode.valueOrThrow().name).to.equal("Chuck");
    });

    it("`getRootNode` should return root node", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const node = await queryer.getRootNode();
        expect(node.valueOrThrow().name).to.equal("Albert");
    });

    it("`defaultSelectFieldList` paremeter should be able to control the fields of returned nodes", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName, [
            "id",
            "left"
        ]);
        const node = (await queryer.getRootNode()).valueOrThrow();
        expect(Object.keys(node)).to.have.members(["id", "left"]);
    });

    it("`getNodes with no parameters should return all nodes", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const nodes = await queryer.getNodes();
        expect(nodes.map(n => n.name)).to.have.members([
            "Albert",
            "Bert",
            "Chuck",
            "Donna",
            "Eddie",
            "Fred"
        ]);
    });

    it("`getNodes({ leafNodesOnly: true })` should return all leaf nodes", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const nodes = await queryer.getNodes({ leafNodesOnly: true });
        expect(nodes.map(n => n.name)).to.have.members([
            "Bert",
            "Donna",
            "Eddie",
            "Fred"
        ]);
    });

    it("`getNodes with both name and leafNodesOnly should return all leaf nodes with that name", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const nodes = await queryer.getNodes({
            leafNodesOnly: true,
            name: "Bert"
        });
        expect(nodes.map(n => n.name)).to.have.members(["Bert"]);
    });

    it("`getAllChildren` should return all children correctly", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let nodes = await queryer.getAllChildren(
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(nodes.map(n => n.name)).to.have.members([
            "Bert",
            "Chuck",
            "Donna",
            "Eddie",
            "Fred"
        ]);

        nodes = await queryer.getAllChildren(
            await getNodeIdFromName(tableName, "Chuck")
        );
        expect(nodes.map(n => n.name)).to.have.members([
            "Donna",
            "Eddie",
            "Fred"
        ]);

        nodes = await queryer.getAllChildren(
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(nodes.length).to.equal(0);
    });

    it("`getImmediateChildren` should return all immediate children", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let nodes = await queryer.getImmediateChildren(
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(nodes.map(n => n.name)).to.have.members(["Bert", "Chuck"]);

        nodes = await queryer.getImmediateChildren(
            await getNodeIdFromName(tableName, "Chuck")
        );
        expect(nodes.map(n => n.name)).to.have.members([
            "Donna",
            "Eddie",
            "Fred"
        ]);

        nodes = await queryer.getImmediateChildren(
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(nodes.length).to.equal(0);
    });

    it("`getAllParents` should return all parents", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let nodes = await queryer.getAllParents(
            await getNodeIdFromName(tableName, "Chuck")
        );
        expect(nodes.map(n => n.name)).to.have.members(["Albert"]);

        nodes = await queryer.getAllParents(
            await getNodeIdFromName(tableName, "Donna")
        );
        expect(nodes.map(n => n.name)).to.have.members(["Chuck", "Albert"]);

        nodes = await queryer.getAllParents(
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(nodes.map(n => n.name)).to.have.members(["Albert"]);

        nodes = await queryer.getAllParents(
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(nodes.length).to.equal(0);
    });

    it("`getImmediateParent` should return the immediate parent", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let node = await queryer.getImmediateParent(
            await getNodeIdFromName(tableName, "Chuck")
        );
        expect(node.valueOrThrow().name).to.equal("Albert");

        node = await queryer.getImmediateParent(
            await getNodeIdFromName(tableName, "Donna")
        );
        expect(node.valueOrThrow().name).to.equal("Chuck");

        node = await queryer.getImmediateParent(
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(node.valueOrThrow().name).to.equal("Albert");

        node = await queryer.getImmediateParent(
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(node.equals(Maybe.nothing())).to.be.true;
    });

    it("`getAllNodesAtLevel` should return all nodes at N level", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let nodes = await queryer.getAllNodesAtLevel(1);
        expect(nodes.length).to.equal(1);
        expect(nodes[0].name).to.equal("Albert");

        nodes = await queryer.getAllNodesAtLevel(2);
        expect(nodes.map(n => n.name)).to.have.members(["Bert", "Chuck"]);

        nodes = await queryer.getAllNodesAtLevel(3);
        expect(nodes.map(n => n.name)).to.have.members([
            "Donna",
            "Eddie",
            "Fred"
        ]);

        nodes = await queryer.getAllNodesAtLevel(4);
        expect(nodes.length).to.equal(0);
    });

    it("`getLevelOfNode` should return the level number of the node", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let level: number;
        level = await queryer.getLevelOfNode(
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(level).to.equal(1);

        level = await queryer.getLevelOfNode(
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(level).to.equal(2);

        level = await queryer.getLevelOfNode(
            await getNodeIdFromName(tableName, "Chuck")
        );
        expect(level).to.equal(2);

        level = await queryer.getLevelOfNode(
            await getNodeIdFromName(tableName, "Donna")
        );
        expect(level).to.equal(3);

        level = await queryer.getLevelOfNode(
            await getNodeIdFromName(tableName, "Fred")
        );
        expect(level).to.equal(3);

        level = await queryer.getLevelOfNode(
            await getNodeIdFromName(tableName, "Eddie")
        );
        expect(level).to.equal(3);
    });

    it("`getTreeHeight` should return the tree height", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let height = await queryer.getTreeHeight();
        expect(height).to.equal(3);
    });

    it("`getLeftMostImmediateChild` should return left most immediate child", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let node: Maybe<NodeRecord>;
        node = await queryer.getLeftMostImmediateChild(
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(node.valueOrThrow().name).to.equal("Bert");

        node = await queryer.getLeftMostImmediateChild(
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(node.equals(Maybe.nothing())).to.be.true;

        node = await queryer.getLeftMostImmediateChild(
            await getNodeIdFromName(tableName, "Chuck")
        );
        expect(node.valueOrThrow().name).to.equal("Donna");

        node = await queryer.getLeftMostImmediateChild(
            await getNodeIdFromName(tableName, "Eddie")
        );
        expect(node.equals(Maybe.nothing())).to.be.true;
    });

    it("`getRightMostImmediateChild` should return right most immediate child", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let node: Maybe<NodeRecord>;
        node = await queryer.getRightMostImmediateChild(
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(node.valueOrThrow().name).to.equal("Chuck");

        node = await queryer.getRightMostImmediateChild(
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(node.equals(Maybe.nothing())).to.be.true;

        node = await queryer.getRightMostImmediateChild(
            await getNodeIdFromName(tableName, "Chuck")
        );
        expect(node.valueOrThrow().name).to.equal("Fred");

        node = await queryer.getRightMostImmediateChild(
            await getNodeIdFromName(tableName, "Eddie")
        );
        expect(node.equals(Maybe.nothing())).to.be.true;
    });

    it("`getTopDownPathBetween` should return top down path between two nodes", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let nodes: Maybe<NodeRecord[]>;
        nodes = await queryer.getTopDownPathBetween(
            await getNodeIdFromName(tableName, "Albert"),
            await getNodeIdFromName(tableName, "Donna")
        );
        expect(nodes.valueOrThrow().map(n => n.name)).to.have.members([
            "Albert",
            "Chuck",
            "Donna"
        ]);

        nodes = await queryer.getTopDownPathBetween(
            await getNodeIdFromName(tableName, "Albert"),
            await getNodeIdFromName(tableName, "Eddie")
        );
        expect(nodes.valueOrThrow().map(n => n.name)).to.have.members([
            "Albert",
            "Chuck",
            "Eddie"
        ]);

        nodes = await queryer.getTopDownPathBetween(
            await getNodeIdFromName(tableName, "Chuck"),
            await getNodeIdFromName(tableName, "Fred")
        );
        expect(nodes.valueOrThrow().map(n => n.name)).to.have.members([
            "Chuck",
            "Fred"
        ]);

        nodes = await queryer.getTopDownPathBetween(
            await getNodeIdFromName(tableName, "Albert"),
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(nodes.valueOrThrow().map(n => n.name)).to.have.members([
            "Albert",
            "Bert"
        ]);

        nodes = await queryer.getTopDownPathBetween(
            await getNodeIdFromName(tableName, "Bert"),
            await getNodeIdFromName(tableName, "Fred")
        );
        // --- there is no path between Bert and Fred
        expect(nodes.equals(Maybe.nothing())).to.be.true;
    });

    it("`compareNodes` should return 'ancestor', 'descendant', 'equal', 'unrelated' based on the nodes' level on the available path", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        let compareResult: CompareNodeResult;
        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Albert"),
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(compareResult).to.equal("ancestor");

        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Bert"),
            await getNodeIdFromName(tableName, "Albert")
        );
        expect(compareResult).to.equal("descendant");

        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Bert"),
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(compareResult).to.equal("equal");

        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Bert"),
            await getNodeIdFromName(tableName, "Eddie")
        );
        // --- as there is no path between Bert & Eddie
        // --- i.e. Eddie is not Bert's subordinate
        expect(compareResult).equal("unrelated");

        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Eddie"),
            await getNodeIdFromName(tableName, "Bert")
        );
        expect(compareResult).equal("unrelated");

        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Chuck"),
            await getNodeIdFromName(tableName, "Donna")
        );
        expect(compareResult).to.equal("ancestor");

        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Chuck"),
            await getNodeIdFromName(tableName, "Donna")
        );
        expect(compareResult).to.equal("ancestor");

        compareResult = await queryer.compareNodes(
            await getNodeIdFromName(tableName, "Chuck"),
            "60194a60-aaaa-aaaa-aaaa-3e4d3c2cfefc" //--- non exists node
        );
        expect(compareResult).equal("unrelated");
    });

    it("`createRootNode` should create a root node", async () => {
        const tableName = await createTestTable();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        const nodeId = await queryer.createRootNode({
            name: "test root node name",
            desc: "test root node description"
        });
        expect(typeof nodeId).to.equal("string");
        expect(nodeId.length).to.equal(36);

        const result = await pool.query(
            `SELECT * FROM "${tableName}" WHERE "id" = $1`,
            [nodeId]
        );
        expect(_.isArray(result.rows)).to.equal(true);
        expect(result.rows[0].name).to.equal("test root node name");
        expect(result.rows[0].desc).to.equal("test root node description");
        expect(result.rows[0].left).to.equal(1);
        expect(result.rows[0].right).to.equal(2);

        expect(queryer.createRootNode({ name: "abc" })).be.rejectedWith(
            `A root node with id: ${nodeId} already exists`
        );
    });

    it("`createRootNode` should create a root node and set right correctly", async () => {
        // --- create a non empty table
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);
        queryer.defaultSelectFieldList = [
            "id",
            "name",
            "desc",
            "left",
            "right"
        ];

        const originalRootNode = await queryer.getRootNode();
        // --- delete the root node
        await pool.query(`DELETE FROM "${tableName}" WHERE "id" = $1`, [
            originalRootNode.valueOrThrow().id
        ]);

        const nodeId = await queryer.createRootNode({
            name: "test root node name",
            desc: "test root node description"
        });
        expect(typeof nodeId).to.equal("string");
        expect(nodeId.length).to.equal(36);

        const newRootNode = (await queryer.getRootNode()).valueOrThrow();
        expect(newRootNode.name).to.equal("test root node name");
        expect(newRootNode.desc).to.equal("test root node description");
        expect(newRootNode.left).to.equal(1);
        expect(newRootNode.right).to.equal(12); // --- right should be 12
    });

    it("`insertNode` should insert the node to the parent node specified", async () => {
        const tableName = await createTestTable();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        const nodeId = await queryer.createRootNode({
            name: "Albert"
        });
        expect(typeof nodeId).to.equal("string");
        expect(nodeId.length).to.equal(36);

        const rootNode = (await queryer.getRootNode()).valueOrThrow();
        await queryer.insertNode(rootNode["id"], { name: "Bert" });

        const lv3ParentNodeId = await queryer.insertNode(nodeId, {
            name: "Chuck"
        });

        expect(typeof lv3ParentNodeId).to.equal("string");
        expect(lv3ParentNodeId.length).to.equal(36);

        await queryer.insertNode(lv3ParentNodeId, { name: "Donna" });
        await queryer.insertNode(lv3ParentNodeId, { name: "Eddie" });
        await queryer.insertNode(lv3ParentNodeId, { name: "Fred" });

        let testNode = (await queryer.getNodes({ name: "Albert" }))[0];
        expect(testNode.left).to.equal(1);
        expect(testNode.right).to.equal(12);

        testNode = (await queryer.getNodes({ name: "Bert" }))[0];
        expect(testNode.left).to.equal(2);
        expect(testNode.right).to.equal(3);

        testNode = (await queryer.getNodes({ name: "Chuck" }))[0];
        expect(testNode.left).to.equal(4);
        expect(testNode.right).to.equal(11);

        testNode = (await queryer.getNodes({ name: "Donna" }))[0];
        expect(testNode.left).to.equal(5);
        expect(testNode.right).to.equal(6);

        testNode = (await queryer.getNodes({ name: "Eddie" }))[0];
        expect(testNode.left).to.equal(7);
        expect(testNode.right).to.equal(8);

        testNode = (await queryer.getNodes({ name: "Fred" }))[0];
        expect(testNode.left).to.equal(9);
        expect(testNode.right).to.equal(10);
    });

    it("`insertNodeToRightOfSibling` should insert the node to the right side of specified sibling", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        const bertId = (await queryer.getNodes({ name: "Bert" }))[0]["id"];
        const bert1nodeId = await queryer.insertNodeToRightOfSibling(bertId, {
            name: "Bert1"
        });
        expect(typeof bert1nodeId).to.equal("string");
        expect(bert1nodeId.length).to.equal(36);

        const lv2Nodes = await queryer.getAllNodesAtLevel(2);
        const bert1 = lv2Nodes.find(n => n.id === bert1nodeId);
        expect(_.isUndefined(bert1)).to.equal(false);

        const bert = lv2Nodes.find(n => n.id === bertId);
        expect(_.isUndefined(bert)).to.equal(false);

        const chuckId = (await queryer.getNodes({ name: "Chuck" }))[0]["id"];
        const chuck = lv2Nodes.find(n => n.id === chuckId);
        expect(_.isUndefined(chuck)).to.equal(false);

        // --- test bert1 is between bert and chuck
        expect(bert.left < bert1.left).to.equal(true);
        expect(bert.right < bert1.right).to.equal(true);

        expect(chuck.left > bert1.left).to.equal(true);
        expect(chuck.right > bert1.right).to.equal(true);

        // --- Chuck's childrens should still be his children
        const childrens = await queryer.getAllChildren(chuckId, false);
        expect(childrens.length).to.equal(3);
        expect(childrens.findIndex(n => n.name === "Donna") !== -1).to.equal(
            true
        );
        expect(childrens.findIndex(n => n.name === "Eddie") !== -1).to.equal(
            true
        );
        expect(childrens.findIndex(n => n.name === "Fred") !== -1).to.equal(
            true
        );
    });

    it("`moveSubTreeTo` should move the subtree to a new parent node (unless specified parent node is not a higeher level node) and maintain correct structure", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        const chuckId = (await queryer.getNodes({ name: "Chuck" }))[0]["id"];
        const bertId = (await queryer.getNodes({ name: "Bert" }))[0]["id"];

        // --- move Chuck under Bert
        await queryer.moveSubTreeTo(chuckId, bertId);

        // --- checking three structure after the chanhes
        let rootNode = (await queryer.getRootNode()).valueOrThrow();
        expect(rootNode.name).to.equal("Albert");

        let lv2Nodes = await queryer.getAllNodesAtLevel(2);
        expect(lv2Nodes.length).to.equal(1);
        expect(lv2Nodes[0].name).to.equal("Bert");

        let lv3Nodes = await queryer.getAllNodesAtLevel(3);
        expect(lv3Nodes.length).to.equal(1);
        expect(lv3Nodes[0].name).to.equal("Chuck");

        let lv4Nodes = await queryer.getAllNodesAtLevel(4);
        expect(lv4Nodes.length).to.equal(3);
        expect(lv4Nodes.map(n => n.name)).to.have.members([
            "Donna",
            "Eddie",
            "Fred"
        ]);

        // --- continue to move `Donna` to `Bert`
        await queryer.moveSubTreeTo(
            (await queryer.getNodes({ name: "Donna" }))[0]["id"],
            (await queryer.getNodes({ name: "Bert" }))[0]["id"]
        );

        // --- checking three structure after the chanhes
        rootNode = (await queryer.getRootNode()).valueOrThrow();
        expect(rootNode.name).to.equal("Albert");

        lv2Nodes = await queryer.getAllNodesAtLevel(2);
        expect(lv2Nodes.length).to.equal(1);
        expect(lv2Nodes[0].name).to.equal("Bert");

        lv3Nodes = await queryer.getAllNodesAtLevel(3);
        expect(lv3Nodes.length).to.equal(2);
        expect(lv3Nodes.map(n => n.name)).to.have.members(["Chuck", "Donna"]);

        lv4Nodes = await queryer.getAllNodesAtLevel(4);
        expect(lv4Nodes.length).to.equal(2);
        expect(lv4Nodes.map(n => n.name)).to.have.members(["Eddie", "Fred"]);

        // --- we shouldn't allow to move Bert's sub stree to Eddie
        // --- as Eddie is one of Bert's subordinate
        let eddieId = (await queryer.getNodes({ name: "Eddie" }))[0]["id"];

        expect(queryer.moveSubTreeTo(bertId, eddieId)).be.rejectedWith(
            `Cannot move a higher level node (id: ${bertId})to its subordinate (id: ${eddieId})`
        );
    });

    it("`moveSubTreeTo` should work on a leaf node as well", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        expect(
            (await queryer.getImmediateParent(
                (await queryer.getNodes({ name: "Donna" }))[0]["id"]
            )).valueOrThrow().name
        ).to.equal("Chuck");

        // --- move `Donna` to `Bert`: there is no path from Donna to Bert
        await queryer.moveSubTreeTo(
            (await queryer.getNodes({ name: "Donna" }))[0]["id"],
            (await queryer.getNodes({ name: "Bert" }))[0]["id"]
        );

        // --- checking three structure after the changes
        let rootNode = (await queryer.getRootNode()).valueOrThrow();
        expect(rootNode.name).to.equal("Albert");

        let lv2Nodes = await queryer.getAllNodesAtLevel(2);
        expect(lv2Nodes.map(n => n.name)).to.have.members(["Bert", "Chuck"]);

        let lv3Nodes = await queryer.getAllNodesAtLevel(3);
        expect(lv3Nodes.map(n => n.name)).to.have.members([
            "Eddie",
            "Donna",
            "Fred"
        ]);
        expect(
            (await queryer.getImmediateParent(
                (await queryer.getNodes({ name: "Donna" }))[0]["id"]
            )).valueOrThrow().name
        ).to.equal("Bert");
    });

    it("`deleteSubTree` should delete the specified subtree and close the gap properly", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        const chuckId = (await queryer.getNodes({ name: "Chuck" }))[0]["id"];
        await queryer.deleteSubTree(chuckId);

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 4);
        await checkNodeLeftRight(queryer, "Bert", 2, 3);

        const results = await pool.query(`SELECT * FROM "${tableName}"`);
        expect(results.rows.length).to.equal(2);
    });

    it("`deleteSubTree` should allow to delete the root node if `allowRootNodeId` is true", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        // --- try delete root stree
        const rootNodeId = (await queryer.getNodes({ name: "Albert" }))[0][
            "id"
        ];
        await queryer.deleteSubTree(rootNodeId, true);

        const results = await pool.query(`SELECT * FROM "${tableName}"`);
        expect(results.rows.length).to.equal(0);
    });

    it("`deleteSubTree` should not allow delete root node if default value is used for `allowRootNodeId` parameter", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        // --- try delete root stree
        const rootNodeId = (await queryer.getNodes({ name: "Albert" }))[0][
            "id"
        ];

        expect(queryer.deleteSubTree(rootNodeId)).be.rejectedWith(
            "Root node id is not allowed!"
        );
    });

    it("`deleteSubTree` should delete a leaf node properly", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        // --- move Bert under Eddie
        await queryer.moveSubTreeTo(
            (await queryer.getNodes({ name: "Donna" }))[0]["id"],
            (await queryer.getNodes({ name: "Bert" }))[0]["id"]
        );

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 12);
        await checkNodeLeftRight(queryer, "Bert", 2, 5);
        await checkNodeLeftRight(queryer, "Chuck", 6, 11);
        await checkNodeLeftRight(queryer, "Donna", 3, 4);
        await checkNodeLeftRight(queryer, "Eddie", 7, 8);
        await checkNodeLeftRight(queryer, "Fred", 9, 10);

        // --- delete Eddie
        await queryer.deleteSubTree(
            (await queryer.getNodes({ name: "Eddie" }))[0]["id"]
        );

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 10);
        await checkNodeLeftRight(queryer, "Bert", 2, 5);
        await checkNodeLeftRight(queryer, "Chuck", 6, 9);
        await checkNodeLeftRight(queryer, "Donna", 3, 4);
        await checkNodeLeftRight(queryer, "Fred", 7, 8);
    });

    it("`deleteNode` should delete the specified node only and move all its children to its parent", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        const chuckId = (await queryer.getNodes({ name: "Chuck" }))[0]["id"];

        // --- delete chuck
        await queryer.deleteNode(chuckId);

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 10);
        await checkNodeLeftRight(queryer, "Bert", 2, 3);
        await checkNodeLeftRight(queryer, "Donna", 4, 5);
        await checkNodeLeftRight(queryer, "Eddie", 6, 7);
        await checkNodeLeftRight(queryer, "Fred", 8, 9);
    });

    it("`deleteNode` should delete the specified node only and close the gap properly for 3 levels children & 2 levels parents", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        // --- move Bert under Eddie
        await queryer.moveSubTreeTo(
            (await queryer.getNodes({ name: "Bert" }))[0]["id"],
            (await queryer.getNodes({ name: "Eddie" }))[0]["id"]
        );

        // --- move Donna under Bert
        await queryer.moveSubTreeTo(
            (await queryer.getNodes({ name: "Donna" }))[0]["id"],
            (await queryer.getNodes({ name: "Bert" }))[0]["id"]
        );

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 12);
        await checkNodeLeftRight(queryer, "Chuck", 2, 11);
        await checkNodeLeftRight(queryer, "Eddie", 3, 8);
        await checkNodeLeftRight(queryer, "Bert", 4, 7);
        await checkNodeLeftRight(queryer, "Donna", 5, 6);
        await checkNodeLeftRight(queryer, "Fred", 9, 10);

        // --- delete Eddie
        await queryer.deleteNode(
            (await queryer.getNodes({ name: "Eddie" }))[0]["id"]
        );

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 10);
        await checkNodeLeftRight(queryer, "Chuck", 2, 9);
        await checkNodeLeftRight(queryer, "Bert", 3, 6);
        await checkNodeLeftRight(queryer, "Donna", 4, 5);
        await checkNodeLeftRight(queryer, "Fred", 7, 8);
    });

    it("`deleteNode` should delete the specified node only and close the gap properly for 2 levels children & 2 levels parents", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        // --- move Bert under Eddie
        await queryer.moveSubTreeTo(
            (await queryer.getNodes({ name: "Bert" }))[0]["id"],
            (await queryer.getNodes({ name: "Eddie" }))[0]["id"]
        );

        // --- move Donna under Bert
        await queryer.moveSubTreeTo(
            (await queryer.getNodes({ name: "Donna" }))[0]["id"],
            (await queryer.getNodes({ name: "Bert" }))[0]["id"]
        );

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 12);
        await checkNodeLeftRight(queryer, "Chuck", 2, 11);
        await checkNodeLeftRight(queryer, "Eddie", 3, 8);
        await checkNodeLeftRight(queryer, "Bert", 4, 7);
        await checkNodeLeftRight(queryer, "Donna", 5, 6);
        await checkNodeLeftRight(queryer, "Fred", 9, 10);

        // --- delete Bert
        await queryer.deleteNode(
            (await queryer.getNodes({ name: "Bert" }))[0]["id"]
        );

        // --- checking left nodes data
        await checkNodeLeftRight(queryer, "Albert", 1, 10);
        await checkNodeLeftRight(queryer, "Chuck", 2, 9);
        await checkNodeLeftRight(queryer, "Eddie", 3, 6);
        await checkNodeLeftRight(queryer, "Donna", 4, 5);
        await checkNodeLeftRight(queryer, "Fred", 7, 8);
    });

    it("`deleteNode` should not allow to delete a root node", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = ["id", "name", "left", "right"];

        // --- delete Albert (root Node)
        expect(
            queryer.deleteNode(
                (await queryer.getNodes({ name: "Albert" }))[0]["id"]
            )
        ).be.rejectedWith("Delete a root node is not allowed!");
    });

    it("`updateNode` should update node data properly and ignore `id`, `left` & `right` fields", async () => {
        const tableName = await createTestTableWithTestData();
        const queryer = new NestedSetModelQueryer(pool, tableName);

        queryer.defaultSelectFieldList = [
            "id",
            "name",
            "desc",
            "left",
            "right"
        ];
        const albertId = (await queryer.getNodes({ name: "Albert" }))[0]["id"];
        await queryer.updateNode(albertId, {
            id: "testId", // --- should be ignored
            left: 14, // --- should be ignored
            right: 16, // --- should be ignored
            name: "test name",
            desc: "test desc"
        });

        const albertNode = (await queryer.getNodeById(albertId)).valueOrThrow();
        expect(albertNode.id).to.equal(albertId);
        expect(albertNode.left).to.equal(1);
        expect(albertNode.right).to.equal(12);
        expect(albertNode.name).to.equal("test name");
        expect(albertNode.desc).to.equal("test desc");
    });
});
