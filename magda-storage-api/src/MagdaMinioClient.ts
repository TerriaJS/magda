import ObjectFromStore from "./ObjectFromStore";
import ObjectStoreClient from "./ObjectStoreClient";
import { CreateBucketResponse } from "./ObjectStoreClient";
import { Stream, Readable } from "stream";

import * as Minio from "minio";

export default class MagdaMinioClient implements ObjectStoreClient {
    private readonly client: Minio.Client;
    private readonly bucketName: string = "magda-bucket";
    private readonly region: string;

    constructor({
        endPoint,
        port,
        useSSL,
        accessKey,
        secretKey,
        region = "unspecified-region"
    }: any) {
        this.client = new Minio.Client({
            endPoint,
            port,
            useSSL,
            accessKey,
            secretKey,
            region
        });
        this.region = region;
        this.createBucket(this.bucketName);
    }

    createBucket(bucket: string): Promise<CreateBucketResponse> {
        return new Promise((resolve, reject) => {
            return this.client.makeBucket(bucket, this.region, (err: Error) => {
                if (err) {
                    if ((err as any).code === "BucketAlreadyOwnedByYou") {
                        return resolve({
                            message: "Bucket " + bucket + " already exists 👍",
                            success: false
                        });
                    } else {
                        console.error("😢 Error creating bucket: ", err);
                        return reject(err);
                    }
                }
                return resolve({
                    message:
                        "Bucket " +
                        bucket +
                        " created successfully in " +
                        this.region +
                        " 🎉",
                    success: true
                });
            });
        });
    }

    getFile(bucket: string, fileName: string): ObjectFromStore {
        const streamP = new Promise((resolve, reject) => {
            return this.client.getObject(
                bucket,
                fileName,
                (err: Error, dataStream: Stream) => {
                    if (err) {
                        console.error(err);
                        return reject("Encountered Error while getting file");
                    }
                    return resolve(dataStream);
                }
            );
        });
        const statP = new Promise((resolve, reject) => {
            return this.client.statObject(
                bucket,
                fileName,
                (err: Error, stat: any) => {
                    if (err) {
                        reject(err);
                    }
                    return resolve(stat);
                }
            );
        });

        return {
            createStream() {
                return streamP.then((stream: any) => {
                    return stream;
                });
            },
            headers() {
                return statP.then((stat: any) =>
                    Promise.resolve({
                        "Content-Type": stat.metaData["content-type"],
                        "Content-Encoding": stat.metaData["content-encoding"],
                        "Cache-Control": stat.metaData["cache-control"],
                        "Content-Length": stat.size
                    })
                );
            }
        };
    }

    putFile(
        bucket: string,
        objectName: string,
        content: any,
        metaData?: object
    ): Promise<any> {
        const contentSize = content.length;
        const contentStream = new Readable();

        /*  https://stackoverflow.com/questions/12755997/how-to-create-streams-from-string-in-node-js/22085851#22085851
            (Update: in v0.10.26 through v9.2.1 so far, a call to push directly
            from the REPL prompt will crash with a not implemented exception
            if you didn't set _read. It won't crash inside a function or a script.
            If inconsistency makes you nervous, include the noop.)
        */
        // tldr; otherwise .push crashes in some versions of node with a 'not implemented' error
        contentStream._read = () => {};
        contentStream.push(content);
        contentStream.push(null);

        return new Promise((resolve, reject) => {
            return this.client.putObject(
                bucket,
                objectName,
                contentStream,
                contentSize,
                metaData,
                (err: Error, eTag: string) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(eTag);
                }
            );
        });
    }

    /**
     *
     * @param bucket Bucket to remove the object from
     * @param objectName Name of the object in the bucket
     * @returns Whether or not deletion has been successful
     */
    deleteFile(bucket: string, objectName: string): Promise<boolean> {
        return new Promise((resolve, _reject) => {
            return this.client.removeObject(bucket, objectName, function(
                err: any
            ) {
                if (err) {
                    console.error("Unable to remove object: ", err);
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }
}
