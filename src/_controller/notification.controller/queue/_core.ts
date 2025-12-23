import { _post } from "./_post";
import { _get } from "./_get";
import { _delete } from "./_delete";
import { checkQueueRelated } from "./checkQueueRelated";
import { addMany } from "./addMany";

export const queue = {
  _post,
  _get,
  _delete,
  addMany,
  checkQueueRelated,
};
