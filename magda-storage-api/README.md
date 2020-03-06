# Storage API

Magda service to store/retrieve files.

The service stores files to a [MinIO](https://min.io/) server in a specified MinIO bucket.

## Running

[The Example Config](./config.example.json) should give an idea on the structure of the
expected config file. Create a `config.json` file with the appropriate parameters.

```json5
// Example Config
{
    listenPort: 6121,
    minioAccessKey: "", // You would have specified this when creating the MinIO server
    minioSecretKey: "", // You would have specified this when creating the MinIO server
    minioEnableSSL: true,
    minioHost: "localhost",
    minioPort: 9000,
    uploadLimit: "100mb"
}
```

If you do not have `yarn` installed, install `yarn` via:

```console
$ sudo npm install yarn -g
$ yarn -v
```

From the `magda-storage-api` directory, run:

```console
$ yarn run dev
Storage API started on port 6121
```

## API

### PUT /:bucketid

Attempts to create a bucket with the name `<bucketid>`.

_Note:_ If the bucket exists, the request will not fail.

#### Example usage

```console
$ curl -X PUT localhost:6121/v0/test-bucket
{"message":"Bucket test-bucket created successfully in unspecified region 🎉"}
```

### PUT /:bucket/:fileid

Attempts to upload content to the MinIO `<bucket>`. Gives it a name `<fileid>` and returns a unique etag
if the upload is successfull.

#### Example usage

```console
$ cat ./favourite.csv
column1,column2
A,1234
B,4321
C,2007
$ curl -X PUT -H "Content-Type:text/csv" localhost:6121/v0/test-bucket/myFavouriteCSV --data-binary '@favourite.csv'
{"message":"File uploaded successfully","etag":"<some hash value>"}
```

### GET /:bucket/:fileid

Attempts to retrieve content with the name `<fileid>` from the MinIO server
that is stored in `<bucket>`.

#### Example usage

```console
$ curl -X GET localhost:6121/v0/test-bucket/myFavouriteCSV
column1,column2
A,1234
B,4321
C,2007
```

### DELETE /:bucket/:fileid

Deletes object with the name `<fileid>` from the MinIO server
that is stored in `<bucket>`.

_Note_ Does **not** throw an error if the object does not exist.

#### Example usage

```console
$ curl -X DELETE localhost:6121/v0/test-bucket/myFavouriteCSV
{ message: "File deleted successfully" }
```

### Note

The service does not come with authentication or authorization.

## Features in backlog

-   [x] Bucket name to be specified in the request, not at startup
-   [ ] Endpoint to delete an object
