import mysql from "mysql2";

class PScale {
  static conn;

  static async init() {
    this.conn = mysql.createPool({
      uri: process.env.PLANETSCALE_URL,
      connectionLimit: 10,
    });
  }
}

export default PScale;
