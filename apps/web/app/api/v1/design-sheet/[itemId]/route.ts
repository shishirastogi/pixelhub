import { route } from "@/server/http";
import * as router from "@/server/modules/design-sheet/router";

export const PATCH = route(router.update);
export const DELETE = route(router.remove);
