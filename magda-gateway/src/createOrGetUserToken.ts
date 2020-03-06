import passport from "passport";
import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import {
    User,
    UserToken
} from "magda-typescript-common/src/authorization-api/model";

export default function createOrGetUserToken(
    authApi: ApiClient,
    profile: passport.Profile,
    source: string
): Promise<UserToken> {
    return authApi.lookupUser(source, profile.id).then(maybe =>
        maybe.caseOf({
            just: user => Promise.resolve(userToUserToken(user)),
            nothing: () =>
                authApi
                    .createUser(profileToUser(profile, source))
                    .then(userToUserToken)
        })
    );
}

function profileToUser(profile: passport.Profile, source: string): User {
    if (!profile.emails || profile.emails.length === 0) {
        throw new Error("User with no email address");
    }

    return {
        displayName: profile.displayName,
        email: profile.emails[0].value,
        photoURL:
            profile.photos && profile.photos.length > 0
                ? profile.photos[0].value
                : undefined,
        source: source,
        sourceId: profile.id,
        isAdmin: false
    };
}

function userToUserToken(user: User): UserToken {
    return {
        id: <string>user.id
    };
}
