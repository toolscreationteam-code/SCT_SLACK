import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

let dbHost = (process.env.DB_HOST && process.env.DB_HOST.trim()) || '91.108.107.40';
if (dbHost === 'auth-db1408.hstgr.io') {
  dbHost = '91.108.107.40';
}
const dbUser = (process.env.DB_USER && process.env.DB_USER.trim()) || 'u339048620_stkreq';
const dbPassword = (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim()) || '8yc7zuc8z*A';
const dbName = (process.env.DB_NAME && process.env.DB_NAME.trim()) || 'u339048620_stkreq';
const dbPort = Number(process.env.DB_PORT) || 3306;

const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  port: dbPort,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000
});

export default pool;
