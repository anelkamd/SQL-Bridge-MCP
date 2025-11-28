# Installation du MCP Server MySQL sur Ubuntu

## Prérequis

1. **Node.js 18+** installé
2. **MySQL** installé et en cours d'exécution
3. **npm** ou **pnpm**

## Étape 1 : Vérifier votre installation MySQL

\`\`\`bash
# Vérifier que MySQL est en cours d'exécution
sudo systemctl status mysql

# Se connecter à MySQL pour vérifier les credentials
mysql -u root -p
\`\`\`

## Étape 2 : Créer la base de données et la table

Connectez-vous à MySQL et exécutez :

\`\`\`sql
-- Créer la base de données (si elle n'existe pas)
CREATE DATABASE IF NOT EXISTS mcp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mcp_db;

-- Créer la table users
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(50) NOT NULL DEFAULT 'user'
);

-- Insérer des données de test
INSERT INTO users (email, fullname, role, created_at) VALUES
    ('admin@example.com', 'Administrateur Principal', 'admin', NOW()),
    ('jean.dupont@example.com', 'Jean Dupont', 'user', NOW()),
    ('marie.martin@example.com', 'Marie Martin', 'moderator', NOW()),
    ('pierre.durand@example.com', 'Pierre Durand', 'user', NOW()),
    ('sophie.bernard@example.com', 'Sophie Bernard', 'user', NOW());
\`\`\`

Ou exécutez directement le script SQL fourni :

\`\`\`bash
mysql -u root -p < scripts/schema.sql
\`\`\`

## Étape 3 : Configurer le fichier .env

Modifiez le fichier `.env` à la racine du projet :

\`\`\`bash
# Ouvrez le fichier .env
nano .env
\`\`\`

Configurez vos identifiants MySQL :

\`\`\`env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=votre_mot_de_passe_mysql
MYSQL_DATABASE=mcp_db
\`\`\`

**Important :** Sur Ubuntu, si vous avez configuré MySQL avec `auth_socket`, vous devrez peut-être :

\`\`\`bash
# Option 1 : Créer un utilisateur avec mot de passe
sudo mysql -u root
CREATE USER 'mcp_user'@'localhost' IDENTIFIED BY 'mot_de_passe_securise';
GRANT ALL PRIVILEGES ON mcp_db.* TO 'mcp_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Puis dans .env :
MYSQL_USER=mcp_user
MYSQL_PASSWORD=mot_de_passe_securise
\`\`\`

## Étape 4 : Installer les dépendances et compiler

\`\`\`bash
# Installer les dépendances
npm install

# Compiler le TypeScript
npm run build
\`\`\`

## Étape 5 : Tester le serveur

\`\`\`bash
# Lancer le client de test
npm run client
\`\`\`

Vous devriez voir les 9 tests s'exécuter avec les résultats de votre base de données.

## Étape 6 : Utiliser avec Claude Desktop ou autre client MCP

Ajoutez cette configuration dans votre fichier de config MCP :

**Pour Claude Desktop** (`~/.config/claude/claude_desktop_config.json`) :

\`\`\`json
{
  "mcpServers": {
    "mysql-users": {
      "command": "node",
      "args": ["/chemin/vers/votre/projet/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "votre_mot_de_passe",
        "MYSQL_DATABASE": "mcp_db"
      }
    }
  }
}
\`\`\`

## Dépannage

### Erreur "Access denied for user 'root'@'localhost'"

Sur Ubuntu, MySQL utilise souvent `auth_socket` par défaut pour root :

\`\`\`bash
# Vérifier le type d'authentification
sudo mysql -u root
SELECT user, host, plugin FROM mysql.user WHERE user = 'root';

# Si plugin = 'auth_socket', changez-le :
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'nouveau_mot_de_passe';
FLUSH PRIVILEGES;
\`\`\`

### Erreur "ER_NOT_SUPPORTED_AUTH_MODE"

Installez `mysql2` qui supporte les nouvelles méthodes d'authentification (déjà inclus dans ce projet).

### Erreur "ECONNREFUSED"

MySQL n'est pas démarré :

\`\`\`bash
sudo systemctl start mysql
sudo systemctl enable mysql  # Pour démarrer au boot
\`\`\`

## Structure du projet

\`\`\`
/votre-projet
├── .env                 # Vos credentials MySQL (à créer/modifier)
├── package.json
├── tsconfig.json
├── scripts/
│   └── schema.sql       # Script SQL pour créer la table
├── src/
│   ├── index.ts         # Point d'entrée
│   ├── mcp-server.ts    # Configuration MCP (tools, resources, prompts)
│   ├── db.ts            # Pool MySQL
│   ├── queries.ts       # Requêtes SQL
│   └── client.ts        # Client de test
└── dist/                # Fichiers compilés (après npm run build)
