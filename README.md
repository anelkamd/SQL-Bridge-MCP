# SQL Bridge MCP

**Serveur MCP universel pour connecter n'importe quel LLM a votre base de donnees MySQL.**

SQL Bridge permet a Claude, Copilot, et autres LLMs d'explorer et interroger vos bases de donnees MySQL en toute securite (lecture seule).

---

## Fonctionnalites

| Tool | Description |
|------|-------------|
| `list_tables` | Liste toutes les tables de la base |
| `describe_table` | Affiche la structure d'une table (colonnes, types, cles) |
| `select_query` | Execute des requetes SELECT (lecture seule) |
| `sample_data` | Recupere des exemples de donnees d'une table |

| Resource | Description |
|----------|-------------|
| `sqlbridge://schema` | Schema complet de la base (tables + colonnes) |

| Prompt | Description |
|--------|-------------|
| `explore_database` | Guide pour explorer la base |
| `query_assistant` | Aide a construire des requetes depuis du langage naturel |

---

## Installation

### 1. Telecharger et installer

\`\`\`bash
# Cloner ou telecharger le projet
cd sql-bridge-mcp

# Installer les dependances
npm install

# Compiler TypeScript
npm run build
\`\`\`

### 2. Configurer la connexion MySQL

Creez un fichier `.env` a la racine du projet :

\`\`\`env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=votre_mot_de_passe
MYSQL_DATABASE=nom_de_votre_base
\`\`\`

### 3. Tester la connexion

\`\`\`bash
npm run client
\`\`\`

---

## Configuration pour les LLMs

### Claude Desktop (macOS/Windows)

Editez le fichier de configuration Claude :

**macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

\`\`\`json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "node",
      "args": ["/chemin/absolu/vers/sql-bridge-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "votre_mot_de_passe",
        "MYSQL_DATABASE": "votre_base"
      }
    }
  }
}
\`\`\`

Redemarrez Claude Desktop apres modification.

---

### Claude Code (CLI)

\`\`\`bash
# Ajouter le serveur MCP
claude mcp add sql-bridge node /chemin/absolu/vers/sql-bridge-mcp/dist/index.js \
  -e MYSQL_HOST=localhost \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=votre_mot_de_passe \
  -e MYSQL_DATABASE=votre_base

# Verifier l'installation
claude mcp list
\`\`\`

---

### VS Code + GitHub Copilot

Ajoutez dans vos settings VS Code (`settings.json`) ou creez `.vscode/mcp.json` :

\`\`\`json
{
  "servers": {
    "sql-bridge": {
      "command": "node",
      "args": ["/chemin/absolu/vers/sql-bridge-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "votre_mot_de_passe",
        "MYSQL_DATABASE": "votre_base"
      }
    }
  }
}
\`\`\`

---

### Cursor

Editez le fichier `~/.cursor/mcp.json` :

\`\`\`json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "node",
      "args": ["/chemin/absolu/vers/sql-bridge-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "votre_mot_de_passe",
        "MYSQL_DATABASE": "votre_base"
      }
    }
  }
}
\`\`\`

---

### Continue.dev

Editez `~/.continue/config.json` :

\`\`\`json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/chemin/absolu/vers/sql-bridge-mcp/dist/index.js"],
          "env": {
            "MYSQL_HOST": "localhost",
            "MYSQL_PORT": "3306",
            "MYSQL_USER": "root",
            "MYSQL_PASSWORD": "votre_mot_de_passe",
            "MYSQL_DATABASE": "votre_base"
          }
        }
      }
    ]
  }
}
\`\`\`

---

## Utilisation

Une fois configure, vous pouvez demander a votre LLM :

- "Liste les tables de ma base de donnees"
- "Decris la structure de la table users"
- "Montre-moi les 10 derniers utilisateurs inscrits"
- "Combien de commandes ont ete passees ce mois-ci ?"
- "Quels produits ont un stock inferieur a 10 ?"

Le LLM utilisera automatiquement les tools SQL Bridge pour repondre.

---

## Securite

SQL Bridge est concu pour etre sur :

- **Lecture seule** : Seules les requetes `SELECT` sont autorisees
- **Validation des inputs** : Les noms de tables et requetes sont valides
- **Rate limiting** : 5 requetes/seconde maximum
- **Pas d'injection SQL** : Requetes parametrees et validation stricte

**Operations bloquees** : INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, GRANT, REVOKE

---

## Configuration MySQL sur Ubuntu

### Verifier que MySQL est installe

\`\`\`bash
sudo systemctl status mysql
\`\`\`

### Creer un utilisateur dedie (recommande)

\`\`\`sql
-- Se connecter a MySQL
sudo mysql -u root

-- Creer un utilisateur pour SQL Bridge
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'mot_de_passe_securise';

-- Donner les droits de lecture sur votre base
GRANT SELECT ON votre_base.* TO 'sqlbridge'@'localhost';

-- Appliquer les changements
FLUSH PRIVILEGES;
\`\`\`

Puis utilisez cet utilisateur dans votre `.env` :

\`\`\`env
MYSQL_USER=sqlbridge
MYSQL_PASSWORD=mot_de_passe_securise
\`\`\`

### Probleme d'authentification auth_socket

Si vous avez l'erreur `Access denied`, MySQL utilise peut-etre `auth_socket` :

\`\`\`bash
# Se connecter en root
sudo mysql

# Changer la methode d'authentification
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'nouveau_mot_de_passe';
FLUSH PRIVILEGES;
\`\`\`

---

## Structure du projet

\`\`\`
sql-bridge-mcp/
├── src/
│   ├── index.ts        # Point d'entree
│   ├── mcp-server.ts   # Serveur MCP (tools, resources, prompts)
│   ├── db.ts           # Connexion MySQL
│   └── client.ts       # Client de test
├── dist/               # Code compile (apres npm run build)
├── .env                # Configuration MySQL
├── package.json
├── tsconfig.json
└── README.md
\`\`\`

---

## Commandes

| Commande | Description |
|----------|-------------|
| `npm install` | Installer les dependances |
| `npm run build` | Compiler TypeScript |
| `npm run start` | Demarrer le serveur MCP |
| `npm run client` | Executer les tests |

---

## Licence

MIT
