import { route } from "@/server/http";
import * as router from "@/server/modules/tasks/router";

export const PATCH = route(router.update);
