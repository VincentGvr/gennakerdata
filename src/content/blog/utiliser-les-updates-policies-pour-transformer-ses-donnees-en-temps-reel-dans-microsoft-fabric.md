---
title: "Utiliser les Updates Policies pour transformer ses données en temps réel dans Microsoft Fabric"
description: "Au sein de Microsoft Fabric, l'ingestion des données peut se faire en temps réel grâce aux services Real Time databases & Event Stream. Une fois les données ingérées, plusieurs…"
pubDate: "2025-01-08T09:30:04.000Z"
slug: "utiliser-les-updates-policies-pour-transformer-ses-donnees-en-temps-reel-dans-microsoft-fabric"
permalink: "/2025/01/08/utiliser-les-updates-policies-pour-transformer-ses-donnees-en-temps-reel-dans-microsoft-fabric/"
lang: "fr"
categories: []
tags: []
originalUrl: "https://gennakerdata.com/2025/01/08/utiliser-les-updates-policies-pour-transformer-ses-donnees-en-temps-reel-dans-microsoft-fabric/"
---

Au sein de Microsoft Fabric, l'ingestion des données peut se faire en temps réel grâce aux services Real Time databases & Event Stream. Une fois les données ingérées, plusieurs possibilités s'ouvrent à nous :

Architecture Lambda

Si les données à traiter n'ont pas besoin des autres lignes pour être traitées, alors il est possible d'enchaîner les modifications, grâce aux update policies. En définissant la fonction de transformation d'une table à l'autre au préalable, il est possible de travailler les donneés d'une table source, d'y appliquer les règles fonctionnelles nécessaires et de les inserer directement dans une table destination.

```sql
// Création de la table source
.create table source (entier: int, chaine_entier:int, chaine:string, manquant:dynamic)

// Création de la table target
.create table target (entier: int, chaine_entier:string, chaine:string, supplement:dynamic)

// Insert première ligne test si ligne déjà existante
.ingest inline into table source <|
1, 12, "Ligne 1", "Toto"

// vérification de la ligne insérée
source

// création de la fonction
.execute database script <|
  .create-or-alter function PutSourceInTarget() {
    source
    | project entier = entier
            , chaine_entier = tostring(chaine_entier)
            , chaine = chaine
            , supplement = todynamic(column_ifexists("supplement", ""))
}

// ajout de la fonction à la table target
.execute database script <|
  .alter table target policy update "[{\"IsEnabled\":true,\"Source\":\"source\",\"Query\":\"PutSourceInTarget\",\"IsTransactional\":false,\"PropagateIngestionProperties\":true,\"ManagedIdentity\":null}]"

// verification de la table target avant insertion
target // pas de valeur.

// ajout des lignes déjà existantes : .append
.append target with(distributed=true) <|
    source
    | project entier = entier
            , chaine_entier = tostring(chaine_entier)
            , chaine = chaine
            , supplement = todynamic(column_ifexists("supplement", ""))

target  // ok

// insertion dans la table source
.ingest inline into table source <|
1, 12, "Ligne 2 - après mise en place de l'update policy", "Toto"

// vérif dans target
target // OK deux lignes.
```
