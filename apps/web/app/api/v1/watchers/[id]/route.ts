import { route } from "@/server/http";
import * as router from "@/server/modules/watchers/router";

export const DELETE = route(router.remove);
