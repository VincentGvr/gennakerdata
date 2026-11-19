---
title: "Uploader un fichier depuis un environnement On-Premises ou une Azure Function vers un compte de stockage Azure"
description: "Uploader un fichier depuis un environnement On-Premises ou une Azure Function vers un compte de stockage Azure"
pubDate: "2022-10-11T11:36:41.000Z"
slug: "upload-file-azure-storage-account"
permalink: "/2022/10/11/upload-file-azure-storage-account/"
lang: "fr"
section: "POWERSHELL"
homeOrder: 17
categories: ["Azure","Powershell"]
tags: []
heroImage: "../../assets/blog/2022/10/image-39.png"
originalUrl: "https://gennakerdata.com/2022/10/11/upload-file-azure-storage-account/"
---

```powershell
Function AuthenticateToAzure($connectionBias){
	if($connectionBias -eq "RunAsAccount"){
		$connectionName = "AzureRunAsConnection"
		$servicePrincipalConnection = Get-AutomationConnection -Name $connectionName
		Connect-AzAccount -ServicePrincipal -TenantId $servicePrincipalConnection.TenantId -ApplicationId $servicePrincipalConnection.ApplicationId -CertificateThumbprint $servicePrincipalConnection.CertificateThumbprint
	} elseif($connectionBias -eq "msi") {
		Connect-AzAccount -Identity
	} else {
		exit
	}
}
Function WriteFileToBlob($obj, $filename, $type) {

    Write-Output $filename
    $filePath = "$env:temp\" + $filename

	if($type -eq "json"){
		$obj | ConvertTo-Json | Out-File -FilePath $filePath
	} elseif($type -eq "csv") {
		$obj | Export-Csv -Path $filePath -NoTypeInformation -Encoding UTF8
	} else {
		$obj | Out-File -FilePath $filePath
	}

	Set-AzStorageBlobContent -Container $containerName -File $filePath -Context $storageContext -Force
    Remove-Item -Path $filePath -Force
	$obj = @()

}

AuthenticateToAzure("msi")

$tenantId           = "xxxxxxx"
$subscriptionId     = "xxxxxxx"
$resourceGroup      = "xxxxxxx"
$storageAccountName = "xxxxxxx"
$containerName      = "xxxxxxx"

Set-AzContext -Subscription $subscriptionId -Tenant $tenantId

$storAccKeys = Get-AzStorageAccountKey -ResourceGroupName $resourceGroup -Name $storageAccountName
$primaryKey = $storAccKeys | Where-Object keyname -eq 'key1' | Select-Object -ExpandProperty value

$storageContext = New-AzStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $primaryKey

WriteFileToBlob -obj $table  -filename "sample.csv"  -type "csv"
WriteFileToBlob -obj $output -filename "sample.json" -type "json"
```
