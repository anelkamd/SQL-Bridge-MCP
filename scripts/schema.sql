-- ============================================
-- SQL Bridge - Schema de test (optionnel)
-- Utilisez ce script pour creer une base de test
-- ============================================

-- Creer la base de donnees
CREATE DATABASE IF NOT EXISTS sql_bridge_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sql_bridge_test;

-- Table users
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  fullname VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  role VARCHAR(50) DEFAULT 'user'
);

-- Table products
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 0,
  category VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table orders
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Donnees de test
INSERT INTO users (email, fullname, role) VALUES
  ('admin@example.com', 'Admin User', 'admin'),
  ('john@example.com', 'John Doe', 'user'),
  ('jane@example.com', 'Jane Smith', 'user');

INSERT INTO products (name, price, stock, category) VALUES
  ('Laptop Pro', 1299.99, 15, 'Electronics'),
  ('Wireless Mouse', 29.99, 100, 'Electronics'),
  ('Coffee Mug', 12.99, 50, 'Kitchen'),
  ('Notebook', 5.99, 200, 'Office');

INSERT INTO orders (user_id, total, status) VALUES
  (2, 1329.98, 'completed'),
  (3, 18.98, 'shipped'),
  (2, 29.99, 'pending');

-- Verification
SELECT 'Tables creees:' AS info;
SHOW TABLES;
