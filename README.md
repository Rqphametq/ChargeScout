# ⚡ ChargeScout - Géo-Prospection SaaS pour IRVE

ChargeScout est un outil de prospection foncière cartographique conçu spécifiquement pour les Développeurs Fonciers et Commerciaux B2B travaillant chez les Opérateurs de Recharge (CPO - Charging Point Operators).

## Le Problème
L'identification de sites pertinents (hypermarchés, hôtels, entrepôts logistiques) pour déployer des bornes de recharge haute puissance (DC) est fastidieuse. Les commerciaux naviguent à l'aveugle entre les bases de données d'entreprises et Google Maps, sans savoir si la concurrence est déjà présente.

## La Solution : ChargeScout
ChargeScout croise en temps réel la base des entreprises françaises (API Sirene) et le registre national des points de charge existants (API ODRÉ). Il permet de détecter instantanément les **"Zones Blanches"** : des établissements à fort potentiel qui n'ont encore aucune borne installée sur leur parking.

### Fonctionnalités Clés
* **Ciblage Métier (Retail vs Flotte)** : Scannez les codes NAF pertinents selon votre stratégie (Loi LOM pour le Retail, Hubs privés pour la Logistique).
* **Détection de la Concurrence** : Radar réglable (200m à 1km) pour identifier le nombre de Points de Charge (PDC) existants et le nom des réseaux concurrents (Tesla, Ionity, etc.).
* **Intelligence Géographique (Mode Retail)** : Détection automatique des commodités (Cafés/Restos à < 300m), des axes routiers majeurs (< 1.5km) et des postes sources électriques (< 2km) via OpenStreetMap.
* **Export CRM One-Click** : Générez un fichier CSV propre (avec SIRET, Adresse, Statut) prêt à être importé dans HubSpot ou Salesforce.

## Stack Technique
* **Frontend** : Vanilla JavaScript, HTML5, CSS3.
* **Cartographie** : Leaflet.js couplé au fond de carte Satellite de Google.
* **APIs** : 
  * *Recherche d'entreprises* (data.gouv.fr)
  * *Bornes IRVE* (ODRÉ - Open Data Réseaux Énergies)
  * *Overpass API* (OpenStreetMap pour la Geo-Intelligence)

## 💡 Comment l'utiliser ?
1. Ouvrez `index.html` dans votre navigateur.
2. Déplacez la carte sur la zone cible de votre choix (Rayon max: 30 km).
3. Choisissez votre cible (Retail ou Flotte) et la sensibilité du radar IRVE.
4. Cliquez sur **Scanner la zone**.
5. Filtrez les résultats dans la barre latérale pour ne conserver que les "Zones Blanches" (Points verts).
6. Exportez les Leads qualifiés.
