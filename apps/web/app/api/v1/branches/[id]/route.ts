import { route } from "@/server/http";
import * as router from "@/server/modules/branches/router";

export const PATCH = route(router.update);
