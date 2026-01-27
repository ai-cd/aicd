## YAML Example for Starting Database

You can refer to the YAML file to call the Kubernetes API to implement database creation, and get the internal address and password of the database through `service` `secret` and other interfaces.

To get the password, call the Kubernetes API to get the password field in the secret like [project-name]-conn-credential, which is base64 encoded, pay attention to parsing:

Example of getting it:
```
root@(ns-ajno7yq7) ~$ kubectl get secret fullstackagent-conn-credential -oyaml
apiVersion: v1
data:
  endpoint: ZnVsbHN0YWNrYWdlbnQtcG9zdyZXNx1NDMy
  host: ZnVsbHN0YWNrYWdlbnQtcG9zdGdXNxbA==
  password: bm43eHB2M=
  port: NTQzM==
  username: cGdGdyZXM=
kind: Secret
metadata:
  creationTimestamp: "2025-10-11T04:33:32Z"
  finalizers:
  - cluster.kubeblocks.io/finalizer
  labels:
    app.kubernetes.io/instance: fullstackagent
    app.kubernetes.io/managed-by: kubeblocks
    app.kubernetes.io/name: postgresql
    apps.kubeblocks.io/cluster-type: postgresql
  name: fullstackagent-conn-credential
  namespace: ns-ajno7yq7
  ownerReferences:
  - apiVersion: apps.kubeblocks.io/v1alpha1
    blockOwnerDeletion: true
    controller: true
    kind: Cluster
    name: fullstackagent
    uid: 7d246a6b-4714-4861-bdb8-c1c95a28898c
  resourceVersion: "612201031"
  uid: b714f062-88ce-45aa-820d-b37f4078bb20
type: Opaque
```