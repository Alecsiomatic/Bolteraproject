-- First flush to exit skip-grant-tables mode
FLUSH PRIVILEGES;
-- Reset root password and create boletera_user using ALTER USER
ALTER USER 'root'@'localhost' IDENTIFIED BY 'Cer0un0cer0.com20182417';
ALTER USER 'admin'@'localhost' IDENTIFIED BY 'Cer0un0cer0.com20182417';
CREATE USER IF NOT EXISTS 'boletera_user'@'localhost' IDENTIFIED BY 'Cer0un0cer0.com20182417';
GRANT ALL PRIVILEGES ON boletera_db.* TO 'boletera_user'@'localhost';
FLUSH PRIVILEGES;
SELECT User, Host FROM mysql.user;
