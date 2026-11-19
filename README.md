# Gennaker Data

Blog de Vincent Guyonvarch (Azure, Microsoft Fabric, Power BI, PowerShell, SQL), migré de WordPress vers un site statique [Astro](https://astro.build) hébergé sur GitHub Pages.

- Aperçu : https://vincentgvr.github.io/gennakerdata/
- Domaine cible : https://gennakerdata.com (⚠️ **DNS non basculé** pour l'instant)

## Fonctionnalités

Contenu Markdown/MDX (content collections), permaliens WordPress conservés, thème clair/sombre, coloration syntaxique (Shiki), table des matières, temps de lecture, recherche [Pagefind](https://pagefind.app), RSS (`/rss.xml`), sitemap, Open Graph, accessibilité de base, aucun suivi/analytics.

## Développement local

Prérequis : Node.js 22+.

```bash
npm install
npm run dev                    # http://localhost:4321/gennakerdata/
npm run build                  # build Astro + index Pagefind dans dist/
npm run preview                # sert dist/
node scripts/check-links.mjs   # vérifie liens/images internes (après build)
```

Sous Windows PowerShell, utiliser `npm.cmd` si `npm.ps1` est bloqué.

### Base / domaine

`astro.config.mjs` lit deux variables d'environnement :

| Variable    | Aperçu (défaut)                | Domaine personnalisé       |
| ----------- | ------------------------------ | -------------------------- |
| `SITE`      | `https://vincentgvr.github.io` | `https://gennakerdata.com` |
| `BASE_PATH` | `/gennakerdata`                | `/`                        |

Exemple : `SITE=https://gennakerdata.com BASE_PATH=/ npm run build`.
Dans GitHub Actions, il suffit de définir la variable de dépôt `USE_CUSTOM_DOMAIN=true` (Settings → Secrets and variables → Actions → Variables) puis de relancer le déploiement.

## Contenu

- Articles : `src/content/blog/*.md` (front-matter : title, pubDate, slug, permalink, section, categories, tags, heroImage…).
- Images : `src/assets/blog/`.
- Import WordPress (déjà exécuté) : `node scripts/import-wordpress.mjs "<export>.xml"`. Les images sont téléchargées depuis le site et mises en cache (`scripts/image-manifest.json`).
- Redirections `/<slug>/` → permalien canonique, `/gennaker-data/` → `/`, `/feed/` → `/rss.xml` : pages HTML meta-refresh (GitHub Pages ne gère pas les 301).

## Notes de migration

- Brouillons WordPress non importés ; page CV exclue (données personnelles dans les images) ; e-mail retiré du contenu.
- Cinq articles ont des images LinkedIn expirées (introuvables, déjà cassées sur le site d'origine) : un bandeau d'avertissement s'affiche (`missingImages` dans le front-matter).
- Le langage des blocs de code sans langage a été deviné (sql, powershell, python, json) : à relire.

## Déploiement

Le workflow `.github/workflows/deploy.yml` construit, vérifie les liens puis déploie sur GitHub Pages à chaque push sur `main`. Source Pages : **GitHub Actions**.

## Checklist de bascule DNS (gennakerdata.com)

À faire seulement quand vous êtes prêt à quitter WordPress.

1. Vérifier l'aperçu sur https://vincentgvr.github.io/gennakerdata/ (articles, images, recherche, anciens permaliens).
2. Chez le registrar, remplacer les enregistrements de l'apex `gennakerdata.com` par :
   - `A` : `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA` : `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
3. `www` : `CNAME` → `vincentgvr.github.io`.
4. Définir la variable de dépôt `USE_CUSTOM_DOMAIN=true` et relancer le workflow (Actions → Run workflow). `public/CNAME` contient déjà `gennakerdata.com`.
5. Settings → Pages : vérifier le domaine personnalisé, attendre la validation DNS puis cocher **Enforce HTTPS** (le certificat peut prendre de quelques minutes à quelques heures).
6. Vérifier https://gennakerdata.com, les permaliens, `/rss.xml`, `/sitemap-index.xml`, et soumettre le sitemap aux moteurs de recherche.
7. Garder WordPress en ligne quelques jours en cas de retour arrière (TTL DNS bas recommandé avant la bascule).
