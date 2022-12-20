import BaseModel from "./base.js";
import PScale from "../service/pscale.js";

class Asset extends BaseModel {
  constructor() {
    super();

    this._table = "Assets";
    this._idString = "id";

    this.validate();
  }

  // Group amount by address and return a map indexed by the address
  async amountByAddress() {
    const [row] = await PScale.conn
      .promise()
      .query(
        `SELECT address, sum(amount) FROM ${this._table} GROUP BY address`
      );

    const amountMap = {};
    for (const r of row) {
      amountMap[r.address] = r["sum(amount)"];
    }

    return amountMap;
  }
}

export default Asset;
