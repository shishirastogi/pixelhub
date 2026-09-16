import { route } from "@/server/http";
import * as router from "@/server/modules/decisions/router";

export const PATCH = route(router.update);
