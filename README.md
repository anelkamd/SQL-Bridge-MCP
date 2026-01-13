# SQL Bridge MCP

**Serveur MCP (Model Context Protocol) universel pour connecter n'importe quel LLM à votre base de données MySQL en langage naturel!**

[![npm version](https://badge.fury.io/js/sql-bridge-mcp.svg)](https://www.npmjs.com/package/sql-bridge-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

SQL Bridge MCP permet à Claude, Copilot, Cursor, ChatGPT et autres LLMs de **dialoguer avec vos bases de données MySQL en langage naturel**, tout en garantissant sécurité et performance.

**Table des matières**

- [Fonctionnement](#fonctionnement)
- [Caractéristiques](#caractéristiques)
- [Installation](#installation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Tools MCP](#tools-mcp)
- [Sécurité](#sécurité)
- [Exemples](#exemples)
- [Dépannage](#dépannage)

---

## Fonctionnement

Le fonctionnement de SQL Bridge MCP repose sur un flux d'interaction simple mais puissant :

```
┌─────────────────────────────────────────────────────────────────┐
│ Utilisateur: "Combien d'utilisateurs se sont inscrits aujourd'hui?"│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SQL Bridge reçoit la question via le tool 'ask'                 │
│ Récupère le SCHEMA complet de la base de données                │
│ Transmet le tout au LLM avec instructions détaillées            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Le LLM analyse le schéma et génère une requête SQL appropriée:  │
│ SELECT * FROM users WHERE DATE(created_at) = CURDATE()         │
│ Exécute le tool 'execute_sql'                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SQL Bridge valide et exécute la requête (lecture seule)         │
│ Retourne les résultats au LLM                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Réponse formatée et agréable:                                    │
│                                                                  │
│ "J'ai trouvé 3 utilisateurs inscrits aujourd'hui! 🎉            │
│  • Jean Dupont (jean@email.com) - inscrit à 14h32              │
│  • Marie Martin (marie@email.com) - inscrit à 16h45            │
│  • Pierre Durand (pierre@email.com) - inscrit à 18h20          │
│                                                                  │
│  C'est une bonne journée pour les inscriptions!"                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Caractéristiques

### 🛡️ Sécurité Maximale

- **Lecture seule** : Seules les requêtes `SELECT` sont autorisées
- **Validation stricte** : Filtrage des commandes dangereuses (INSERT, UPDATE, DELETE, DROP, etc.)
- **Requêtes paramétrées** : Prévention complète de l'injection SQL
- **Rate limiting** : 5 requêtes par seconde maximum (configurable)
- **Utilisateur dédié** : Création d'un compte MySQL restreint recommandée

### ⚡ Performance

- **Pool de connexions** : Réutilisation intelligente des connexions
- **Gestion d'erreurs** : Fermeture propre et timeout appropriés
- **Caching des schémas** : Minimisation des appels à information_schema

### 🔌 Compatibilité Complète

- Support de **Claude Desktop** (macOS/Windows)
- Support de **Claude Code** (CLI)
- Support de **VS Code + GitHub Copilot**
- Support de **Cursor**
- Support de **Continue.dev**
- Support de **ChatGPT** et autres LLMs compatibles MCP

### 📊 Exploration de Données

- Affichage du schéma complet avec types et contraintes
- Aperçu des données avec sampling
- Statistiques des tables (nombre de lignes)
- Descriptions et commentaires des colonnes

---

## Installation

### Installation Globale (Recommandée)

```bash
npm install -g sql-bridge-mcp
```

### Installation Locale pour le Développement

```bash
# Cloner le repository
git clone https://github.com/anelkamd/sql-bridge-mcp
cd sql-bridge-mcp

# Installer les dépendances
npm install

# Compiler le TypeScript
npm run build

# Installer localement
npm link
```

### Vérifier l'Installation

```bash
# Devrait afficher la version
sql-bridge-mcp --version

# Ou directement
which sql-bridge-mcp
```

---

## Configuration

### 1. Préparer la Base de Données

#### Option A : Utiliser une base existante

Créez un utilisateur MySQL dédié avec droits **SELECT uniquement** :

```sql
-- Connexion en tant que root
sudo mysql -u root

-- Créer l'utilisateur
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'mot_de_passe_securise';

-- Donner les droits de lecture sur votre base
GRANT SELECT ON ma_base_de_donnees.* TO 'sqlbridge'@'localhost';

-- Appliquer les changements
FLUSH PRIVILEGES;

-- Vérifier (quitter avec Ctrl+D)
\q
```

#### Option B : Créer une base de test

```bash
mysql -u root -p < scripts/schema.sql
```

Ce script crée une base de test avec des tables d'exemple :

- **users** : Utilisateurs (id, email, fullname, created_at, role)
- **products** : Produits (id, name, price, stock, category)
- **orders** : Commandes (id, user_id, total, status)

### 2. Configurer les Variables d'Environnement

Créez un fichier `.env` à la racine du projet :

```bash
# Dans votre terminal
cp .env.example .env

# Puis éditez avec votre éditeur préféré
nano .env
```

Contenu du `.env` :

```env
# Paramètres de connexion MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=sqlbridge
MYSQL_PASSWORD=mot_de_passe_securise
MYSQL_DATABASE=ma_base_de_donnees
```

**Variables disponibles :**

| Variable         | Description        | Défaut      | Requis  |
| ---------------- | ------------------ | ----------- | ------- |
| `MYSQL_HOST`     | Adresse du serveur | `localhost` | Non     |
| `MYSQL_PORT`     | Port MySQL         | `3306`      | Non     |
| `MYSQL_USER`     | Utilisateur MySQL  | `root`      | Non     |
| `MYSQL_PASSWORD` | Mot de passe       | (vide)      | Non     |
| `MYSQL_DATABASE` | Nom de la base     | (vide)      | **Oui** |

### 3. Intégrer avec votre LLM

#### Claude Desktop (macOS/Windows)

**Localisation des fichiers de config :**

- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration :**

```json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "sqlbridge",
        "MYSQL_PASSWORD": "mot_de_passe_securise",
        "MYSQL_DATABASE": "ma_base"
      }
    }
  }
}
```

Redémarrez Claude Desktop. Le serveur s'activera automatiquement.

#### Claude Code (CLI)

```bash
claude mcp add sql-bridge sql-bridge-mcp \
  -e MYSQL_HOST=localhost \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=sqlbridge \
  -e MYSQL_PASSWORD=mot_de_passe_securise \
  -e MYSQL_DATABASE=ma_base
```

#### VS Code + GitHub Copilot

Créez `.vscode/mcp.json` à la racine de votre workspace :

```json
{
  "servers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "sqlbridge",
        "MYSQL_PASSWORD": "mot_de_passe_securise",
        "MYSQL_DATABASE": "ma_base"
      }
    }
  }
}
```

#### Cursor

Éditez ou créez `~/.cursor/mcp.json` :

```json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "sqlbridge",
        "MYSQL_PASSWORD": "mot_de_passe_securise",
        "MYSQL_DATABASE": "ma_base"
      }
    }
  }
}
```

#### Continue.dev

Éditez `~/.continue/config.json` :

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "sql-bridge-mcp",
          "env": {
            "MYSQL_HOST": "localhost",
            "MYSQL_PORT": "3306",
            "MYSQL_USER": "sqlbridge",
            "MYSQL_PASSWORD": "mot_de_passe_securise",
            "MYSQL_DATABASE": "ma_base"
          }
        }
      }
    ]
  }
}
```

### 4. Tester la Connexion

```bash
# Démarrer le serveur
sql-bridge-mcp

# Vous devriez voir:
# [SQL Bridge] Connecté à la base: ma_base
# [SQL Bridge] Serveur MCP lancé sur stdio
```

---

## Architecture

### Vue d'Ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                    LLM (Claude, Copilot, etc)               │
│                    Utilise les tools MCP                     │
└────────────────────────────────────────────────────────────┬─┘
                                                            │
                        Protocole MCP
                          (stdio/http)
                                                            │
┌────────────────────────────────────────────────────────────▼─┐
│              SQL Bridge MCP Server                            │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  MCP Server Interface (src/mcp-server.ts)            │    │
│  │  • Gère les tools (ask, execute_sql, etc)           │    │
│  │  • Valide les requêtes                               │    │
│  │  • Applique le rate limiting                         │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Database Module (src/db.ts)                         │    │
│  │  • Pool de connexions MySQL                          │    │
│  │  • Exécution des requêtes                            │    │
│  │  • Gestion des erreurs                               │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Query Helpers (src/queries.ts)                      │    │
│  │  • Fonctions SQL réutilisables                       │    │
│  │  • Requêtes paramétrées                              │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┬──┘
                                                             │
                                                     MySQL 3306
                                                             │
                    ┌───────────────────────────────────────▼──┐
                    │      MySQL Database Server              │
                    │  (Lecture seule pour sqlbridge user)     │
                    └──────────────────────────────────────────┘
```

### Fichiers Clés

**[src/index.ts](src/index.ts)** - Point d'entrée

- Gère le démarrage du serveur
- Configure les signaux d'arrêt gracieux (SIGINT, SIGTERM)
- Gère les erreurs non capturées

**[src/mcp-server.ts](src/mcp-server.ts)** - Cœur du serveur MCP (704 lignes)

- Définition de tous les tools disponibles
- Validation stricte des entrées
- Implémentation du rate limiting
- Récupération du schéma de la base
- Gestion des ressources et prompts

**[src/db.ts](src/db.ts)** - Module de base de données

- Pool de connexions MySQL avec configuration automatique
- Gestion singleton de la connexion
- Test de connexion
- Fermeture propre du pool

**[src/queries.ts](src/queries.ts)** - Fonctions utilitaires

- Requêtes paramétrées réutilisables
- Fonctions d'accès aux utilisateurs
- Pagination avec sécurité intégrée

---

## Tools MCP

SQL Bridge expose 5 tools MCP principaux :

### 1. `ask` - Question en Langage Naturel

**Description :** Outil principal pour poser des questions sur la base de données.

**Fonctionnement :**

- Reçoit une question en langage naturel
- Récupère le schéma complet de la base
- Transmet le schéma au LLM avec instructions détaillées
- Le LLM génère la requête SQL et l'exécute avec `execute_sql`

**Paramètres :**

```typescript
{
  "question": "string (requis)"  // Votre question
}
```

**Exemple d'utilisation :**

```
Utilisateur: "Combien d'utilisateurs premium avons-nous ?"
SQL Bridge retourne le schéma complet
LLM génère: SELECT COUNT(*) FROM users WHERE role = 'premium'
```

**Schéma retourné :**

```json
{
  "database": "ma_base",
  "tables": [
    {
      "name": "users",
      "rows": 1250,
      "comment": "Table des utilisateurs",
      "columns": [
        {
          "name": "id",
          "type": "int(11)",
          "nullable": false,
          "key": "PRI",
          "default": null
        },
        {
          "name": "email",
          "type": "varchar(255)",
          "nullable": false,
          "key": "UNI",
          "default": null
        }
        // ... autres colonnes
      ]
    }
    // ... autres tables
  ]
}
```

### 2. `execute_sql` - Exécuter une Requête SQL

**Description :** Exécute une requête SELECT et retourne les résultats.

**Fonctionnement :**

- Valide que la requête commence par SELECT
- Bloque les opérations dangereuses (INSERT, UPDATE, etc.)
- Exécute avec limit de sécurité
- Retourne les résultats au LLM pour formatage

**Paramètres :**

```typescript
{
  "sql": "string (requis)",     // Requête SELECT
  "limit": "integer (optionnel)" // Max 500, défaut 50
}
```

**Exemple :**

```typescript
{
  "sql": "SELECT email, COUNT(*) as order_count FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.id ORDER BY order_count DESC LIMIT 10",
  "limit": 10
}
```

**Résultat :**

```json
[
  {
    "email": "top_customer@example.com",
    "order_count": 45
  },
  {
    "email": "regular_customer@example.com",
    "order_count": 12
  }
]
```

### 3. `list_tables` - Lister les Tables

**Description :** Affiche toutes les tables avec leurs statistiques.

**Paramètres :** Aucun

**Exemple de résultat :**

```
📊 Base de données: ma_base (3 tables)

┌─────────────┬──────────┬──────────────────────────────────┐
│ Table       │ Lignes   │ Commentaire                      │
├─────────────┼──────────┼──────────────────────────────────┤
│ users       │ 1250     │ Table des utilisateurs           │
│ products    │ 450      │ Catalogue de produits            │
│ orders      │ 5280     │ Historique des commandes         │
└─────────────┴──────────┴──────────────────────────────────┘
```

### 4. `describe_table` - Détails d'une Table

**Description :** Affiche la structure détaillée d'une table.

**Paramètres :**

```typescript
{
  "table": "string (requis)"  // Nom de la table
}
```

**Exemple de résultat :**

```
🔍 Structure de la table: users

┌──────────┬─────────────────┬──────────┬─────┬──────────┬────────────────┐
│ Colonne  │ Type            │ Nullable │ Clé │ Défaut   │ Commentaire    │
├──────────┼─────────────────┼──────────┼─────┼──────────┼────────────────┤
│ id       │ int(11)         │ Non      │ PRI │          │ ID utilisateur │
│ email    │ varchar(255)    │ Non      │ UNI │          │ Email unique   │
│ fullname │ varchar(255)    │ Non      │     │          │ Nom complet    │
│ created_ │ datetime        │ Non      │     │ NOW()    │ Date création  │
│ at       │                 │          │     │          │                │
│ role     │ varchar(50)     │ Oui      │     │ 'user'   │ Rôle utilisat. │
└──────────┴─────────────────┴──────────┴─────┴──────────┴────────────────┘
```

### 5. `sample_data` - Aperçu des Données

**Description :** Récupère un échantillon de données pour comprendre le contenu.

**Paramètres :**

```typescript
{
  "table": "string (requis)",    // Nom de la table
  "limit": "integer (optionnel)" // 1-20, défaut 5
}
```

**Exemple de résultat :**

```
📋 Données de la table: users (affichage de 5 lignes)

┌────┬─────────────────────────┬──────────────────┬─────────────────────┬──────────┐
│ id │ email                   │ fullname         │ created_at          │ role     │
├────┼─────────────────────────┼──────────────────┼─────────────────────┼──────────┤
│ 1  │ admin@example.com       │ Admin User       │ 2024-01-15 10:30:00 │ admin    │
│ 2  │ john@example.com        │ John Doe         │ 2024-01-20 14:45:00 │ user     │
│ 3  │ jane@example.com        │ Jane Smith       │ 2024-01-22 09:15:00 │ user     │
└────┴─────────────────────────┴──────────────────┴─────────────────────┴──────────┘

ℹ️ Total de lignes: 1250
```

---

## Sécurité

### 🔐 Mesures de Sécurité Implémentées

#### 1. Validation Stricte des Requêtes

```typescript
// Les requêtes DOIVENT commencer par SELECT
✅ Autorisé:  SELECT * FROM users
✅ Autorisé:  SELECT id, email FROM products WHERE price > 100
❌ Bloqué:    INSERT INTO users VALUES (...)
❌ Bloqué:    UPDATE users SET email = 'test@test.com'
❌ Bloqué:    DELETE FROM users
```

#### 2. Opérations Bloquées

La validation bloque les commandes suivantes (case-insensitive) :

- `INSERT` - Insertion de données
- `UPDATE` - Modification de données
- `DELETE` - Suppression de données
- `DROP` - Suppression de tables/bases
- `CREATE` - Création de tables/bases
- `ALTER` - Modification de structure
- `TRUNCATE` - Suppression de tous les enregistrements
- `GRANT` / `REVOKE` - Modification des permissions
- `EXEC` / `EXECUTE` - Exécution de procédures

#### 3. Prévention de l'Injection SQL

```typescript
// ❌ JAMAIS: Concaténation directe
const sql = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ TOUJOURS: Requêtes paramétrées
const sql = `SELECT * FROM users WHERE id = ?`;
const rows = await query(sql, [userId]);
```

**Tous les tools utilisent des requêtes paramétrées** via le pool MySQL2.

#### 4. Contrôle d'Accès

**Création recommandée d'un utilisateur dédié :**

```sql
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'motdepasse';
GRANT SELECT ON votre_base.* TO 'sqlbridge'@'localhost';
FLUSH PRIVILEGES;
```

Cet utilisateur :

- ✅ Peut lire TOUTES les tables
- ❌ Ne peut pas modifier les données
- ❌ Ne peut pas créer/supprimer de tables
- ❌ Ne peut pas accéder à d'autres bases

#### 5. Rate Limiting

```typescript
// Limitation à 5 requêtes par seconde
// Configurable dans mcp-server.ts
const rateLimiter = new RateLimiter(5); // requestsPerSecond
```

#### 6. Validation des Noms de Tables

```typescript
// Seuls les caractères alphanumériques et underscore
// Format: [a-zA-Z_][a-zA-Z0-9_]*
✅ users, user_profiles, table_2024
❌ user;drop, 123table, table-name
```

#### 7. Limite de Résultats

```typescript
// execute_sql: Max 500 résultats
// sample_data: Max 20 lignes
// list_tables: Limite du serveur
```

---

## Exemples

### Cas d'Utilisation Courants

#### 1. Analytics et Rapports

**Question :** "Quel est le chiffre d'affaires total du mois dernier ?"

**Flux :**

```
LLM reçoit le schéma → Génère:
SELECT SUM(total) as revenue
FROM orders
WHERE MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
AND YEAR(created_at) = YEAR(NOW())

Résultat: $45,230.50 généré le mois dernier ! 💰
```

#### 2. Exploration de Données

**Question :** "Montre-moi les 10 clients les plus actifs"

```sql
SELECT
  u.email,
  u.fullname,
  COUNT(o.id) as total_orders,
  SUM(o.total) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id
ORDER BY total_orders DESC
LIMIT 10
```

#### 3. Contrôle de Qualité

**Question :** "Y a-t-il des commandes en attente depuis plus de 7 jours ?"

```sql
SELECT
  id,
  user_id,
  created_at,
  DATEDIFF(NOW(), created_at) as days_pending
FROM orders
WHERE status = 'pending'
AND DATEDIFF(NOW(), created_at) > 7
```

#### 4. Gestion d'Inventaire

**Question :** "Quels produits ont un stock faible (< 10 unités) ?"

```sql
SELECT
  id,
  name,
  stock,
  price
FROM products
WHERE stock < 10
ORDER BY stock ASC
```

### Exemple Complet en Temps Réel

**Conversation avec Claude :**

```
Utilisateur: "Combien de nouveaux utilisateurs depuis hier ?"

Claude: Je vais chercher cette information pour vous...

1. Appelle le tool 'ask' avec votre question
2. Reçoit le schéma de la base (10 tables, structures, types)
3. Génère la requête:
   SELECT COUNT(*) as new_users
   FROM users
   WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)

4. Appelle 'execute_sql' avec cette requête
5. Récoit le résultat: 23 nouveaux utilisateurs
6. Formate la réponse:

"Excellent ! 📈
Vous avez accueilli 23 nouveaux utilisateurs hier.
C'est une augmentation de 15% par rapport à la moyenne quotidienne."
```

---

## Dépannage

### Problème : "Connection refused"

**Symptômes :**

```
[SQL Bridge] Erreur: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions :**

1. Vérifier que MySQL est lancé :

```bash
# Linux/Mac
sudo systemctl status mysql
# ou
brew services list | grep mysql

# Windows
sc query MySQL80
```

2. Vérifier les paramètres de connexion dans `.env` :

```env
MYSQL_HOST=localhost  # ou 127.0.0.1
MYSQL_PORT=3306      # Port correct ?
MYSQL_USER=sqlbridge
MYSQL_PASSWORD=...
MYSQL_DATABASE=...
```

3. Vérifier la connectivité MySQL :

```bash
mysql -h localhost -u sqlbridge -p ma_base

# Ou avec la commande 'test'
sql-bridge-mcp test
```

### Problème : "Access denied for user 'sqlbridge'"

**Symptômes :**

```
[SQL Bridge] Erreur: Access denied for user 'sqlbridge'@'localhost'
```

**Solutions :**

1. Vérifier que l'utilisateur existe :

```bash
mysql -u root -p

# Dans MySQL:
SELECT User, Host FROM mysql.user WHERE User = 'sqlbridge';
```

2. Recréer l'utilisateur s'il n'existe pas :

```sql
DROP USER 'sqlbridge'@'localhost';
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'nouveau_motdepasse';
GRANT SELECT ON ma_base.* TO 'sqlbridge'@'localhost';
FLUSH PRIVILEGES;
```

3. Vérifier le mot de passe dans `.env` :

```env
MYSQL_PASSWORD=doit_correspondre_exactement
```

### Problème : "auth_socket" sur Ubuntu

**Symptômes :**

```
Access denied for user 'root'@'localhost' (using password: YES)
```

**Solution :**

```bash
sudo mysql

# Dans MySQL:
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'nouveau_mdp';
FLUSH PRIVILEGES;
\q

# Mettre à jour .env
MYSQL_USER=root
MYSQL_PASSWORD=nouveau_mdp
```

### Problème : "Database not found"

**Symptômes :**

```
[SQL Bridge] Erreur: Unknown database 'ma_base'
```

**Solutions :**

1. Vérifier que la base existe :

```bash
mysql -u root -p

# Dans MySQL:
SHOW DATABASES LIKE 'ma_base';
```

2. Créer la base si elle n'existe pas :

```sql
CREATE DATABASE ma_base
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

3. Vérifier la variable d'environnement :

```env
MYSQL_DATABASE=ma_base  # Sans backticks
```

### Problème : Rate limiting actif

**Symptômes :**

```
Délais anormaux entre les requêtes
```

**Solution :**

Augmenter la limite dans [src/mcp-server.ts](src/mcp-server.ts) :

```typescript
const rateLimiter = new RateLimiter(10); // Au lieu de 5
```

### Problème : Port MySQL en utilisation

**Symptômes :**

```
Erreur: Port 3306 déjà en utilisation
```

**Solutions :**

1. Utiliser un port différent dans `.env` :

```env
MYSQL_PORT=3307
```

2. Ou arrêter le processus qui utilise le port :

```bash
# Trouver le processus
lsof -i :3306

# Tuer le processus
kill -9 <PID>
```

### Déboguer avec Logs

Pour plus de détails, activez les logs de débogage :

```bash
# Avec NODE_DEBUG
NODE_DEBUG=mysql:* sql-bridge-mcp

# Ou ajouter dans le code
console.log('[SQL Bridge Debug]', data)
```

---

## Développement

### Structure du Projet

```
sql-bridge-mcp/
├── src/
│   ├── index.ts           # Point d'entrée
│   ├── mcp-server.ts      # Serveur MCP (cœur)
│   ├── db.ts              # Module base de données
│   ├── queries.ts         # Requêtes paramétrées
│   └── client.ts          # Client de test
├── scripts/
│   └── schema.sql         # Schéma de test
├── dist/                  # Compilé (généré)
├── package.json           # Dépendances
├── tsconfig.json          # Configuration TypeScript
└── README.md              # Documentation
```

### Installation pour Développement

```bash
git clone https://github.com/anelkamd/sql-bridge-mcp
cd sql-bridge-mcp
npm install
```

### Compilation

```bash
# Build une fois
npm run build

# Watch mode (recompile à chaque changement)
npm run dev
```

### Test Local

```bash
# Avec la base de test
./scripts/schema.sql | mysql -u root -p

# Configurer .env
cp .env.example .env
nano .env  # Remplir les variables

# Lancer le serveur
npm run dev
# Ou directement
node dist/index.js

# Dans un autre terminal, tester
npm test
```

### Publier sur npm

```bash
# Vérifier la version dans package.json
npm version patch  # ou minor/major

# Compiler
npm run build

# Publier
npm publish
```

---

## Support et Contribution

### Rapporter un Bug

Ouvrez une issue sur [GitHub](https://github.com/anelkamd/sql-bridge-mcp/issues) avec :

- Version de SQL Bridge (`npm list sql-bridge-mcp`)
- Version de MySQL (`mysql --version`)
- Système d'exploitation
- Logs d'erreur complets
- Étapes pour reproduire

### Contribuer

Les contributions sont bienvenues !

1. Fork le repository
2. Créez une branche (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add amazing feature'`)
4. Pushez vers GitHub (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

### Idées de Contributions

- Support de PostgreSQL/SQLite
- Caching intelligent du schéma
- Webhooks pour les notifications
- Audit logging
- Support de procédures stockées (SELECT uniquement)
- Interface web pour explorer les données
- Tests unitaires étendus

---

## Licence

MIT © SQL Bridge Contributors

Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## Ressources Supplémentaires

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Claude API Documentation](https://claude.ai/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Dernière mise à jour :** 2024  
**Mainteneur :** SQL Bridge Contributors  
**Repository :** https://github.com/anelkamd/sql-bridge-mcp
