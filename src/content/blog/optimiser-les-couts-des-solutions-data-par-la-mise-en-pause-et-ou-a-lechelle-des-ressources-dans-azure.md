---
title: "Optimiser les coûts des solutions Data par la mise en pause et/ou à l'échelle des ressources dans Azure"
description: "Il existe plusieurs méthodes pour optimiser les coûts des solutions Data et des entrepôts de données déployés dans le cloud et plus particulièrement sur Azure. L'optimisation…"
pubDate: "2022-08-22T16:32:06.000Z"
slug: "optimiser-les-couts-des-solutions-data-par-la-mise-en-pause-et-ou-a-lechelle-des-ressources-dans-azure"
permalink: "/gennaker-data/optimiser-les-couts-des-solutions-data-par-la-mise-en-pause-et-ou-a-lechelle-des-ressources-dans-azure/"
lang: "fr"
section: "AZURE & FABRIC"
homeOrder: 9
categories: []
tags: ["ADF","Analytics","Azure","Azure Analysis Services","Azure API","Azure Data","Data","FinOps","REST API","SQL Database","Synapse"]
heroImage: "../../assets/blog/2022/08/optimiser-les-couts-des-solutions-data-par-la-mise-en-pause-et-ou-a-lechelle-des-ressources-dans-azure.png"
missingImages: 11
originalUrl: "https://gennakerdata.com/gennaker-data/optimiser-les-couts-des-solutions-data-par-la-mise-en-pause-et-ou-a-lechelle-des-ressources-dans-azure/"
---

### Préciser le design et l'architecture d'une solution pour en optimiser les coûts

Il existe plusieurs méthodes pour optimiser les coûts des solutions Data et des entrepôts de données déployés dans le cloud et plus particulièrement sur Azure. L'optimisation des développements, l'utilisation de justes moyens pour les ressources, des tests plus approfondis permettent d'optimiser la solution en elle même, d'en réduire les temps de traitement, et donc d'en réduire les coûts. Au delà du design et du développement de la solution, il est courant de remarquer pour des architectures basées sur des ressources dédiées comme SQL Database provisionné et Azure Analysis Services, que les instances ne sont jamais mises en pause ou à l'échelle vis à vis des usages.

L'**idée de cet article** est de présenter une **solution** permettant via **REST API** et **Azure Data Factory** (ADF) de mettre en pause et/ou à l'échelle une instance SQL, Un pool SQL dédié dans Synapse ou encore une instance Analysis Services, avant et après leur chargement. L'usage de l'**identité managée** de l'ADF permettra de simplifer la gestion des indentités et des credentials. Si ADF n'est pas utilisé, on pourrait imaginer l'usage d'une Azure Function ou encore d'une Logic Apps.

Imaginons une architecture simple : une Azure Data Factory sourcé sur un ADLS Gen2*,* déversant les données dans une SQL Database ou un pool SQL dédié dans Synapse, et enfin un modèle sémantique tabulaire dans Azure Analysis Services.

Nous admettrons que la base SQL n'est destinée qu'à l'alimentation de cette solution, et nous ne prendrons pas en compte l'usage en lecture du cube. Sans trop de détails sur les usages ou les temps de chargement, on peut dresser l'ébauche d'une chaîne d'intégration :

### Mise à l'échelle et en pause des services SQL DB :

#### SQL Database Provisionnée :

Il n'est **pas possible** de **mettre en pause** une base de données provisionnée ou serverless via API : Ces SKUs n'intègrent pas la possibilité de mettre en pause le système, même si les endpoints API existent. Une solution de contournement consiste à faire un back up/restore de la base vers un stockage temporaire, et de détruire la base chaque fois qu'elle n'est pas utilisée. On comprend que cette méthode n'est pas la solution recherchée.

En revanche, il est possible de placer les bases dans le **SKU le plus petit possible** lorsqu'elles ne sont pas utilisées.

Voici le patron du pipeline ADF que l'on pourrait intégrer : il ne nécessite pas l'usage de Linked Services ou de Datasets, et utilisera uniquement des appels Web.

1\. La récupération de l'ID de souscription dans laquelle est contenu l'ADF et la base, et la définition d'une variable :

L'URL de l'API : *https://management.azure.com/subscriptions?api-version=2020-01-01*

Le parsing du retour API pour ne récupérer que la valeur de l'ID :

```text
@replace(activity('Get Azure Subscription').output.value[0].id,'/subscriptions/','')
```

2\. Un switch permettant de rendre dynamique l'exécution du flux, selon l'action désirée :

```text
@pipeline().parameters.SwitchAction
```

3\. Un appel API dépendant du contexte du switch, pour mettre en pause, relancer, ou mettre à l'échelle la base. Pour SQL DB, on aura alors uniquement le ScaleDatabase :

Voici alors l''URL concaténée, avec le SubscriptionId, le nom du Resource Group, le serveur et la database :

```text
@concat('https://management.azure.com/subscriptions/',variables('SubscriptionId'),'/resourceGroups/',pipeline().parameters.ResourceGroupName,'/providers/Microsoft.Sql/servers/',pipeline().parameters.SQLServerName,'/databases/',pipeline().parameters.SQLDBName,'?api-version=2021-02-01-preview')
```

Le body envoyé :

```text
@concat('{"sku": { "name": "',pipeline().parameters.ScaleSKU,'" } }')
```

La mise à l'échelle de la base est **synchrone** : Le retour de l'API contient les détails du résultat de la mise à l'échelle. On peut donc alors l'intégrer à une chaîne sans avoir à intérroger la base pour récupérer son état, et conditionner la suite du chargement.

#### Mise en pause/Démarrage des Pool SQL dédié au sein de Synapse :

La mise en pause du pool est **lui aussi** syncrhone. L'appel est différent, c'est un POST et non un PATCH, le body peut être laissé vide :

Voici l'URL pour la **pause** :

```text
@concat('https://management.azure.com/subscriptions/',variables('SubscriptionId'),'/resourceGroups/',pipeline().parameters.ResourceGroupName,'/providers/Microsoft.Synapse/workspaces/',pipeline().parameters.SQLServerName,'/sqlPools/',pipeline().parameters.SQLDBName,'/pause?api-version=2021-03-01')
```

Pour le **resume**, il suffira de changer */pause?api-version=2021-03-01* par */resume?api-version=2021-03-01.*

#### SQL Database Serveless - mise à l'échelle/mise en pause automatique :

-   S'il on veut éviter l'ajout de ces différentes étapes à la chaîne d'intégration, il est possible d'utiliser la **mise à l'échelle automatique** : sur SQL Database Serverless, il est possible d'avoir une utilisation des ressources selon les usages :

-   Ainsi qu'une **mise en pause automatique de** la base après un délai d'inactivité (entre 1 heure et 7 jours) :

### Mise à l'échelle et/ou en pause d'Azure Analysis Services :

Pour les modèles Analysis Services, la logique sera la même :

Les URL API et les contenus sont différents :

-   **Suspend** :

```text
@concat('https://management.azure.com/subscriptions/',variables('SubscriptionId'),'/resourceGroups/',pipeline().parameters.ResourceGroupName,'/providers/Microsoft.AnalysisServices/servers/',pipeline().parameters.AASServerName,'/suspend?api-version=2017-08-01')
```

-   **Resume** :

```text
@concat('https://management.azure.com/subscriptions/',variables('SubscriptionId'),'/resourceGroups/',pipeline().parameters.ResourceGroupName,'/providers/Microsoft.AnalysisServices/servers/',pipeline().parameters.AASServerName,'/resume?api-version=2017-08-01')
```

-   **Scale** :

```text
@concat('https://management.azure.com/subscriptions/',variables('SubscriptionId'),'/resourceGroups/',pipeline().parameters.ResourceGroupName,'/providers/Microsoft.AnalysisServices/servers/',pipeline().parameters.AASServerName,'?api-version=2017-08-01')
```

```text
@concat('{"sku": { "capacity": 1, "name": "',pipeline().parameters.ScaleSKU,'" "tier": "Standard" } }')
```

#### Prérequis :

Pour autoriser l'ADF à récupérer les informations de la souscription et d'éxécuter sur la base des mises à l'échelle, il est nécessaire :

-   d'ajouter l'identité managée d'ADF en tant que lecteur sur la souscription,
-   d'ajouter l'identité managée d'ADF en tant que Contributeur de SQL Server sur l'instance SQL Database, le pool SQL Synpase ou encore Analysis Services :

## Sources :

-   Managed Identities : [Managed identities for Azure resources | Microsoft Docs](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview)
-   List Subscriptions : [Subscriptions - List - REST API (Azure Resource Management) | Microsoft Docs](https://docs.microsoft.com/fr-fr/rest/api/resources/subscriptions/list)
-   List Resource Groups : [Resource Groups - List - REST API (Azure Resource Management) | Microsoft Docs](https://docs.microsoft.com/fr-fr/rest/api/resources/resource-groups/list)
-   Pause/Resume/Scale SQL Database : [Databases - Pause - REST API (Azure SQL Database) | Microsoft Docs](https://docs.microsoft.com/en-us/rest/api/sql/2021-02-01-preview/databases/pause)
