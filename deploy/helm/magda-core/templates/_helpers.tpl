{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dockerimage" -}}
"{{ .Values.image.repository | default .Values.global.image.repository }}/magda-{{ .Chart.Name }}:{{ .Values.image.tag | default .Values.global.image.tag }}"
{{- end -}}

{{- define "postgres" -}}
"{{ .Values.image.repository | default .Values.global.image.repository }}/magda-postgres:{{ .Values.image.tag | default .Values.global.image.tag }}"
{{- end -}}

{{- define "magda.postgres-client-env" -}}
        - name: CLIENT_USERNAME
          value: {{- if .Values.global.useCloudSql }} proxyuser {{- else }} client {{- end }}
        - name: CLIENT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: cloudsql-db-credentials
              key: password
{{- end -}}

{{- define "magda.postgres-migrator-env" }}
        - name: PGUSER
          value: postgres
        {{- if .Values.global.noDbAuth }}
        - name: PGPASSWORD
          value: password
        {{- else if .Values.global.useCloudSql }}
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: cloudsql-db-credentials
              key: password
        {{- else if not .Values.global.noDbAuth }}
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: db-passwords
              key: {{ .Chart.Name }}
        {{- end }}
        - name: CLIENT_USERNAME
          value: client
        {{- if .Values.global.noDbAuth }}
        - name: CLIENT_PASSWORD
          value: password
        {{- else }}
        - name: CLIENT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-passwords
              key: {{ .Chart.Name }}-client
        {{- end }}
{{- end -}}

{{- define "magda.postgres-env" -}}
        {{- template "magda.postgres-migrator-env" . }}
        {{- if .Values.limits }}
        - name: MEMORY_LIMIT
          value: {{ .Values.limits.memory }}
        {{- end }}
        {{- if .Values.waleBackup }}
        - name: BACKUP
          value: {{ .Values.waleBackup.method | default "NONE" | quote }}
        - name: BACKUP_RO
          value: {{ .Values.waleBackup.readOnly | default "FALSE" | upper | quote }}
        - name: BACKUP_RECOVERY_MODE
          value: {{ .Values.waleBackup.recoveryMode | quote }}
        - name: WALE_S3_PREFIX
          value: {{ .Values.waleBackup.s3Prefix }}
        - name: AWS_ACCESS_KEY_ID
          value: {{ .Values.waleBackup.awsAccessKeyId }}
        - name: AWS_SECRET_ACCESS_KEY
          value: {{ .Values.waleBackup.secretAccessKey }}
        - name: AWS_REGION
          value: {{ .Values.waleBackup.awsRegion }}
        - name: WALE_WABS_PREFIX
          value: {{ .Values.waleBackup.wabsPrefix }}
        - name: WABS_ACCOUNT_NAME
          value: {{ .Values.waleBackup.wabsAccountName }}
        - name: WABS_ACCESS_KEY
          value: {{ .Values.waleBackup.wabsAccessKey }}
        - name: WABS_SAS_TOKEN
          value: {{ .Values.waleBackup.wabsSasToken }}
        - name: WALE_GS_PREFIX
          value: {{ .Values.waleBackup.gsPrefix }}
        {{- if .Values.waleBackup.googleApplicationCreds }}
        - name: GOOGLE_APPLICATION_CREDENTIALS
          value: "/var/{{ .Values.waleBackup.googleApplicationCreds.secretName }}/{{ .Values.waleBackup.googleApplicationCreds.fileName }}"
        {{- end }}
        - name: WALE_SWIFT_PREFIX
          value: {{ .Values.waleBackup.swiftPrefix }}
        - name: SWIFT_AUTHURL
          value: {{ .Values.waleBackup.swiftAuthUrl }}
        - name: SWIFT_TENANT
          value: {{ .Values.waleBackup.swiftTenant }}
        - name: SWIFT_USER
          value: {{ .Values.waleBackup.swiftUser }}
        - name: SWIFT_PASSWORD
          value: {{ .Values.waleBackup.swiftPassword }}
        - name: SWIFT_AUTH_VERSION
          value: {{ .Values.waleBackup.swiftAuthVersion }}
        - name: SWIFT_ENDPOINT_TYPE
          value: {{ .Values.waleBackup.swiftEndpointType }}
        {{- if .Values.waleBackup.hostPath }}
        - name: WALE_FILE_PREFIX
          value: "file://localhost/var/backup"
        {{- end }}
        - name: BACKUP_EXECUTION_TIME
          value: {{ .Values.waleBackup.executionTime }}
        {{- end }}
{{- end }}

{{- define "magda.waleVolumes.volumeMount" }}
{{- if and .Values.waleBackup }}
{{- if .Values.waleBackup.googleApplicationCreds }}
        - name: wale-google-account-credentials
          mountPath: "/var/{{ .Values.waleBackup.googleApplicationCreds.secretName }}"
          readOnly: true
{{- end }}
{{- if .Values.waleBackup.hostPath }}
        - name: wale-backup-directory
          mountPath: /var/backup
{{- end }}
{{- end }}
{{- end }}

{{- define "magda.waleVolumes.volume" }}
{{- if and .Values.waleBackup }}
{{- if .Values.waleBackup.googleApplicationCreds }}
        - name: wale-google-account-credentials
          secret:
            secretName: {{ .Values.waleBackup.googleApplicationCreds.secretName }}
{{- end }}
{{- if .Values.waleBackup.hostPath }}
        - name: wale-backup-directory
          hostPath:
            path: {{ .Values.waleBackup.hostPath }}
            type: DirectoryOrCreate
{{- end }}
{{- end }}
{{- end }}

{{- define "magda.postgresLivenessProbe" }}
        readinessProbe:
          exec:
            command: [ "/bin/sh", "-c", "pg_isready -h 127.0.0.1 -p 5432" ]
          initialDelaySeconds: 10
          periodSeconds: 30
{{- if .Values.global.enableLivenessProbes }}
        livenessProbe:
          exec:
            command: [ "/bin/sh", "-c", "pg_isready -h 127.0.0.1 -p 5432" ]
          initialDelaySeconds: 3600
          periodSeconds: 10
          timeoutSeconds: 1
{{- end }}
{{- end }}

{{- define "magda.postgresLifecycle" }}
        lifecycle:
          preStop:
            exec:
              command: ["/bin/bash", 'pkill backup-push && gosu postgres psql -c "SELECT pg_stop_backup()"']
{{- end }}

{{- define "magda.connectorJobSpec" }}
spec:
  template:
    metadata:
      name: connector-{{ .jobConfig.name }}
    spec:
      containers:
        - name: connector-{{ .jobConfig.id }}
          image: "{{ .jobConfig.image.repository | default .root.Values.image.repository | default .root.Values.global.image.repository }}/{{ .jobConfig.image.name }}:{{ .jobConfig.image.tag | default .root.Values.image.tag | default .root.Values.global.image.tag }}"
          imagePullPolicy: {{ .jobConfig.image.pullPolicy | default .root.Values.image.pullPolicy | default .root.Values.global.image.pullPolicy }}
          command:
            - "node"
            - "/usr/src/app/component/dist/index.js"
            - "--tenantId"
            - {{ .jobConfig.tenantId | default .root.Values.defaultTenantId | quote }}
            - "--config"
            - "/etc/config/connector.json"
            - "--registryUrl"
            - "http://registry-api/v0"
          resources:
{{ .jobConfig.resources | default .root.Values.resources | toYaml | indent 12 }}
          volumeMounts:
            - mountPath: /etc/config
              name: config
          env:
            - name: USER_ID
              value: 00000000-0000-4000-8000-000000000000
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: auth-secrets
                  key: jwt-secret
      restartPolicy: "OnFailure"
      volumes:
        - name: config
          configMap:
            name: "connector-config"
            items:
              - key: "{{ .jobConfig.id }}.json"
                path: "connector.json"
{{- end }}
