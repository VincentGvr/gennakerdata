export const SITE_TITLE = 'Gennaker Data';
export const SITE_DESCRIPTION =
	'Articles sur Azure, Microsoft Fabric, Power BI, PowerShell et SQL par Vincent Guyonvarch.';
export const AUTHOR = 'Vincent Guyonvarch';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/vincent-guyonvarch/';

export const SECTIONS = [
	{
		name: 'AZURE & FABRIC',
		slug: 'azure-fabric',
		description: 'Architectures data, Microsoft Fabric, Real-Time Intelligence, FinOps.',
	},
	{
		name: 'POWER BI',
		slug: 'power-bi',
		description: 'Datasets, API REST, CI/CD, rafraîchissements et haute disponibilité.',
	},
	{
		name: 'POWERSHELL',
		slug: 'powershell',
		description: 'Scripts d’automatisation pour Azure et Power BI.',
	},
	{
		name: 'SQL TOOLBOX',
		slug: 'sql-toolbox',
		description: 'Astuces et requêtes SQL au quotidien.',
	},
] as const;
