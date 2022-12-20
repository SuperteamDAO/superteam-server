import BaseModel from "./base.js";

class User extends BaseModel {
  constructor() {
    super();

    this._table = "Users";
    this._idString = "address";

    this.validate();
  }
}

export default User;
