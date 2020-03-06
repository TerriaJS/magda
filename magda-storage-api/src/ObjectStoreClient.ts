import ObjectFromStore from "./ObjectFromStore";

export type CreateBucketResponse = {
    message: string;
    err?: Error;
    success: boolean;
};

export default interface ObjectStoreClient {
    createBucket(
        bucket: string,
        region?: string
    ): Promise<CreateBucketResponse>;
    getFile(bucket: string, name: string): ObjectFromStore;
    putFile(
        bucket: string,
        fileName: string,
        content: any,
        metaData?: object
    ): Promise<any>;
    deleteFile(bucket: string, name: string): Promise<boolean>;
}
