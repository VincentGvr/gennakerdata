---
title: "Récupérer les rafraîchissements programmés par capacités Power BI via REST API et Powersehell"
description: "Récupérer les rafraîchissements programmés par capacités Power BI via REST API et Powersehell"
pubDate: "2022-10-05T09:45:25.000Z"
slug: "scheduled-refreshes-admin-powerbi-rest-api"
permalink: "/2022/10/05/scheduled-refreshes-admin-powerbi-rest-api/"
lang: "fr"
section: "POWERSHELL"
homeOrder: 18
categories: ["Power BI","Powershell"]
tags: []
heroImage: "../../assets/blog/2022/10/image-22.png"
originalUrl: "https://gennakerdata.com/2022/10/05/scheduled-refreshes-admin-powerbi-rest-api/"
---

```powershell
$appSecret = ''
$appId     = ''
$tenantId  = ''

$appSecretSec = ConvertTo-SecureString -String $appSecret -AsPlainText -Force
$credentials = New-Object System.Management.Automation.PSCredential($appId,$appSecretSec)
Connect-PowerBIServiceAccount -Tenant $tenantId -ServicePrincipal -Credential ($credentials)

$capacitiesList = @()
$capacitiesAdminList = @()

$capacitiesURI = https://api.powerbi.com/v1.0/myorg/admin/capacities
$capacities = Invoke-PowerBIRestMethod -Url $capacitiesURI -Method GET  | ConvertFrom-Json

$capacitiesList += $capacities.value      | Select-Object @{N='capacityId'; E={$_.Id}}, id, displayName,sku,state,capacityUserAccessRight,region
$capacitiesAdminList += $capacities.value | Select-Object @{N='capacityId'; E={$_.Id}}, admins -ExpandProperty admins -ExcludeProperty admins

Foreach($capa in $capacities.value){
    $id = $capa.Id

    $refreshURI = https://api.powerbi.com/v1.0/myorg/admin/capacities/$id/refreshables?`$expand=capacity,group

    $i = 1
    $x = 1

    while($i -eq 1){
        if($capa.Sku -eq "PP3") {
            Write-Host "   Premium Per User - not in scope"
            $i = 0
        } elseif ($capa.Sku.Substring(0,1) -eq "A"){
            Write-Host "   Embedded Capacities - not in scope"
            $i = 0
        } else {

            $refreshables = Invoke-PowerBIRestMethod -Url $refreshURI -Method GET | ConvertFrom-Json
            if($refreshables.'@odata.nextLink'){
                $refreshURI = $refreshables.'@odata.nextLink'
            } else {
                $i = 0
            }
        }
    }
    $x += 1
}
```
