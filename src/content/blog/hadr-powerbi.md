---
title: "Mettre en place une stratégie de haute disponibilité et de reprise d’activité sur Power BI"
description: "Lorsque les rapports Power BI prennent une part de plus en plus importante dans l'entreprise, les voir régresser fonctionnellement ou les voir disparaître peut entraîner un…"
pubDate: "2022-08-23T10:29:32.000Z"
slug: "hadr-powerbi"
permalink: "/2022/08/23/hadr-powerbi/"
lang: "fr"
section: "POWER BI"
homeOrder: 14
categories: ["Power BI"]
tags: ["Analytics","Azure","Azure API","Azure Data","Data","HADR","REST API","SQL Database"]
heroImage: "../../assets/blog/2022/08/power-bi-hadr.png"
missingImages: 15
originalUrl: "https://gennakerdata.com/2022/08/23/hadr-powerbi/"
---

### S'assurer d'une stratégie de reprise d'activité avec les Back Up/Restore de datasets

#### Pourquoi assurer les datasets Power BI au delà de la sauvegarde des fichier de développement ?

Lorsque les rapports Power BI prennent une part de plus en plus importante dans l'entreprise, les voir régresser fonctionnellement ou les voir disparaître peut entraîner un ensemble de mauvaises nouvelles pours les équipes Analytiques.

Pour les modèles les plus critiques, on voudra alors s'assurer que l'équipe de développement, l'équipe de test ou encore les membres des espaces de travail ne commettent pas de fautes (volontaires ou involontaires) en **supprimant** un dataset, une mesure ou en **écrasant** un dataset en republiant une **version antérieure** par dessus. On pourrait aussi envisager le cas ou un dataset soit corrompu pour une raison ou une autre.

Pour **répondre** à ce **besoin** de **sauvegarde**, il est alors possible de mettre en place une logique, manuelle ou programmatique pour sauvegarder les datasets. Ces datasets seront sauvegardés au format **.abf** (comme les modèles Analysis Services) et **stockés dans Azure**, sur un compte de stockage.

#### Mise en place des backup/restore Power BI avec Azure

##### Les prérequis :

**Azure :**

-   Il est nécessaire d'héberger ces backups dans un compte de stockage Azure. Ce compte de stockage devra être hébergé sur le même environnement Azure que celui de Power BI.
-   Ce compte de stockage devra être en mode de stockage hiérarchique (activer ADLS Gen2)

Création du compte de stockage en question sur Azure :

**Power BI :**

-   L'espace de travail devra être hébergé dans une capacité Premium : via une licence Premium Per User, Premium Per Capacity, ou encore Embedded.
-   Le dataset restauré devra être en mode *large dataset.*

Mise en place de la liaison avec le compte de stockage dans les paramètres de l'espace de travail :

##### Méthode manuelle :

L'idée est alors de se connecter via SQL Server Management Studio au workspace concerné. Une fois connecté, via une nouvelle requête XMLA, il sera possible de lancer une commande simple de backup, et de restore.

**Génération du backup :**

**Déploiement du backup en cas de problème :**

##### Méthode automatisée :

On pourrait imaginer automatiser périodiquement les backups, ou bien redéployer ce dataset via code lors de la détection d'une anomalie. Voici alors une version du code en **Powershell** avec le module sqlserver :

## S'assurer d'une stratégie de reprise d'activité avec les Back Up/Restore de datasets

#### Assurer la haute disponiblité des rapports Power BI

L'idée ici est de proposer une une méthode pour rendre les rapports Power BI disponibles au maximum pour les utilisateurs clé de l'entreprise. Deux situations s'offrent à nous : un rapport en **Direct Query** ou **Live Connection**, sur une base qui aurait subit un dommage, une corruption ou une mise à jour négligée. L'autre situation concerne un rapport sur un dataset en mode **Import**, lui aussi corrompu ou ayant subit une regression.

#### Changer la datasource d'un rapport Power BI via API :

Pour illustrer mon propos, je vais déployer un rapport connecté à une base hébergée sur Azure SQL Database, qui, lors du déploiement d'une nouvelle version, verra une table clé du modèle disparaître. L'idée est alors d'être capable de redéployer cette base au plus vite, et de changer la datasource du raport vers la nouvelle base.

Voici l'état de notre rapport avant notre simulation :

Une regression est déployée pa erreur sur le modèle, mais les analyses ne peuvent pas être arrêtées. Voici le rapport en l'état :

##### Côté Azure :

Nous allons alors redéployer la base SQL via API, grâce aux *point in time restore* : pour y arriver, il sera nécessaire de définir au sein de la souscription le nouveau nom de la base de données de bascule. Via l'API suivante, on peut alors restaurer la base : [Restore a database from a backup - Azure SQL Database & SQL Managed Instance | Microsoft Docs](https://docs.microsoft.com/en-us/azure/azure-sql/database/recovery-using-backups?view=azuresql)

##### Côté Power BI :

Dans un [article écrit](https://www.linkedin.com/pulse/power-bi-datasets-mettre-%25C3%25A0-jour-les-param%25C3%25A8tres-via-api-guyonvarch/) au début de l'année, j'avais détaillé la logique permettant de s'authentifier, d'identifier le dataset et ses datasources, et ainsi d'être capable de mettre à jour ces informations par API. La logique sera ici la même : par API toujours, nous allons mettre à jour la datasource du dataset :

Une fois la datasource mise à jour, il faudra renseigner les credentials, toujours par API :

Maintenant, le rapport pointe alors vers la nouvelle base de données. On peut à nouveau consulter le rapport, pendant que le bug est résolu :

Cette méthode, basée sur les API SQL Database et Power BI, nous donne une manière de réduire grandement le downtime d'un rapport, et ainsi assurer la continuité du service.

#### Changer le dataset sur lequel un rapport Power BI se source via API :

L'idée cette fois ci est de changer la source du rapport lui même. Notre situation est la suivante : un développeur a cette fois-ci déployé non pas une erreur dans la base de données source, mais directement dans le Dataset Power BI. Les rapports, eux sont restés tels que.

Comme vu dans la première partie de l'article, nous procédons alors à la restauration du dataset :

On observe dans le workspace l'apparition du nouveau Dataset :

Via API, on va relier le rapport au nouveau Dataset, le temps de corriger le dataset KO : [Reports - Rebind Report - REST API (Power BI Power BI REST APIs) | Microsoft Docs](https://docs.microsoft.com/en-us/rest/api/power-bi/reports/rebind-report)

A nouveau, le rapport est disponible, les utilisateurs clés peuvent continuer leurs analyses, et le temps d'indisponibilité du service est grandement diminué. Par ce biais, le **Recovery Time Objective** est inférieur à la minute.
