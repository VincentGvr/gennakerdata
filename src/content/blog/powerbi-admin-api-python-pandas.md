---
title: "Interroger les API Admin Power BI via Python et Pandas"
description: "Le but de ce script est de présenter une méthode permettant d'historiser les données de logs d'activités Power BI. Il repose sur trois prérequis :"
pubDate: "2022-10-25T09:01:01.000Z"
slug: "powerbi-admin-api-python-pandas"
permalink: "/2022/10/25/powerbi-admin-api-python-pandas/"
lang: "fr"
section: "POWER BI"
homeOrder: 11
categories: ["Power BI","Synapse"]
tags: ["Azure","Pandas","Python","REST API"]
heroImage: "../../assets/blog/2022/10/image-42.png"
originalUrl: "https://gennakerdata.com/2022/10/25/powerbi-admin-api-python-pandas/"
---

Le but de ce script est de présenter une méthode permettant d'historiser les données de logs d'activités Power BI. Il repose sur trois prérequis :

-   L'autorisation aux [APIs d'Admin Power BI](https://learn.microsoft.com/en-us/power-bi/enterprise/read-only-apis-service-principal-authentication) pour les service principals,
-   La création d'un [principal de service](https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal) et d'un [groupe de sécurité](https://learn.microsoft.com/en-us/azure/active-directory/fundamentals/how-to-manage-groups) autorisé côté Power BI,
-   L'installation des packages Python utilisés ci-dessous ([requests](https://pypi.org/project/requests/), [pandas](https://pypi.org/project/pandas/)).

Une fois les prérequis mis en place, il faudra compléter le script avec les informations sur le tenant et l'app. Aussi, faire attention au nombre de jour à interroger, et le nombre de minutes incluses dans l'interval d'interrogation API. L'API limite le nombre d'appel possible dans une journée, et le nombre de lignes retournées par appel.

## Script Python

```python
import json
import requests
from datetime import date, timedelta, datetime
import pandas

tenantId = "XXXX-XXXX-XXXX-XXXX"	             # Power BI & Azure AD tenant Id
appId = "XXXX-XXXX-XXXX-XXXX"                    # Admin API app Id
appSecret = "XXXX-XXXX-XXXX-XXXX"                # Admin API app Secret
filePath = "C:\\temp\\dev\\python\\AuditLogs"    # Target Folder

daystoGet = 7                                    # Number of days to get from API (today is not included)
intervalMinutes = 60                             # Number of minutes to get for every API call loop. To decrease if the number of activities is high.

reqTokenBody = {
    "Grant_Type": "client_credentials",
    "Scope" : "https://analysis.windows.net/powerbi/api/.default",
    "client_Id" : appId,
    "Client_Secret" : appSecret
}

print("Requesting Token ... ")
authentUri = "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/token"
tokenResponse = requests.post(authentUri, data = reqTokenBody)
tokenResponse =  json.loads(tokenResponse.text)

reqHeaders = {
    "Authorization": "Bearer " + tokenResponse["access_token"]
    ,"Content-Type":"application/json"
}

boolContinue = 1
oldestDay = -daystoGet
oldestDayPlusOne = oldestDay + 1

while oldestDay < 0:

    start = date.today() + timedelta(oldestDay)
    startDt = datetime(start.year, start.month, start.day)

    end = date.today() + timedelta(oldestDayPlusOne)
    endDt = datetime(end.year, end.month, end.day)

    currentStart = startDt
    currentEnd = endDt

    fileName = filePath + currentStart.strftime("%Y%m%d") + ".csv"
    activityDf = pandas.DataFrame()
    while boolContinue == 1:

        currentEnd = currentStart + timedelta(minutes=intervalMinutes)

        print("Retrieving logs between " + currentStart.strftime("%m/%d/%Y %H:%M:%S") + " and " + currentEnd.strftime("%m/%d/%Y %H:%M:%S"))

        if(currentEnd.hour == 0):
            activityUri = "https://api.powerbi.com/v1.0/myorg/admin/activityevents?startDateTime='" + currentStart.strftime("%Y-%m-%dT%H:%M:%S") + ".000Z'&endDateTime='" + (currentEnd - timedelta(seconds = 1)).strftime("%Y-%m-%dT%H:%M:%S") + ".000Z'"
        else:
            activityUri = "https://api.powerbi.com/v1.0/myorg/admin/activityevents?startDateTime='" + currentStart.strftime("%Y-%m-%dT%H:%M:%S") + ".000Z'&endDateTime='" + currentEnd.strftime("%Y-%m-%dT%H:%M:%S")  + ".000Z'"

        activityResponse = requests.get(activityUri, headers = reqHeaders)
        activity = json.loads(activityResponse.text)
        list = pandas.DataFrame.from_dict(activity["activityEventEntities"])
        activityDf = pandas.concat([activityDf,list[["RecordType","CreationTime","UserId","UserAgent","Activity","CapacityId","WorkspaceId","ObjectId","DatasetId","ReportId","DataConnectivityMode","ConsumptionMethod"]]])

        currentStart = currentEnd

        if currentEnd >= endDt:
            boolContinue = 0

    activityDf.to_csv(fileName, index = False)

    oldestDay = oldestDay + 1
    oldestDayPlusOne = oldestDay + 1
    boolContinue = 1
```
