---
title: "Power BI Datasets : Mettre à jour les paramètres d'identification via API dans une logique CI/CD"
description: "Dans une logique de développement & d'intégration continue, et lors des déploiements d'un rapport depuis un environnement de développement vers un environnement d'intégration…"
pubDate: "2022-09-05T13:18:41.000Z"
slug: "powerbi-cicd-api"
permalink: "/2022/09/05/powerbi-cicd-api/"
lang: "fr"
section: "POWER BI"
homeOrder: 16
categories: ["Power BI"]
tags: ["Analytics","CI/CD","Data","REST API"]
heroImage: "../../assets/blog/2022/09/image.png"
missingImages: 10
originalUrl: "https://gennakerdata.com/2022/09/05/powerbi-cicd-api/"
---

## Déploiement automatisé et mise à jour des paramètres de Datasets au sein de Power BI

Dans une logique de développement & d'intégration continue, et lors des déploiements d'un rapport depuis un environnement de développement vers un environnement d'intégration puis de production, il est important de séparer les sources de données et les identités d'authentification. Cependant, lors du téléchargement sur le service Power BI, les moyens d'authentification sont propagées tels qu'ils ont été définis lors de la phase de développement. Grâce aux [pipelines de déploiement](https://docs.microsoft.com/fr-fr/power-bi/create-reports/deployment-pipelines-overview), il est possible d'intégrer via une règle de gestion la modification de ces méthodes. Cependant, il n'est pas possible de modifier l'intégralité des paramètres, néanmoins pour le moment.

L'idée de cet article est de présenter une méthode pour y parvenir, notamment via les API REST du service Power BI. Nous aurons besoin d'un service principal, ayant les droits sur le ou les workspaces en question, et d'être habilité à en modifier les paramètres par API. (*cf. Documentation :* [Créer une application et un principal de service Azure AD dans le portail](https://docs.microsoft.com/fr-fr/azure/active-directory/develop/howto-create-service-principal-portal) & [Automatiser des tâches d’espace de travail et de jeu de données Power BI Premium avec des principaux de service](https://docs.microsoft.com/fr-fr/power-bi/admin/service-premium-service-principal))

### Authentification au service Power BI via API REST

Nous admettrons donc que le service Principal existe et que les informations d'identifications ont été notés pour le développement. Nous utiliserons Postman pour tester les API.

Récupérons les informations permettant de se connecter via API sur l'Active Directory, et sur Power BI :

Dans **Postman**, créons un premier appel API permettant de s'authentifier. En méthode POST, l'ID du tenant allant dans l'URL de connexion, et le couple Id/Secret dans le *body* de l'appel :

Une fois lancé, il sera possible de récupérer l'**access\_token** présent dans le retour de l'appel, qu'il faudra intégrer à chaque appel par la suite :

### Récupération des informations nécessaires à la propagation des nouvelles valeurs d'identifications : Dataset Id, Datasource Id & Gateway Id.

Premièrement, récupérons à l'aide de l'appel de type **GET** l'ID du dataset en question [Get Datasets In Group](https://docs.microsoft.com/en-us/rest/api/power-bi/datasets/get-datasets-in-group) :

Une fois récupéré, selon les actions que l'on veut automatiser, nous devrons récupérer l'ID de la **source de données** et/ou l'id de la **passerelle** (NB : toutes les datasources ont une gateway Id, même si aucune On-premises Data Gateway a été utilisée. Il est nécessaire de la récupérer, car la modification des identifiants est un appel porté sur le endpoint API de la Gateway) - [Get Datasources In Group](https://docs.microsoft.com/en-us/rest/api/power-bi/datasets/get-datasources-in-group) :

Une fois ces informations récupérées, nous avons ici toutes les informations dont nous avons besoin.

### Propagation des nouvelles valeurs d'identifications : Source de données, Identifiants & Paramètres.

La modification des paramètres est nécessaire si la datasource n'est pas supporté (*cf. liste dans la documentation* [Update Datasources In Group](https://docs.microsoft.com/en-us/rest/api/power-bi/datasets/update-datasources-in-group)*).* De ce fait, il faut passer en tant que paramètre les valeurs des serveurs/bases au niveau du rapport. Modification des paramètres du dataset : [Datasets - Update Parameters In Group](https://docs.microsoft.com/en-us/rest/api/power-bi/datasets/update-parameters-in-group)

Modification des identifiants (attention, cette fois ci, c'est un **PATCH** et non un POST qu'il faut exécuter) : [Gateways - Update Datasource](https://docs.microsoft.com/en-us/rest/api/power-bi/gateways/update-datasource)

### Problèmes rencontrés lors de la mise en place

-   Le service principal doit être directement défini dans les accès du workspace, et non pas via le groupe de sécurité :

-   Si le dataset n'a pas été déployé via le Service Principal, il est possible de prendre la main sur le dataset via API aussi. Autrement une erreur sera jetée à l'envoi de la requête :
