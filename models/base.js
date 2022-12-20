import PScale from "../service/pscale.js";

class BaseModel {
  _table = "";
  _idString = "";

  validate() {
    if (this._table === "") {
      throw new Error("Table name not set");
    }

    if (this._idString === "") {
      throw new Error("Id string not set");
    }
  }

  destructure(data) {
    let queryString = "";
    for (const key of Object.keys(data)) {
      queryString += `${key} = ?, `;
    }

    return {
      queryString: queryString.slice(0, -2),
      values: Object.values(data),
    };
  }

  async findById(id) {
    const [row] = await PScale.conn
      .promise()
      .query(`SELECT * FROM ${this._table} WHERE ${this._idString} = ?`, [id]);

    return row?.[0] || null;
  }

  async findByColumn(column, data) {
    const [row] = await PScale.conn
      .promise()
      .query(`SELECT * FROM ${this._table} WHERE ${column} = ?`, [data]);

    return row?.[0] || null;
  }

  async findAllByColumn(column, data) {
    const [row] = await PScale.conn
      .promise()
      .query(`SELECT * FROM ${this._table} WHERE ${column} = ?`, [data]);

    return row || null;
  }

  async findAll(limit = 50) {
    const [row] = await PScale.conn
      .promise()
      .query(`SELECT * FROM ${this._table} LIMIT ${limit}`);

    return row || null;
  }

  async updateById(id, data) {
    const { queryString, values } = this.destructure(data);

    const [row] = await PScale.conn
      .promise()
      .execute(
        `UPDATE ${this._table} SET ${queryString} WHERE ${this._idString} = ?`,
        [...values, id]
      );

    return row;
  }

  async create(data) {
    const { queryString, values } = this.destructure(data);

    const [row] = await PScale.conn
      .promise()
      .execute(`INSERT INTO ${this._table} SET ${queryString}`, [...values]);

    return row?.[0] || null;
  }
}

export default BaseModel;
