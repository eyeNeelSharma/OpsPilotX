import fs from "fs";
import path from "path";

const USERS_DB_FILE = path.join(process.cwd(), "db_users.json");

export interface DBUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
  password?: string;
  createdAt: string;
}

const DEFAULT_USERS: DBUser[] = [
  { id: 'DB-REGOPS-928', name: 'Sarah Jenkins', role: 'Senior RegOps Analyst (IAM & Compliance)', avatar: 'SJ', password: 'db-key-signature', createdAt: new Date().toISOString() },
  { id: 'DB-SRE-104', name: 'Marcus Vance', role: 'Principal SRE (Infrastructure)', avatar: 'MV', password: 'db-key-signature', createdAt: new Date().toISOString() },
  { id: 'DB-RISK-712', name: 'Alok Mehta', role: 'Compliance & Risk Officer', avatar: 'AM', password: 'db-key-signature', createdAt: new Date().toISOString() }
];

export function loadUsers(): DBUser[] {
  try {
    if (fs.existsSync(USERS_DB_FILE)) {
      const data = fs.readFileSync(USERS_DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading users database:", err);
  }
  // Fallback to default users and save them
  saveUsers(DEFAULT_USERS);
  return DEFAULT_USERS;
}

export function saveUsers(users: DBUser[]): void {
  try {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving users database:", err);
  }
}

// Ensure database file is generated immediately on startup
loadUsers();
