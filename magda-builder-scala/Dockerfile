FROM data61/magda-builder-docker:latest

# A few problems with compiling Java from source:
#  1. Oracle.  Licensing prevents us from redistributing the official JDK.
#  2. Compiling OpenJDK also requires the JDK to be installed, and it gets
#       really hairy.

# Default to UTF-8 file.encoding
ENV LANG C.UTF-8

# add a simple script that can auto-detect the appropriate JAVA_HOME value
# based on whether the JDK or only the JRE is installed
RUN { \
		echo '#!/bin/sh'; \
		echo 'set -e'; \
		echo; \
		echo 'dirname "$(dirname "$(readlink -f "$(which javac || which java)")")"'; \
	} > /usr/local/bin/docker-java-home \
	&& chmod +x /usr/local/bin/docker-java-home
ENV JAVA_HOME /usr/lib/jvm/java-1.8-openjdk
ENV PATH $PATH:/usr/lib/jvm/java-1.8-openjdk/jre/bin:/usr/lib/jvm/java-1.8-openjdk/bin

ENV JAVA_VERSION 8u212
ENV JAVA_ALPINE_VERSION 8.222.10-r0

RUN set -x \
	&& apk add --no-cache openjdk8="$JAVA_ALPINE_VERSION" \
	&& [ "$JAVA_HOME" = "$(docker-java-home)" ]

ENV SBT_VERSION 1.3.3
# make sure cache are captured completely
ENV SBT_OPTS "-Dsbt.global.base=/sbt-cache/sbtboot -Dsbt.boot.directory=/sbt-cache/boot -Dsbt.ivy.home=/sbt-cache/ivy"
ENV COURSIER_CACHE "/sbt-cache/coursier"
ENV SBT_HOME /usr/local/sbt
ENV SCALA_VERSION 2.12.10
ENV PATH ${PATH}:${SBT_HOME}/bin

# Install sbt
RUN mkdir -p "$SBT_HOME" && \
    apk add --no-cache --update wget bash nss && \
    wget -qO - --no-check-certificate "https://piccolo.link/sbt-$SBT_VERSION.tgz" | tar xz -C $SBT_HOME --strip-components=1 && \
    apk del wget && \
	sbt sbtVersion
