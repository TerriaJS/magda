import uuid from "uuid";
import { User } from "../authorization-api/model";

const mockUserData = [
    {
        id: "00000000-0000-4000-8000-000000000000",
        displayName: "admin",
        email: "admin@admin.com",
        photoURL: "http://example.com",
        source: "manual",
        sourceId: "1",
        isAdmin: true
    },
    {
        id: "8D8931AF-86B3-104A-9B24-153491C6EA5E",
        displayName: "Standard User",
        email: "test@test.com",
        photoURL: "http://example.com",
        source: "ckan",
        sourceId: "testuser",
        isAdmin: false
    }
];

let runtimeUserDataStore: User[];

const mockUserDataStore = {
    reset: function() {
        runtimeUserDataStore = mockUserData.map(item => ({ ...item }));
    },

    getData: function() {
        return runtimeUserDataStore;
    },
    getRecordBySourceAndSourceId(source: string, sourceId: string) {
        return runtimeUserDataStore.filter(record => {
            return record.source == source && record.sourceId == sourceId;
        });
    },
    getRecordByUserId(userId: string) {
        return runtimeUserDataStore.filter(record => {
            return record.id == userId;
        });
    },
    getRecordByIndex(idx: number) {
        return runtimeUserDataStore[idx];
    },
    createRecord(user: User) {
        const newRecord: any = { ...user, id: uuid.v4() };
        runtimeUserDataStore.push(newRecord);
        return newRecord;
    },
    countRecord: function() {
        return runtimeUserDataStore.length;
    }
};

mockUserDataStore.reset();

export default mockUserDataStore;
