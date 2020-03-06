### Create a release branch

This should happen just before or after a complete QA of the system. During the test issues will be created for bugs found - if any are release blockers, the PRs that fix them should be based on this release branch. Anything else should be based on `master`.

-   [ ] Check out master and ensure you don't have any extra changes

```bash
git checkout master
git status
```

-   [ ] `git pull`

-   [ ] Check this out into a release branch

```
git checkout -b release/0.0.x
```

-   [ ] Run `lerna publish` to bump the version number to a Release Candidate version (`v*.*.\*-RC1)

```bash
lerna publish --skip-npm --skip-git --force-publish
```

-   [ ] Use a text editor to do a find-and-replace-in-project for the old version to make sure that there's not extra references to the old version number lying around. In particular update the prod config to point at this new version. Also make sure to change `deploy/helm/magda/Chart.yaml` and `deploy/helm/magda-core/Chart.yaml`.

-   [ ] Commit and push.

### Bump version in master

-   [ ] Run `lerna publish` to bump the version number to a the next development version (x.x.x-0).

```bash
git checkout master
lerna publish --skip-npm --skip-git --force-publish
```

-   [ ] Use a text editor to do a find-and-replace-in-project for the old version to make sure that there's not extra references to the old version number lying around - we want to automate this whereever possible but it happens. Ensure that the prod config continues to point at a release version, but the dev config should point at the new version. Also make sure to change `deploy/helm/magda/Chart.yaml` and `deploy/helm/magda-core/Chart.yaml`.

-   [ ] Commit the changes and create a PR against `master` for the version bump.

### (When all release-blocker bugs resolved) Release the RC

-   [ ] Check out the release branch and make sure it's up to date, then tag it as an RC and push it.

```bash
git checkout release/x.x.x
git pull
git tag vx.x.x-RC1 # The "v" in the tag is very important!!
git push vx.x.x-RC1
```

This will cause a slightly different build pipeline to run - it will automatically push images to docker hub with the current version as specified in the root package json and create a full preview at https://vx-x-x-rc1.dev.magda.io using those images.

-   [ ] Test https://vx-x-x-rc1.dev.magda.io. If it succeeds then proceed, otherwise fix it and go back to "Release the RC", bumping the RC version by one.

-   [ ] Shut down the staging namespace in Gitlab.

### Publish to prod

-   [ ] Connect to the prod cluster

```bash
kubectl config use-context <prod-cluster-name>
```

-   [ ] Check if there's been any changes to the search index definitions `magda-scala-common/src/main/resources/common.conf` since the last release branch.

-   [ ] Helm upgrade prod

If there were changes to the index versions, you'll need to set the search api to still point at the previous version of the index while the indexer builds the new one:

```bash
helm upgrade magda --timeout 999999999 --wait -f deploy/helm/search-data-gov-au.yml deploy/helm/magda --set search-api.datasetsIndexVersion=<version>,search-api.regionsIndexVersion=<version>
```

Once the indexer has finished (watch `kubectl logs -f <indexer pod name>`) or if there's no changes to the indices:

```bash
helm upgrade magda --timeout 999999999 --wait -f deploy/helm/search-data-gov-au.yml deploy/helm/magda
```

-   [ ] Look at the logs on magda-registry and the webhooks table of the database to make sure it's processing webhooks again

```
kubectl logs -f <registry-api-pod-name>
kubectl port-forward <cloud-sql-proxy-pod-name> 5432:5432
```

-   [ ] Generate/deploy new cron jobs

```bash
cd deploy
yarn run create-connector-configmap
yarn run generate-connector-jobs-prod
mkdir kubernetes/generated/prod/cron
mv kubernetes/generated/prod/*-cron.json kubernetes/generated/prod/cron
kubectl apply -f kubernetes/generated/prod/cron
cd ..
```

-   [ ] Test on prod:

    -   Make sure Google Analytics is reporting your presence
    -   Do a regression test
    -   Ensure that prod-specific settings (particularly absence of user accounts) are in place correctly
    -   If there's a problem then go back to "Release the RC", bumping the RC version by one.
    -   Also do a post-mortem so this doesn't happen again. Things going wrong in dev is ok, but they shouldn't break in prod!

-   [ ] Mark the tag as a pre-release in github

### Merge the changes in the release branch back into master

```
git checkout <release-branch>
git checkout -b merge-<version>
lerna publish --force-publish --skip-npm --skip-git # Set version to same as master
# Also make sure any other version (particularly in Chart.yaml) is updated
git pull origin master
git push origin merge-<version>
```

And open a PR on master.

### Push the previous RC of last version as a release

Now we've released a whole new version, presumably the previous version on prod proved stable enough to release as not an RC, so lets release that as a proper release.

-   [ ] Check out last version's release branch

```bash
git checkout release/x.x.x
```

-   [ ] Set the version number as an actual release version (no "-RCx") and push it to docker and github

```bash
lerna publish --skip-npm --skip-git --force-publish
```

-   [ ] Use a text editor to correct any references to the RC version that didn't get changed.

-   [ ] Commit and tag as vx.x.x, then push the tag

-   [ ] Retag the last RC docker images as the new version

```bash
yarn run retag-and-push -- -- --fromVersion=x.x.x-RC1 --toVersion=x.x.x
```

-   [ ] Set that latest tag as a "release" in github.

*   [ ] Delete the release branch in github
