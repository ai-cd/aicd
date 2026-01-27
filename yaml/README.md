# Database and Sandbox Creation Rules

Note: When calling K8s interface to create deployment service ingress and other objects, strictly reference the YAML files in this directory. Do not omit important information inside, such as label information and other fields. Except for some necessary fields that have changed, other general content needs to be retained.

All resources should have naming rules, such as [project-name]-agentruntime-[6-digit-random-number]