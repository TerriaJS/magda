# Building and Running

These instructions assume you are using a Bash shell. You can easily get a Bash shell on Windows by installing the [git](https://git-scm.com/downloads) client.

## Prerequisites

You need to install following in order to build MAGDA:

-   [Node.js](https://nodejs.org/en/) - To build and run the TypeScript / JavaScript components, as well as many of the build scripts. Version 9+ works fine as of March 2018.
-   [Java 8 JDK](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html) - To run the JVM components, and to build the small amount of Java code.
-   [sbt](http://www.scala-sbt.org/) - To build the Scala components.
-   [yarn](https://yarnpkg.com/) - Npm replacement that makes node deps in a monorepo much easier.
-   [lerna](https://lerna.js.org/) - To manage our multiple-project repo. Once you have node.js/yarn installed, installing lerna is as simple as `yarn global add lerna`.
-   [pancake](https://github.com/govau/pancake) - To manage design components. Once you have Node.js installed, installing pancake is as simple as `yarn global add @gov.au/pancake`.

To push the images and run them on kubernetes, you'll need to install:

-   [GNU tar](https://www.gnu.org/software/tar/) - (Mac only) MacOS ships with `BSD tar`. However, you will need `GNU tar` for docker images operations. On MacOS, you can install `GNU Tar` via [Homebrew](https://brew.sh/): `brew install gnu-tar`
-   [gcloud](https://cloud.google.com/sdk/gcloud/) - For the `kubectl` tool used to control your Kubernetes cluster. You will also need to this to deploy to our test and production environment on Google Cloud.
-   [Helm 2](https://v2.helm.sh/docs/using_helm/#installing-helm) to manage kubernetes deployments and config.
-   [Docker](https://docs.docker.com/install/) - Magda uses `docker` command line tool to build docker images.

You'll also need a Kubernetes cluster - to develop locally this means installing either [minikube](./installing-minikube.md) or [docker](./installing-docker-k8s.md) (MacOS only at this stage). Potentially you could also do this with native Kubernetes, or with a cloud cluster, but we haven't tried it.

## Trying it out locally

If you just want to try it out locally without actually changing anything, it's much easier to just install [minikube](https://magda.io/docs/installing-minikube.md) or [docker for desktop](https://github.com/magda-io/magda/blob/master/docs/docs/installing-docker-k8s.md), then following the instructions at [https://github.com/magda-io/magda-config/blob/master/legacy.md](https://github.com/magda-io/magda-config/blob/master/legacy.md). What follows is instructions on how to build _everything_, code, databases and all, from scratch into a working application.

## Building and running (just) the frontend

If you just want to edit the UI, you don't actually even need helm -
just clone the repo, run `yarn install` at the root, then `cd magda-web-client` and run `yarn run dev`.
This will build/run a local version of the client, connecting to the API at [https://dev.magda.io/api](https://dev.magda.io/api).
If you want to connect to a magda API hosted elsewhere you can modify the `config.js` file in the client.

## Building and running the backend

First clone the magda directory and `cd` into it.

Then install `npm` dependencies and set up the links between components by running:

```bash
yarn install
```

Once the above prerequisites are in place, and the npm dependencies are installed, building MAGDA is easy.
From the MAGDA root directory, simply run the appropriate build command:

```bash
# If using lerna v3.18.0 or higher
lerna run build --stream --concurrency=1 --include-dependencies

# If verison of lerna is lower than v3.18.0
lerna run build --stream --concurrency=1 --include-filtered-dependencies
```

You can also run the same command in an individual component's directory (i.e. `magda-whatever/`) to build just that component.

### Set up Helm

Helm is the package manager for Kubernetes - we use it to make it so that you can install all the various services you need for MAGDA at once. To install, follow the instructions at [https://github.com/helm/helm#install](https://github.com/helm/helm#install).

In a nutshell, once you have helm installed, this is how you initialise helm and Tiller.

```bash
kubectl apply -f deploy/kubernetes/rbac-config.yaml
helm init --service-account tiller
```

Add Magda Helm Chart Repo:

```bash
helm repo add magda-io https://charts.magda.io
```

### Install a local kube registry

This gives you a local docker registry that you'll upload your built images to so you can use them locally, without having to go via DockerHub or some other external registry.

```bash
helm repo add incubator http://storage.googleapis.com/kubernetes-charts-incubator
helm repo update
helm install --name docker-registry -f deploy/helm/docker-registry.yml stable/docker-registry
helm install --name kube-registry-proxy -f deploy/helm/kube-registry-proxy.yml incubator/kube-registry-proxy
```

### Build local docker images

Now you can build the docker containers locally - this might take quite a while so get a cup of tea.

```bash
eval $(minikube docker-env) # (If you haven't run this already)
lerna run docker-build-local --stream --concurrency=4 --include-filtered-dependencies
```

### Create the necessary secrets with the secret creation script

```bash
yarn run create-secrets
```

### Windows only: Set up a volume for Postgres data

If you're using Docker Desktop on Windows, you'll need to set up a volume to store Postgres data because the standard strategy approach - a `hostpath` volume mapped to a Windows share - will result in file/directory permissions that are not to Postgres's liking. Instead, we'll set up a volume manually which is just a directory in the Docker Desktop VM's virtual disk. We use the unusual path of `/etc/kubernetes` because it is one of the few mount points backed by an actual virtual disk.

```bash
kubectl apply -f deploy/kubernetes/local-storage.yaml
kubectl apply -f deploy/kubernetes/local-storage-volume.yaml
```

Note: If using docker desktop for Windows older than version 19, change the value from "docker-desktop" to "docker-for-desktop" in nodeAffinity in file deploy/kubernetes/local-storage-volume.yaml

### Install Magda on your minikube/docker-desktop cluster

```bash
# update magda helm repo
helm repo update
# update magda chart dependencies
helm dep build deploy/helm/magda
# deploy the magda chart from magda helm repo
helm upgrade --install --timeout 9999 --wait -f deploy/helm/minikube-dev.yml magda deploy/helm/magda
```

This can take a while as it does a lot - downloading all the docker images, starting them up and running database migration jobs. You can see what's happening by opening another tab and running `kubectl get pods -w`.

Also note that by default there won't be any minions running, as some of them can be very CPU intensive. You can toggle them on by specifying `--set tags.minion-<minionname>=true` when you run `helm upgrade`.

If you're using Docker Desktop on Windows, add `-f deploy/helm/docker-desktop-windows.yml` too, i.e. do this instead of the above:

```bash
# update magda helm repo
helm repo update
# update magda chart dependencies
helm dep build deploy/helm/magda
# deploy the magda chart from magda helm repo
helm upgrade --install --timeout 9999 --wait -f deploy/helm/docker-desktop-windows.yml -f deploy/helm/minikube-dev.yml magda deploy/helm/magda
```

If you want to deploy the packed & production ready helm chart in our helm repo:

```bash
# update magda helm repo
helm repo update
# deploy the local magda chart
helm upgrade --install --timeout 9999 --wait -f deploy/helm/minikube-dev.yml magda magda-io/magda
```

**Please Note:**

-   By default, helm will install the latest production version. This excludes development versions (e.g. 0.0.57-0)
-   If you need the latest version (including the development version), please add a `--devel` switch to the `helm upgrade` command above.
-   Alternatively, you can use `--version` to specify a specific version. e.g. `--version 0.0.57-0`

### Crawl Data

By default, helm will create a one-time crawl job for data.gov.au to get you started. If you want to crawl other datasets, look at the config under `connectors:` in `deploy/helm/minikube-dev.yml`. For sources of data, check out `deploy/helm/magda-dev.yml`. Once you've changed your config, just run the `helm upgrade` command above again to make it happen.

## Kubernetes tricks

### Running individual services

If you want to just start up individual pods (e.g. just the combined database) you can do so by setting the `all` tag to `false` and the tag for the pod you want to `true`, e.g.

```bash
helm install --name magda deploy/helm/magda -f deploy/helm/minikube-dev.yml --set tags.all=false --set tags.combined-db=true
```

**You can find all available tags in [deploy/helm/magda-core/requirements.yaml](https://github.com/magda-io/magda/blob/master/deploy/helm/magda-core/requirements.yaml) and [deploy/helm/magda/requirements.yaml](https://github.com/magda-io/magda/blob/master/deploy/helm/magda/requirements.yaml)**

Once everything starts up, you can access the web front end on http://192.168.99.100:30100. The IP address may be different on your system. Get the real IP address by running:

```bash
minikube ip
```

It's a good idea to add an entry for `minikube.data.gov.au` to your `hosts` file (`C:\Windows\System32\drivers\etc\hosts` on Windows), mapping it to your Minikube IP address. Some services may assume this is in place. For example:

```console
192.168.99.100	minikube.data.gov.au
```

### Running on both host and minikube

It's also possible to run what you're working on your host, and the services your dependent on in minikube. Depending on what you're doing, this might be simple or complicated.

### Using the minikube database

This is super-easy, just run

```bash
 kubectl port-forward combined-db-0 5432:5432
```

Now you can connect to the database in minikube as if it were running locally, while still taking advantage of all the automatic schema setup that the docker image does.

### Running a microservice locally but still connecting through the gateway

You might find yourself developing an API locally that depends on authentication, which is easiest done by just logging in through the web interface and connecting through the gateway. You can actually make this work by telling the gateway to proxy your service to `192.168.99.1` in `deploy/helm/magda-core/charts/gateway/templates/configmap.yaml`. For instance, if I wanted to run the search api locally, I'd change `configmap.yaml` like so:

```yaml
data:
  # When the config map is mounted as a volume, these will be created as files.
  routes.json: '{
    "search": {
        "to": "http://192.168.99.1:6102/v0"
    },
    # ...etc
```

Then update helm:

```bash
helm upgrade magda -f deploy/helm/minikube-dev.yml deploy/helm/magda
```

Now when I go to `http://${minikube ip}/api/v0/search`, it'll be proxied to my local search rather than the one in minikube.

Be aware that if your local service has to connect to the database or other microservices in minikube you'll have to use `kube-port-forward` to proxy from `localhost:{port}` to the appropriate service in minikube - you can find a list of ports at https://github.com/magda-io/magda/blob/master/doc/local-ports.md.

In the likely even you need to figure out what the jwt shared secret is on your minikube, you can cheat by opening up a shell to a container that has that secret and echoing the environment variable:

```bash
kubectl exec -it gateway-cf9c575bb-th57x -- /bin/bash
echo $JWT_SECRET
```

### Running local minions

You can use the same pattern for minions - register a webhook with a url host of `192.168.99.1` and it'll post webhooks to your local machine instead of within the minikube network. Be aware that your minion won't be able to find the registry until you use `kubectl port-forward` to make it work... e.g.

```bash
kubectl port-forward registry-api-79f7bf7787-5j52x 6101:80
```

## What do I need to run?

Running individual components is easy enough, but how do we get a fully working system? It is rarely necessary to run _all_ of MAGDA locally, but various components depend on other components as follows:

| Component                 | Dependencies                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `magda-*-connector`       | `magda-registry-api`                                                                                             |
| `magda-*-minion`          | `magda-registry-api`                                                                                             |
| `magda-authorization-api` | `magda-postgres`, `magda-migrator-combined-db`                                                                   |
| `magda-gateway`           | `magda-registry-api`, `magda-search-api`, `magda-web-client`, `magda-authorization-api`, `magda-discussions-api` |
| `magda-indexer`           | `magda-elastic-search`                                                                                           |
| `magda-registry-api`      | `magda-postgres`, `magda-migrator-combined-db`                                                                   |
| `magda-search-api`        | `magda-elastic-search`                                                                                           |
| `magda-web-client`        | `magda-web-server`, but uses API at https://dev.magda.io/api if server is not running.                           |
| `magda-web-server`        | none, but if this is running then `magda-gateway` and its dependencies must be too or API calls will fail.       |

## Architecture Diagram

The following `Architecture Diagram` may help you to get clearer idea which components you need to run in order to look at a particular function area:

![Magda Architecture Diagram](./magda-architecture.png)

The following table shows the relationship between `Magda components` and `Diagram elements`:

| Component                         | Diagram elements                                                                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `magda-admin-api`                 | `Admin API (NodeJS)`                                                                                                                                                                                                                                 |
| `magda-*-connector`               | `Connectors`                                                                                                                                                                                                                                         |
| `magda-elastic-search`            | `ES Client`, `ES Data (x2)`, `ES Master (x3)`                                                                                                                                                                                                        |
| `magda-*-minion`                  | `Minions`                                                                                                                                                                                                                                            |
| `magda-authorization-api`         | `Auth API (NodeJS)`                                                                                                                                                                                                                                  |
| `magda-gateway`                   | `Gateway (x1+) (NodeJS)`                                                                                                                                                                                                                             |
| `magda-indexer`                   | `Search Indexer (Scala)`                                                                                                                                                                                                                             |
| `magda-registry-api`              | `Registry API (Scala)`                                                                                                                                                                                                                               |
| `magda-search-api`                | `Search API (Scala)`                                                                                                                                                                                                                                 |
| `magda-web-client`                | `MAGDA Web UI`                                                                                                                                                                                                                                       |
| `magda-web-server`                | `Web Server (NodeJS)`                                                                                                                                                                                                                                |
| `magda-preview-map`               | `Terria Server (NodeJS)`                                                                                                                                                                                                                             |
| `magda-postgres`                  | All databases - see the migrators that set up the individual database schemas below                                                                                                                                                                  |
| `magda-migrator-authorization-db` | `Auth DB (Postgres)`. `magda-migrator-authorization-db` is only used for production environment.                                                                                                                                                     |
| `magda-migrator-discussions-db`   | `Discussion DB (Postgres)`. `magda-migrator-discussions-db` is only used for production environment.                                                                                                                                                 |
| `magda-migrator-registry-db`      | `Registry DB (Postgres)`. `magda-migrator-registry-db` is only used for production environment.                                                                                                                                                      |
| `magda-migrator-session-db`       | `Session DB (Postgres)`. `magda-migrator-session-db` is only used for production environment.                                                                                                                                                        |
| `magda-migrator-combined-db`      | `Registry DB (Postgres)`, `Session DB (Postgres)`, `Discussion DB (Postgres)`, `Auth DB (Postgres)`. `magda-migrator-combined-db` component is only used for dev environment. Production environment will launch all DB components above separately. |

## Running on your host machine

You can also avoid minikube and run magda components on your local machine - this is much, much trickier. In any component (except databases/elasticsearch), you can run:

```bash
yarn run dev
```

This will build and launch the component, and automatically stop, build, and restart it whenever source changes are detected. In some cases (e.g. code generation), it is necessary to run `yarn run build` at least once before `yarn run dev` will work. Typically it is _not_ necessary to run `yarn run build` again in the course of development, though, unless you're changing something other than source code.

A typical use case would be:

1.  Start `combined-db` in `Minikube` using `helm:`

From root level of the project directory:

```bash
helm install --name magda deploy/helm/magda -f deploy/helm/minikube-dev.yml --set tags.all=false --set tags.combined-db=true
```

2.  Port forward database service port to localhost so that your local running program (outside the `Kubernetes` cluster in `minikube`) can connect to them:

```bash
# Port forward database
# this command doesn't terminate, so run it in a separate terminal
kubectl port-forward combined-db-0 5432:5432
```

3.  Start the registry API by executing the following command

```bash
cd magda-registry-api && yarn run dev
```

4.  (Optional) If later you wanted to start elastic search as well:

Like `combined-db`, elastic search can only be started in `minikube` via `helm` rather than `yarn run dev`.

You need to upgrade previously installed `helm` chart `magda` to include `magda-elastic-search` component:

```bash
helm upgrade magda deploy/helm/magda -f deploy/helm/minikube-dev.yml --set tags.all=false --set tags.combined-db=true --set tags.elasticsearch=true
```

And then, port forward `elasticsearch` so that you can run other components that may need to connect to `elasticsearch` outside the `minikube`:

```bash
# Port forward elasticsearch
# this commands doesn't terminate, so run it in a separate terminal
kubectl port-forward es-data-0 9300:9300
```

## Debugging Node.js / TypeScript components

Node.js / TypeScript components can easily be debugged using the [Visual Studio Code](https://code.visualstudio.com/) debugger. Set up a launch configuration like this:

```javascript
{
    "type": "node",
    "request": "launch",
    "protocol": "inspector",
    "name": "Launch CKAN Connector",
    "runtimeExecutable": "${workspaceRoot}/scripts/node_modules/.bin/ts-node",
    "windows": {
        "runtimeExecutable": "${workspaceRoot}/scripts/node_modules/.bin/ts-node.cmd"
    },
    "runtimeArgs":[
        "src/index.ts"
    ],
    "args":[
        "--name", "data.gov.au", "--sourceUrl", "https://data.gov.au/"
    ],
    "cwd": "${workspaceRoot}/magda-ckan-connector"
}
```

## Debugging Scala components

Scala components can easily be debugged using the IntelliJ debugger. Create a debug configuration for the `App` class of whatever component you're debugging.
