---
title: "Renommer les fichiers d'un dossier par pattern"
description: "Renommer les fichiers d'un dossier par pattern"
pubDate: "2022-09-23T13:44:29.000Z"
slug: "rename-file-pattern"
permalink: "/2022/09/23/rename-file-pattern/"
lang: "fr"
section: "POWERSHELL"
homeOrder: 19
categories: ["Powershell"]
tags: []
heroImage: "../../assets/blog/2022/09/image-26.png"
originalUrl: "https://gennakerdata.com/2022/09/23/rename-file-pattern/"
---

```powershell
$folderPath = "C:\dev\test"

$files = Get-ChildItem $folderPath

$removedString = "xxxxxx"
$removedString.Length

Foreach($file in $files) {
    if($file.Name.Contains($removedString)){
        Write-Host $file.Name
        Get-ChildItem ($folderPath + "\" + $file.Name) | Rename-Item -NewName $file.Name.Substring($removedString.Length, $file.Name.Length - $removedString.Length)
    }
}
```
