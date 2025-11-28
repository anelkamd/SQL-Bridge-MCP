# SQL Bridge MCP

**Serveur MCP universel pour connecter n'importe quel LLM a votre base de donnees MySQL - en langage naturel!**

[![npm version](https://badge.fury.io/js/sql-bridge-mcp.svg)](https://www.npmjs.com/package/sql-bridge-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SQL Bridge permet a Claude, Copilot, Cursor et autres LLMs d'explorer et interroger vos bases de donnees MySQL **en langage naturel**, avec des reponses agreables et lisibles.

---

## Fonctionnement

\`\`\`
Vous: "Combien d'utilisateurs se sont inscrits aujourd'hui?"

SQL Bridge:
1. Recoit la question en langage naturel
2. Fournit le schema de votre base au LLM
3. Le LLM genere: SELECT * FROM users WHERE DATE(created_at) = CURDATE()
4. Execute la requete (lecture seule)
5. Le LLM formate une reponse agreable:

"J'ai trouve 3 utilisateurs inscrits aujourd'hui! 🎉
• Jean Dupont (jean@email.com) - inscrit a 14h32
• Marie Martin (marie@email.com) - inscrit a 16h45
• Pierre Durand (pierre@email.com) - inscrit a 18h20

C'est une bonne journee pour les inscriptions!"
\`\`\`

---

## Installation

\`\`\`bash
npm install -g sql-bridge-mcp
\`\`\`

---

## Exemples de questions

Une fois configure, posez des questions naturelles a votre LLM:

- "Combien d'utilisateurs se sont inscrits cette semaine?"
- "Montre-moi les 5 derniers produits ajoutes"
- "Quels clients ont passe des commandes de plus de 100 euros?"
- "Liste les utilisateurs avec un email Gmail"
- "Quel est le produit le plus vendu?"
- "Y a-t-il des commandes en attente depuis plus de 3 jours?"

Le LLM comprendra votre question, generera le SQL, et vous repondra de maniere conversationnelle.

---

## Tools disponibles

| Tool | Description |
|------|-------------|
| `ask` | **Principal** - Recoit une question naturelle et retourne le schema pour aider le LLM |
| `execute_sql` | Execute une requete SELECT et retourne les resultats |
| `list_tables` | Liste toutes les tables de la base |
| `describe_table` | Affiche la structure d'une table |
| `sample_data` | Recupere des exemples de donnees |

---

## Configuration pour les LLMs

### Claude Desktop (macOS/Windows)

**macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

\`\`\`json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
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

Redemarrez Claude Desktop. Ensuite, dites simplement:
> "Utilise le prompt assistant_sql pour m'aider avec ma base de donnees"

Ou posez directement vos questions!

---

### Claude Code (CLI)

\`\`\`bash
claude mcp add sql-bridge sql-bridge-mcp \
  -e MYSQL_HOST=localhost \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=votre_mot_de_passe \
  -e MYSQL_DATABASE=votre_base
\`\`\`

---

### VS Code + GitHub Copilot

Creez `.vscode/mcp.json` :

\`\`\`json
{
  "servers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
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

Editez `~/.cursor/mcp.json` :

\`\`\`json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
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
          "command": "sql-bridge-mcp",
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

## Prompts MCP

SQL Bridge inclut des prompts pre-configures pour une meilleure experience:

### `assistant_sql`
Active le mode assistant conversationnel. Le LLM repondra de maniere agreable avec des emojis et bullet points.

### `query_natural`
Convertit une question specifique en SQL et formate la reponse.

---

## Test en local

\`\`\`bash
# Cloner ou telecharger le projet
cd sql-bridge-mcp

# Installer
npm install

# Configurer (editez .env)
cp .env.example .env
nano .env

# Compiler
npm run build

# Tester
npm test

# Installer globalement en local
npm link
\`\`\`

---

## Securite

- **Lecture seule** : Seules les requetes SELECT sont autorisees
- **Validation stricte** : Noms de tables et requetes valides
- **Rate limiting** : 5 requetes/seconde max
- **Pas d'injection SQL** : Requetes parametrees

**Bloque** : INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE

---

## Configuration MySQL Ubuntu

### Creer un utilisateur dedie (recommande)

\`\`\`sql
sudo mysql -u root

CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'mot_de_passe_securise';
GRANT SELECT ON votre_base.* TO 'sqlbridge'@'localhost';
FLUSH PRIVILEGES;
\`\`\`

### Probleme auth_socket

\`\`\`bash
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'nouveau_mdp';
FLUSH PRIVILEGES;
\`\`\`

---

## Variables d'environnement

| Variable | Description | Defaut |
|----------|-------------|--------|
| `MYSQL_HOST` | Hote MySQL | `localhost` |
| `MYSQL_PORT` | Port MySQL | `3306` |
| `MYSQL_USER` | Utilisateur | `root` |
| `MYSQL_PASSWORD` | Mot de passe | (vide) |
| `MYSQL_DATABASE` | Base de donnees | (requis) |

---

## Publier sur npm

\`\`\`bash
npm adduser
npm publish
\`\`\`

---

## Licence

MIT
