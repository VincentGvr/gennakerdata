---
title: "Utiliser une procédure de MERGE dans une logique ELT pour SQL"
description: "Ce script est une ébauche permettant de mettre à jour les données d'une table depuis une source avec une procédure de MERGE. Via un ensemble de clé, la procédure choisiera de…"
pubDate: "2022-10-20T08:08:26.000Z"
updatedDate: "2022-10-27T14:45:57.000Z"
slug: "merge-sql-insert-update"
permalink: "/2022/10/20/merge-sql-insert-update/"
lang: "en"
section: "SQL TOOLBOX"
homeOrder: 20
categories: []
tags: ["Analytics","Azure Data","Data","Synapse"]
heroImage: "../../assets/blog/2022/10/image-40.png"
originalUrl: "https://gennakerdata.com/2022/10/20/merge-sql-insert-update/"
---

Ce script est une ébauche permettant de mettre à jour les données d'une table depuis une source avec une procédure de MERGE. Via un ensemble de clé, la procédure choisiera de mettre à jour ou d'ajouter les lignes lues dans la source.

## SQL Script

```sql
-- Creation of the Technical Table to follow up the insert/update of the Target table
IF NOT EXISTS (SELECT 1 FROM SYS.TABLES WHERE NAME = 'TCH_MERGE_FOLLOWUP')
CREATE TABLE TCH_MERGE_FOLLOWUP (
	ID_run				INT IDENTITY(1,1) NOT NULL,
	LB_MergeAction		NVARCHAR(20) NOT NULL,
	IN_ActionCount		INT NOT NULL,
	LB_MergeCallInfo	NVARCHAR(50) NULL,
	DT_MergeDateTime	DATETIME DEFAULT GETDATE()
);

CREATE OR ALTER PROCEDURE dbo.MERGE_SRC_TGT
    @TchInfo NVARCHAR(50)											-- Parameter to keep origin of the Merge Execution
AS
BEGIN
    SET NOCOUNT ON;

	DECLARE @RunDate DATETIME										-- RunDate calculated at the begining of the run to follow up merge
	SET @RunDate = GETDATE()										-- This Date will be used to read last inserted values in our source later

	DECLARE @TMP_MergeAction TABLE(MergeAction VARCHAR(20));		-- Table to track list of actions done during last run

    MERGE dbo.TGT AS target											-- target table that will be inserted/merged into
    USING (
		SELECT [src_name]
			  ,[amount]
			  ,[src_date]
		FROM dbo.TEMP_TGT) AS temp ([src_name],[amount],[src_date]) -- definition of the fields that will be read from the source
	ON (target.[name] = temp.[src_name])							-- definition of the keys that will match/unmatch data

    WHEN MATCHED THEN
        UPDATE SET [amount] = temp.[amount]							-- if the keys match, it is an existing row, then update
    WHEN NOT MATCHED THEN
        INSERT ([name],[amount],[src_date])
        VALUES (temp.[src_name],temp.[amount],temp.[src_date])		-- if the keys don't match, it is a new row, then insert
	OUTPUT $action INTO @TMP_MergeAction;							-- all the output metadata are stored in a our tracklist table

INSERT INTO TCH_MERGE_FOLLOWUP (LB_MergeAction, IN_ActionCount, LB_MergeCallInfo, DT_MergeDateTime)
	SELECT MergeAction, COUNT(MergeAction) AS CountPerChange, @TchInfo, @RunDate
	FROM @TMP_MergeAction											-- summarize result in tracklist table.
	GROUP BY MergeAction;

END;
GO

-- Sample Load of the Temporary table
INSERT INTO dbo.TEMP_TGT
SELECT [src_name]
      ,[amount]
      ,[src_date]
  FROM [dbo].[SRC]
  WHERE [src_date] > (SELECT MAX(DT_MergeDateTime) FROM TCH_MERGE_FOLLOWUP)

-- Sample Exec of the merge statement
EXEC dbo.MERGE_SRC_TGT 'Demo Run'
TRUNCATE TABLE dbo.TEMP_TGT
```
